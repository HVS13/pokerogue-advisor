# Implementation roadmap

## Phase 1: Game bridge

Wire a read-only snapshot adapter into the target PokeRogue fork.

Reuse existing game logic instead of duplicating it where possible:

- move and switch evaluation from `src/utils/battle-planner-ai.ts`
- capture probability and replacement evaluation from `src/utils/computer-partner-capture-ai.ts`
- reward and recovery/shop decisions from `src/utils/computer-partner-reward-ai.ts`

Do not expose mutable Phaser/game objects. Return plain serializable data.

### First bridge contexts

- battle command selection
- Pokeball/capture selection
- reward selection
- shop selection

## Phase 2: Overlay

- battle move ranking
- switch recommendation
- capture percentages for every available ball
- team-fit and replacement recommendation
- reward ranking
- shop recommendation
- F8 toggle
- simple/detailed view

## Phase 3: Recommendation quality

- damage ranges from the game's actual damage path where practical
- KO probability
- explain type/STAB/status/survival tradeoffs
- account for held items and modifiers
- double/triple battle targeting and ally coordination

## Phase 4: Better probabilities

Planner scores are recommendation scores, not true win probabilities.

Add deterministic forward simulation or MCTS only after the V1 overlay is useful. At that point, show simulation-backed outcome percentages separately from planner confidence.
