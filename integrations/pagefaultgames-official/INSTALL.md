# Official PokeRogue capture adapter

Target: `pagefaultgames/pokerogue`, current default branch `beta`.

This adapter is intentionally capture-only for the first compatibility slice. It does not add the 2P battle planner patch or reward/shop sidecar.

## Install

From the advisor repository root:

```bash
node scripts/install-official.mjs "C:\path\to\pokerogue"
```

The installer:

1. copies `integrations/pagefaultgames-official/pokerogue-advisor-bridge.ts` to the official game's `src/` folder
2. adds one side-effect import after i18n initialization in `src/main.ts`

It is idempotent and does not modify battle/reward logic.

## Build and run

Build the advisor normally:

```bash
npm install
npm test
npm run build
```

Load `extension/` as an unpacked Chrome/Edge extension, then run your local official PokeRogue checkout normally.

## Current behavior

Open the **Poké Ball** menu in a catchable encounter. The adapter sends:

- active wild target(s)
- exact HP / max HP
- species catch rate
- status catch multiplier
- shiny event multiplier
- exact final catch probability per available ball
- party species/current BST/types for the shared conservative catch-value logic

The existing advisor core then decides a practical ball, applies the same near-equal/resource-conservation rules, and can provide conservative catch-value/replacement guidance.

The official adapter currently does **not** recommend weakening/status setup because the 2P-only capture helper is not available upstream. Do not copy that helper into official PokeRogue just to force feature parity.

## Capture formula

The adapter mirrors the current official `AttemptCapturePhase` mechanics:

- HP factor and species catch rate
- official Poké Ball multiplier
- status multiplier
- timed shiny catch multiplier
- official `getCriticalCaptureChance(modifiedCatchRate)`
- one shake for critical capture, three shakes otherwise
- Master Ball / modified catch rate ≥255 => guaranteed

## Revert

Restore `src/main.ts` from your normal Git workflow and delete:

```text
src/pokerogue-advisor-bridge.ts
```

## Automated compatibility

GitHub Actions checks out `pagefaultgames/pokerogue@beta`, installs its dependencies, records upstream TypeScript errors, installs this adapter, typechecks again, and fails only if the adapter adds new TypeScript errors.

Human browser acceptance can happen later and does not block development.
