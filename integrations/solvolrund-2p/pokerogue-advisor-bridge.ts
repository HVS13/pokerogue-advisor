/**
 * PokeRogue Advisor bridge for SolVolrund/pokerogue-2p-beta.
 *
 * Copy this file to `pokerogue-beta/src/pokerogue-advisor-bridge.ts` and import it once from `src/main.ts`.
 * It is read-only: it serializes capture-menu state and never sends game inputs.
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
import type { EnemyPokemon, PlayerPokemon } from "#field/pokemon";
import type { CommandPhase } from "#phases/command-phase";
import { estimateComputerPartnerMoveDamageRatio } from "#utils/computer-partner-capture-ai";

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

interface WireCaptureTarget {
  targetId: number;
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
  isShiny: boolean;
  activeHpRatio: number;
  balls: WireCaptureBall[];
  preparations: WireCapturePreparation[];
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
const MAX_SAFE_WEAKENING_DAMAGE_RATIO = 0.8;

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
    .filter((option): option is WireCapturePreparation => !!option)
    .sort((a, b) => (b.estimatedDamageRatio ?? 0) - (a.estimatedDamageRatio ?? 0))
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

  const commandPhase = currentPhase as CommandPhase;
  const playerIndex = globalScene.getPlayerIndexForFieldSlot(commandPhase.getFieldIndex());
  const counts = globalScene.getPlayerPokeballCounts(playerIndex);
  const activePokemon = commandPhase.getPokemon();
  const targets = globalScene
    .getEnemyField()
    .filter(target => target.isActive(true) && !target.isFainted());

  if (targets.length === 0) return [];

  return targets.map(target => {
    const statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1;
    const shinyMultiplier = target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1;

    return {
      targetId: target.id,
      speciesName: target.getNameToRender(),
      hp: target.hp,
      maxHp: target.getMaxHp(),
      catchRate: target.species.catchRate,
      statusMultiplier,
      shinyMultiplier,
      isShiny: target.isShiny(),
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

    return {
      version: 1,
      context: "idle",
      notice: "Open the Poké Ball menu to see live capture advice.",
      generatedAt: Date.now(),
    };
  } catch (error) {
    console.warn("[PokeRogue Advisor] Failed to build snapshot", error);
    return {
      version: 1,
      context: "idle",
      notice: "Advisor bridge is installed, but capture state is not ready yet.",
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

console.info("[PokeRogue Advisor] 2P capture bridge installed");
