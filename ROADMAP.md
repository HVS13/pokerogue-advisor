# Implementation roadmap

The detailed operating blueprint is in [`AGENTS.md`](./AGENTS.md). This is the short execution view.

## Pareto order

The high-value 2P loop is implemented at developer-test level:

1. capture decision
2. battle move + target decision
3. reward decision
4. recovery/shop decision
5. basic party-fit / replacement judgment

Official capture compatibility is also complete. Advanced simulation waits until real playtesting proves it is worth the complexity.

## Phase 1: 2P capture decision — DEVELOPER COMPLETE

- exact per-ball probability
- resource-aware ball choice
- throw / weaken / status / skip
- conservative catch value and replacement candidate
- multi-target support
- 3/6 party capacity
- automated real-source compatibility check

## Phase 2: 2P battle move decision — DEVELOPER COMPLETE

- deterministic existing-planner scoring export
- `USE <MOVE> → <TARGET>`
- qualitative strength, no fake win/confidence percentage
- cached evaluation
- planner explanations
- no advisor RNG consumption
- automated real-source compatibility check

## Phase 3: 2P reward and shop — DEVELOPER COMPLETE

- `PICK` / `SKIP REWARD`
- `BUY` / `SAVE MONEY`
- target explanation
- emergency recovery priority
- exact adjusted costs
- current money + reserve context
- reward RNG state preservation
- automated real-source compatibility check

## Phase 4: Party quality — PARTLY COMPLETE

Basic party fit was pulled into capture because it is needed for `CATCH` vs `SKIP`.

Only improve when playtesting identifies concrete misses: evolution potential, IVs/nature/ability, deeper roles, or better replacement scoring.

## Phase 5A: Official PokeRogue capture adapter — DEVELOPER COMPLETE

Target: `pagefaultgames/pokerogue@beta`.

- same core/overlay unchanged
- exact official capture mechanics
- live official target, party, and Poké Ball inventory
- separate idempotent installer
- capture formula regression
- automated real official-source compatibility check

Official weakening/status preparation is not included because it would require pulling 2P-specific helper logic into the official adapter.

## Phase 5B: Official battle/reward/shop — OPTIONAL / DEFERRED

Do not expand official parity by default. Capture compatibility already proves the multi-adapter architecture.

## Phase 6: Integration hardening — ACTIVE

Smallest next slice:

- one adapter response per decision surface
- battle/capture bridge must stay silent during `MODIFIER_SELECT`
- reward/shop sidecar is the sole provider on the modifier screen
- regression test provider routing
- keep advisor, real 2P, and real official CI green

Then consider:

- reduce unnecessary render churn
- cleaner install/build packaging
- adapter/version diagnostics for later acceptance testing

## Phase 7: Advanced quality — DEFERRED

Only where real playtesting proves value:

- exact damage ranges
- KO probability
- switch advice
- richer double/triple coordination
- held-item/modifier edge cases
- forward simulation / MCTS

Planner scores remain recommendation evidence. Simulation-backed win probability appears only if a real simulator exists.
