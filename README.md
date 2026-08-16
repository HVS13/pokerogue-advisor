# PokeRogue Advisor

A read-only, decision-first on-screen advisor for PokeRogue.

## Supported targets

| Game | Status | Strategy |
|---|---|---|
| `SolVolrund/pokerogue-2p-beta` | Primary, developer-complete for core MVP decisions | Exact capture mechanics, existing battle planner, reward scoring, recovery/shop scoring, and per-player live state. |
| `pagefaultgames/pokerogue` | Capture compatibility developer-complete | Thin official capture adapter using the same advisor core/overlay. |

The advisor core and overlay do not fork per game. Only the source adapter changes.

## Product rule

**Decision first, numbers second.**

The overlay leads with actions such as:

```text
THROW ULTRA BALL NOW
WEAKEN WITH FALSE SWIPE
USE THUNDERBOLT → GYARADOS
PICK MULTI LENS
BUY REVIVE
SAVE MONEY
```

Then it shows qualitative recommendation strength, concise reasons, and supporting probabilities/scores. Near-equal choices are treated as equivalent so meaningless numeric edges do not waste scarce resources.

## Current 2P MVP

Implemented and automated-tested:

- exact catch probability per usable ball
- practical ball selection and Master Ball conservation
- `THROW` / `WEAKEN` / `APPLY STATUS` / `SKIP`
- conservative catch value and replacement candidate
- 3- or 6-Pokémon party awareness
- `USE <MOVE> → <TARGET>` from the existing one-turn planner
- qualitative battle strength without fake probability/confidence percentages
- reward `PICK` / `SKIP REWARD`
- recovery shop `BUY` / `SAVE MONEY`
- emergency recovery, target, money, and reserve explanations
- F8 overlay
- origin-checked `window.postMessage`
- automated integration checks against the real current SolVolrund source

Human browser/game acceptance remains deferred and does not block development.

## Official PokeRogue capture compatibility

Capture-only compatibility for `pagefaultgames/pokerogue@beta` is also developer-complete and automated-tested.

The official adapter provides:

- exact current official capture probability per available ball
- official ball inventory and wild-target state
- shared practical resource-aware ball choice
- shared conservative catch-value/replacement inputs
- a separate idempotent installer
- real official-source CI compatibility checks

It intentionally does **not** copy 2P-only weakening/status helpers, battle planner, or reward/shop AI into official PokeRogue.

Install into an official checkout with:

```bash
node scripts/install-official.mjs "C:\path\to\pokerogue"
```

See [`integrations/pagefaultgames-official/INSTALL.md`](./integrations/pagefaultgames-official/INSTALL.md).

## RNG safety

Advisor inspection must not alter seeded game outcomes.

- Battle advice uses a deterministic planner-evaluation export and never calls the planner's random final chooser.
- Reward scoring can use random target fallbacks internally, so the 2P adapter saves and restores `Phaser.Math.RND.state()` around each evaluation.

## Architecture

1. **Game adapter** converts live game state into serialized `AdvisorSnapshot` data.
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

Load `extension/` as an unpacked Chrome/Edge extension and run PokeRogue normally.

See [`integrations/solvolrund-2p/INSTALL.md`](./integrations/solvolrund-2p/INSTALL.md) for details and reverting instructions.

## Automated testing

Every push/PR runs the advisor test/build suite plus real-source jobs for both supported targets. Each integration records upstream TypeScript errors before installation, installs the appropriate Advisor adapter, typechecks again, and rejects new Advisor-introduced errors.

Tests also cover capture shake/critical math, resource decisions, battle decisions, reward/shop decisions, cross-origin message rejection, installer idempotency, RNG safety assertions, and the built extension bundle.

## Current development focus

The high-value 2P decision loop and official capture compatibility are built. The next Pareto step is **integration hardening**, especially deterministic provider routing and cleaner packaging/diagnostics, rather than immediately expanding optional official battle/reward/shop parity.

## Development philosophy

The project uses a Pareto-first workflow plus the AI Builder-style discipline captured in [`AGENTS.md`](./AGENTS.md): explicit scope, small vertical slices, immediate tests, root-cause debugging, and recorded decisions.

See [`ROADMAP.md`](./ROADMAP.md) for the short execution view.
