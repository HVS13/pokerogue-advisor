# SolVolrund 2P adapter — Phase 1 capture bridge

This is the smallest end-to-end integration for `SolVolrund/pokerogue-2p-beta`.

It only exposes read-only capture-menu state. It does not press inputs or alter multiplayer messages.

## Fast install

From the advisor repository root, run:

```bash
node scripts/install-2p.mjs "C:\path\to\pokerogue-2p-beta"
```

The path may point either to the outer `pokerogue-2p-beta` repository or directly to its `pokerogue-beta` game folder.

The installer is cross-platform and idempotent: it copies the bridge and adds the required import only if it is missing. A PowerShell installer remains available under this folder as an alternative.

## Manual install

Copy:

```text
integrations/solvolrund-2p/pokerogue-advisor-bridge.ts
```

to:

```text
<2P repo>/pokerogue-beta/src/pokerogue-advisor-bridge.ts
```

Then add this side-effect import near the top of `<2P repo>/pokerogue-beta/src/main.ts`:

```ts
import "./pokerogue-advisor-bridge";
```

Do not modify the multiplayer relay.

## Test and build the advisor

```bash
npm install
npm test
npm run build
```

Then load `extension/` as an unpacked Chrome/Edge extension and reload the game page.

## Run PokeRogue 2P

Start it normally:

```bash
corepack pnpm run start:dev:lan
corepack pnpm run start:2p-ws:lan
```

## Expected Phase 1 behavior

1. Outside the Poké Ball menu, the overlay tells you to open the ball menu.
2. Open **Ball** during a catchable encounter.
3. The overlay leads with a decision such as `USE ULTRA BALL NOW`, plus recommendation strength and a short reason.
4. Ball percentages remain visible as supporting evidence.
5. Near-equal odds prefer the cheaper resource. Example: 85.8% Ultra vs 86.0% Rogue recommends Ultra rather than wasting Rogue for 0.2 percentage points.
6. Master-tier resources are preserved by default until target-value/team-fit data justifies them.
7. In a multi-enemy 2P battle, each target is labeled separately.
8. F8 toggles the overlay.

## Automated checks

`npm test` currently covers:

- TypeScript checks
- capture decision/resource-conservation cases
- multi-target labeling
- cross-origin message rejection
- simulated game bridge → extension → decision → overlay flow
- 2P bridge compatibility fixture
- installer idempotency
- built extension bundle smoke test

GitHub Actions runs the same suite on pushes and pull requests.

## Remaining live verification

A real running `SolVolrund/pokerogue-2p-beta` checkout still needs one end-to-end browser encounter to verify that the live game emits the same data shape as the compatibility fixture and that the displayed probability matches a real encounter.
