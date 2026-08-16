# PokeRogue Advisor — Project Blueprint

This is the living operating document for AI-assisted development of PokeRogue Advisor.

## Mission

Build a read-only on-screen advisor that gives a player useful, explainable recommendations at the exact moment a decision is needed.

The one thing that makes the project worth building: **while playing PokeRogue, show the best practical choice without requiring the player to leave the game or manually calculate it.**

## Product principles

### Decision first, numbers second

The product is an advisor, not a calculator.

Every decision surface should answer these in order:

1. **What should I do?**
2. **How strong is that recommendation?**
3. **Why?**
4. **What numbers support it?**

Raw percentages or scores are evidence, not the primary output. Small numeric differences must not create fake precision. When two choices are effectively equivalent, prefer the option that preserves scarce resources or reduces downside, and say that explicitly.

Example: if two balls give 86.0% and 85.8% capture chance, the advisor should normally treat the capture chances as effectively tied and prefer the cheaper/more abundant ball unless the target is valuable enough that the tiny gain is worth the resource cost.

### Pareto principle

Optimize for the small set of features that produces most player value.

Priority order:

1. Capture decision + best ball + catch/skip/prepare guidance.
2. Battle move decision.
3. Reward choice decision.
4. Shop/recovery decision.
5. Party-fit / replacement decision.

Do not delay those five for advanced simulation, visual polish, generalized plugin systems, or edge-case completeness.

### AI Builder workflow

- Requirements before design.
- Design before implementation.
- Keep MVP IN and OUT explicit.
- Work in small vertical slices with observable done criteria.
- Build, run, test, record, then continue.
- Use current authoritative source code/docs before integrating external or fast-changing APIs.
- Record architectural decisions with reasons.
- Record failures and root causes immediately.
- Diagnose before fixing.

## Critical constraints

- Read-only advisor. Do not automatically press game inputs in the MVP.
- Prefer exact live game state over OCR or screen scraping whenever a bridge is possible.
- Never expose mutable Phaser/game objects across the bridge. Serialize plain data only.
- The overlay must lead with a recommendation, not a raw percentage table.
- Close choices must use an indifference/equivalence threshold so the UI does not overstate meaningless numeric differences.
- Resource scarcity and opportunity cost must be considered when recommending consumables.
- Capture percentages may be labeled as probability when calculated from the actual game mechanics.
- Planner score normalization must be labeled recommendation confidence, not win probability.
- Do not add MCTS or forward simulation until the basic advisor is proven useful in real play.
- Primary target is `SolVolrund/pokerogue-2p-beta`.
- `pagefaultgames/pokerogue` compatibility is desirable but optional. It must not block the primary target.

## Decision model

Keep probability, utility, and recommendation separate.

### Capture decision

Candidate actions should eventually include:

- throw a specific ball now
- weaken first
- apply status first
- skip the catch

The recommendation should consider:

- actual catch probability by ball
- ball scarcity / replacement cost
- target value and team fit
- whether the target replaces a current party member
- risk of KOing the target while weakening
- player survival risk while spending another turn
- wave/run context when relevant

Do not simply choose the highest catch percentage.

### Battle decision

The primary output is the recommended move/switch/target. Planner scores and later damage/KO probabilities support the recommendation but do not replace it.

### Reward/shop decision

The primary output is `PICK`, `BUY`, `SKIP`, `REROLL`, or `SAVE`, with short reasons. Item score and price are supporting evidence.

### Recommendation strength

Use qualitative decision strength to avoid false precision:

- **Strong** — materially better than alternatives.
- **Moderate** — meaningful edge, but context could change it.
- **Slight** — small edge; alternatives are reasonable.
- **Equivalent** — differences are too small to matter; prefer lower resource cost/risk.
- **Situational** — depends on a player goal or information the advisor cannot know reliably.

Thresholds should start simple and be tuned from real playtesting rather than over-engineered in advance.

## Architecture

Keep three layers separate:

1. **Game adapter** — reads one supported PokeRogue build and emits a stable serialized `AdvisorSnapshot`.
2. **Advisor core** — game-agnostic scoring, normalization, ranking, decision utility, and explanation logic.
3. **Overlay** — renders recommendations and never needs direct knowledge of Phaser internals.

Supported adapters should share the snapshot contract but may derive scores differently.

### Adapter A — SolVolrund 2P (primary)

Reuse the fork's existing advisor-friendly logic where practical:

- `src/utils/battle-planner-ai.ts`
- `src/utils/computer-partner-capture-ai.ts`
- `src/utils/computer-partner-reward-ai.ts`
- live state from `globalScene`

### Adapter B — Pagefault Games official (optional)

Use official PokeRogue mechanics directly rather than requiring the 2P-only planner:

- capture mechanics from `AttemptCapturePhase` and Pokeball helpers
- move / target scoring from official enemy AI and `Pokemon` methods
- reward/shop options from `SelectModifierPhase` and modifier option helpers
- live state from official `globalScene`

The core advisor must not import either game's source directly. Source-specific code belongs in adapters.

## MVP scope

### IN

- Stable snapshot contract.
- Primary 2P game adapter.
- Capture probability for every available ball.
- A capture decision: best action now, not just best probability.
- Best-ball recommendation with scarcity awareness.
- Initial `throw now` vs `prepare first` vs `skip` guidance using available state.
- Battle move ranking with clear confidence labeling.
- Reward ranking.
- Shop/recovery ranking.
- Catch/team-fit guidance when the source adapter can provide it.
- Browser overlay with simple explanations and F8 toggle.
- Basic compatibility hooks for an official PokeRogue adapter.

### OUT

- Automatic gameplay / input botting.
- Full-run autonomous strategy.
- MCTS / Monte Carlo win-rate estimates.
- Perfect prediction of hidden information.
- OCR as the primary integration method.
- Elaborate themes/settings before the core loop works.
- Official PokeRogue parity if it slows the primary 2P MVP.

## Build plan

### Phase 1 — One real capture decision [ACTIVE]

Goal: get one live, correct, useful capture decision from the 2P game into the overlay.

Done criteria:

- A running 2P game produces a serialized capture snapshot.
- Extension receives it without accessing mutable page objects.
- Overlay leads with a plain-language recommendation such as `THROW GREAT BALL NOW`, `WEAKEN FIRST`, or `SKIP`.
- Overlay shows each available ball and its calculated capture percentage as supporting evidence.
- Near-equal ball probabilities do not cause a wasteful recommendation when a cheaper/more abundant ball is effectively equivalent.
- The displayed probabilities match the game's capture formula for a manually checked encounter.
- The recommendation rationale is visible in one or two concise lines.
- Failure state is obvious when no bridge is installed.

Do not add reward/shop/battle integration until this works end-to-end.

### Phase 2 — Battle move decision

Done criteria:

- Live legal moves are visible in the snapshot.
- Existing 2P planner evaluations are converted into deterministic ranked recommendations.
- Overlay leads with `USE <MOVE>` / `SWITCH` and target when relevant.
- UI says `confidence`, not `win probability`.
- Close alternatives are labeled `Slight` or `Equivalent` rather than presented as certain.
- At least five normal battle scenarios are manually sanity checked.

### Phase 3 — Reward and shop decisions

Done criteria:

- Current reward options and shop options are serialized.
- Existing computer-partner reward/recovery logic is reused where practical.
- Overlay leads with `PICK`, `BUY`, `SKIP`, `REROLL`, or `SAVE` plus concise reasons.

### Phase 4 — Party fit

Done criteria:

- Wild Pokemon can be compared against the current player's party.
- Overlay can recommend catch/skip and a replacement candidate when appropriate.

### Phase 5 — Official PokeRogue adapter

Only start after Phases 1–3 are stable on the primary fork.

Done criteria:

- Same extension/core runs unchanged.
- Only adapter code differs.
- Capture recommendations match official PokeRogue mechanics.
- Battle ranking uses official move/target scoring where available.
- Reward/shop snapshots work with official `SelectModifierPhase` structures.

### Phase 6 — Quality improvements

Only add features driven by observed player value or recorded recommendation failures.

Candidates:

- exact damage ranges
- KO probability
- better switch advice
- double/triple target coordination
- modifier/held-item edge cases
- simulation-backed outcome probability

## Locked design decisions

| Decision | Reason |
|---|---|
| Decision first, numbers second | The product should reduce player decision burden, not move the calculation burden into an overlay. |
| Separate probability from utility | Highest success percentage is not always the best action when resources and opportunity cost matter. |
| Treat near-equal choices as equivalent | Prevents fake precision such as acting as if 86.0% is meaningfully better than 85.8%. |
| Separate game adapters from advisor core | Lets the same overlay/core support both the 2P fork and official PokeRogue without branching the whole project. |
| Primary target is 2P fork | It already exposes stronger planner/capture/reward logic and is the user's current game. |
| Official PokeRogue is optional Phase 5 | Compatibility is valuable but should not create early scope drag. |
| Read-only MVP | Much easier to trust, debug, and support than an autonomous bot. |
| `window.postMessage` bridge | Avoids depending on browser-extension isolated-world access to page-owned objects. |
| Adapter supplies exact per-ball capture probability | Critical-capture chance depends on modified catch rate, which changes with the selected ball. |
| Capture snapshots may contain multiple targets | 2P battles can expose multiple catchable enemies before target selection; advice must not silently refer to the wrong target. |
| No MCTS in MVP | Existing game logic can deliver most of the value much faster. |

## Current state

Confirmed:

- TypeScript advisor scaffold exists.
- Browser overlay and origin-checked snapshot message boundary exist.
- Missing game bridge now produces an obvious overlay notice instead of failing silently.
- Core capture, battle ranking, reward and shop functions exist as standalone logic.
- Capture core accepts exact adapter-supplied probability per ball and multiple target snapshots.
- A Phase 1 SolVolrund 2P capture bridge source exists under `integrations/solvolrund-2p/`.
- The adapter reads the active command player's ball inventory and labels multiple active wild targets separately.
- Advisor core/extension passes local `tsc -p tsconfig.json --noEmit` after the Phase 1 changes.
- Primary and official PokeRogue both retain closely related capture/reward game structures.

Not yet confirmed working end-to-end:

- The 2P bridge compiling inside an actual `SolVolrund/pokerogue-2p-beta` checkout.
- Any live recommendation rendered from an actual running game.
- The decision utility layer for capture actions.
- A manual comparison between displayed capture percentage and a real encounter.
- Official PokeRogue adapter.
- Packaged extension installation after a clean `npm install && npm run build` on a normal development machine.

## Debugging history

| Problem | Root cause / finding | Resolution |
|---|---|---|
| Initial extension plan assumed direct `window` access | Content scripts run in an isolated JS world | Use a serialized `window.postMessage` boundary. |
| Capture model treated critical chance as one target-wide value | PokeRogue critical-capture chance depends on modified catch rate, so it varies by ball | Let the game adapter supply exact final probability per ball; keep generic math only as fallback. |
| A capture snapshot assumed one enemy target | In 2P battles the Ball command may have multiple valid enemies before `SelectTargetPhase` | Support `captureTargets[]` and label every recommendation with its target when needed. |
| Percentage-only output would still leave close decisions to the player | Probability does not include resource cost, team value, or practical equivalence | Add a decision utility layer and qualitative recommendation strength; raw percentages become supporting evidence. |
| Full npm bundle was not validated in the assistant runtime | Runtime could not reach npm registry | Type-check locally where possible; validate full install/build on a normal dev machine before claiming release readiness. |

## What's next

Finish **Phase 1 only** on a real game checkout, but validate a decision rather than only a percentage:

1. Install the Phase 1 bridge into the 2P checkout.
2. Run the 2P game's typecheck/build.
3. Build/load the Advisor extension.
4. Open one live wild encounter and verify the displayed probabilities against the game's capture inputs.
5. Add/tune the minimum capture decision utility so the overlay can recommend `throw now`, `prepare first`, or `skip` and select a sensible ball without wasting scarce resources on negligible percentage gains.

Do not begin battle/reward/shop bridge work until this vertical slice succeeds.

## Session protocol

Before a development session:

1. Read this file.
2. Identify the active Build Plan phase.
3. State the session goal in one sentence.
4. Flag anything here that appears stale before coding.

During a session:

1. Stay inside the active phase unless scope is consciously changed.
2. Build the smallest next piece.
3. Run or test it immediately.
4. Record failures/root causes when discovered.
5. Update decisions when architecture changes.

At the end of a session:

1. Update Current state.
2. Update phase status and done criteria.
3. Update Debugging history.
4. Update Locked design decisions if needed.
5. Set one concrete What's next item.
