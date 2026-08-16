# Implementation roadmap

The detailed operating blueprint is in [`AGENTS.md`](./AGENTS.md). This file is the short execution view.

## Pareto order

Build the few features that create most player value first:

1. capture probability / best ball
2. battle move ranking
3. reward ranking
4. shop/recovery ranking
5. party-fit / replacement advice

Advanced simulation waits until those are proven useful.

## Phase 1: One live capture recommendation — ACTIVE

Primary target: `SolVolrund/pokerogue-2p-beta`.

Build the smallest end-to-end vertical slice:

- read the active wild Pokemon and player's available balls
- reuse the game's real capture inputs/mechanics
- emit a plain serialized `AdvisorSnapshot`
- deliver it over the existing message bridge
- render ball-by-ball capture percentages in the overlay

### Done criteria

- one actual running encounter reaches the overlay
- percentages appear for all available balls
- one manually checked encounter matches the game formula
- the overlay clearly shows when the bridge is unavailable

No battle/reward/shop integration before this is confirmed.

## Phase 2: Battle move ranking

For the 2P fork, reuse `src/utils/battle-planner-ai.ts` instead of building a new search engine.

- legal moves and targets
- planner score normalization
- concise explanation
- confidence label, never fake win probability

### Done criteria

- live battle move list reaches overlay
- ranking is stable for identical state
- five normal battle scenarios are manually sanity checked

## Phase 3: Rewards and shop

Reuse the 2P fork's computer-partner reward/recovery logic where practical.

- reward ranking
- shop purchase ranking
- recovery target recommendation
- concise reasons

### Done criteria

- live reward/shop choices reach overlay
- best choice and reason are shown
- no game input is automatically executed

## Phase 4: Party fit

- catch/skip score
- suggested replacement
- team-role/coverage reasoning

## Phase 5: Official PokeRogue adapter — OPTIONAL

Target: `pagefaultgames/pokerogue`.

Keep the same advisor core, snapshot contract, and overlay. Add only a source-specific adapter.

Useful official foundations include:

- capture mechanics in `src/phases/attempt-capture-phase.ts` and `src/data/pokeball.ts`
- move/target and matchup scoring in the official Pokemon/enemy AI paths
- reward/shop choices in `src/phases/select-modifier-phase.ts` and modifier helpers

The official adapter must not slow Phases 1–3.

### Done criteria

- same extension/core runs unchanged
- official adapter produces compatible snapshots
- capture percentages match official mechanics
- battle ranking uses official scoring where practical
- reward/shop choices serialize correctly

## Phase 6: Improve only where playtesting proves value

Candidates:

- exact damage ranges
- KO probability
- better switch advice
- double/triple target coordination
- held-item/modifier edge cases
- forward simulation / MCTS

Planner scores remain recommendation scores. Simulation-backed win probabilities only appear if and when a real simulator exists.
