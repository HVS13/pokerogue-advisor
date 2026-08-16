import type { CapturePartyMember, CaptureSnapshot } from "./types.js";

export interface CatchValueAssessment {
  score: number;
  replacementName?: string;
  reasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getNovelTypeCount(targetTypes: number[] | undefined, party: CapturePartyMember[]): number {
  if (!targetTypes?.length) return 0;
  const represented = new Set(party.flatMap(member => member.types));
  return new Set(targetTypes.filter(type => !represented.has(type))).size;
}

function getRarityBonus(catchRate: number): number {
  if (catchRate <= 45) return 8;
  if (catchRate <= 90) return 4;
  return 0;
}

function getStrengthBonus(baseStatTotal: number): number {
  if (baseStatTotal >= 600) return 25;
  if (baseStatTotal >= 525) return 18;
  if (baseStatTotal >= 475) return 12;
  if (baseStatTotal >= 425) return 6;
  if (baseStatTotal < 325) return -5;
  return 0;
}

function isDuplicateSpecies(snapshot: CaptureSnapshot, party: CapturePartyMember[]): boolean {
  if (snapshot.targetSpeciesId === undefined) return false;
  return party.some(member => member.speciesId === snapshot.targetSpeciesId);
}

export function assessCatchValue(snapshot: CaptureSnapshot): CatchValueAssessment | undefined {
  if (snapshot.teamFitScore !== undefined) {
    return {
      score: clamp(snapshot.teamFitScore, 0, 100),
      replacementName: snapshot.replacementName,
      reasons: ["Catch value supplied by the game adapter."],
    };
  }

  const party = snapshot.party;
  if (!party || snapshot.targetBaseStatTotal === undefined) return;

  if (snapshot.isShiny) {
    return {
      score: 100,
      reasons: ["Shiny encounter: preserve the opportunity unless capture is impossible."],
    };
  }

  const partyCapacity = snapshot.partyCapacity ?? 6;
  const hasOpenSlot = party.length < partyCapacity;
  const duplicate = isDuplicateSpecies(snapshot, party);
  const novelTypes = getNovelTypeCount(snapshot.targetTypes, party);
  const rarityBonus = getRarityBonus(snapshot.catchRate);
  const reasons: string[] = [];

  if (hasOpenSlot) {
    let score = 55
      + getStrengthBonus(snapshot.targetBaseStatTotal)
      + Math.min(novelTypes * 6, 12)
      + rarityBonus
      - (duplicate ? 8 : 0);

    // An open slot has low opportunity cost. Do not auto-skip an unevolved target merely because its current BST is low.
    score = clamp(score, 35, 95);
    reasons.push(`Open party slot: catching does not force a replacement.`);
    if (novelTypes > 0) reasons.push(`Adds ${novelTypes} currently unrepresented type${novelTypes === 1 ? "" : "s"}.`);
    if (rarityBonus > 0) reasons.push("Low catch rate is a useful rarity/potential signal.");
    if (duplicate) reasons.push("Same species is already in the party, reducing immediate team value.");
    return { score, reasons };
  }

  const weakest = [...party].sort((a, b) => a.baseStatTotal - b.baseStatTotal)[0];
  if (!weakest) return;

  const strengthDelta = snapshot.targetBaseStatTotal - weakest.baseStatTotal;
  let score = 45
    + clamp(strengthDelta * 0.18, -25, 30)
    + Math.min(novelTypes * 8, 16)
    + rarityBonus
    - (duplicate ? 12 : 0);

  // Be conservative with SKIP. Current BST undervalues unevolved Pokémon, so unique targets get a floor above auto-skip.
  if (!duplicate) score = Math.max(score, 30);
  score = clamp(score, 0, 98);

  if (strengthDelta >= 25) {
    reasons.push(`Current-form strength is ${strengthDelta} BST above ${weakest.name}.`);
  } else if (strengthDelta <= -75) {
    reasons.push(`Current-form strength is ${Math.abs(strengthDelta)} BST below the weakest party member.`);
  } else {
    reasons.push(`Current-form strength is close to the weakest party slot.`);
  }

  if (novelTypes > 0) reasons.push(`Adds ${novelTypes} currently unrepresented type${novelTypes === 1 ? "" : "s"}.`);
  if (rarityBonus > 0) reasons.push("Low catch rate is a useful rarity/potential signal.");
  if (duplicate) reasons.push("Same species is already in the party, so replacement value must be clearly better.");

  const replacementName = score >= 60 && (strengthDelta >= 0 || novelTypes > 0)
    ? weakest.name
    : undefined;

  return { score, replacementName, reasons };
}
