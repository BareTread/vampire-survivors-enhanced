# 🎮 Vampire Survivors Enhanced - Architectural Handover

## 🎯 Current Status
The UI/UX polishing phase is complete, and we have just finished **Sprint 29: The Smart Rarity & HUD Polish Update**. The game now features a fully cohesive, 100% canvas-rendered interface with adaptive layouts, removing our reliance on DOM-based HTML overlays for in-game and menu screens. The in-game HUD has been meticulously scaled for perfect readability, and the level-up system now features a deterministic, build-aware recommendation engine.

**Final Test Status**: 123/123 tests passing across 9 suites.

## 🛠️ Recent Achievements (Sprint 29)
1. **Smart Rarity Scoring Engine (`RaritySystem.js`)**: Replaced the random dice-roll rarity system with a deterministic, 0-100 scoring engine. Rarity (Common → Epic) now accurately reflects the value of an option based on:
   - **Base Type Value**: Scaling value for weapon/passive upgrades.
   - **Build Synergy**: Massive score boosts for passives that enable weapon evolutions for currently owned max-level weapons. Diminishing returns on repeatedly picking the same stat upgrade.
   - **Contextual Scarcity**: Score boosts for early-game weapons or the final weapon/passive slot.
2. **Informational Rarity**: Rarity is now purely a "build advisor" label. It no longer applies hidden multipliers to stat upgrades, ensuring the game's balance math remains clean and predictable.
3. **HUD Readability Polish (`CanvasHUD.js`)**: Carefully bumped the sizing of all in-game HUD elements by ~20%.
   - Weapon slots (38→46px) and passive slots (26→32px) are larger and easier to parse.
   - All HUD fonts (XP, Gold, Kills, Level, Map) were bumped from the unreadable 7-9px range up to a crisp 9-12px+ range.
   - Minimap radius increased for better spatial awareness.
4. **Scoring Test Coverage**: Added `tests/rarity-scoring.test.js` with 16 new tests verifying the synergy logic, diminishing returns, and base scoring math to ensure the recommendation engine never breaks.

## 🏛️ Architectural Principles (To Be Maintained)
To keep the game "well put together and thoughtfully engineered", please adhere to the following principles:

1. **Canvas-First Rendering**: With the exception of the Settings menu, all game UI (HUD, Menus, Pause, Codex, Upgrades) is now drawn directly to the canvas context. **Do not introduce new HTML/DOM overlays** unless absolutely necessary (e.g., complex text inputs).
2. **Entity & Memory Pooling**: The game manages 1000s of entities (particles, projectiles, damage numbers). Always use the established pool patterns (e.g., `globalDamageNumberPool`, `ProjectileSystem.js`) rather than instantiating `new Object()` inside the game loop.
3. **Event-Driven UI**: `VampireSurvivorsGame.js` acts as the router. Keyboard and mouse inputs are caught centrally and routed to the active `gameState` system (e.g., `this.systems.titleScreen.handleInput`). Keep this routing clean and centralized.
4. **Zero-Overhead Updates**: The `update(dt)` loop must remain brutally fast. Avoid `.filter()`, `.map()`, or `.forEach()` in hot paths. Use standard `for (let i=0; i<len; i++)` loops for entity arrays. Run heavy logic (like `RaritySystem.scoreOption`) ONLY on discrete events like level-ups, never in the `update()` loop.
5. **Separation of Concerns**: Visual rendering (`render(ctx)`) should NEVER mutate game state. Game logic (`update(dt)`) should NEVER call rendering functions.

---

## 🚀 Strategic Roadmap & Ideas for the Next Agent

Now that the foundation is rock solid, visually polished, and features an intelligent recommendation engine, here are thoughtful ways to build upon the game without compromising the architecture:

### 1. The Equipment Synergy System (The "Build Crafter" Update)
**Concept**: Enhance `SynergySystem.js` to support passive-to-passive or passive-to-weapon interactions, not just weapon evolutions.
* **Idea**: E.g., Having "Candelabrador" (Area) and "Empty Tome" (Cooldown) grants a hidden "Overcharge" buff that makes weapons emit shockwaves.
* **Engineering**: Build upon the synergy concepts introduced in the new `RaritySystem.js`. Add a `evaluateBuildSynergies()` method that runs *only on level up* (to save CPU) and caches a `player.buildModifiers` object that weapons read from during their attack logic.

### 2. The Dynamic Events Expansion (The "Run Variance" Update)
**Concept**: Make every run feel fundamentally different by expanding `DynamicEventsSystem.js`.
* **Idea**: Implement "Environmental Hazards" (e.g., meteor strikes, toxic fog zones, healing springs) that spawn temporarily on the map.
* **Engineering**: Build a `ZoneManager` inside `TerrainSystem.js` that emits signals when the player enters special chunks. Bind these signals to visual effects in `AmbientParticlesSystem.js`.

### 3. Advanced Enemy Behaviors (The "Tactical AI" Update)
**Concept**: Move away from 100% "walk directly at player" logic.
* **Idea**: Introduce enemy formations (V-shape, encircling rings) or support enemies (healers, speed-buffers for other enemies).
* **Engineering**: Create an `EnemySquad` manager. Instead of updating 500 enemies individually, update 10 `EnemySquad` objects, and have individual enemies interpolate their positions relative to their squad leader using flocking/boids algorithms. This actually *improves* performance while adding complexity.

### 4. Meta-Progression Deepening
**Concept**: Give players more to do with their gold long-term.
* **Idea**: Implement a "Relic" system in the Upgrades menu. Relics are expensive, unique toggleable modifiers (e.g., "Start with -50% health but +100% damage").
* **Engineering**: Extend `PersistenceSystem.js` and `TitleScreenSystem.js` (specifically `renderUpgrades`). Relics would be stored as a Set of active IDs applied during `VampireSurvivorsGame.startGame()`.

### 5. Juice Pass (Audio Overhaul Complete)
**Concept**: The audio engine now uses an anti-fatigue gothic synth mix: split SFX/music buses, automatic ducking, density-aware tone shaping, and a sparse adaptive underscore. Remaining juice work is visual/timing.
* **Idea**: Implement "Hit Stop" (micro-freezes on big boss hits), screen-edge chromatic aberration when at low health, and camera hitstop on evolution reveals.
* **Engineering**: Extend `Camera.js` with a `hitStop(ms)` method that temporarily forces `timeScale = 0` via a setTimeout. Audio already reacts cleanly to density and impact, so the next gains are mostly visual rhythm and temporal emphasis.

## 📝 Operating Directives
1. **Always run tests:** Run `npm test` after modifying core files.
2. **Check for regressions:** 168 tests currently pass. Keep it that way. Run tests with `NODE_OPTIONS=--experimental-vm-modules jest` or simply `npm test`.
3. **Respect the Linter:** Run `npm run format` and ensure no unused variables are left behind.
