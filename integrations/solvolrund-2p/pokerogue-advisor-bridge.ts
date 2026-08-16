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
import { PokeballType } from "#enums/pokeball";
import { UiMode } from "#enums/ui-mode";
import type { EnemyPokemon } from "#field/pokemon";
import type { CommandPhase } from "#phases/command-phase";

interface WireCaptureBall {
  id: string;
  name: string;
  multiplier: number;
  count: number;
  probability: number;
}

interface WireCaptureTarget {
  targetId: number;
  speciesName: string;
  hp: number;
  maxHp: number;
  catchRate: number;
  statusMultiplier: number;
  shinyMultiplier: number;
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

function getModifiedCatchRate(target: EnemyPokemon, ballType: PokeballType): number {
  const maxHp = target.getMaxHp();
  if (maxHp <= 0) return 0;

  const hpFactor = Math.max(3 * maxHp - 2 * target.hp, 1) / (3 * maxHp);
  const statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1;
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

function getExactCatchProbability(target: EnemyPokemon, ballType: PokeballType, playerIndex: PlayerIndex): number {
  const ballMultiplier = getPokeballCatchMultiplier(ballType);
  if (ballMultiplier === -1) return 1;

  const modifiedCatchRate = getModifiedCatchRate(target, ballType);
  if (modifiedCatchRate >= 255) return 1;
  if (modifiedCatchRate <= 0) return 0;

  const shakeProbability = Math.round(65536 / Math.pow(255 / modifiedCatchRate, 0.1875));
  const shakeChance = clamp01(shakeProbability / 65536);
  const criticalChance = clamp01(getCriticalCaptureChance(modifiedCatchRate, playerIndex) / 256);

  return criticalChance * shakeChance + (1 - criticalChance) * Math.pow(shakeChance, 3);
}

function getCaptureTargets(): WireCaptureTarget[] | undefined {
  if (!globalScene?.ui || globalScene.ui.getMode() !== UiMode.BALL) return;

  const currentPhase = globalScene.phaseManager.getCurrentPhase();
  if (!currentPhase?.is("CommandPhase")) return;

  const commandPhase = currentPhase as CommandPhase;
  const playerIndex = globalScene.getPlayerIndexForFieldSlot(commandPhase.getFieldIndex());
  const counts = globalScene.getPlayerPokeballCounts(playerIndex);
  const targets = globalScene
    .getEnemyField()
    .filter(target => target.isActive(true) && !target.isFainted());

  if (targets.length === 0) return [];

  return targets.map(target => {
    const statusMultiplier = target.status ? getStatusEffectCatchRateMultiplier(target.status.effect) : 1;
    const shinyMultiplier = target.isShiny() ? timedEventManager.getShinyCatchMultiplier() : 1;
    const balls = ADVISOR_BALL_TYPES.flatMap(ballType => {
      const count = Number(counts[ballType] ?? 0);
      if (count <= 0) return [];

      return [{
        id: String(ballType),
        name: getPokeballName(ballType),
        multiplier: getPokeballCatchMultiplier(ballType),
        count,
        probability: getExactCatchProbability(target, ballType, playerIndex),
      }];
    });

    return {
      targetId: target.id,
      speciesName: target.getNameToRender(),
      hp: target.hp,
      maxHp: target.getMaxHp(),
      catchRate: target.species.catchRate,
      statusMultiplier,
      shinyMultiplier,
      balls,
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
      notice: "Open the Poké Ball menu to see live catch percentages.",
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
