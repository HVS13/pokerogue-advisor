# PokeRogue Advisor quickstart

This is the shortest path for testing a built GitHub Actions artifact later. You do **not** need to run `npm install` or build the extension when using that artifact.

## PokeRogue 2P

Unzip the Advisor artifact, then run:

```bash
node scripts/install-2p.mjs "C:\path\to\pokerogue-2p-beta"
```

Start PokeRogue 2P normally:

```bash
cd C:\path\to\pokerogue-2p-beta\pokerogue-beta
corepack pnpm run start:dev:lan
```

Start the multiplayer relay in another terminal when needed:

```bash
corepack pnpm run start:2p-ws:lan
```

In Chrome/Edge:

1. Open Extensions.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the artifact's `extension/` folder.
5. Open or reload the PokeRogue page.

Press **F8** to show/hide the overlay.

## Official PokeRogue local checkout

For current capture-only compatibility:

```bash
node scripts/install-official.mjs "C:\path\to\pokerogue"
```

Run that official checkout normally and load the same `extension/` folder.

## Current decision surfaces

PokeRogue 2P supports decision-first capture, battle, reward, and recovery-shop advice, for example:

```text
THROW ULTRA BALL NOW
WEAKEN WITH FALSE SWIPE
USE THUNDERBOLT → GYARADOS
PICK MULTI LENS
BUY REVIVE
SAVE MONEY
```

Official PokeRogue support is currently capture-only.

## If the overlay says the bridge is missing

The extension loaded, but the game source adapter was not detected. Re-run the appropriate installer, restart the game dev server, and reload the tab.

## Reverting 2P source changes

Restore these through your normal Git workflow:

```text
pokerogue-beta/src/main.ts
pokerogue-beta/src/utils/battle-planner-ai.ts
```

Then delete:

```text
pokerogue-beta/src/pokerogue-advisor-bridge.ts
pokerogue-beta/src/pokerogue-advisor-reward-bridge.ts
```

For official PokeRogue, restore `src/main.ts` and delete `src/pokerogue-advisor-bridge.ts`.

See the integration-specific INSTALL files for more detail.
