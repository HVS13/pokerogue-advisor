declare module "phaser" {
  const Phaser: { Math: { RND: { state(value?: string): string } } };
  export default Phaser;
}
declare module "#app/battle-scene" { export type PlayerIndex = 0 | 1 | 2; }
declare module "#app/global-event-manager" { export const timedEventManager: { getShinyCatchMultiplier(): number }; }
declare module "#app/overrides" { export const activeOverrides: { WAIVE_ROLL_FEE_OVERRIDE: boolean }; }
declare module "#enums/pokeball" { export enum PokeballType { POKEBALL, GREAT_BALL, ULTRA_BALL, ROGUE_BALL, MASTER_BALL, LUXURY_BALL, GLASS_BALL } }
declare module "#enums/ui-mode" { export enum UiMode { MESSAGE, TITLE, COMMAND, FIGHT, BALL, TARGET_SELECT, MODIFIER_SELECT } }
declare module "#enums/move-category" { export enum MoveCategory { PHYSICAL, SPECIAL, STATUS } }
declare module "#enums/status-effect" { export enum StatusEffect { NONE, SLEEP, POISON, TOXIC, PARALYSIS, BURN, FREEZE, FAINT } }
declare module "#data/pokeball" { import type { PlayerIndex } from "#app/battle-scene"; import type { PokeballType } from "#enums/pokeball"; export function getCriticalCaptureChance(modifiedCatchRate: number, playerIndex?: PlayerIndex): number; export function getPokeballCatchMultiplier(type: PokeballType): number; export function getPokeballName(type: PokeballType): string; }
declare module "#data/status-effect" { import type { StatusEffect } from "#enums/status-effect"; export function getStatusEffectCatchRateMultiplier(effect: StatusEffect): number; }
declare module "#field/pokemon" {
  import type { MoveCategory } from "#enums/move-category";
  import type { StatusEffect } from "#enums/status-effect";
  export interface StubSpecies { speciesId: number; catchRate: number; type1: number; type2: number | null; getBaseStatTotal(): number; }
  export interface StubMoveAttr { selfTarget: boolean; effect: StatusEffect; effects: StatusEffect[]; getMoveChance(user: PlayerPokemon, target: EnemyPokemon, move: StubMove, selfEffect?: boolean, showAbility?: boolean): number; }
  export interface StubMove { name: string; category: MoveCategory; accuracy: number; getAttrs(type: string): StubMoveAttr[]; }
  export interface StubPokemonMove { moveId: number; ppUsed: number; getMove(): StubMove; isUsable(user: PlayerPokemon, ignorePp?: boolean, ignoreRestriction?: boolean): [boolean, string?]; isOutOfPp(): boolean; }
  export interface Pokemon { id: number; hp: number; status: { effect: StatusEffect } | null; species: StubSpecies; isActive(check?: boolean): boolean; isFainted(): boolean; getNameToRender(): string; getBattlerIndex(): number; }
  export interface PlayerPokemon extends Pokemon { getMoveset(): StubPokemonMove[]; getHpRatio(): number; }
  export interface EnemyPokemon extends Pokemon { getMaxHp(): number; isShiny(): boolean; canSetStatus(effect: StatusEffect, quiet?: boolean, overrideStatus?: boolean, sourcePokemon?: PlayerPokemon | null, ignoreField?: boolean): boolean; }
}
declare module "#modifiers/modifier" { export class HealShopCostModifier {} }
declare module "#modifiers/modifier-type" {
  export interface StubModifierType { id?: string; name: string; tier?: number; }
  export class ModifierTypeOption { constructor(type: StubModifierType, upgradeCount?: number, cost?: number); type: StubModifierType; upgradeCount: number; cost: number; }
  export type ModifierTypeOption = InstanceType<typeof ModifierTypeOption>;
  export function getPlayerShopModifierTypeOptionsForWave(waveIndex: number, baseCost: number): ModifierTypeOption[];
}
declare module "#utils/battle-planner-ai" {
  import type { PlayerPokemon, StubPokemonMove } from "#field/pokemon";
  export interface StubPlannerBreakdown { benefit: number; attack: number; status: number; threat: number; badStatus: number; healing: number; setup: number; sideSupport: number; enemyStatus: number; redundancy: number; protect: number; }
  export function getPlannerAdvisorMoveEvaluations(user: PlayerPokemon, movePool: StubPokemonMove[]): Array<{ moveId: number; moveName: string; targets: number[]; score: number; breakdown?: StubPlannerBreakdown; result?: string }>;
}
declare module "#utils/computer-partner-capture-ai" { import type { EnemyPokemon, PlayerPokemon, StubMove } from "#field/pokemon"; export function estimateComputerPartnerMoveDamageRatio(attacker: PlayerPokemon, target: EnemyPokemon, move: StubMove): number; }
declare module "#utils/computer-partner-reward-ai" {
  import type { PlayerPokemon } from "#field/pokemon";
  import type { ModifierTypeOption } from "#modifiers/modifier-type";
  export interface ComputerPartnerRecoveryChoice { option: ModifierTypeOption; optionIndex: number; itemId: string; kind: string; score: number; targetPokemonIndex?: number; targetMoveIndex?: number; reason: string; usefulValue: number; wastedValue: number; cost: number; isEmergency: boolean; reserveCost?: number; moneyAfterPurchase?: number; }
  export interface ComputerPartnerRewardChoice { option: ModifierTypeOption; optionIndex: number; itemId: string; score: number; effectiveTier: number; priority: number; targetPokemonIndex?: number; targetMoveIndex?: number; reason: string; recoveryChoice?: ComputerPartnerRecoveryChoice; }
  export function chooseComputerPartnerRewardOption(options: ModifierTypeOption[], party: PlayerPokemon[], context?: { pokeballCounts?: Record<number, number> | Partial<Record<number, number>> }): ComputerPartnerRewardChoice | undefined;
  export function scoreComputerPartnerRecoveryOption(option: ModifierTypeOption, optionIndex: number, party: PlayerPokemon[]): ComputerPartnerRecoveryChoice | undefined;
  export function getComputerPartnerShopReserve(options: ModifierTypeOption[]): number;
}
declare module "#utils/common" { export class NumberHolder { constructor(value: number); value: number; } }
declare module "#phases/command-phase" { import type { PlayerPokemon } from "#field/pokemon"; export interface CommandPhase { getFieldIndex(): number; getPokemon(): PlayerPokemon; } }
declare module "#app/global-scene" {
  import type { PlayerIndex } from "#app/battle-scene";
  import type { PokeballType } from "#enums/pokeball";
  import type { EnemyPokemon, PlayerPokemon } from "#field/pokemon";
  export const globalScene: {
    ui: { getMode(): number };
    phaseManager: { getCurrentPhase(): { is(name: string): boolean; getFieldIndex?: () => number } };
    currentBattle: { turn: number; waveIndex: number };
    twoPlayerMode: boolean;
    twoPlayerPartySize: 3 | 6;
    getPlayerIndexForFieldSlot(index: number): PlayerIndex;
    getPlayerPokeballCounts(index: PlayerIndex): Partial<Record<PokeballType, number>>;
    getPlayerParty(index: PlayerIndex): PlayerPokemon[];
    getPlayerField(): PlayerPokemon[];
    getEnemyField(): EnemyPokemon[];
    getWaveMoneyAmount(multiplier: number): number;
    applyModifierForPlayer(type: unknown, playerIndex: PlayerIndex, holder: { value: number }): void;
    getPlayerMoney(playerIndex: PlayerIndex): number;
  };
}
