# Browser extension

The extension is a read-only overlay. It requests serialized snapshots from the game bridge via `window.postMessage` and never sends PokeRogue inputs.

## Build

From the repository root:

```bash
npm install
npm run build
```

This produces `extension/advisor.js`.

Then open your browser's extensions page, enable developer mode, and load `extension/` as an unpacked extension.

Press **F8** in game to show or hide the overlay.

## Host permissions

The starter manifest accepts HTTP pages because the multiplayer fork commonly runs on localhost or a LAN IP. If you host the game on a fixed origin, narrow the `matches` list to that origin.
