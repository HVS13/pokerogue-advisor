# Implementation roadmap

The detailed operating blueprint is in [`AGENTS.md`](./AGENTS.md). This is the short execution view.

## Pareto order

The high-value 2P loop is now implemented at developer-test level:

1. capture decision
2. battle move + target decision
3. reward decision
4. recovery/shop decision
5. basic party-fit / replacement judgment

Advanced simulation waits until real playtesting proves it is worth the complexity.

## Phase 1: Capture decision — DEVELOPER COMPLETE

- exact per-ball probability
- practical resource-aware ball choice
- throw / weaken / status / skip
- conservative catch value and replacement candidate
- multi-target support
- 3/6 party capacity
- automated real-source compatibility check

Human browser acceptance is deferred.

## Phase 2: Battle move decision — DEVELOPER COMPLETE

- deterministic existing-planner scoring export
- `USE <MOVE> → <TARGET>`
- qualitative strength, no fake win/confidence percentage
- cached evaluation
- planner breakdown reasons
- no advisor RNG consumption
- automated real-source compatibility check

Switch advice and exact KO/damage probability are later quality work, not MVP blockers.

## Phase 3: Reward and shop — DEVELOPER COMPLETE

- `PICK` / `SKIP REWARD`
- `BUY` / `SAVE MONEY`
- target Pokémon/move explanation
- emergency recovery priority
- exact adjusted shop costs
- current money + reserve context
- reward RNG state preservation
- simulated overlay flow
- automated real-source compatibility check

## Phase 4: Party quality — PARTLY COMPLETE

Basic party fit was pulled forward into capture because it is needed for `CATCH` vs `SKIP`.

Only improve when playtesting identifies concrete misses:

- evolution potential
- IVs/nature/ability
- deeper team roles
- better replacement scoring

## Phase 5A: Official PokeRogue capture adapter — ACTIVE

Target: `pagefaultgames/pokerogue`, default branch `beta`.

Smallest compatibility slice:

- keep advisor core/overlay unchanged
- read official wild target + Poké Ball inventory
- reproduce the current official capture formula exactly
- emit the existing capture snapshot format
- add a separate official installer
- add official-source CI that rejects new TypeScript errors

Do not add official battle/reward/shop support until this is green.

## Phase 5B: Official battle/reward/shop — OPTIONAL

Only after official capture works:

- official move/target scoring adapter
- official reward/shop state
- same decision-first core

## Phase 6: Improve only where playtesting proves value

Candidates:

- exact damage ranges
- KO probability
- switch advice
- richer double/triple coordination
- held-item/modifier edge cases
- forward simulation / MCTS

Planner scores remain recommendation evidence. Simulation-backed win probability appears only if a real simulator exists.
