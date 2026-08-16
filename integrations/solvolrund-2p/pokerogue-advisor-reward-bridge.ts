/**
 * Reward/shop sidecar for the SolVolrund 2P advisor integration.
 *
 * It responds only while SelectModifierPhase is showing MODIFIER_SELECT.
 * Reward scoring may use random target fallbacks internally, so every advisor
 * scoring call snapshots and restores Phaser.Math.RND state.
 */
import { globalScene } from "#app/global-scene";
import { activeOverrides } from "#app/overrides";
import { UiMode } from "#enums/ui-mode";
import type { PlayerIndex } from "#app/battle-scene";
import type { PlayerPokemon } from "#field/pokemon";
import { HealShopCostModifier } from "#modifiers/modifier";
import {
  getPlayerShopModifierTypeOptionsForWave,
  ModifierTypeOption,
  type ModifierTypeOption as ModifierTypeOptionType,
} from "#modifiers/modifier-type";
import {
  chooseComputerPartnerRewardOption,
  getComputerPartnerShopReserve,
  scoreComputerPartnerRecoveryOption,
  type ComputerPartnerRecoveryChoice,
  type ComputerPartnerRewardChoice,
} from "#utils/computer-partner-reward-ai";
import { NumberHolder } from "#utils/common";
import Phaser from "phaser";

interface WireChoice {
  id: string;
  name: string;
  score: number;
  reason?: string;
  cost?: number;
  target?: string;
  emergency?: boolean;
  reserveCost?: number;
  moneyAfterPurchase?: number;
}

interface WireRewardShopSnapshot {
  version: 1;
  context: "reward-shop";
  rewards: WireChoice[];
  shop: WireChoice[];
  shopMoney: number;
  shopReserve: number;
  generatedAt: number;
}

interface AdvisorRequestMessage {
  source: "pokerogue-advisor-extension";
  type: "request-snapshot";
}

interface RewardPhaseView {
  typeOptions?: ModifierTypeOptionType[];
  playerIndex?: PlayerIndex;
}

const REQUEST_SOURCE = "pokerogue-advisor-extension";
const RESPONSE_SOURCE = "pokerogue-advisor-game";

let cachedKey: string | undefined;
let cachedSnapshot: Omit<WireRewardShopSnapshot, "generatedAt"> | undefined;

function withRngPreserved<T>(callback: () => T): T {
  const state = Phaser.Math.RND.state();
  try {
    return callback();
  } finally {
    Phaser.Math.RND.state(state);
  }
}

function getTargetLabel(
  choice: Pick<ComputerPartnerRecoveryChoice | ComputerPartnerRewardChoice, "targetPokemonIndex" | "targetMoveIndex">,
  party: PlayerPokemon[],
): string | undefined {
  if (choice.targetPokemonIndex === undefined) return;
  const pokemon = party[choice.targetPokemonIndex];
  if (!pokemon) return;

  const pokemonName = pokemon.getNameToRender();
  if (choice.targetMoveIndex === undefined) return pokemonName;
  const moveName = pokemon.getMoveset()[choice.targetMoveIndex]?.getMove().name;
  return moveName ? `${pokemonName} · ${moveName}` : pokemonName;
}

function getAdjustedShopOptions(playerIndex: PlayerIndex): ModifierTypeOption[] {
  return getPlayerShopModifierTypeOptionsForWave(
    globalScene.currentBattle.waveIndex,
    globalScene.getWaveMoneyAmount(1),
  ).map(option => {
    const healingItemCost = new NumberHolder(option.cost);
    globalScene.applyModifierForPlayer(HealShopCostModifier, playerIndex, healingItemCost);
    return new ModifierTypeOption(option.type, option.upgradeCount, healingItemCost.value);
  });
}

function buildRewardChoices(
  options: ModifierTypeOptionType[],
  party: PlayerPokemon[],
  playerIndex: PlayerIndex,
): WireChoice[] {
  const context = { pokeballCounts: globalScene.getPlayerPokeballCounts(playerIndex) };

  return options.flatMap((option, optionIndex) => {
    const choice = withRngPreserved(() => chooseComputerPartnerRewardOption([option], party, context));
    if (!choice) return [];
    const target = getTargetLabel(choice, party);

    return [{
      id: `${optionIndex}:${choice.itemId}`,
      name: option.type.name,
      score: choice.score,
      reason: choice.reason,
      ...(target ? { target } : {}),
    }];
  });
}

function buildShopChoices(
  options: ModifierTypeOptionType[],
  party: PlayerPokemon[],
  eligibilityMoney: number,
  actualMoney: number,
  reserveCost: number,
  waiveCost: boolean,
): WireChoice[] {
  return options.flatMap((option, optionIndex) => {
    const choice = scoreComputerPartnerRecoveryOption(option, optionIndex, party);
    if (!choice || choice.cost > eligibilityMoney) return [];
    if (!choice.isEmergency && eligibilityMoney - choice.cost < reserveCost) return [];
    const target = getTargetLabel(choice, party);

    return [{
      id: `${optionIndex}:${choice.itemId}`,
      name: option.type.name,
      score: choice.score,
      reason: waiveCost ? `${choice.reason}; purchase cost is waived by the active override` : choice.reason,
      cost: waiveCost ? 0 : choice.cost,
      emergency: choice.isEmergency,
      reserveCost,
      moneyAfterPurchase: waiveCost ? actualMoney : actualMoney - choice.cost,
      ...(target ? { target } : {}),
    }];
  });
}

function getPartyStateKey(party: PlayerPokemon[]): string {
  return party.map(pokemon => {
    const moveState = pokemon.getMoveset().map(move => `${move.moveId}:${move.ppUsed}`).join(",");
    return `${pokemon.id}:${pokemon.hp}:${pokemon.status?.effect ?? 0}:${moveState}`;
  }).join("|");
}

function buildRewardShopSnapshot(): WireRewardShopSnapshot | undefined {
  if (globalScene?.ui?.getMode() !== UiMode.MODIFIER_SELECT) return;

  const currentPhase = globalScene.phaseManager.getCurrentPhase();
  if (!currentPhase?.is("SelectModifierPhase")) return;

  const phase = currentPhase as unknown as RewardPhaseView;
  if (!Array.isArray(phase.typeOptions) || phase.playerIndex === undefined) return;

  const playerIndex = phase.playerIndex;
  const party = globalScene.getPlayerParty(playerIndex);
  const realMoney = globalScene.getPlayerMoney(playerIndex);
  const waiveCost = activeOverrides.WAIVE_ROLL_FEE_OVERRIDE;
  const eligibilityMoney = waiveCost ? Number.MAX_SAFE_INTEGER : realMoney;
  const shopOptions = getAdjustedShopOptions(playerIndex);
  const reserveCost = getComputerPartnerShopReserve(shopOptions);
  const rewardOptionKey = phase.typeOptions.map(option => `${option.type.id ?? option.type.name}:${option.type.tier ?? -1}`).join(",");
  const shopOptionKey = shopOptions.map(option => `${option.type.id ?? option.type.name}:${option.cost}`).join(",");
  const key = [
    globalScene.currentBattle.waveIndex,
    playerIndex,
    realMoney,
    waiveCost ? 1 : 0,
    rewardOptionKey,
    shopOptionKey,
    getPartyStateKey(party),
  ].join("|");

  if (key === cachedKey && cachedSnapshot) {
    return { ...cachedSnapshot, generatedAt: Date.now() };
  }

  const base: Omit<WireRewardShopSnapshot, "generatedAt"> = {
    version: 1,
    context: "reward-shop",
    rewards: buildRewardChoices(phase.typeOptions, party, playerIndex),
    shop: buildShopChoices(shopOptions, party, eligibilityMoney, realMoney, reserveCost, waiveCost),
    shopMoney: realMoney,
    shopReserve: reserveCost,
  };

  cachedKey = key;
  cachedSnapshot = base;
  return { ...base, generatedAt: Date.now() };
}

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as Partial<AdvisorRequestMessage> | undefined;
  if (data?.source !== REQUEST_SOURCE || data.type !== "request-snapshot") return;

  const snapshot = buildRewardShopSnapshot();
  if (!snapshot) return;
  window.postMessage({ source: RESPONSE_SOURCE, type: "snapshot", snapshot }, window.location.origin);
});

console.info("[PokeRogue Advisor] 2P reward/shop bridge installed");
