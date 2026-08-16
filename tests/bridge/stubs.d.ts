declare module "#app/battle-scene" { export type PlayerIndex = 0 | 1 | 2; }
declare module "#app/global-event-manager" { export const timedEventManager: { getShinyCatchMultiplier(): number }; }
declare module "#enums/pokeball" { export enum PokeballType { POKEBALL, GREAT_BALL, ULTRA_BALL, ROGUE_BALL, MASTER_BALL, LUXURY_BALL, GLASS_BALL } }
declare module "#enums/ui-mode" { export enum UiMode { MESSAGE, TITLE, COMMAND, FIGHT, BALL } }
declare module "#enums/move-category" { export enum MoveCategory { PHYSICAL, SPECIAL, STATUS } }
declare module "#enums/status-effect" { export enum StatusEffect { NONE, SLEEP, POISON, TOXIC, PARALYSIS, BURN, FREEZE, FAINT } }
declare module "#data/pokeball" { import type { PlayerIndex } from "#app/battle-scene"; import type { PokeballType } from "#enums/pokeball"; export function getCriticalCaptureChance(modifiedCatchRate: number, playerIndex?: PlayerIndex): number; export function getPokeballCatchMultiplier(type: PokeballType): number; export function getPokeballName(type: PokeballType): string; }
declare module "#data/status-effect" { import type { StatusEffect } from "#enums/status-effect"; export function getStatusEffectCatchRateMultiplier(effect: StatusEffect): number; }
declare module "#field/pokemon" {
  import type { MoveCategory } from "#enums/move-category";
  import type { StatusEffect } from "#enums/status-effect";
  export interface StubMoveAttr { selfTarget: boolean; effect: StatusEffect; effects: StatusEffect[]; getMoveChance(user: PlayerPokemon, target: EnemyPokemon, move: StubMove, selfEffect?: boolean, showAbility?: boolean): number; }
  export interface StubMove { name: string; category: MoveCategory; accuracy: number; getAttrs(type: string): StubMoveAttr[]; }
  export interface StubPokemonMove { getMove(): StubMove; isUsable(user: PlayerPokemon, ignorePp?: boolean, ignoreRestriction?: boolean): [boolean, string?]; isOutOfPp(): boolean; }
  export interface PlayerPokemon { getMoveset(): StubPokemonMove[]; getHpRatio(): number; }
  export interface EnemyPokemon { id: number; hp: number; status: { effect: StatusEffect } | null; species: { catchRate: number }; getMaxHp(): number; isShiny(): boolean; isActive(check?: boolean): boolean; isFainted(): boolean; getNameToRender(): string; canSetStatus(effect: StatusEffect, quiet?: boolean, overrideStatus?: boolean, sourcePokemon?: PlayerPokemon | null, ignoreField?: boolean): boolean; }
}
declare module "#utils/computer-partner-capture-ai" { import type { EnemyPokemon, PlayerPokemon, StubMove } from "#field/pokemon"; export function estimateComputerPartnerMoveDamageRatio(attacker: PlayerPokemon, target: EnemyPokemon, move: StubMove): number; }
declare module "#phases/command-phase" { import type { PlayerPokemon } from "#field/pokemon"; export interface CommandPhase { getFieldIndex(): number; getPokemon(): PlayerPokemon; } }
declare module "#app/global-scene" { import type { PlayerIndex } from "#app/battle-scene"; import type { PokeballType } from "#enums/pokeball"; import type { EnemyPokemon } from "#field/pokemon"; export const globalScene: { ui: { getMode(): number }; phaseManager: { getCurrentPhase(): { is(name: string): boolean; getFieldIndex?: () => number } }; getPlayerIndexForFieldSlot(index: number): PlayerIndex; getPlayerPokeballCounts(index: PlayerIndex): Partial<Record<PokeballType, number>>; getEnemyField(): EnemyPokemon[]; }; }
