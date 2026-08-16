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

Source-specific code stays in adapters. Core/overlay must remain reusable by the official PokeRogue adapter.

## Decision model

### Capture

Candidate actions:

- throw a specific ball now
- weaken first
- apply status first
- skip target

Supported inputs include exact per-ball probability, inventory/scarcity, safe weakening candidates, catch-useful status candidates, active-Pokémon HP risk, party capacity, target/party BST and types, duplicate species, shiny status, and conservative replacement value.

Current catch-value logic deliberately avoids auto-skipping unique low-current-BST Pokémon because unevolved species can be undervalued.

### Battle

Primary output is `USE <MOVE> → <TARGET>`. Existing 2P one-turn planner scores and breakdowns support the decision.

The advisor uses a deterministic scoring export added to `battle-planner-ai.ts`. It must not call the seeded/random final move chooser, switch chooser, or reposition chooser.

### Reward/shop

Primary outputs are `PICK`, `BUY`, `SKIP`, or `SAVE`, with concise reasons.

The 2P reward adapter reuses the fork's existing reward/recovery scoring. Reward scoring can use random target fallbacks internally, so every advisor evaluation snapshots and restores `Phaser.Math.RND.state()` in `finally`.

Shop recommendations use exact adjusted shop prices, emergency status, player money, and the fork's recovery reserve logic. With the game's waive-cost debug override, eligibility matches the game's unlimited-money behavior while displayed money remains the player's real unchanged money.

## MVP scope

### IN

- Stable snapshot contract.
- SolVolrund 2P adapter.
- Exact capture probabilities.
- Throw / weaken / status / skip capture decisions.
- Resource-aware ball selection.
- Conservative catch value + replacement candidate.
- Battle move + target decision using existing planner.
- Reward and shop decisions.
- F8 browser overlay.
- Automatic tests against the real current 2P source.
- Thin official PokeRogue compatibility adapter after the primary 2P value loop is complete.

### OUT

- Automatic gameplay.
- Full-run autonomous strategy.
- MCTS / Monte Carlo battle win rates.
- Perfect hidden-information prediction.
- OCR as the primary integration method.
- Advanced official parity before capture-only compatibility works.

## Build plan

### Phase 1 — Capture decision [DEVELOPER COMPLETE]

Implemented and automated-tested:

- exact per-ball probability
- near-equal resource conservation
- Master Ball release thresholds
- `THROW`, `WEAKEN`, `APPLY STATUS`, `SKIP`
- safe preparation estimates
- low-HP setup risk
- multi-target decisions
- live party facts, 3/6 party capacity, catch value, replacement candidate
- shiny protection
- simulated bridge → extension → decision → overlay
- real SolVolrund source integration compile

Human acceptance deferred: visual fit/feel in the user's actual browser and manual comparison of one displayed probability against one live encounter.

### Phase 2 — Battle move decision [DEVELOPER COMPLETE]

Implemented and automated-tested:

- deterministic planner scoring export
- normal game chooser still uses its existing final selection logic
- no RNG in advisor evaluation path
- cached battle analysis keyed to decision state
- move + target serialization
- `USE <MOVE> → <TARGET>` decision
- qualitative strength from planner-score gap
- planner breakdown explanations
- simulated battle snapshot → overlay test
- real 2P source integration compile

Deferred until evidence says they are high-value: switch advice, exact damage/KO probability, richer multi-ally coordination.

### Phase 3 — Reward + shop decisions [DEVELOPER COMPLETE]

Implemented and automated-tested:

- live modifier reward options from `SelectModifierPhase`
- live adjusted recovery shop options
- decision-first `PICK` / `SKIP REWARD`
- decision-first `BUY` / `SAVE MONEY`
- emergency recovery priority
- target Pokémon/move explanations
- player money and recovery reserve context
- one-purchase-then-reassess guidance
- reward RNG state preservation
- cross-platform/idempotent second sidecar installation
- simulated reward-shop snapshot → overlay test
- real SolVolrund source integration compile

Human acceptance remains deferred and does not block development.

### Phase 4 — Party/capture quality [PARTLY FOLDED INTO PHASE 1]

Already present: basic type coverage, duplicate-species penalty, current BST comparison, open-slot handling, shiny protection, and replacement candidate.

Only improve further if playtesting proves value:

- evolution potential
- abilities/natures/IVs
- role/coverage sophistication beyond basic types/BST
- better replacement scoring

### Phase 5 — Official PokeRogue adapter [ACTIVE]

Target: `pagefaultgames/pokerogue`, current default branch `beta`.

Pareto slice 5A: **capture-only compatibility**.

Done criteria:

- same advisor core/overlay unchanged
- thin official adapter emits compatible capture snapshots
- exact official capture probability matches the current official formula
- ball inventory and target state come from live official game objects
- official adapter installer is isolated from the 2P installer
- official-source CI verifies the adapter introduces no new TypeScript errors

Do not add official battle/reward/shop support until capture-only compatibility is green.

### Phase 6 — Advanced quality

Only after the basic advisor loop is proven useful in real play:

- exact damage ranges
- KO probability
- switch advice
- deeper simulation / MCTS

## Locked design decisions

| Decision | Reason |
|---|---|
| Decision first, numbers second | Reduce player decision burden rather than move calculations into an overlay. |
| Separate probability from utility | Highest success percentage is not always the best practical action. |
| Treat near-equal choices as equivalent | Avoid fake precision such as 86.0% vs 85.8%. |
| Separate adapters from core | Support 2P and official PokeRogue without forking the whole advisor. |
| Read-only MVP | Easier to trust, debug, and keep multiplayer-safe. |
| `window.postMessage` boundary | Browser content scripts should not depend on direct page-owned object access. |
| Exact probability comes from adapter | Critical-capture chance varies with modified catch rate and therefore by ball. |
| All multi-target decisions render before evidence | Evidence for target 1 must never hide target 2's decision. |
| No numeric battle-confidence percentage | Planner score gaps are not calibrated probabilities. |
| Deterministic planner evaluation export | Reuse the fork's intelligence without consuming seeded battle RNG. |
| Preserve/restore RNG around reward scoring | Existing reward target fallbacks can call Phaser's seeded RNG. |
| Planner installer fails closed | Upstream source drift should cause a clear error, not a guessed patch. |
| No MCTS in MVP | Existing game logic provides most value much faster. |

## Automated testing

Every push/PR runs:

- TypeScript checks
- capture/catch-value/battle/reward-shop decision tests
- browser-message and overlay simulation
- cross-origin message rejection
- extension bundle smoke test
- installer/sidecar/planner-hook idempotency
- planner no-RNG assertion
- real current `SolVolrund/pokerogue-2p-beta` checkout + dependency install
- upstream TypeScript error baseline
- advisor install into real source
- failure if advisor introduces any new TypeScript errors

The baseline comparison is necessary because the upstream 2P repository can have pre-existing clean-checkout TypeScript errors when asset JSON files are absent.

## Debugging history

| Problem | Root cause | Resolution |
|---|---|---|
| Direct `window` access from extension was unsafe | Content scripts use an isolated JS world | Serialized, origin-checked `window.postMessage`. |
| One critical-capture value was used for every ball | Critical chance depends on modified catch rate | Adapter computes exact final probability per ball. |
| Single-target capture model | 2P can have multiple catchable enemies | `captureTargets[]`; decisions ordered before evidence. |
| Percentage-only product | Probability does not decide resource/risk tradeoffs | Added decision utility and qualitative strength. |
| 86.0% beat 85.8% and wasted a better ball | Raw maximum ignored practical equivalence | Equivalence margins + resource rank. |
| Valuable target could over-trigger Master Ball | Target value alone ignored already-good normal odds | Premium release thresholds depend on target value and non-premium reliability. |
| Naive battle confidence would invent percentages | Planner scores are not calibrated probability | Qualitative strength only; raw scores as evidence. |
| Reward scoring could advance seeded RNG | Random target fallbacks use `Phaser.Math.RND.pick` | Save/restore `Phaser.Math.RND.state()` around every advisor reward evaluation. |
| Reward sidecar failed real-source exact-optional typing | Target helper was invoked inside an optional spread and inferred `string | undefined` | Compute target once and emit the property only when definitely present. |
| Waived shop costs produced fake huge post-purchase money | Unlimited money is only an eligibility mechanism | Keep unlimited eligibility but display cost 0 and unchanged real player money. |
| Full upstream 2P `tsc` failed in CI | Missing upstream asset JSON, unrelated to advisor | Compare before/after TypeScript error sets and reject only new advisor errors. |

## What's next

Build **Phase 5A official capture-only adapter**, add official-source compatibility CI, and keep the existing core/overlay unchanged. Human browser acceptance remains deferred.

## Session protocol

Before work: read this file, identify active phase, flag stale assumptions.

During work: build the smallest next piece, test it immediately, diagnose failures, record decisions.

End of work: update current phase/state, debugging history, and exactly one next step.
