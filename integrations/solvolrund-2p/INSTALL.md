# SolVolrund 2P adapter — Phase 1 capture bridge

This is the smallest end-to-end integration for `SolVolrund/pokerogue-2p-beta`.

It only exposes read-only capture-menu state. It does not press inputs or alter multiplayer messages.

## Fast install on Windows

From the advisor repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\integrations\solvolrund-2p\install-into-2p.ps1 -GameRoot "C:\path\to\pokerogue-2p-beta"
```

`-GameRoot` may point either to the outer `pokerogue-2p-beta` repository or directly to its `pokerogue-beta` game folder.

The installer is idempotent: it copies the bridge and adds the required import only if it is missing.

## Manual install

From this repository, copy:

```text
integrations/solvolrund-2p/pokerogue-advisor-bridge.ts
```

to:

```text
<2P repo>/pokerogue-beta/src/pokerogue-advisor-bridge.ts
```

Then add this one side-effect import near the top of:

```text
<2P repo>/pokerogue-beta/src/main.ts
```

```ts
import "./pokerogue-advisor-bridge";
```

Do not modify the multiplayer relay.

## Run

Start PokeRogue 2P normally:

```bash
corepack pnpm run start:dev:lan
corepack pnpm run start:2p-ws:lan
```

Build this advisor repository:

```bash
npm install
npm run build
```

Load `extension/` as an unpacked Chrome/Edge extension, then reload the game page.

## Expected Phase 1 behavior

1. Outside the Poké Ball menu, the overlay says to open the ball menu.
2. Open **Ball** during a catchable encounter.
3. The overlay lists every currently usable ball with an estimated catch percentage.
4. In a multi-enemy 2P battle, each target is labeled separately so advice cannot silently refer to the wrong wild Pokémon.
5. F8 toggles the overlay.

## Manual verification

For one encounter, compare the overlay against the game's own capture inputs:

- current HP / max HP
- species catch rate
- ball multiplier
- status multiplier
- shiny-event multiplier
- player-specific critical-capture chance

The adapter calculates critical-capture probability separately for each ball because the game's critical chance depends on modified catch rate.

## Current limitation

The bridge is stored here because this GitHub connection has no push permission to `SolVolrund/pokerogue-2p-beta`. It must be installed into that game checkout (or applied in a fork you control) before live recommendations can work.
