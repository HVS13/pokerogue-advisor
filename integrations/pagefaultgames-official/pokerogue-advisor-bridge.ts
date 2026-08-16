/**
 * Capture-only PokeRogue Advisor bridge for pagefaultgames/pokerogue.
 *
 * This adapter is intentionally thin. It reads official live capture state and
 * emits the same AdvisorSnapshot shape used by the 2P adapter. It never sends inputs.
 */
import { PLAYER_PARTY_MAX_SIZE } from "#app/constants";
import { timedEventManager } from "#app/global-event-manager";
import { globalScene } from "#app/global-scene";
import {
  getCriticalCaptureChance,
  getPokeballCatchMultiplier,
  getPokeballName,
} from "#data/pokeball";
import { getStatusEffectCatchRateMultiplier } from "#data/status-effect";
import { PokeballType } from "#enums/pokeball";
import { UiMode } from "#enums/ui-mode";
import type { EnemyPokemon, PlayerPokemon } from "#field/pokemon";

interface WireCaptureBall {
  id: string;
  name: string;
  multiplier: number;
  count: number;
  probability: number;
  resourceRank: number;
}

interface WireCapturePartyMember {
  speciesId: number;
  name: string;
  baseStatTotal: number;
  types: number[];
}

interface WireCaptureTarget {
  targetId: number;
  targetSpeciesId: number;
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
  isShiny: boolean;
  targetBaseStatTotal: number;
  targetTypes: number[];
  party: WireCapturePartyMember[];
  partyCapacity: number;
  balls: WireCaptureBall[];
}

interface WireSnapshot {
  version: 1;
  context: "capture" | "idle";
  captureTargets?: WireCaptureTarget[];
  notice?: string;
  generatedAt: number;
}

interface AdvisorRequestMessage {
  source: "pokerogue-advisor-extension";
  type: "request-snapshot";
}

const REQUEST_SOURCE = "pokerogue-advisor-extension";
const RESPONSE_SOURCE = "pokerogue-advisor-game";

const ADVISOR_BALL_TYPES = [
  PokeballType.POKEBALL,
  PokeballType.GREAT_BALL,
  PokeballType.ULTRA_BALL,
  PokeballType.ROGUE_BALL,
  PokeballType.MASTER_BALL,
] as const;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getSpeciesTypes(pokemon: EnemyPokemon | PlayerPokemon): number[] {
  const types = [pokemon.species.type1, pokemon.species.type2];
  return types.filter((type): type is NonNullable<typeof type> => type !== null).map(Number);
}

function buildPartyFacts(): WireCapturePartyMember[] {
  return globalScene.getPlayerParty().map(pokemon => ({
    speciesId: pokemon.species.speciesId,
    name: pokemon.getNameToRender(),
    baseStatTotal: pokemon.species.getBaseStatTotal(),
    types: getSpeciesTypes(pokemon),
  }));
}

function getModifiedCatchRate(
  target: EnemyPokemon,
  ballType: PokeballType,
): number {
  const maxHp = target.getMaxHp();
  if (maxHp <= 0) return 0;

  const statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1;
  const shinyMultiplier = target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1;
  return Math.round(
    (((3 * maxHp - 2 * target.hp) * target.species.catchRate * getPokeballCatchMultiplier(ballType)) / (3 * maxHp))
      * statusMultiplier
      * shinyMultiplier,
  );
}

function getExactCatchProbability(target: EnemyPokemon, ballType: PokeballType): number {
  const ballMultiplier = getPokeballCatchMultiplier(ballType);
  if (ballMultiplier === -1) return 1;

  const modifiedCatchRate = getModifiedCatchRate(target, ballType);
  if (modifiedCatchRate >= 255) return 1;
  if (modifiedCatchRate <= 0) return 0;

  const shakeProbability = Math.round(65536 / Math.pow(255 / modifiedCatchRate, 0.1875));
  const shakeChance = clamp01(shakeProbability / 65536);
  const criticalChance = clamp01(getCriticalCaptureChance(modifiedCatchRate) / 256);
  return criticalChance * shakeChance + (1 - criticalChance) * Math.pow(shakeChance, 3);
}

function buildBalls(target: EnemyPokemon): WireCaptureBall[] {
  return ADVISOR_BALL_TYPES.flatMap(ballType => {
    const count = Number(globalScene.pokeballCounts[ballType] ?? 0);
    if (count <= 0) return [];

    return [{
      id: String(ballType),
      name: getPokeballName(ballType),
      multiplier: getPokeballCatchMultiplier(ballType),
      count,
      probability: getExactCatchProbability(target, ballType),
      resourceRank: ballType,
    }];
  });
}

function getCaptureTargets(): WireCaptureTarget[] | undefined {
  if (!globalScene?.ui || globalScene.ui.getMode() !== UiMode.BALL) return;

  const targets = globalScene.getEnemyField(true).filter(target => !target.isFainted());
  if (targets.length === 0) return [];

  const party = buildPartyFacts();
  return targets.map(target => ({
    targetId: target.id,
    targetSpeciesId: target.species.speciesId,
    speciesName: target.getNameToRender(),
    hp: target.hp,
    maxHp: target.getMaxHp(),
    catchRate: target.species.catchRate,
    statusMultiplier: target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1,
    shinyMultiplier: target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1,
    isShiny: target.isShiny(),
    targetBaseStatTotal: target.species.getBaseStatTotal(),
    targetTypes: getSpeciesTypes(target),
    party,
    partyCapacity: PLAYER_PARTY_MAX_SIZE,
    balls: buildBalls(target),
  }));
}

function buildSnapshot(): WireSnapshot {
  try {
    const captureTargets = getCaptureTargets();
    if (captureTargets) {
      return {
        version: 1,
        context: "capture",
        captureTargets,
        generatedAt: Date.now(),
      };
    }

    return {
      version: 1,
      context: "idle",
      notice: "Open the Poké Ball menu to see official PokeRogue capture advice.",
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.warn("[PokeRogue Advisor] Official capture snapshot failed", error);
    return {
      version: 1,
      context: "idle",
      notice: "Official PokeRogue adapter is installed, but capture state is not ready yet.",
      generatedAt: Date.now(),
    };
  }
}

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as Partial<AdvisorRequestMessage> | undefined;
  if (data?.source !== REQUEST_SOURCE || data.type !== "request-snapshot") return;

  window.postMessage(
    { source: RESPONSE_SOURCE, type: "snapshot", snapshot: buildSnapshot() },
    window.location.origin,
  );
});

console.info("[PokeRogue Advisor] Official capture bridge installed");
