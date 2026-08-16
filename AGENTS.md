# PokeRogue Advisor — Project Blueprint

This is the living operating document for AI-assisted development of PokeRogue Advisor.

## Mission

Build a read-only on-screen advisor that answers **what should I do now, how strong is that recommendation, and why?** without making the player leave the game or manually interpret raw scores.

## Product principles

### Decision first, numbers second

Every decision surface should answer, in order:

1. What should I do?
2. How strong is that recommendation?
3. Why?
4. What numbers support it?

Raw percentages and planner scores are evidence, not the primary output. Treat practically equivalent choices as equivalent and prefer lower resource cost/risk.

### Pareto principle

Prioritize the few features that create most player value:

1. Capture decision: throw / prepare / skip + sensible ball.
2. Battle move + target decision.
3. Reward decision.
4. Shop/recovery decision.
5. Party/replacement judgment.

Do not delay these for MCTS, elaborate settings, perfect edge cases, OCR, or visual polish.

### AI Builder workflow

- Requirements before design.
- Design before implementation.
- Keep MVP IN/OUT explicit.
- Build small vertical slices with observable done criteria.
- Build, run, test, record, then continue.
- Diagnose root cause before fixing.
- Record architectural decisions and failures so they are not rediscovered.

## Critical constraints

- Read-only MVP. Do not automatically press game inputs.
- Prefer exact live game state over OCR/screen scraping.
- Serialize plain data only. Never expose mutable Phaser/game objects across the bridge.
- Capture percentages may be called probability only when calculated from actual game mechanics.
- Battle planner scores are not win probability and must not be converted into invented confidence percentages.
- Use qualitative strength: **Strong / Moderate / Slight / Equivalent / Situational**.
- Advisor analysis must not consume or advance PokeRogue seeded RNG.
- Primary target: `SolVolrund/pokerogue-2p-beta`.
- Secondary optional target: `pagefaultgames/pokerogue`.

## Architecture

1. **Game adapter** reads one supported PokeRogue build and emits serialized `AdvisorSnapshot` data.
2. **Advisor core** performs game-agnostic decision utility, ranking, thresholds, and explanations.
3. **Overlay** renders decisions and has no direct Phaser knowledge.

Source-specific code stays in adapters. Core/overlay remain reusable across supported PokeRogue builds.

## Decision model

### Capture

Candidate actions are throw a specific ball now, weaken first, apply status first, or skip target.

The 2P adapter supports exact per-ball probability, inventory/scarcity, safe weakening, catch-useful status, active-Pokémon HP risk, 3/6 party capacity, target/party BST and types, duplicate species, shiny status, and conservative replacement value.

The official adapter intentionally starts smaller: exact official capture probability, inventory, target state, and portable party facts. It does not copy 2P-only weakening/status helpers into official PokeRogue.

### Battle

Primary 2P output is `USE <MOVE> → <TARGET>`. Existing one-turn planner scores and breakdowns support the decision.

The advisor uses a deterministic scoring export added to `battle-planner-ai.ts`. It must not call the seeded/random final move chooser, switch chooser, or reposition chooser.

### Reward/shop

Primary 2P outputs are `PICK`, `BUY`, `SKIP`, or `SAVE`, with concise reasons.

Reward scoring can use random target fallbacks internally, so every advisor evaluation snapshots and restores `Phaser.Math.RND.state()` in `finally`.

Shop recommendations use exact adjusted prices, emergency status, player money, and the fork's recovery reserve logic. With the game's waive-cost debug override, eligibility matches the game while displayed money remains the real unchanged money.

## MVP scope

### IN

- Stable snapshot contract.
- SolVolrund 2P adapter.
- Exact capture probabilities and capture decisions.
- Resource-aware ball selection.
- Conservative party fit/replacement judgment.
- Battle move + target decisions.
- Reward and recovery-shop decisions.
- F8 browser overlay.
- Automated real-source integration tests.
- Thin official PokeRogue capture adapter using the same core/overlay.

### OUT

- Automatic gameplay.
- Full-run autonomous strategy.
- MCTS / Monte Carlo battle win rates.
- Perfect hidden-information prediction.
- OCR as the primary integration method.
- Official battle/reward/shop parity before it proves worth the extra maintenance.

## Build plan

### Phase 1 — 2P capture decision [DEVELOPER COMPLETE]

Implemented and automated-tested: exact per-ball probability, resource-aware ball choice, `THROW` / `WEAKEN` / `APPLY STATUS` / `SKIP`, low-HP setup risk, multi-target decisions, 3/6 party capacity, conservative catch value/replacement, shiny protection, simulated overlay flow, and real SolVolrund source integration.

### Phase 2 — 2P battle move decision [DEVELOPER COMPLETE]

Implemented and automated-tested: deterministic planner export, cached move/target evaluation, `USE <MOVE> → <TARGET>`, qualitative strength, planner explanations, no advisor RNG consumption, simulated overlay flow, and real-source integration.

Switch advice and exact damage/KO probability remain optional quality work.

### Phase 3 — 2P reward + shop decisions [DEVELOPER COMPLETE]

Implemented and automated-tested: live reward/shop state, `PICK` / `SKIP REWARD`, `BUY` / `SAVE MONEY`, emergency priority, target explanations, money/reserve context, one-purchase-then-reassess guidance, RNG preservation, simulated overlay flow, and real-source integration.

### Phase 4 — Party/capture quality [PARTLY FOLDED INTO PHASE 1]

Already present: basic type coverage, duplicate penalty, current BST comparison, open-slot handling, shiny protection, and replacement candidate.

Only improve further when playtesting shows concrete misses: evolution potential, IVs/nature/ability, deeper roles, or better replacement scoring.

### Phase 5A — Official PokeRogue capture adapter [DEVELOPER COMPLETE]

Target: `pagefaultgames/pokerogue@beta`.

Implemented and automated-tested:

- same advisor core/overlay unchanged
- separate thin official capture bridge
- exact current official capture mechanics
- live official target, party, and Poké Ball inventory
- portable catch-value inputs
- separate idempotent official installer
- capture shake/critical formula regression
- real official-source CI with no added TypeScript errors

Official weakening/status setup, battle, reward, and shop parity are intentionally not part of 5A.

### Phase 5B — Official battle/reward/shop [OPTIONAL / DEFERRED]

Do not start by default. The primary 2P value loop is complete and official capture compatibility already proves the multi-adapter architecture. Add further official parity only if it creates more value than hardening installation/runtime behavior.

### Phase 6 — Integration hardening [ACTIVE]

Pareto goal: make the existing advisor predictable and easy to run before adding more optional intelligence.

Current slice:

- ensure exactly one 2P adapter responds for each decision surface
- remove battle/capture idle response on `MODIFIER_SELECT` so reward/shop is the sole provider there
- add a regression test for provider routing
- keep all real-source CI green

Next candidates after routing is green:

- reduce unnecessary snapshot/render churn
- package a cleaner local build/install flow
- add diagnostics/version information useful for later human acceptance

### Phase 7 — Advanced quality [DEFERRED]

Only after real playtesting proves value: exact damage ranges, KO probability, switch advice, richer multi-ally coordination, or deeper simulation/MCTS.

## Locked design decisions

| Decision | Reason |
|---|---|
| Decision first, numbers second | Reduce player decision burden rather than move calculations into an overlay. |
| Separate probability from utility | Highest success percentage is not always the best practical action. |
| Treat near-equal choices as equivalent | Avoid fake precision such as 86.0% vs 85.8%. |
| Separate adapters from core | Support 2P and official PokeRogue without forking the whole advisor. |
| Read-only MVP | Easier to trust, debug, and keep multiplayer-safe. |
| `window.postMessage` boundary | Browser content scripts should not depend on direct page-owned object access. |
| Exact probability comes from adapter | Critical-capture chance depends on each game's live capture mechanics. |
| All multi-target decisions render before evidence | Evidence for target 1 must never hide target 2's decision. |
| No numeric battle-confidence percentage | Planner score gaps are not calibrated probabilities. |
| Deterministic planner evaluation export | Reuse the fork's intelligence without consuming seeded battle RNG. |
| Preserve/restore RNG around reward scoring | Existing reward target fallbacks can call Phaser's seeded RNG. |
| Official adapter remains thin | Optional compatibility must not drag 2P-only AI into upstream code. |
| Installers fail closed on source drift | Upstream changes should produce a clear error, not a guessed patch. |
| No MCTS in MVP | Existing game logic provides most value much faster. |

## Automated testing

Every push/PR runs the advisor suite plus real-source integrations for both supported targets.

Coverage includes TypeScript, capture math, capture decisions, catch value, battle decisions, reward/shop decisions, browser-message/overlay simulation, cross-origin rejection, extension bundle smoke tests, installer idempotency, planner RNG safety, real `SolVolrund/pokerogue-2p-beta`, and real `pagefaultgames/pokerogue@beta` compatibility.

Integration jobs compare upstream TypeScript errors before/after installation and fail only on new Advisor errors, because clean upstream checkouts can have unrelated baseline errors.

## Debugging history

| Problem | Root cause | Resolution |
|---|---|---|
| Direct `window` access from extension was unsafe | Content scripts use an isolated JS world | Serialized, origin-checked `window.postMessage`. |
| One critical-capture value was used for every ball | Critical chance depends on modified catch rate | Adapter computes exact final probability per ball. |
| Single-target capture model | 2P can have multiple catchable enemies | `captureTargets[]`; decisions ordered before evidence. |
| Percentage-only product | Probability does not decide resource/risk tradeoffs | Added decision utility and qualitative strength. |
| 86.0% beat 85.8% and wasted a better ball | Raw maximum ignored practical equivalence | Equivalence margins + resource rank. |
| Valuable target could over-trigger Master Ball | Target value alone ignored already-good normal odds | Premium release thresholds depend on value and non-premium reliability. |
| Naive battle confidence would invent percentages | Planner scores are not calibrated probability | Qualitative strength only; raw scores as evidence. |
| Reward scoring could advance seeded RNG | Random target fallbacks use `Phaser.Math.RND.pick` | Save/restore RNG state around advisor evaluation. |
| Reward sidecar exact-optional typing failed real-source CI | Optional target property could infer `undefined` | Emit `target` only when definitely a string. |
| Waived shop costs produced fake huge post-purchase money | Unlimited money is only an eligibility mechanism | Keep eligibility unlimited but display cost 0 and unchanged real money. |
| Full upstream typechecks can fail before Advisor | Missing upstream assets or unrelated baseline errors | Compare before/after error sets and reject only new Advisor errors. |

## What's next

Finish **Phase 6 provider routing hardening**, then improve packaging/diagnostics rather than immediately expanding optional official parity. Human browser acceptance remains deferred.

## Session protocol

Before work: read this file, identify active phase, flag stale assumptions.

During work: build the smallest next piece, test it immediately, diagnose failures, record decisions.

End of work: update current phase/state, debugging history, and exactly one next step.
