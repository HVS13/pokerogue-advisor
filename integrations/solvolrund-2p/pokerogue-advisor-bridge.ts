/**
 * PokeRogue Advisor bridge for SolVolrund/pokerogue-2p-beta.
 *
 * Install with `node scripts/install-2p.mjs <game-root>` so the bridge and the
 * deterministic planner-evaluation export are applied together.
 *
 * The integration is read-only. It serializes decision state and never sends game inputs.
 */
import type { PlayerIndex } from "#app/battle-scene";
import { timedEventManager } from "#app/global-event-manager";
import { globalScene } from "#app/global-scene";
import {
  getCriticalCaptureChance,
  getPokeballCatchMultiplier,
  getPokeballName,
} from "#data/pokeball";
import { getStatusEffectCatchRateMultiplier } from "#data/status-effect";
import { MoveCategory } from "#enums/move-category";
import { PokeballType } from "#enums/pokeball";
import { StatusEffect } from "#enums/status-effect";
import { UiMode } from "#enums/ui-mode";
import type { EnemyPokemon, PlayerPokemon, Pokemon } from "#field/pokemon";
import type { CommandPhase } from "#phases/command-phase";
import { getPlannerAdvisorMoveEvaluations } from "#utils/battle-planner-ai";
import { estimateComputerPartnerMoveDamageRatio } from "#utils/computer-partner-capture-ai";

interface WireBattleMove {
  id: string;
  name: string;
  plannerScore: number;
  target?: string;
  reasons?: string[];
  warnings?: string[];
}

interface WireBattle {
  actorName: string;
  opponentNames: string[];
  moves: WireBattleMove[];
}

interface WireCaptureBall {
  id: string;
  name: string;
  multiplier: number;
  count: number;
  probability: number;
  resourceRank: number;
}

interface WireCapturePreparation {
  kind: "weaken" | "status";
  moveIndex: number;
  moveName: string;
  projectedBalls: WireCaptureBall[];
  successProbability: number;
  estimatedDamageRatio?: number;
  projectedHp?: number;
  statusName?: string;
  statusMultiplier?: number;
  warning?: string;
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
  activeHpRatio: number;
  balls: WireCaptureBall[];
  preparations: WireCapturePreparation[];
}

interface WireSnapshot {
  version: 1;
  context: "battle" | "capture" | "idle";
  battle?: WireBattle;
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
const MAX_SAFE_WEAKENING_DAMAGE_RATIO = 0.8;

const ADVISOR_BALL_TYPES = [
  PokeballType.POKEBALL,
  PokeballType.GREAT_BALL,
  PokeballType.ULTRA_BALL,
  PokeballType.ROGUE_BALL,
  PokeballType.MASTER_BALL,
] as const;

let cachedBattleKey: string | undefined;
let cachedBattle: WireBattle | undefined;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getSpeciesTypes(pokemon: EnemyPokemon | PlayerPokemon): number[] {
  const types = [pokemon.species.type1, pokemon.species.type2];
  return types.filter((type): type is NonNullable<typeof type> => type !== null).map(Number);
}

function buildPartyFacts(playerIndex: PlayerIndex): WireCapturePartyMember[] {
  return globalScene.getPlayerParty(playerIndex).map(pokemon => ({
    speciesId: pokemon.species.speciesId,
    name: pokemon.getNameToRender(),
    baseStatTotal: pokemon.species.getBaseStatTotal(),
    types: getSpeciesTypes(pokemon),
  }));
}

function getBattleTargetName(targetIndex: number, battlers: Pokemon[]): string {
  return battlers.find(pokemon => Number(pokemon.getBattlerIndex()) === targetIndex)?.getNameToRender()
    ?? `Target ${targetIndex}`;
}

function getPlannerReasonEntries(
  breakdown: ReturnType<typeof getPlannerAdvisorMoveEvaluations>[number]["breakdown"],
): string[] {
  if (!breakdown) return [];

  const entries: Array<[number, string]> = [
    [breakdown.attack, "Strong offensive value."],
    [breakdown.threat, "Reduces an immediate threat."],
    [breakdown.healing, "Useful recovery value."],
    [breakdown.setup, "Useful setup value."],
    [breakdown.sideSupport, "Supports your side."],
    [breakdown.enemyStatus, "Useful disruption/status pressure."],
    [breakdown.protect, "Defensive/protect value."],
    [breakdown.benefit, "Good overall move benefit."],
  ];

  return entries
    .filter(([score]) => score >= 8)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([, reason]) => reason);
}

function getBattleStateKey(commandPhase: CommandPhase, actor: PlayerPokemon): string {
  const battlers = [...globalScene.getPlayerField(), ...globalScene.getEnemyField()]
    .filter(pokemon => pokemon.isActive(true));
  const battlerState = battlers
    .map(pokemon => `${pokemon.id}:${pokemon.hp}:${pokemon.status?.effect ?? 0}`)
    .join(",");
  const moveState = actor.getMoveset()
    .map(move => `${move.moveId}:${move.ppUsed}`)
    .join(",");

  return [
    globalScene.currentBattle?.turn ?? -1,
    commandPhase.getFieldIndex(),
    actor.id,
    actor.hp,
    actor.status?.effect ?? 0,
    moveState,
    battlerState,
  ].join("|");
}

function getBattleState(): WireBattle | undefined {
  const mode = globalScene?.ui?.getMode();
  if (mode !== UiMode.COMMAND && mode !== UiMode.FIGHT) return;

  const currentPhase = globalScene.phaseManager.getCurrentPhase();
  if (!currentPhase?.is("CommandPhase")) return;

  const commandPhase = currentPhase as unknown as CommandPhase;
  const actor = commandPhase.getPokemon();
  const key = getBattleStateKey(commandPhase, actor);
  if (key === cachedBattleKey && cachedBattle) return cachedBattle;

  const movePool = actor.getMoveset().filter(move => move.isUsable(actor, false, true)?.[0] ?? false);
  const evaluations = getPlannerAdvisorMoveEvaluations(actor, movePool);
  const battlers = [...globalScene.getPlayerField(), ...globalScene.getEnemyField()]
    .filter(pokemon => pokemon.isActive(true));
  const opponents = globalScene.getEnemyField().filter(pokemon => pokemon.isActive(true) && !pokemon.isFainted());

  const battle: WireBattle = {
    actorName: actor.getNameToRender(),
    opponentNames: opponents.map(pokemon => pokemon.getNameToRender()),
    moves: evaluations.map(evaluation => {
      const targets = evaluation.targets.map(target => getBattleTargetName(Number(target), battlers));
      return {
        id: `${Number(evaluation.moveId)}:${evaluation.targets.map(Number).join("-")}`,
        name: evaluation.moveName,
        plannerScore: evaluation.score,
        ...(targets.length > 0 ? { target: targets.join(", ") } : {}),
        reasons: getPlannerReasonEntries(evaluation.breakdown),
        ...(evaluation.result?.toLowerCase().includes("waste")
          ? { warnings: ["Planner detected a possible wasted-turn outcome."] }
          : {}),
      };
    }),
  };

  cachedBattleKey = key;
  cachedBattle = battle;
  return battle;
}

function getModifiedCatchRate(
  target: EnemyPokemon,
  ballType: PokeballType,
  hp = target.hp,
  statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1,
): number {
  const maxHp = target.getMaxHp();
  if (maxHp <= 0) return 0;

  const hpFactor = Math.max(3 * maxHp - 2 * hp, 1) / (3 * maxHp);
  const ballMultiplier = getPokeballCatchMultiplier(ballType);
  const shinyMultiplier = target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1;

  return Math.round(
    hpFactor
      * target.species.catchRate
      * ballMultiplier
      * statusMultiplier
      * shinyMultiplier,
  );
}

function getExactCatchProbability(
  target: EnemyPokemon,
  ballType: PokeballType,
  playerIndex: PlayerIndex,
  hp = target.hp,
  statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1,
): number {
  const ballMultiplier = getPokeballCatchMultiplier(ballType);
  if (ballMultiplier === -1) return 1;

  const modifiedCatchRate = getModifiedCatchRate(target, ballType, hp, statusMultiplier);
  if (modifiedCatchRate >= 255) return 1;
  if (modifiedCatchRate <= 0) return 0;

  const shakeProbability = Math.round(65536 / Math.pow(255 / modifiedCatchRate, 0.1875));
  const shakeChance = clamp01(shakeProbability / 65536);
  const criticalChance = clamp01(getCriticalCaptureChance(modifiedCatchRate, playerIndex) / 256);

  return criticalChance * shakeChance + (1 - criticalChance) * Math.pow(shakeChance, 3);
}

function buildBalls(
  target: EnemyPokemon,
  counts: ReturnType<typeof globalScene.getPlayerPokeballCounts>,
  playerIndex: PlayerIndex,
  hp = target.hp,
  statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1,
): WireCaptureBall[] {
  return ADVISOR_BALL_TYPES.flatMap(ballType => {
    const count = Number(counts[ballType] ?? 0);
    if (count <= 0) return [];

    return [{
      id: String(ballType),
      name: getPokeballName(ballType),
      multiplier: getPokeballCatchMultiplier(ballType),
      count,
      probability: getExactCatchProbability(target, ballType, playerIndex, hp, statusMultiplier),
      resourceRank: ballType,
    }];
  });
}

function getMoveHitProbability(accuracy: number): number {
  return accuracy <= 0 ? 1 : clamp01(accuracy / 100);
}

function getStatusName(effect: StatusEffect): string {
  return StatusEffect[effect]
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function buildWeakeningPreparations(
  activePokemon: PlayerPokemon,
  target: EnemyPokemon,
  counts: ReturnType<typeof globalScene.getPlayerPokeballCounts>,
  playerIndex: PlayerIndex,
): WireCapturePreparation[] {
  return activePokemon
    .getMoveset()
    .map((pokemonMove, moveIndex) => {
      const move = pokemonMove.getMove();
      const isUsable = pokemonMove.isUsable(activePokemon, false, true)?.[0] ?? false;
      if (!isUsable || pokemonMove.isOutOfPp() || move.category === MoveCategory.STATUS) return;

      const damageRatio = estimateComputerPartnerMoveDamageRatio(activePokemon, target, move);
      if (damageRatio <= 0 || damageRatio >= MAX_SAFE_WEAKENING_DAMAGE_RATIO) return;

      const projectedHp = Math.max(1, Math.round(target.hp * (1 - damageRatio)));
      return {
        kind: "weaken" as const,
        moveIndex,
        moveName: move.name,
        projectedBalls: buildBalls(target, counts, playerIndex, projectedHp),
        successProbability: getMoveHitProbability(move.accuracy),
        estimatedDamageRatio: damageRatio,
        projectedHp,
        warning: "Damage is a rough non-critical estimate; unusual modifiers can change the real result.",
      };
    })
    .filter((option): option is NonNullable<typeof option> => option !== undefined)
    .sort((a, b) => b.estimatedDamageRatio - a.estimatedDamageRatio)
    .slice(0, 2);
}

function buildStatusPreparations(
  activePokemon: PlayerPokemon,
  target: EnemyPokemon,
  counts: ReturnType<typeof globalScene.getPlayerPokeballCounts>,
  playerIndex: PlayerIndex,
): WireCapturePreparation[] {
  if (target.status) return [];

  const candidates: WireCapturePreparation[] = [];
  for (const [moveIndex, pokemonMove] of activePokemon.getMoveset().entries()) {
    const move = pokemonMove.getMove();
    const isUsable = pokemonMove.isUsable(activePokemon, false, true)?.[0] ?? false;
    if (!isUsable || pokemonMove.isOutOfPp() || move.category !== MoveCategory.STATUS) continue;

    const statusEffects = [
      ...move.getAttrs("StatusEffectAttr")
        .filter(attr => !attr.selfTarget)
        .map(attr => ({ effect: attr.effect, effectChance: attr.getMoveChance(activePokemon, target, move, false, false) })),
      ...move.getAttrs("MultiStatusEffectAttr")
        .filter(attr => !attr.selfTarget)
        .flatMap(attr => attr.effects.map(effect => ({
          effect,
          effectChance: attr.getMoveChance(activePokemon, target, move, false, false),
        }))),
    ]
      .filter(candidate => target.canSetStatus(candidate.effect, true, false, activePokemon))
      .map(candidate => ({
        ...candidate,
        multiplier: getStatusEffectCatchRateMultiplier(candidate.effect),
      }))
      .filter(candidate => candidate.multiplier > 1)
      .sort((a, b) => b.multiplier - a.multiplier || b.effectChance - a.effectChance);

    const bestStatus = statusEffects[0];
    if (!bestStatus) continue;

    const effectProbability = bestStatus.effectChance < 0 ? 1 : clamp01(bestStatus.effectChance / 100);
    const successProbability = getMoveHitProbability(move.accuracy) * effectProbability;
    candidates.push({
      kind: "status",
      moveIndex,
      moveName: move.name,
      statusName: getStatusName(bestStatus.effect),
      statusMultiplier: bestStatus.multiplier,
      successProbability,
      projectedBalls: buildBalls(target, counts, playerIndex, target.hp, bestStatus.multiplier),
    });
  }

  return candidates
    .sort((a, b) =>
      (b.statusMultiplier ?? 1) * b.successProbability - (a.statusMultiplier ?? 1) * a.successProbability,
    )
    .slice(0, 2);
}

function getCaptureTargets(): WireCaptureTarget[] | undefined {
  if (!globalScene?.ui || globalScene.ui.getMode() !== UiMode.BALL) return;

  const currentPhase = globalScene.phaseManager.getCurrentPhase();
  if (!currentPhase?.is("CommandPhase")) return;

  const commandPhase = currentPhase as unknown as CommandPhase;
  const playerIndex = globalScene.getPlayerIndexForFieldSlot(commandPhase.getFieldIndex());
  const counts = globalScene.getPlayerPokeballCounts(playerIndex);
  const activePokemon = commandPhase.getPokemon();
  const party = buildPartyFacts(playerIndex);
  const partyCapacity = globalScene.twoPlayerMode ? globalScene.twoPlayerPartySize : 6;
  const targets = globalScene
    .getEnemyField()
    .filter(target => target.isActive(true) && !target.isFainted());

  if (targets.length === 0) return [];

  return targets.map(target => {
    const statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1;
    const shinyMultiplier = target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1;

    return {
      targetId: target.id,
      targetSpeciesId: target.species.speciesId,
      speciesName: target.getNameToRender(),
      hp: target.hp,
      maxHp: target.getMaxHp(),
      catchRate: target.species.catchRate,
      statusMultiplier,
      shinyMultiplier,
      isShiny: target.isShiny(),
      targetBaseStatTotal: target.species.getBaseStatTotal(),
      targetTypes: getSpeciesTypes(target),
      party,
      partyCapacity,
      activeHpRatio: activePokemon.getHpRatio(),
      balls: buildBalls(target, counts, playerIndex),
      preparations: [
        ...buildWeakeningPreparations(activePokemon, target, counts, playerIndex),
        ...buildStatusPreparations(activePokemon, target, counts, playerIndex),
      ],
    };
  });
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

    const battle = getBattleState();
    if (battle) {
      return {
        version: 1,
        context: "battle",
        battle,
        generatedAt: Date.now(),
      };
    }

    return {
      version: 1,
      context: "idle",
      notice: "Open a battle command or Poké Ball menu to see live advice.",
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.warn("[PokeRogue Advisor] Failed to build snapshot", error);
    return {
      version: 1,
      context: "idle",
      notice: "Advisor integration is installed, but decision state is not ready yet.",
      generatedAt: Date.now(),
    };
  }
}

function postSnapshot(snapshot: WireSnapshot): void {
  window.postMessage(
    {
      source: RESPONSE_SOURCE,
      type: "snapshot",
      snapshot,
    },
    window.location.origin,
  );
}

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as Partial<AdvisorRequestMessage> | undefined;
  if (data?.source !== REQUEST_SOURCE || data.type !== "request-snapshot") return;
  postSnapshot(buildSnapshot());
});

console.info("[PokeRogue Advisor] 2P battle/capture bridge installed");
