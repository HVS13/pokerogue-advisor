# PokeRogue Advisor

A read-only decision assistant and on-screen overlay for PokeRogue.

## Supported targets

| Game | Priority | Strategy |
|---|---|---|
| `SolVolrund/pokerogue-2p-beta` | Primary | Reuse its live state and existing planner/capture/reward logic. |
| `pagefaultgames/pokerogue` | Optional | Use a separate adapter over official capture, enemy-AI scoring, reward/shop, and live state structures. |

The advisor core and overlay do not fork per game. Only the game adapter changes.

## Product goal

While playing, show the best practical choice without requiring the player to leave the game or manually calculate it.

High-value decisions:

1. Capture chance, best ball, and catch/skip guidance.
2. Battle move ranking.
3. Reward choice ranking.
4. Shop/recovery ranking.
5. Party-fit and replacement guidance.

## Build philosophy

This project uses a Pareto-first approach: deliver the small set of features that creates most player value before adding advanced simulation or polish.

The project workflow is documented in [`AGENTS.md`](./AGENTS.md). In short:

- requirements and architecture stay written down
- MVP scope has explicit IN and OUT
- each phase has observable done criteria
- build one vertical slice, run/test it, then continue
- diagnose root cause before fixing
- record failures and locked decisions so they are not rediscovered later

## Architecture

The project is intentionally split into three layers:

1. **Game adapter**: converts one supported PokeRogue build's live state into a stable, read-only `AdvisorSnapshot`.
2. **Advisor core**: game-agnostic scoring, ranking, probability, and explanation logic.
3. **Advisor extension**: requests serialized snapshots over `window.postMessage` and renders recommendations over the game.

The `postMessage` boundary matters because normal browser-extension content scripts run in an isolated JavaScript world and should not depend on directly reading page-owned JS objects.

## Why not OCR?

PokeRogue already knows exact HP, status, species, moves, party state, rewards, money, shop options, and capture mechanics. Using pixels would discard reliable state we can obtain from a small source adapter.

## Active MVP phase

**Phase 1: one real live capture recommendation on the 2P fork.**

The first 2P bridge source and installer now live in [`integrations/solvolrund-2p/`](./integrations/solvolrund-2p/).

Before expanding scope, we still must prove end-to-end that:

- the adapter compiles inside a real 2P checkout
- the game emits a serialized capture snapshot
- the extension receives it
- the overlay shows every currently usable ball and its capture percentage
- at least one displayed value is manually verified against the game's own formula

See [`integrations/solvolrund-2p/INSTALL.md`](./integrations/solvolrund-2p/INSTALL.md), [`AGENTS.md`](./AGENTS.md), and [`ROADMAP.md`](./ROADMAP.md).

## Development

```bash
npm install
npm run check
npm run build
```

Then load `extension/` as an unpacked browser extension.

The extension and game adapter exchange serialized request/snapshot messages through same-page `window.postMessage`. The advisor never sends game inputs.

## Probability labels

- Capture percentages can be actual probabilities when calculated from the game's mechanics.
- The 2P adapter sends exact final probability per ball because critical-capture chance varies with modified catch rate.
- Battle planner percentages are **recommendation confidence**, not win probability.
- Do not label battle recommendations as win probability until a real forward simulator or MCTS layer exists.

## Status

The standalone advisor scaffold and the first 2P capture adapter are implemented. Core/extension TypeScript passes a local type-check. The next required milestone is compiling the adapter inside an actual 2P checkout and verifying one live encounter before adding battle/reward/shop integration.
