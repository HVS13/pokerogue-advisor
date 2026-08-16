# SolVolrund 2P adapter

This integration adds read-only capture, battle, reward, and shop advice to `SolVolrund/pokerogue-2p-beta`.

It does not press inputs and does not alter multiplayer messages.

## Fast install

From the advisor repository root, run:

```bash
node scripts/install-2p.mjs "C:\path\to\pokerogue-2p-beta"
```

The path may point either to the outer `pokerogue-2p-beta` repository or directly to its `pokerogue-beta` game folder.

The Node installer is cross-platform and idempotent. It performs four local source changes:

1. Copies `pokerogue-advisor-bridge.ts` into the game's `src/` folder.
2. Copies `pokerogue-advisor-reward-bridge.ts` into the game's `src/` folder.
3. Adds both side-effect imports to `src/main.ts`.
4. Adds one small exported evaluation helper to `src/utils/battle-planner-ai.ts` and refactors the existing chooser to reuse the same scoring helper.

The planner patch exposes the already-computed candidate scores without calling the seeded/random final-choice selector. The normal game chooser keeps using its existing selection logic.

The reward/shop sidecar reuses the fork's existing reward and recovery scoring. Some reward target fallbacks use Phaser's seeded RNG, so each advisor reward evaluation snapshots `Phaser.Math.RND.state()` and restores it in `finally`. Advisor inspection therefore must leave game RNG unchanged.

If the upstream planner block changes, the installer fails closed with an error instead of guessing how to patch it.

Do not modify the multiplayer relay.

## Reverting

If the game checkout is a Git repository and you want to remove the local integration, restore these game files from Git:

```text
pokerogue-beta/src/main.ts
pokerogue-beta/src/utils/battle-planner-ai.ts
```

and delete:

```text
pokerogue-beta/src/pokerogue-advisor-bridge.ts
pokerogue-beta/src/pokerogue-advisor-reward-bridge.ts
```

Use your normal Git workflow if you already have unrelated local changes in those files.

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

## Capture behavior

During a catchable encounter, open **Ball**. The overlay can lead with decisions such as:

```text
THROW ULTRA BALL NOW
WEAKEN WITH FALSE SWIPE
APPLY SLEEP WITH SPORE
SKIP RATTATA
```

Percentages remain supporting evidence. Near-equal odds prefer the cheaper resource, and Master-tier resources are gated by target value plus the reliability of non-premium balls.

The bridge also sends portable party facts for conservative catch-value and replacement judgment. Half Party and Full Party modes use the game's actual `twoPlayerPartySize`.

## Battle behavior

On **Command** or **Fight**, the bridge runs the fork's existing one-turn battle planner evaluation and caches the result until the decision state changes.

The overlay leads with a recommendation such as:

```text
USE THUNDERBOLT → GYARADOS
Strength: Strong
```

Raw planner scores are supporting evidence, not win probability. Close planner scores are labeled `Slight` or `Equivalent` instead of pretending tiny score differences are certain.

The advisor evaluation path deliberately does not call the planner's seeded/random final-choice selector, switch selector, or reposition selector. Opening the overlay must not consume battle RNG.

## Reward and shop behavior

On the modifier/reward screen, the advisor treats rewards and recovery purchases as two decisions on the same surface:

```text
PICK MULTI LENS
BUY REVIVE
```

or, when no recovery purchase survives affordability/reserve checks:

```text
PICK LEFTOVERS
SAVE MONEY
```

The reward row uses the fork's existing item/tier/target scoring without applying computer-partner personality roles to the human player. The shop row uses the existing recovery scoring, emergency flag, exact adjusted shop cost, current player money, and the fork's revive+heal reserve calculation.

Emergency recovery outranks a higher non-emergency raw score. After recommending a purchase, the overlay explicitly says to reassess because HP, PP, money, and reserve state change after each buy.

Reward target scoring can contain random fallbacks. The sidecar snapshots and restores Phaser RNG around each evaluation, so merely opening or polling the advisor must not advance the game's seeded RNG.

## Automated checks

`npm test` covers:

- TypeScript checks
- capture decisions and resource conservation
- safe weaken/status preparation decisions
- conservative catch-value/replacement scoring
- Master Ball release thresholds
- battle decision strength and target formatting
- reward `PICK` / `SKIP` decisions
- shop `BUY` / `SAVE` decisions and emergency priority
- multi-target decision ordering
- cross-origin message rejection
- simulated bridge → extension → capture/battle/reward-shop decision → overlay flow
- installer, reward-sidecar, and planner-hook idempotency
- built extension bundle smoke test

GitHub Actions also checks out the real current `SolVolrund/pokerogue-2p-beta` source, captures its existing TypeScript error baseline, installs this integration, and fails if the advisor introduces any new TypeScript errors.

## Remaining human acceptance

Automated tests cannot verify visual fit and feel inside your exact Chrome/Edge + Phaser + LAN session. That final acceptance can be done later; development does not need to wait for it.
