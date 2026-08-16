declare module "#app/constants" { export const PLAYER_PARTY_MAX_SIZE: number; }
declare module "#app/global-event-manager" { export const timedEventManager: { getShinyCatchMultiplier(): number }; }
declare module "#enums/pokeball" { export enum PokeballType { POKEBALL, GREAT_BALL, ULTRA_BALL, ROGUE_BALL, MASTER_BALL, LUXURY_BALL } }
declare module "#enums/ui-mode" { export enum UiMode { MESSAGE, TITLE, COMMAND, FIGHT, BALL } }
declare module "#data/pokeball" {
  import type { PokeballType } from "#enums/pokeball";
  export function getCriticalCaptureChance(modifiedCatchRate: number): number;
  export function getPokeballCatchMultiplier(type: PokeballType): number;
  export function getPokeballName(type: PokeballType): string;
}
declare module "#data/status-effect" { export function getStatusEffectCatchRateMultiplier(effect: number): number; }
declare module "#field/pokemon" {
  export interface StubSpecies { speciesId: number; catchRate: number; type1: number; type2: number | null; getBaseStatTotal(): number; }
  export interface PlayerPokemon { id: number; species: StubSpecies; getNameToRender(): string; }
  export interface EnemyPokemon { id: number; hp: number; status: { effect: number } | null; species: StubSpecies; getMaxHp(): number; isShiny(): boolean; isFainted(): boolean; getNameToRender(): string; }
}
declare module "#app/global-scene" {
  import type { PokeballType } from "#enums/pokeball";
  import type { EnemyPokemon, PlayerPokemon } from "#field/pokemon";
  export const globalScene: {
    ui: { getMode(): number };
    pokeballCounts: Partial<Record<PokeballType, number>>;
    getPlayerParty(): PlayerPokemon[];
    getEnemyField(active?: boolean): EnemyPokemon[];
  };
}
