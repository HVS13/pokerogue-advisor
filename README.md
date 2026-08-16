# PokeRogue Advisor

A read-only, decision-first on-screen advisor for PokeRogue.

## Supported targets

| Game | Status | Strategy |
|---|---|---|
| `SolVolrund/pokerogue-2p-beta` | Primary, developer-complete for core MVP decisions | Reuse exact capture mechanics, the existing battle planner, reward scoring, recovery/shop scoring, and per-player live state. |
| `pagefaultgames/pokerogue` | Optional compatibility, capture adapter next | Keep the same core/overlay and add a thin official-game adapter. |

The advisor core and overlay do not fork per game. Only the source adapter changes.

## Product rule

**Decision first, numbers second.**

The overlay should lead with an action:

```text
THROW ULTRA BALL NOW
WEAKEN WITH FALSE SWIPE
USE THUNDERBOLT → GYARADOS
PICK MULTI LENS
BUY REVIVE
SAVE MONEY
```

Then it shows recommendation strength, concise reasons, and supporting probabilities/scores.

Raw percentages are not the product. Near-equal choices are treated as equivalent so a meaningless numeric edge does not waste scarce resources.

## Current 2P MVP

Implemented and automated-tested:

- exact catch probability for each usable ball
- practical ball selection with scarcity and Master Ball conservation
- `THROW` / `WEAKEN` / `APPLY STATUS` / `SKIP` capture decisions
- conservative catch value and replacement candidate
- 3- or 6-Pokémon 2P party awareness
- battle `USE <MOVE> → <TARGET>` decisions from the fork's existing one-turn planner
- qualitative battle strength without fake win/confidence percentages
- reward `PICK` / `SKIP REWARD`
- recovery shop `BUY` / `SAVE MONEY`
- emergency recovery priority, target, money, and reserve explanations
- F8 overlay
- cross-origin-safe `window.postMessage` boundary
- automated integration checks against the real current SolVolrund source

The remaining 2P work is human acceptance in an actual browser/game session. Development does not wait on that.

## RNG safety

Advisor inspection must not alter seeded game outcomes.

- Battle advice uses a deterministic planner-evaluation export and never calls the planner's random final chooser.
- Reward scoring can use random target fallbacks internally, so the adapter saves and restores `Phaser.Math.RND.state()` around each advisor evaluation.

## Architecture

1. **Game adapter** converts live game state into a serialized `AdvisorSnapshot`.
2. **Advisor core** performs game-agnostic decision utility, ranking, thresholds, and explanations.
3. **Browser overlay** requests snapshots over same-page `window.postMessage` and renders decisions.

No OCR is required when source state is available.

## Install into PokeRogue 2P

From the advisor repository root:

```bash
node scripts/install-2p.mjs "C:\path\to\pokerogue-2p-beta"
```

Then:

```bash
npm install
npm test
npm run build
```

Load `extension/` as an unpacked Chrome/Edge extension and run PokeRogue 2P normally.

See [`integrations/solvolrund-2p/INSTALL.md`](./integrations/solvolrund-2p/INSTALL.md) for details and reverting instructions.

## Automated testing

Every push/PR runs the advisor test/build suite plus an integration job that:

1. checks out the current `SolVolrund/pokerogue-2p-beta`
2. installs its dependencies
3. records its existing TypeScript-error baseline
4. installs the Advisor bridge/sidecars/planner hook
5. typechecks again
6. fails if Advisor introduces new TypeScript errors

The baseline comparison is needed because the upstream 2P checkout can already have asset-related TypeScript errors when some asset JSON files are unavailable.

## Optional official PokeRogue compatibility

The next Pareto slice is **capture-only support** for `pagefaultgames/pokerogue` on its current `beta` branch.

The same advisor core and overlay will remain unchanged. The official adapter will only translate official live state and mechanics into the existing snapshot contract.

Battle/reward/shop parity for official PokeRogue waits until official capture compatibility is green.

## Development philosophy

The project uses a Pareto-first workflow plus the AI Builder-style discipline captured in [`AGENTS.md`](./AGENTS.md): explicit scope, small vertical slices, immediate tests, root-cause debugging, and recorded decisions.

See [`ROADMAP.md`](./ROADMAP.md) for the short execution view.
