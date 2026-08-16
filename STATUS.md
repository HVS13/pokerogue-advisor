# PokeRogue Advisor status

## Current state

The core 2P MVP is **developer-complete and automated-tested**. Human browser/live-game acceptance is intentionally deferred until the player has time.

### SolVolrund PokeRogue 2P

Implemented:

- exact per-ball capture probability
- practical resource-aware ball choice
- `THROW`, `WEAKEN`, `APPLY STATUS`, and `SKIP` capture decisions
- conservative catch value and replacement candidate
- 3/6-Pokémon party awareness
- battle `USE <MOVE> → <TARGET>` decisions from the existing planner
- qualitative battle strength without fake win/confidence percentages
- reward `PICK` / `SKIP REWARD`
- recovery shop `BUY` / `SAVE MONEY`
- emergency recovery, target, money, and reserve explanations
- RNG-safe planner/reward inspection

### Official Pagefault Games PokeRogue

Implemented:

- capture-only adapter on the current `beta` target
- exact official capture probability
- official Poké Ball inventory and wild-target state
- shared practical ball/resource decision core
- shared conservative catch-value inputs
- separate idempotent installer

Official battle/reward/shop parity remains optional and intentionally deferred.

## Integration hardening

Implemented:

- origin-checked `window.postMessage` boundary
- non-idle snapshot arbitration so fallback `idle` responses cannot immediately overwrite a real decision
- content-based render key that ignores transport-only `generatedAt` changes
- PokeRogue page detection before starting the polling/render loop
- broad LAN/VPN HTTP support while avoiding broad all-HTTPS injection
- unrelated pages stay inert
- decision cards headline qualitative strength rather than opaque internal scores

## Testing and packaging

Automated coverage includes:

- capture formula regression
- capture/resource/catch-value decisions
- battle decisions
- reward/shop decisions
- multi-target ordering
- cross-origin rejection
- browser-message/overlay simulation
- built extension smoke test
- installer/sidecar/planner-hook idempotency
- real current SolVolrund source compatibility
- real current Pagefault Games official source compatibility
- bounded/deduplicated acceptance recording
- deterministic recorded-session replay verification

Acceptance tooling:

- `integrations/solvolrund-2p/doctor.mjs`
- `integrations/pagefaultgames-official/doctor.mjs`
- automatic in-memory recorder for the last 100 meaningful decision states
- `Shift+F8` local JSON export
- `npm run replay -- <session.json>` developer replay verifier
- `QUICKSTART.md`
- `DIAGNOSTICS.md`

The recorder adds no telemetry, backend, browser storage, or extra extension permissions. It ignores idle states and timestamp-only repeats.

Packaging:

- ready-to-test GitHub Actions package with built extension and installers
- 90-day durable package on `main`
- `BUILD.txt` identifies the exact packaged commit

## Upstream drift monitoring

A scheduled compatibility workflow checks the latest supported upstream branches weekly, installs each adapter twice, and rejects new TypeScript errors introduced by Advisor.

## Human acceptance still pending

When convenient later:

1. install a ready-to-test package
2. run the appropriate doctor command
3. launch the game
4. verify overlay fit/feel and one live capture probability
5. if advice looks wrong or confusing, press `Shift+F8` and send the exported session JSON

Development does not need to wait for this acceptance, but **new advanced AI features should wait for real-play evidence** so the project stays Pareto-focused.

## Next engineering trigger

Do not add MCTS, exact damage/KO simulation, switch advice, or full official parity by default. Add the next feature only when one of these becomes true:

- acceptance testing exposes a concrete decision failure, preferably with a recorded session
- upstream compatibility breaks
- a missing feature repeatedly forces the player to make a high-value decision manually
