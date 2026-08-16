# PokeRogue Advisor — Project Blueprint

This is the living operating document for AI-assisted development of PokeRogue Advisor.

## Mission

Build a read-only on-screen advisor that answers **what should I do now, how strong is that recommendation, and why?** without making the player leave the game or manually interpret raw scores.

## Product principles

### Decision first, numbers second

Every decision surface should answer, in this order:

1. What should I do?
2. How strong is that recommendation?
3. Why?
4. What numbers support it?

Raw percentages and planner scores are evidence, not the primary output. Treat practically equivalent choices as equivalent and prefer lower resource cost/risk.

### Pareto principle

Prioritize the small set of features that produces most player value:

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
- Advisor analysis must not consume PokeRogue battle RNG.
- Primary target: `SolVolrund/pokerogue-2p-beta`.
- Optional later target: `pagefaultgames/pokerogue`.

## Architecture

1. **Game adapter** reads one supported PokeRogue build and emits serialized `AdvisorSnapshot` data.
2. **Advisor core** performs game-agnostic decision utility, ranking, thresholds, and explanations.
3. **Overlay** renders decisions and has no direct Phaser knowledge.

Source-specific code stays in adapters. Core/overlay should be reusable by the official PokeRogue adapter later.

## Decision model

### Capture

Candidate actions:

- throw a specific ball now
- weaken first
- apply status first
- skip target

Inputs already supported:

- exact per-ball probability
- ball inventory/scarcity
- safe weakening candidates
- catch-useful status candidates
- active-Pokémon HP risk
- party capacity (3 or 6 in the 2P fork)
- target/party BST and types
- duplicate species
- shiny status
- conservative target-value / replacement estimate

Current catch-value logic deliberately avoids auto-skipping unique low-current-BST Pokémon because unevolved species can be undervalued.

### Battle

Primary output is `USE <MOVE> → <TARGET>`. Existing 2P one-turn planner scores and breakdowns support the decision.

The advisor uses a deterministic scoring export added to `battle-planner-ai.ts`. It **must not call** the seeded/random final move chooser, switch chooser, or reposition chooser.

### Reward/shop

Primary outputs will be `PICK`, `BUY`, `SKIP`, `REROLL`, or `SAVE`, with concise reasons. Reuse the fork's existing computer-partner reward/recovery scoring where practical.

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

### OUT

- Automatic gameplay.
- Full-run autonomous strategy.
- MCTS / Monte Carlo battle win rates.
- Perfect hidden-information prediction.
- OCR as the primary integration method.
- Official PokeRogue parity if it slows the primary MVP.

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

### Phase 2 — Battle move decision [ACTIVE]

Implemented in current development slice:

- deterministic planner scoring export
- existing game chooser refactored to reuse the same scoring helper without changing chooser behavior
- no RNG in advisor evaluation path
- cached battle analysis keyed to decision state
- move + target serialization
- decision-first `USE <MOVE> → <TARGET>` output
- qualitative strength from planner-score gap
- planner breakdown explanations
- simulated battle snapshot → overlay test
- real 2P source integration compile

Still optional/later within battle quality:

- switch recommendation
- exact damage ranges / KO probability
- richer multi-ally coordination

Do not block Phase 3 on these unless real playtesting shows they are high-value.

### Phase 3 — Reward + shop decisions [NEXT]

Done criteria:

- live reward options and shop options serialized
- existing computer-partner reward/recovery scoring reused without random choice
- overlay leads with `PICK` / `BUY` / `SKIP` / `SAVE`
- reasons include target and money/reserve context when available
- real-source CI green

### Phase 4 — Capture/party quality improvements

Only if observed failures justify it:

- evolution potential
- abilities/natures/IVs
- role/coverage sophistication beyond basic types/BST
- better replacement scoring

### Phase 5 — Official PokeRogue adapter

Only after Phases 1–3 are stable on the primary fork. Same core/overlay, separate thin adapter.

### Phase 6 — Advanced battle quality

Candidates only after basic value is proven:

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
| Separate adapters from core | Supports 2P and official PokeRogue without forking the whole advisor. |
| Read-only MVP | Easier to trust, debug, and keep multiplayer-safe. |
| `window.postMessage` boundary | Browser content scripts should not depend on direct page-owned object access. |
| Exact probability comes from adapter | Critical-capture chance varies with modified catch rate and therefore by ball. |
| All multi-target decisions render before evidence | Evidence for target 1 must never hide target 2's decision. |
| No numeric battle-confidence percentage | Planner score gaps are not calibrated probabilities. |
| Deterministic planner evaluation export | Reuse the fork's intelligence without consuming seeded battle RNG. |
| Planner installer fails closed | Upstream source drift should cause a clear error, not a guessed patch. |
| No MCTS in MVP | Existing game logic provides most of the value much faster. |

## Automated testing

Every push/PR runs:

- TypeScript checks
- core capture/catch-value/battle decision tests
- browser-message and overlay simulation
- cross-origin message rejection
- extension bundle smoke test
- installer idempotency
- planner-hook idempotency/no-RNG assertion
- real current `SolVolrund/pokerogue-2p-beta` checkout + dependency install
- upstream TypeScript error baseline
- advisor install into real source
- failure if advisor introduces any new TypeScript errors

The baseline comparison is necessary because the upstream repository can have pre-existing clean-checkout TypeScript errors when asset JSON files are absent.

## Debugging history

| Problem | Root cause | Resolution |
|---|---|---|
| Direct `window` access from extension was unsafe | Content scripts use an isolated JS world | Serialized, origin-checked `window.postMessage`. |
| One critical-capture value was used for every ball | Critical chance depends on modified catch rate | Adapter computes exact final probability per ball. |
| Single-target capture model | 2P can have multiple catchable enemies | `captureTargets[]`; decisions ordered before evidence. |
| Percentage-only product | Probability does not decide resource/risk tradeoffs | Added decision utility and qualitative strength. |
| 86.0% beat 85.8% and wasted a better ball | Raw maximum ignored practical equivalence | Equivalence margins + resource rank. |
| Valuable target could over-trigger Master Ball | Target value alone ignored already-good normal odds | Premium release thresholds depend on both target value and non-premium reliability. |
| Naive battle confidence would invent percentages | Planner scores are not calibrated probability | Qualitative strength only; raw scores as evidence. |
| Full upstream `tsc` failed in CI | Missing upstream asset JSON, unrelated to advisor | Compare before/after TypeScript error sets and reject only new advisor errors. |

## What's next

Finish and merge Phase 2 move advice after the short advisor suite is green, then start **Phase 3 reward/shop**. Human browser acceptance remains deferred and should not block development.

## Session protocol

Before work: read this file, identify active phase, flag stale assumptions.

During work: build the smallest next piece, test it immediately, diagnose failures, record decisions.

End of work: update current phase/state, debugging history, and exactly one next step.
