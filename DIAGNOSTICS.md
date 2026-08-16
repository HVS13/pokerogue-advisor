# Advisor diagnostics

Use these commands later when you want to test without spending time guessing whether the source adapter was installed correctly.

## PokeRogue 2P

From the Advisor artifact/repository root:

```bash
node integrations/solvolrund-2p/doctor.mjs "C:\path\to\pokerogue-2p-beta"
```

A healthy install reports:

```text
OK  capture-battle-bridge
OK  reward-shop-bridge
OK  capture-battle-import
OK  reward-shop-import
OK  planner-hook
RESULT: READY
```

If a check is missing, re-run:

```bash
node scripts/install-2p.mjs "C:\path\to\pokerogue-2p-beta"
```

Then restart the game dev server and reload the browser tab.

## Official PokeRogue local checkout

```bash
node integrations/pagefaultgames-official/doctor.mjs "C:\path\to\pokerogue"
```

A healthy capture-only install reports:

```text
OK  capture-bridge
OK  capture-import
RESULT: READY
```

If incomplete, re-run:

```bash
node scripts/install-official.mjs "C:\path\to\pokerogue"
```

## Export a decision session

The extension automatically keeps only the last **100 meaningful decision states in memory**. It ignores idle states, timestamp-only changes, and repeated copies of the same state.

Press:

```text
Shift+F8
```

to download a small `pokerogue-advisor-session-*.json` file.

The file contains only the serialized Advisor snapshot and the recommendation produced from it. It is intended for reproducing bad or confusing advice. The recorder does not upload anything, use browser storage, inspect save files, or add extension permissions.

If a recommendation looks wrong later, send that JSON file instead of trying to recreate the run from memory.

## Replay a recorded session during development

From a source checkout of this repository:

```bash
npm run replay -- path\to\pokerogue-advisor-session.json
```

Replay recomputes every recorded recommendation with the current Advisor core and reports whether the output still matches exactly. This makes decision regressions reproducible without launching PokeRogue.

## What the doctor intentionally does not do

It does not modify files, launch the game, inspect save data, send network messages, or attempt to repair a partially modified checkout. It only reads the expected local source files and reports whether the Advisor integration points are present.

The normal installers remain the single repair path so diagnostics cannot silently make new source changes.
