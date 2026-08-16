# PokeRogue Advisor

A read-only decision assistant and on-screen overlay for the PokeRogue multiplayer fork.

Target game: `SolVolrund/pokerogue-2p-beta`.

## Goals

- Rank battle moves and later switches.
- Show real capture probability by ball.
- Estimate whether a wild Pokemon improves the current party.
- Rank reward choices.
- Recommend shop purchases and healing.
- Explain recommendations on screen without automatically pressing inputs.

## Architecture

The project is intentionally split in two:

1. **Game bridge**: a tiny integration inside PokeRogue converts live game state and existing AI evaluations into a stable, read-only `AdvisorSnapshot`.
2. **Advisor extension**: a bundled browser content script requests that snapshot over `window.postMessage`, evaluates it, and renders recommendations over the game.

The `postMessage` boundary matters because normal browser-extension content scripts run in an isolated JavaScript world and should not depend on directly reading page-owned JS objects.

## Why not OCR?

The PokeRogue fork already knows exact HP, status, species, moves, party ownership, rewards, money, shop options, and capture mechanics. Using pixels would discard reliable state we already have.

## V1 roadmap

1. Capture percentages and best-ball recommendation.
2. Battle move ranking using PokeRogue's existing planner scores.
3. Reward and shop ranking using existing computer-partner AI.
4. Party/catch value and replacement recommendation.
5. Browser-extension overlay with F8 show/hide.
6. Later: Monte Carlo / forward simulation for true battle-outcome probabilities.

## Bridge contract

The game integration may expose a local debugging API:

```ts
window.pokerogueAdvisor = {
  version: 1,
  getSnapshot(): AdvisorSnapshot,
};
```

The extension requests serialized snapshots through `window.postMessage`. It never sends game inputs.

## Development

```bash
npm install
npm run check
npm run build
```

Then load `extension/` as an unpacked browser extension.

## Important probability labels

- Capture percentages can be actual probabilities because the game mechanics are known.
- Battle planner percentages are **recommendation confidence**, not win probability.
- Do not label battle recommendations as win probability until a real forward simulator or MCTS layer exists.

## Status

Starter scaffold. The next implementation step is wiring the bridge into the target fork's `globalScene`, battle planner, capture AI, and reward AI.
