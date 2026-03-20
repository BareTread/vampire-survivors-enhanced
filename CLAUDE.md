# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Vampire Survivors-style browser game** built with vanilla JavaScript and HTML5 Canvas. It's a survival action game where players fight endless waves of enemies, collect experience gems, level up, and upgrade weapons.

## Development Commands

### Running the Game

- **Local Development**: Open `index.html` in a web browser (requires local server for ES6 modules)
- **Debugging**: F1 = Settings Menu, F2 = Performance Monitor/Dashboard, F4/G = Debug Overlay
- **Console Commands**: Available via `window.debugCommands` object

### No Build System

This project uses **vanilla JavaScript with ES6 modules** - no build step required. Direct browser execution.

## Core Architecture

### Game Architecture Pattern

- **ECS (Entity-Component-System)** architecture in `src/core/ECS.js`
- **Game Loop**: Managed by `VampireSurvivorsGame` class with optimized 60+ FPS performance
- **Systems-based**: Each game feature is a separate system (enemy spawning, projectiles, particles, etc.)

### Key Entry Points

- `index.html` - Main HTML file and game launcher
- `src/vampireMain.js` - Bootstrap and initialization
- `src/core/VampireSurvivorsGame.js` - Main game engine and loop

### Core Systems Architecture

```
src/core/
├── VampireSurvivorsGame.js  # Main game engine
├── ECS.js                   # Entity-Component-System framework
├── InputManager.js          # Keyboard/mouse input handling
├── Camera.js                # 2D camera with following and effects
├── Renderer.js              # Canvas rendering engine
├── AudioManager.js          # Sound system (optional fallback)
└── WeaponFactory.js         # Weapon creation and management
```

### Game Systems

```
src/systems/
├── EnemySystem.js           # Enemy spawning, AI, behavior, formation spawns, obstacle-aware spawn positioning
├── ProjectileSystem.js      # Weapon projectiles and collision
├── ExperienceSystem.js      # XP collection and leveling
├── ParticleSystem.js        # Visual effects and particles
├── PsychologyFeedbackSystem.js  # Player engagement mechanics
├── FlowStateSystem.js       # Adaptive difficulty based on player performance
├── AchievementSystem.js     # 12 achievements with canvas popups + localStorage
├── RewardsSystem.js         # Critical hits, kill streaks, XP multipliers
├── MicroChallengeSystem.js  # In-game challenges with HUD + XP rewards
├── AdaptiveMusicSystem.js   # 4-layer procedural music (bass, pulse, melody, filter)
├── PassiveItemSystem.js     # 6 passive items with 5 upgrade levels each
├── KillMilestoneSystem.js   # Kill milestones celebrations
├── ScreenEffectsSystem.js   # Low-health vignette, boss desaturation, slow-mo
├── RunTimerSystem.js        # Run timer + Death at 30 minutes
├── PersistenceSystem.js     # LocalStorage schema + migrations + records + character unlocks
├── GoldSystem.js            # Gold drops + HUD + persistence
├── RaritySystem.js          # Level-up rarity tiers
├── SynergySystem.js         # Weapon+passive synergy bonuses
├── WeaponEvolutionSystem.js # Weapon evolutions (max level + recipe)
├── BossSystem.js            # Timed boss encounters (3 types, multi-phase, telegraph attacks)
├── TitleScreenSystem.js     # Canvas-rendered title screen + upgrade shop + character select (menu/characters/upgrades states)
├── RunSummarySystem.js      # Canvas-rendered post-death stats overlay with character info (summary state)
├── CanvasHUD.js             # Canvas-rendered HUD replacing DOM (XP bar, health bar, level, kills, weapon/passive inventory, synergies, power-up timers)
├── InventoryOverlaySystem.js # Full-screen Tab build overlay (weapons, passives, synergies, evolution progress)
├── DynamicEventSystem.js    # Timed narrative events (Treasure chest, Golden Swarm, Blood Moon, Calm Eye)
├── AmbientParticleSystem.js # Persistent atmospheric particles (fog wisps, dust motes, floating embers)
└── FloorItemSystem.js       # World-space collectible drops: health orbs, vacuum, rosary, treasure chests
```

### Data

```
src/data/
└── characters.js            # Character definitions (id, name, color, startingWeapon, statModifiers, unlockCondition)
```

### Entities Structure

```
src/entities/
├── Player.js                # Player character and stats
├── Enemy.js                 # Enemy base class and behaviors
├── ExperienceGem.js         # Collectible XP gems
├── Projectile.js            # Weapon projectiles
└── weapons/                 # Weapon implementations
    ├── BaseWeapon.js        # Abstract weapon base class
    ├── MagicMissile.js      # Auto-targeting missile weapon
    ├── Whip.js              # Melee area weapon
    ├── ThrowingKnife.js     # Projectile weapon
    ├── LightningChain.js    # Chain lightning (direct-damage, arcs between enemies)
    ├── GarlicAura.js        # Passive damage aura around player
    ├── HolyBible.js         # Orbiting crosses that circle the player
    ├── FireWand.js          # Fireballs + explosions + burn zones
    ├── BoneBoomerang.js     # Out-and-back boomerang projectile
    ├── IceShard.js          # Freeze projectiles + AoE ice burst (L4+), evoles → Blizzard
    └── ShadowDagger.js      # Telegraph + burst melee, bleed (L4+), chain (L7+), evolves → Phantom Assassin
```

## Game Features

### Weapon System

- **Auto-targeting**: Weapons automatically target nearest enemies
- **Upgradeable**: Level up weapons through experience system
- **Multiple Weapons**: 10 total | Magic Missile, Whip, Throwing Knife, Lightning Chain, Garlic Aura, Holy Bible, Fire Wand, Bone Boomerang, Ice Shard, Shadow Dagger. Distinct playstyles — each with unique behaviors
- **Factory Pattern**: Use `WeaponFactory` to create weapons, register new types in `VampireSurvivorsGame.weaponClasses`
- **Weapon Rendering**: Weapons with visual effects (aura rings, lightning bolts, charging) render via the weapon render loop in `VampireSurvivorsGame.render()`

### Performance Optimizations

- **Object Pooling**: Managed via `ObjectPoolManager.js`
- **Spatial Partitioning**: Efficient collision detection in `SpatialPartitioning.js`
- **Frame Rate Management**: Target 60+ FPS with 200+ entities
- **Lazy Loading**: Asset loading optimization in `utils/LazyLoader.js`

### Game Psychology Systems

- **Flow State**: Dynamic difficulty adjustment
- **Reward Psychology**: Engagement mechanics and feedback loops
- **Visual Feedback**: Screen shake, particles, audio cues for player actions
- **Adaptive Music**: 4-layer procedural soundtrack tied to FlowState intensity

### Passive Item System

- **6 Items**: Spinach (+dmg), Wings (+speed), Armor (-dmg taken), Empty Tome (-cooldown), Duplicator (+projectiles), Attractorb (+pickup range)
- **5 Upgrade Levels**: Each item can be upgraded 5 times during level-up
- **Stat Integration**: Modifiers applied in `Player.getEffectiveStats()`
- **HUD Display**: Passive item bar with colored level pips

## Controls & Debug Features

### Player Controls

- **WASD/Arrow Keys**: Movement
- **Mouse**: Look/aim direction
- **Auto-Attack**: Weapons fire automatically
- **ESC**: Pause/Resume (also closes build inventory overlay)
- **TAB**: Open/close build inventory overlay
- **1-5**: Select level-up options

### Debug Features

- **F1**: Settings Menu
- **F2**: Performance monitor/dashboard (FPS, entity count, memory)
- **F4/G**: Toggle debug overlay
- **Console Commands**: `debugCommands.getGameState()`, `debugCommands.getDebugInfo()`

## Adding New Features

### New Weapons

1. Create weapon class extending `BaseWeapon` in `src/entities/weapons/`
2. Register in `VampireSurvivorsGame.weaponClasses` Map
3. Add to level-up options in `availableWeapons` array in `generateLevelUpOptions()`
4. **CRITICAL**: `BaseWeapon.getDistanceToPlayer()` returns **SQUARED** distance (for performance). If filtering by range, compare against `range * range`, NOT `range`. Using it for sort comparisons is fine (relative order preserved).

### New Enemy Types

1. Extend `Enemy` class with new behavior patterns
2. Register in `EnemySystem.js` spawn logic
3. Add to wave progression system

### New Systems

1. Create system class in `src/systems/`
2. Initialize in `VampireSurvivorsGame.systems` object
3. Call update/render methods in game loop

## Developer Log (most recent first)

### 2026-03-20 (Agent #17 — Balance Audit & Gothic Main Menu Redesign)

**Executed a massive balance sweep and transformed the menus with a dark atmospheric aesthetic. 163/163 regression tests passing.**

- **Combat Balance Mathematically Locked**: Fixed power creep by clamping global output (`300 DPS` soft cap with diminishing returns) and damage reduction (`60%` hard cap). Scaled enemy and boss difficulty by `player.level` and `weaponCount` (instead of just time) to ensure powerful builds maintain late-game tension. Nerfed L8 `Throwing Knife`, `Shadow Dagger`, and `Lightning Chain` to line up with the rest of the arsenal.
- **Menu System Rearchitected**: `TitleScreenSystem` completely redesigned with a dense gothic visual engine. Renders four procedural fog bands, procedural blood drips on borders, and faint swaying character silhouettes. Standard buttons were replaced with textured stone tablets featuring inner and outer hover glows.
- **Buttery State Transitions**: Added a 0.35s fade-to-black state machine via `triggerTransition()` in `TitleScreenSystem`. This replaces all previous instant-cut menu state changes with smooth, deliberate transitions.
- **Bug Fixes**: Resolved the infinite screen shake bug (capped intensity/duration and wired it to `SettingsMenu`) and the level-up selection bug where choices made on invalid items during pause state failed silently.

### 2026-03-19 (Agent #29 — Sprint #29: Smart Rarity & HUD Polish)

**Rewrote the rarity engine to be deterministic and bumped all HUD sizes for readability. 123/123 tests passing.**

- **Smart Rarity Scoring Engine (`RaritySystem.js`)**: Replaced random dice-roll rarity with a 0-100 deterministic scoring engine evaluating options based on Base Type Value, Build Synergy, and Contextual Scarcity. Passives that enable evolutions score massive "Epic" boosts when you own the matching max-level weapon. Stat upgrades get diminishing returns if picked 3+ times.
- **Informational Rarity**: Rarity is now a pure "build advisor" label. It no longer applies hidden multipliers to stat upgrades. Changed `applyStatUpgrade()` to use fixed base values.
- **HUD Readability Bump (`CanvasHUD.js`)**: Increased the sizing of all in-game HUD elements by ~20%. Weapon slots (38→46px), passive slots (26→32px), HUD fonts (7-9px → 9-12px range), and minimap radii were all enlarged.
- **Scoring System Tests**: Added `tests/rarity-scoring.test.js` with 16 new tests validating synergy logic, diminishing returns, score-to-rarity mapping, and resets.

### 2026-03-19 (Agent #27 — Sprint #27: Full Gap Closure)

**Closed 6 verified gameplay gaps across 12 modified files + 1 new file. 85/85 tests remain green.**

- **Death Cause Tracking**: `Player.js` now tracks `lastDamageSource` via `takeDamage(amount, source)`. All call sites threaded: `Enemy.js` (3), `Wraith.js`, `Demon.js` (2), `Projectile.js`, `BossSystem.js` (8), `RunTimerSystem.js` (Death reaper). `VampireSurvivorsGame.gameOver()` includes `killedBy` in `runData`. `RunSummarySystem.js` displays "☠ Killed by: [name]" on the death screen + milestone distance hint.
- **6 Missing Evolution Abilities**: Implemented in `WeaponEvolutionSystem.js` `_updateEvolvedAbility()`: `homing_pierce` (Soul Missile — steer projectiles), `blade_storm` (Thousand Edge — fan burst every 3rd attack), `permanent_burn` (Hellfire — AoE burn patches), `death_spin` (Death Spiral — constant damage aura), `blizzard_storm` (Blizzard — AoE freeze pulse), `phantom_chain` (Phantom Assassin — chain on kill).
- **Wave Pacing**: `EnemySystem.js` now has `getWaveType(waveNumber)` cycling rest/rush/normal in a 5-wave pattern. Rest waves halve spawn rate + slow enemies; rush waves increase spawn rate 60% + speed enemies up. `waveDuration` adjusts per type.
- **Zone/Biome System**: `TerrainRenderer.js` has 4 concentric zones (Crypt/Catacombs/Graveyard/Wasteland) with distinct gradient palettes and grid tints. `getZoneAt(x,y)` returns zone by distance from origin. `renderZoneTransitions()` draws dashed circle outlines at zone boundaries.
- **Endless Mode**: `RunTimerSystem.js` `endlessMode` flag skips Death spawn at 30 min; post-30min escalation boosts enemy cap and spawn rate every 5 minutes. `TitleScreenSystem.js` has 'ENDLESS' menu item.
- **Bestiary/Codex**: New `CodexSystem.js` with 4 categories (enemies/weapons/evolutions/synergies), persistence via `PersistenceSystem.js` `codex` field, `getTotalDiscoveries()` and `getCompletionStats()` API. Discovery hooks in `Enemy.js die()` and `WeaponEvolutionSystem.js evolveWeapon()`.

### 2026-03-18 (Agent #26 - CanvasHUD Redesign & Module Cache Fix)

**The CanvasHUD received a massive visual upgrade to match the game's gothic aesthetic, and a critical ES-module caching bug was fixed.**

- **CanvasHUD Redesign**: Transformed the flat UI into a polished, gothic interface. Added an amber gradient XP bar with a bright leading edge, a blood-red HP bar featuring a Heart (♥) icon and damage drain trail. Panels now use a deep dark purple background `rgba(16,9,30,0.96)` with glowing 1.5px gold borders. Power-up pills were redesigned with left-accent stripes, serif/mono fonts, and an expiry pulse animation. Weapon inventory slots were enlarged to 38px with improved styling. The level indicator and wave number were moved inside the character panel, and the minimap was shifted to the bottom-right and slightly resized to prevent text overlap.
- **UI Collision Cleanup**: Unified the Economy and Kills readouts into a single canvas panel to resolve top-right overlapping issues. Removed duplicate `renderUIOverlays()` from `VampireSurvivorsGame.js` and suppressed the `SynergySystem` and `GoldSystem` duplicate legacy DOM rendering when `CanvasHUD` is active. Bottom UI panels now intelligently shift upward to make room when a micro-challenge card is displayed.
- **ES-Module Cache Busting**: Addressed a critical bug where the local developer server (`0.0.0.0:8000`) served new files, but the browser was persistently caching and running stale ES modules (`CanvasHUD`, etc.). Implemented a robust cache-busting chain using version parameters (e.g., `?v=20260317-hudfix2`) passing from `index.html` → `vampireMain.js` → `VampireSurvivorsGame.js` → `CanvasHUD.js`.

### 2026-03-16 (Agent #25 - Challenge System Completion)

**Challenge modifiers are now fully wired, selectable from the title screen, and regression-covered (`85/85` passing).**

- **Challenge hooks finished**: `src/entities/Player.js` now blocks level-up full heals under `no_heals` and halves XP under `famine`; `src/core/VampireSurvivorsGame.js` now suppresses passive-item level-up options under `iron_will`; `src/systems/GoldSystem.js` now applies the active challenge gold multiplier on coin pickup.
- **Challenge menu added**: `src/systems/TitleScreenSystem.js` now includes a `CHALLENGES` main-menu entry, locked/unlocked challenge panel, toggleable modifier rows, hover/keyboard/click handling, and a live pending gold-multiplier readout for up to 3 selected modifiers.
- **Menu/game-state routing completed**: `src/core/VampireSurvivorsGame.js` now treats `challenges` like the other title-screen states for input, mouse hover, update, render, and escape-to-menu routing.
- **Gold pickup feedback corrected**: Challenge-scaled coin pickups now show the actual earned gold amount in floating text instead of the pre-multiplier base value.
- **Title-screen HUD leak fixed**: The legacy DOM HUD now starts hidden and `start()` re-applies UI visibility immediately, which removed the top-left HUD panel that was leaking over the menu in browser smoke testing.
- **Tests + verification**: Extended `tests/new-features.test.js` with 8 ChallengeSystem regression tests covering `no_heals`, `famine`, `iron_will`, gold multiplier stacking, unlock gating, selection cap, and `glass_cannon`. Verified with `node --check src/entities/Player.js`, `node --check src/core/VampireSurvivorsGame.js`, `node --check src/systems/GoldSystem.js`, `node --check src/systems/TitleScreenSystem.js`, `node --check tests/new-features.test.js`, full `npm test -- --runInBand` (`85 tests / 8 suites` passing), and headless Chromium title-screen smoke screenshots confirming the `CHALLENGES` entry renders cleanly.

### 2026-03-15 (Agent #24 - Major Content Sprint)

**New systems, weapons, characters, and UI — all wired, tested, 77/77 passing.**

- **FloorItemSystem** (`src/systems/FloorItemSystem.js`): World-space collectible drops — `health_orb` (restores 15–25% HP, ~20% elite drop), `vacuum` (gem magnet, ~6%), `rosary` (kills all on-screen enemies, 0.5% elite / boss-guaranteed), `treasure_chest` (gold burst, stat boost, or weapon level — guaranteed boss drop). Bob animation + glow. Hooked into `Enemy.die()`, `BossSystem._onBossDeath()`, and game update/render loop.
- **IceShard** (`src/entities/weapons/IceShard.js`): Weapon #9. Slow ice projectiles that freeze enemies on hit via `StatusEffectSystem.applyFreezeEffect()`. L4+ adds AoE ice burst at impact that spreads freeze to nearby enemies. Evolution: **Blizzard** (+ Empty Tome). Synergy: **Permafrost** (+ Armor → +35% dmg to frozen enemies).
- **ShadowDagger** (`src/entities/weapons/ShadowDagger.js`): Weapon #10. Teleports a shadow blade to nearest enemy with a visual telegraph then strikes for massive burst. L4+ adds bleed. L7+ chains to 2 additional targets. Evolution: **Phantom Assassin** (+ Wings). Synergy: **Death Mark** (+ Spinach → +30% dmg to bleeding enemies).
- **Viktor & Nyx** (`src/data/characters.js`): 2 new characters → 9 total. Viktor (Cryomancer, Ice Shard, +15% area / −10% speed, unlock: 15-min run). Nyx (Assassin, Shadow Dagger, +15% dmg / −15% HP, unlock: 1000-kill run).
- **Elite Aura System** (`src/entities/Enemy.js`, `src/systems/EnemySystem.js`): After wave 8, one elite per wave can spawn with a zone aura — **Warchief** (red, +30% dmg to nearby enemies), **Lifebinder** (green, heals 5 HP/s to nearby enemies), **Frostlord** (blue, slows player 15% when in range), **Void Herald** (purple, spawns 2 fast clones every 8 s). Aura elites have +50% HP and always drop a chest. Rendered as pulsing dashed ring with rotating accent dot.
- **Minimap** (`src/systems/CanvasHUD.js`): 110×110 px top-left overlay. Shows player (white), enemy (red/orange for boss/elite), and floor item (green/gold) dots. Clipped to panel, semi-transparent dark background.
- **Evolutions & synergies**: Blizzard + Phantom Assassin recipes in `WeaponEvolutionSystem.js`; Permafrost + Death Mark in `SynergySystem.js`.
- **Tests**: `tests/new-features.test.js` — 26 tests covering FloorItemSystem (11), IceShard (5), ShadowDagger (5), character registry (5). Full suite: **77 tests / 8 suites**.

### 2026-03-15 (Agent #23 - Attractorb Bug Fix)

- **Attractorb pickup range was inverted (REAL BUG)**: `ExperienceSystem.autoCollectGems()` computed `pickupBonus = mods.pickupRange` where `mods.pickupRange` is an _additive_ bonus (0.25 per level). This made L1 Attractorb shrink the effective magnet range from 80 px to 20 px instead of extending it to 100 px. Only L5 gave any benefit at all (100 px vs intended 180 px). **Fixed** to `pickupBonus = 1 + (mods.pickupRange || 0)`.
- **Attractorb now actually extends magnetism range**: The fix also adds force-magnetization for gems in the extended range (beyond the gem's own 80 px magnetRange but inside Attractorb's effective range). Gems in that band get `forceMagnetTimer = 0.1s` each frame so they visibly drift toward the player.
- **Regression tests added**: Two new tests in `tests/balance-regressions.test.js` — L1 check (85 px gem gets pulled), L5 check (170 px gem gets pulled). Verified with `node --check src/systems/ExperienceSystem.js` and full `npm test -- --runInBand` (`51 tests / 7 suites` passing).

### 2026-03-15 (Agent #22 - Full Balance Sprint + Combat Text Cleanup)

- **Float-text leak fixed at the source**: `src/systems/ParticleSystemCore.js` no longer stringifies numeric damage values before routing them into `globalDamageNumberPool`, and `src/core/DamageNumberPool.js` now rounds both raw numeric inputs and plain numeric strings before display. This closes the visible raw-float leak where values like `11.024000000000003` could appear on screen.
- **Combat text clutter reduced**: `src/core/DamageNumberPool.js` now caps active floating numbers at 30 and shortens lifetimes (`0.7s` normal / `0.9s` crit). `src/core/VampireSurvivorsGame.js` also stops rendering floating damage numbers, achievements, micro-challenge overlays, and kill-milestone overlays while paused, so pause state no longer stacks over combat text.
- **Player feedback spam toned down**: `src/entities/Player.js` now rounds numeric text before display, reduces combo popups to every 10 kills instead of every 5, halves combo-milestone flash/shake intensity, and only shows power-up expiration text for `invincible` instead of every temporary buff ending.
- **Hidden balance bugs removed**: `src/entities/weapons/BaseWeapon.js` no longer boosts weapon damage from XP multiplier logic. `src/entities/Player.js` removes the 15% RNG `triggerLastSecondSave()` mechanic entirely and converts XP gain stacking from multiplicative to additive with a hard `2.5x` cap, preventing combo + desperation + luck + persistence from exploding progression.
- **Garlic and Holy Bible identities retuned**: `src/entities/weapons/GarlicAura.js` now starts weaker, ticks slower, and leans hard into knockback/zone denial instead of top-tier AoE DPS. `src/entities/weapons/HolyBible.js` now deals less damage, runs at slightly wider orbit radii, grants player damage reduction (`5%` per level, capped at `40%`), and caps orbiters at `5` normally / `6` evolved via `src/systems/WeaponEvolutionSystem.js`.
- **Pickup + economy tightened**: `src/systems/ExperienceSystem.js` and `src/entities/ExperienceGem.js` reduce baseline gem magnet range/strength so routing matters more again. `src/systems/PersistenceSystem.js` now uses exponential upgrade costs (`base * 1.8^level`) with lower max levels on key meta upgrades, while `src/systems/GoldSystem.js` shifts gold scaling toward wave-based drop chance/value instead of runaway time-only growth.
- **Regression coverage expanded**: `tests/balance-regressions.test.js` now covers XP multiplier not affecting damage, deterministic no-RNG-death-save behavior, additive XP cap behavior, and Holy Bible's defensive/orbiter caps. Verified with `node --check` on all touched runtime files, `npm test -- --runInBand tests/balance-regressions.test.js`, and full `npm test -- --runInBand` (`49 tests / 7 suites` passing).

### 2026-03-14 (Agent #21 - Dense-Fight Readability Follow-Up)

- **Enhanced VFX now back off during real combat load**: `src/core/GraphicsUpgrade.js` no longer routes every critical hit, death cue, and damage number through the oversized enhanced effects layer when the screen is already dense. The wrapper now only uses enhanced combat VFX in calmer scenes (good FPS, lower enemy count, low active effect load), and otherwise falls back to the lean base particle/damage systems.
- **Enemy readability degrades sooner on purpose**: `src/systems/EnemySystem.js` now switches to `medium` / `low` detail earlier (`>70` / `>120` enemies, or lower FPS thresholds), and `src/entities/Enemy.js` now simplifies standard enemy bodies for both medium and low detail, removes internal face/detail rendering outside high detail, suppresses ranged reticles in low detail, and only keeps always-visible full-health bars for elites in reduced-detail modes.
- **Canvas startup log corrected**: `src/vampireMain.js` now logs canvas size after `resizeCanvas()` so startup diagnostics reflect the actual viewport size instead of the browser default `300x150` canvas dimensions.
- **Regression coverage**: Extended `tests/enemy-system.test.js` to verify dense fights drop to low-detail rendering earlier.
- **Verification**: Verified with `node --check src/core/GraphicsUpgrade.js`, `node --check src/entities/Enemy.js`, `node --check src/systems/EnemySystem.js`, `node --check src/vampireMain.js`, `node --check tests/enemy-system.test.js`, and `npm test -- --runInBand tests/enemy-system.test.js`. Full suite re-run is the next verification step.

### 2026-03-14 (Agent #20 - Runtime Maintenance + Console Noise Fixes)

- **Runaway cleanup loop fixed**: `src/core/VampireSurvivorsGame.js` now tracks `totalFrameCount` separately from the FPS sampling counter. `performMemoryCleanup()` was previously tied to `frameCount`, but `updatePerformanceStats()` resets that counter every second, which caused cleanup to fire almost constantly instead of every ~30 seconds.
- **Conflicting quality auto-adjust removed from the hot path**: Stopped calling the legacy `adjustPerformanceQuality()` loop from `gameLoop()`. That older delta-sample adjuster was fighting the newer adaptive quality systems and producing noisy quality oscillation logs with bogus early FPS readings.
- **Startup perf metrics stabilized**: `start()` now seeds `performanceStats.lastFpsUpdate` and `lastPerformanceReport` from the current clock so the first FPS/perf report is not skewed by pre-start time.
- **Console/debug spam reduced**: Memory cleanup logs, enemy scaling/rage logs, graphics auto-adjust logs, particle-limit logs, and telemetry milestone logs are now gated behind debug visibility. `ProgressionTelemetry.render()` also stays hidden unless both telemetry and the debug overlay are on, preventing accidental dev overlay leakage into regular play.
- **Particle limit regression fixed**: `src/systems/ParticleSystemCore.js` had an inverted clamp in `adaptParticleLimits()` that could increase effect/splatter caps under low FPS. It now actually reduces caps under pressure and restores only to the intended baseline ceilings.
- **Regression coverage**: Extended `tests/particle-system-core.test.js` to verify low-FPS adaptive limits shrink instead of inflate, and extended `tests/runtime-regressions.test.js` to ensure telemetry does not render unless debug overlay is active.
- **Verification**: Verified with `node --check src/core/VampireSurvivorsGame.js`, `node --check src/debug/ProgressionTelemetry.js`, `node --check src/entities/Enemy.js`, `node --check src/systems/VisualEffectsSystem.js`, `node --check src/core/GraphicsUpgrade.js`, `node --check src/systems/ParticleSystemCore.js`, targeted Jest runs for particle/runtime regressions, and full `npm test -- --runInBand` (37 tests / 6 suites passing).

### 2026-03-14 (Agent #19 - Particle Readability Budget Pass)

- **Dense-fight particle prioritization**: `src/systems/ParticleSystemCore.js` now assigns effect priorities (`critical`, `combat`, `cosmetic`) and derives a live load profile from FPS + active enemy count. Heavy load reduces the total effect budget, suppresses cosmetic glow first, and scales burst counts by priority so boss/evolution/last-stand feedback stays visible while low-value filler gets cut.
- **Important effects survive saturation**: When the effect budget is full, higher-priority particles can now evict older lower-priority particles instead of silently losing critical feedback. Update-time budget enforcement also trims excess cosmetic/combat particles before simulation, so clutter drops quickly once fights get dense.
- **Focused regression coverage**: Added `tests/particle-system-core.test.js` covering heavy-load glow suppression, priority-based replacement at capacity, and update-time trimming of cosmetic overflow.
- **Verification**: Verified with `node --check src/systems/ParticleSystemCore.js`, `node --check tests/particle-system-core.test.js`, and `npm test -- --runInBand tests/particle-system-core.test.js`. Full suite re-run is the next verification step after the current pass.

### 2026-03-14 (Agent #18 - Swarm Stability Pass)

- **Enemy pacing corrected**: `src/systems/EnemySystem.js` now uses real `dt` for `updateDifficulty()`, `updatePerformanceTracking()`, and `updatePressureSurge()` instead of fixed `0.016` assumptions, so difficulty and surge timing no longer vary with framerate.
- **Spawn pressure rebalanced**: Reduced baseline caps/pool sizes from the prior chaos-heavy tuning, lowered spawn-rate ceilings, cut per-wave spawn burst size to a max of 5, and added `getSpawnThrottle()` so density and low FPS automatically suppress spawning before performance collapses.
- **Surge/formations fixed**: Pressure surges now actually force the `swarm` pattern via `chooseSpawnPattern()`. Boss and formation spawns now respect remaining enemy capacity instead of freely overshooting active-enemy limits.
- **Enemy render degradation path**: `src/entities/Enemy.js` now accepts a render detail level from `EnemySystem.render()`. Under heavy density/low FPS, standard enemies skip radial gradients and some cosmetic details, and full-health bars are hidden for non-elites to preserve clarity and reduce draw cost.
- **Tests + verification**: Added `tests/enemy-system.test.js` covering dt-based timers, spawn throttling, surge pattern selection, and low-vs-high detail rendering. Verified with `node --check src/systems/EnemySystem.js`, `node --check src/entities/Enemy.js`, `node --check tests/enemy-system.test.js`, `npm test -- --runInBand tests/enemy-system.test.js`, and full `npm test -- --runInBand` (32 tests / 5 suites passing).

### 2026-03-17 (Agent #28 — Sprint #28: Codex UI, Settings Canvas Migration, Polish)

- **Codex discovery hooks wired**: `SynergySystem.update()` now calls `codex.discoverSynergy()` when a synergy activates. `BossSystem._spawnBoss()` now calls `codex.discoverEnemy('boss_' + type)` on spawn. Fixed `CodexSystem.getCompletionStats()` synergies total from 6→10 to match actual synergy count.
- **Codex menu UI**: Added 'CODEX' between STATISTICS and SETTINGS in `TitleScreenSystem.menuItems`. Built `renderCodex()`, `handleCodexInput()`, `handleCodexClick()` — canvas overlay with 4 category tabs (Enemies, Weapons, Evolutions, Synergies), completion bar, discovery grid, and back button. Routed 'codex' game state through all 7 locations in `VampireSurvivorsGame.js`.
- **Settings menu canvas migration**: Replaced DOM-based `SettingsMenu.toggle()` call with canvas-rendered settings overlay. Built `renderSettings()` with volume sliders (left/right arrow keys), toggle pills (enter to flip), reset-to-defaults button, and back button. `SettingsMenu` class still handles persistence and apply logic. Routed 'settings' game state through all 7 locations.
- **Wave pacing HUD badge**: `CanvasHUD._renderCharPanel()` now shows a colored REST (green) or RUSH (red) pill badge next to the wave number when the current wave type is not normal.
- **Zone-aware obstacles**: `TerrainSystem.generateObstacles()` now queries `TerrainRenderer.getZoneAt()` per obstacle position and selects from zone-specific type palettes (Crypt favors tombstones, Graveyard favors dead trees, etc.). Each obstacle stores zone-specific `colors` used by all 4 render methods (`renderRock`, `renderTombstone`, `renderDeadTree`, `renderRuinedWall`).
- **Regression tests**: Added 22 new tests in `tests/new-features.test.js` covering CodexSystem (discovery, completion stats, reset), WeaponEvolutionSystem (recipes, specialAbility fields, ice_shard/shadow_dagger evolutions), wave pacing (getWaveType mod pattern), TerrainRenderer zones (concentric ring ordering, getZoneAt), and RunTimerSystem endless mode (default state, death skip, difficulty escalation, reset). Total: 107 tests / 8 suites passing.

### 2026-03-14 (Agent #17 - Audio Pleasantness Redesign)

- **Shared mix + ambient bed**: `src/core/AudioManager.js` now routes synth audio through internal `ambient`, `music`, `combat`, `reward`, and `ui` buses with per-bus EQ shaping. Added persistent loop controllers for `windHowl`, `lowDrone`, `ritualPulse`, `gothicOrgan`, and refresh-to-hold `heartbeat`, so runs now start with a soft layered bed instead of incidental one-shots.
- **Spam smoothing + cue cleanup**: `experienceGain` and `enemyDeath` now aggregate into short composite phrases, family-wide concurrency caps prevent dense combat stacks from turning into crackle walls, and load softening lowers brightness before level. Added defined defaults for previously missing `bossSpawn`, `bossWarning`, and `weaponFire` cues.
- **Weapon/reward voicing pass**: The audio palette shifted toward warmer glass, reed, bell, drum, cloth, ceramic, and bone textures. Magic Missile, Whip, Lightning, Fire Wand, Bone Boomerang, Garlic Aura, boss, UI, and progression cues now use dedicated softer synth recipes instead of sharing generic bright combat tones.
- **Adaptive music retune**: `src/systems/AdaptiveMusicSystem.js` now routes into the shared music bus, swaps the C-minor palette for D harmonic minor / Phrygian dominant material, uses a warmer D/A drone, denser hand-drum pulse patterns, softer modal ornaments, and a gentler filtered layer so intensity grows through rhythm and density instead of shrill top-end.
- **Tests + verification**: Added `tests/audio-manager.test.js` covering aggregation and family concurrency caps. Verified with `node --check src/core/AudioManager.js`, `node --check src/systems/AdaptiveMusicSystem.js`, `node --check tests/audio-manager.test.js`, and `npm test -- --runInBand tests/audio-manager.test.js`. Browser ear-tuning is still recommended as a final polish pass.

### 2026-03-14 (Agent #16 - Build Depth + Inventory Overlay)

- **Progression bug fix + leak removal**: `VampireSurvivorsGame.selectLevelUpOption()` now applies cooldown upgrades as a reduction (`*= 1 - 0.08 * rarityMultiplier`) instead of accidentally increasing cooldown. `generateLevelUpOptions()` no longer constructs throwaway weapon instances to read names/descriptions; it now uses a static `WEAPON_METADATA` map for all 8 weapons.
- **Character roster expanded**: `src/data/characters.js` now includes 4 additional unlockable characters - Mortimer (Fire Wand), Sera (Garlic Aura), Dante (Lightning Chain), and Luna (Holy Bible) - bringing the roster to 7 total. `PersistenceSystem.checkCharacterUnlocks()` now parses simple `field >= value` unlock conditions instead of hardcoding individual characters.
- **Build visibility UI**: Added `src/systems/InventoryOverlaySystem.js`, a full-screen canvas overlay toggled with `Tab` during gameplay. It pauses action via `timeScale = 0`, renders equipped weapons with level/max/evolved state, passive items, active synergies, and weapon evolution recipe progress, and closes via `Tab` or `Escape`.
- **Input + lifecycle wiring**: `InputManager` now treats `Tab` as a valid key, `VampireSurvivorsGame.handleKeyDown()` routes `Tab` to the inventory overlay, `Escape` closes it, `startGame()` resets it, and the overlay renders above the gameplay HUD.
- **Verification**: Re-ran `npm test -- --runInBand` successfully (23 tests / 3 suites passing). Prior implementation session also reported `node --check` passing for all touched runtime files and a browser smoke test with the game loading correctly.

### 2026-03-13 (Agent #15 — Runtime Stabilization Pass)

- **Input contract + listener cleanup**: `InputManager` click payloads are now consumed as normalized screen-space `{ x, y }` coordinates in `VampireSurvivorsGame.handleClick()`. Title/summary/level-up hover routing now listens through `InputManager` instead of a raw canvas mousemove path. `Player` now stores its input callbacks, unregisters them in `destroy()`, clears player-scoped managed timers, and `VampireSurvivorsGame.disposePlayer()` is called before new runs and on return-to-menu so old runs stop receiving input.
- **Progression correctness fixes**: `GoldSystem.collectCoin()` no longer mutates persistent bank gold immediately; gold is banked once through `PersistenceSystem.recordRunEnd()`. `gameOver()` now persists `player.combo.maxCombo` instead of nonexistent `combo.best`. `Player.applyPersistentUpgrades()` now applies permanent max health and revives at run start, `gainExperienceEnhanced()` applies `xpGain`, `takeDamageEnhanced()` applies permanent armor, and fatal damage consumes a purchased revive before `gameOver()`.
- **Jackpot XP fixed**: `RewardsSystem.rollForJackpot()` now calls `ExperienceSystem.addExperienceToPlayer()` instead of checking for a nonexistent `experience.addExperience()` API, so jackpot rewards grant real XP again.
- **Pooling + kill accounting fixes**: `Projectile.destroy()` and `ExperienceGem.destroy()` now only mark entities inactive; their owning systems reclaim them during compaction/cleanup. `ProjectileSystem.updateProjectiles()` and `ExperienceSystem.updateGems()` now re-check `active` after per-entity update so destroyed objects are not retained for the rest of the frame. `Enemy.die()` now guards against duplicate side effects with `_deathProcessed`, and duplicate kill notifications were removed from `FireWand`, `LightningChain`, `GarlicAura`, and `BoneBoomerang` so achievements/flow-state hooks fire from one place only.
- **Runtime query cleanup**: `EnemySystem.getNearbyEnemies()` and `ProjectileSystem.getProjectilesInArea()` now use live active-collection scans directly instead of routing gameplay queries through the dormant collision system.
- **Tooling + tests**: `package.json` Jest scripts now run with Node ESM support (`NODE_OPTIONS=--experimental-vm-modules`) and the invalid `extensionsToTreatAsEsm` config was removed. Added regression coverage in `tests/runtime-regressions.test.js` and `tests/pooling-regressions.test.js`, updated `tests/projectile.test.js` for ESM + new pool ownership behavior, and extended `tests/setup.js` with stable `localStorage`/`fetch` mocks. Verified with `npm test -- --runInBand` and `node --check` on all touched runtime files.

### 2026-02-25 (Agent #14 — Level-Up Fix + Health Bars + Polish)

- **Level-Up Click Handling (CRITICAL FIX)**: `handleClick()` had early return during `levelUpActive`, assuming DOM events handled level-up selection — but `#level-up-ui` DOM element doesn't exist in `index.html`. Game was permanently trapped at level-up screen. **Fixed** with canvas-based click detection matching card layout geometry. Also added mousemove hover highlight (brighter background + gold border) with pointer cursor.
- **Level-Up Hint Text**: Changed "press 1-N" to "click or press 1-N" so users know clicking works.
- **Dead DOM Code Removed**: `showLevelUpUI()` no longer references nonexistent `#level-up-ui`. `hideLevelUpUI()` cleaned up. Entire `updateLevelUpOptionsUI()` method removed (built DOM buttons for nonexistent `#level-up-options` container).
- **Enemy Health Bars Always Visible**: Changed from conditional (`health < maxHealth`) to always render. Full-health enemies show a subtle thin green bar (`rgba(0,255,0,0.25)`, 2px). Damaged enemies get full health bar with color coding as before.
- **Double timeScale Fix**: `update(dt)` received `dt = deltaTime * timeScale` from gameLoop, then applied `scaledDt = dt * timeScale` again — systems got `deltaTime * timeScale²`. **Fixed** by removing the second multiplication; all systems now receive `dt` directly (already scaled once by gameLoop).
- **Whip Targeting Range Fix (CRITICAL)**: Whip `targetingRange` was 80px — same as attack range. Every other weapon uses 200-300px. Whip barely ever fired because `shouldFire()` requires enemies within targeting range. **Fixed** to 200px. Also increased base range 80→100px and damage 16→22 to match rebalanced enemy HP.
- **Enemy HP Rebalance**: All enemy types had inflated HP values (comments said "HARDER", "TANKIER", "DOUBLED"). Fast enemies had 20 HP vs Whip's 16 damage — couldn't one-shot. **Rebalanced**: basic 35→20, fast 20→12, tank 100→60, ranged 25→15, elite 150→100, berserker 120→80, summoner 90→60, juggernaut 300→200. Also rebalanced damage/speed/XP to match. Difficulty multiplier still scales HP over time.
- **Headless Puppeteer Test Verified**: Standing still, whip fires at T+3s (200px targeting), combo reaches 17 by T+17s, player levels up at T+14s, level-up click handler works. Enemies die in one hit (22 dmg > 12 HP fast).
- **All syntax checks pass** (`node --check` on all modified files).

### 2026-02-25 (Agent #13 — Critical Bugfixes)

- **NaN First-Frame Fix**: `VampireSurvivorsGame.start()` called `this.gameLoop()` without argument → `currentTime = undefined` → first 2 frames had NaN deltaTime → permanently corrupted `TitleScreenSystem.time` → `hsl(NaN,...)` = black screen. **Fixed** by using `requestAnimationFrame(this.gameLoop)`.
- **Whip Hit Detection Fix**: `Whip.isEnemyInWhipArc()` compared `getDistanceToPlayer()` (squared distance) against `attack.range` (linear 80px). Whip only hit within ~9px — effectively never. **Fixed** to compare against `attack.range * attack.range`. **IMPORTANT**: `BaseWeapon.getDistanceToPlayer()` returns SQUARED distance. Any future weapon doing range filtering must square the range threshold.
- **TerrainSystem Fixes**: Y-coord generation used `right - left` instead of `bottom - top`. Two calls to nonexistent `camera.addShake()` changed to `camera.shake()`.
- **EnemySystem Spawn Nudge**: Obstacle avoidance nudge increased from 40px to 50px (max obstacle radius is 45px).
- **Level-Up UI Safety**: Added null guards to `hideLevelUpUI()` and `updateLevelUpOptionsUI()` for DOM element access.
- **Canvas Pause Overlay**: Added dark overlay + "PAUSED" text + "Press ESC to resume" hint when `gameState === 'paused'`.
- **Canvas Level-Up Overlay**: Added full canvas-rendered level-up screen with semi-transparent backdrop, "LEVEL UP!" title, numbered option cards with rarity border colors, descriptions, and rarity tags.
- **Magic Missile in Weapon Pool**: Added `magic_missile` to `availableWeapons` array in `generateLevelUpOptions()` — was missing, could never be offered.
- **All syntax checks pass**. Method existence verified across all 15+ systems.

### 2026-02-25 (Agent #12)

- **Elite Enemy Abilities**: Elites now randomly receive one of 4 abilities on spawn: `shield` (absorbs 3 hits with blue ring indicator + shield pip dots), `teleport` (warps 200-300px from player when within 100px, 5s cooldown, purple shimmer particles, dashed-line telegraph when ready), `healNearby` (heals up to 3 nearby enemies for 20HP each on 6s timer, green pulse + cross indicator when charging), `explodeOnDeath` (30 damage to player within 80px on death, red/orange particle burst + camera shake, faint red inner glow telegraph). All abilities reset properly via object pool `reset()`.
- **Environmental Obstacles**: TerrainSystem now generates ~40 seeded obstacles per map (rocks, tombstones, dead trees, ruined walls) avoiding center spawn area (300px) and maintaining 60px spacing. `pushOutOfObstacles(entity)` provides circular collision response for both player and enemies. `isPositionValid()` checks obstacle overlap. Obstacles render with frustum culling — only drawn within camera bounds + 100px margin. Rocks have irregular shapes with highlights, tombstones have cross engravings, dead trees have bare branches, ruined walls have staggered stone blocks with mortar lines. EnemySystem spawn positions nudge away from obstacles.
- **Weapon Visual Identity**: Added `renderKnifeProjectile()` — oriented steel blade shape (rotated to travel direction) with metallic highlight and periodic glint effect. Added `renderFireballProjectile()` — orange-red radial gradient orb with flickering size, bright yellow-white core, and `shadowBlur` glow. ThrowingKnife already set `type: 'knife'` and FireWand already set `type: 'fireball'` in their projectile configs.
- **Death Screen Redesign**: RunSummarySystem overhauled — dark vignette overlay, 30 floating colored particles, red decorative lines, card-style stat panel with semi-transparent background + alternating row highlights, icons per stat, slide-in animations, monospace stat values, pulsing gold "NEW RECORD" star badges, weapon arsenal pills, gradient buttons with glow on hover/select.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-25 (Agent #11)

- **DynamicEventSystem integration**: Wired Blood Moon flags into Enemy.js — `bloodMoonSpeedMult` multiplies velocity in both melee and ranged AI, `bloodMoonDamageMult` scales `attack()` and `rangedAttack()` damage. Golden Swarm: enemies render gold (`#FFD700`) with glow during `goldenSwarmActive`, `die()` grants 3x XP and bonus gold coin drop. Treasure chest: GarlicAura, LightningChain, and HolyBible now check `dynamicEvents.activeChest` and apply damage — aura checks distance to chest within radius, lightning chains to chest if within chain range of any hit enemy, orbiters hit chest on contact.
- **AmbientParticleSystem.js**: New lightweight atmospheric system with 63 persistent particles: 18 fog wisps (large translucent blobs, slow drift), 35 dust motes (tiny dots, brownian motion, alpha pulse), 10 floating embers (orange/red, drift upward, fade/respawn). Rendered in world space within camera transform, positions viewport-relative. Wired into game loop after terrain render, before experience gems.
- **Statistics Dashboard**: Added STATISTICS menu item to TitleScreenSystem (5-item menu: PLAY, CHARACTERS, UPGRADES, STATISTICS, SETTINGS). Canvas-rendered stats panel with two columns: Run Totals (total runs, playtime, kills, gold earned, damage dealt) and Personal Bests (best survival, most kills, highest level, highest combo, most gold). Favorite weapon section reads `weaponUsage` from persistence. ESC to return. New `'statistics'` game state routed through all input/render/update checks.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-24 (Agent #10)

- **DynamicEventSystem.js**: New system with 4 timed narrative events on staggered schedule. Treasure Event (~3-4 min): golden chest spawns near player with elite guardians, takes projectile damage, drops gold+XP burst on death. Golden Swarm (~5-6 min): 30s of gold-tinted weaker enemies with 3x XP and bonus gold drops. Blood Moon (~7-8 min): 30s danger with +50% enemy speed, +30% damage, red tint overlay; surviving grants full heal + large XP bonus. Calm Eye (~10 min): 10s safe zone, enemies retreat, player heals 25%, blue-white aura. One event at a time. HUD notification with event name, timer bar, and themed colors. Events scale with game time. Public flags (`goldenSwarmActive`, `bloodMoonActive`, `calmEyeActive`) for other systems to read.
- **EnemySystem.js formations**: Added formation-based spawn patterns every 5th wave. 4 formation types: Pincer (two groups from opposite sides), Encirclement (ring closing in), Stampede (dense line of fast enemies), Sniper Ring (stationary ranged enemies in a circle). Formation enemies get color-coded pulsing glow (orange/purple/red/cyan). Enemy count scales with difficulty (8-16). Formation state tracked and cleaned up automatically.
- **CanvasHUD.js power-up indicators**: Ported power-up timer display from hidden DOM HUD to canvas. Shows active power-up pills (Invincible, Speed, Damage, Fire Rate, Magnet) with countdown timers in top-right area below kill counter. Colored pills with left accent bar, label, and timer. Pulse/fade animation when expiring (<3s). Magnet timer uses max of player and system global magnet timer.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-24 (Agent #9)

- **CanvasHUD.js**: New canvas-rendered HUD system replacing the DOM-based `#game-hud` panel. Animated XP bar (full-width, glow pulse on gain, smooth interpolation), health bar (smooth drain trail, red flash on damage, green pulse on heal, color shifts green→yellow→red), level badge with glow-on-level-up, wave number, kill counter with milestone flash+scale animation, weapon inventory row (per-weapon-type icon shapes with cooldown radial overlay, fire flash, evolved gold border, level number), passive item row (colored icons with level pips), active synergy badges (colored pills). Wired into `VampireSurvivorsGame.systems.canvasHUD` (update + render + reset). DOM HUD hidden via `updateUIVisibility()`.
- **MagicMissile.js**: Enhanced charging effect — 2-phase visual: gathering motes (30-70% charge) orbit and converge, then arcane ring + glowing radial-gradient orb (70-100%) with shadow glow. Replaces previous 4-dot sparkle.
- **ThrowingKnife.js**: Added render method — floating knife silhouettes orbit behind player when charge >50%, rotated to fire direction, with metallic glint shimmer at high intensity. Scales with projectile count.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-24 (Agent #8)

- **Character Selection System**: Created `src/data/characters.js` — 3 characters (Antonio/Whip/+10% damage, Imelda/Magic Missile/+15% luck/-10% HP, Gennaro/Throwing Knife/+12% speed/+1 projectile). Data-driven definitions with unlock conditions checked against persistence records.
- **PersistenceSystem.js**: Extended with `selectedCharacter`, `characterUnlocks` in default data. New methods: `getSelectedCharacter()`, `setSelectedCharacter()`, `isCharacterUnlocked()`, `unlockCharacter()`, `checkCharacterUnlocks()`. Auto-unlock called in `recordRunEnd()` after record updates. `mergeDefaults()` handles schema migration for existing saves.
- **TitleScreenSystem.js**: Added 'CHARACTERS' menu item (4-item menu: PLAY, CHARACTERS, UPGRADES, SETTINGS). Character select overlay (gameState='characters') with horizontal card layout — colored circle, name, title, description, starting weapon, stat modifiers. Locked cards show lock icon + unlock condition. Selected character has gold border + "SELECTED" badge. Full keyboard (arrows + enter) and mouse (hover + click) support.
- **VampireSurvivorsGame.js**: `startGame()` now reads character config — applies color, stat modifiers (multiplicative for most, additive for projectiles, scales maxHealth for health), and starting weapon via `weaponClasses.get()`. Added 'characters' state routing in all input/render/update checks alongside 'menu'/'upgrades'.
- **RunSummarySystem.js**: Shows character name and title (in character color) below "FALLEN IN BATTLE" header.
- Game states: menu → characters → upgrades → statistics → playing → levelUp → paused → gameOver → summary → menu.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-24 (Agent #7)

- **TitleScreenSystem.js**: Canvas-rendered title screen replacing DOM overlay. Dark gradient background with slow hue shift, 60 floating particle wisps, animated "VAMPIRE SURVIVORS" title with red-gold glow pulse, "ENHANCED" subtitle. Three menu items (PLAY, UPGRADES, SETTINGS) with keyboard (arrow keys + enter) and mouse (hover + click) navigation. Personal records at bottom. Upgrade shop sub-view (gameState='upgrades') overlays title bg with panel showing all 8 upgrades, level pips, costs, gold balance. Wired into `VampireSurvivorsGame.systems.titleScreen`.
- **RunSummarySystem.js**: Canvas-rendered post-death stats screen overlaid on frozen game scene. "FALLEN IN BATTLE" header with red glow. 6 stats with 0.3s stagger reveal. "NEW RECORD!" gold badges (compared before persistence save). Gold animated count-up. Weapons used row. Play Again / Main Menu buttons with keyboard + mouse. Wired into `VampireSurvivorsGame.systems.runSummary`.
- **Game flow overhaul**: Removed all DOM-based menu/game-over UI (showMenuMessage, hideMenuMessage, createGameOverUI, showGameOverUI, hideGameOverUI, updateFinalStats, renderMenu). New game states: 'upgrades' and 'summary'. Death flow: gameOver → 1.5s darkening pause → summary screen. Input routing for title screen and run summary. Added mousemove listener for hover detection.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2026-02-24 (Agent #6)

- **BossSystem.js**: Timed boss encounters on 5-minute cycle (300s, 600s, 900s, 1200s, 1500s). Three boss types: Vampire Lord (bat swarm, dash, blood drain, blood nova), Lich King (necrotic zone, soul bolt, bone wall, death wave), Alpha Werewolf (charge, claw swipe, leap slam, howl + minions). Each has 3 phases (100%/66%/33% HP) unlocking new attacks. Telegraph system shows visual warnings before attacks. Health bar HUD with name, phase markers, damage shake/flash. Boss health scales with game time (+50% per 10 min). Death triggers slow-mo, particles, gold shower, XP explosion. Wired into `VampireSurvivorsGame.systems.boss`.
- **ScreenEffectsSystem bugfix**: Boss detection was accessing `enemies.enemies` (undefined property). Fixed to `enemies.activeEnemies`. Boss desaturation now works when `isBoss` enemies are active.
- **Not browser-tested** — code follows established patterns, all syntax checks pass.

### 2025-08-09

- Damage numbers clustering fix:
    - `src/core/DamageNumberPool.js`: render now uses world coordinates (camera already applied by `VampireSurvivorsGame.render()`), preventing double camera offset and on-screen clustering.
- Area magnet responsiveness + debug:
    - `src/systems/ExperienceSystem.js`: reordered `update()` to decrement timers, rebuild spatial grid, apply area-magnet pulse, then `updateGems()` so forced pulls move gems the same frame.
    - Added debug overlay circle (cyan, dashed) for active area magnet radius in `render()` when `game.showDebug` is true.
- Testing: pick up Magnet power-up; enable Debug overlay (F4/G) to see cyan radius; gems within the circle should stream toward the player; damage/collection numbers should appear near sources, not clumped.

### 2025-08-09

- Implemented timed Area Magnet effect (large-radius, duration-based gem pull):
    - `src/systems/ExperienceSystem.js`:
        - Added `activateAreaMagnet(radius, duration)` and `magnetizeGemsInRadius(radius, pulseDuration)`.
        - New timers: `areaMagnetTimer`, `areaMagnetRadius`, pulsing each frame to keep gems magnetized while active.
    - `src/core/VampireSurvivorsGame.js`:
        - Magnet pickup (`magnetBoost`) now activates Area Magnet for 12s with radius = `max(10× player.size, 20% of screen min dimension)`; optional initial pulse for immediate feedback.
        - HUD indicator updated in `updatePowerUpIndicators()` to include Area Magnet time in the Magnet pill.
    - `src/entities/ExperienceGem.js`:
        - Only forced pulses or system-level global magnet ignore range; player `magnetBoost` no longer acts as a global magnet.
        - Spawn handling honors forced/system magnet pulls.

### 2025-08-09

- Hotkey unification and docs alignment:
    - `index.html`: Performance Monitor toggle moved to F2; updated on-page hints and console help.
    - `VampireSurvivorsGame.handleKeyDown()`: added F4 alias for Debug Overlay (kept G); F1 remains Settings Menu; F2 continues Performance Dashboard when available.
    - Docs updated: `CLAUDE.md`, `README.md`, `PERFORMANCE_OPTIMIZATIONS.md` to reflect F1=Settings, F2=Performance, F4/G=Debug.
- Verified power-up HUD indicator logic:
    - `updatePowerUpIndicators()` shows Magnet pill using `max(player.magnetBoost.timer, systems.experience.globalMagnetTimer)`.
- Global magnet system confirmed:
    - `ExperienceSystem.activateGlobalMagnet()` / `isGlobalMagnetActive()`; gems honor system magnet during spawn/movement.

### 2025-08-08

- Global magnet system added in `src/systems/ExperienceSystem.js`.
    - New methods: `activateGlobalMagnet(duration)`, `isGlobalMagnetActive()`.
    - Holds `globalMagnetTimer` and forces all gems to magnetize regardless of distance/spawn.
- `src/entities/ExperienceGem.js`: honors system-level magnet; computes pull speed using remaining time (player magnetBoost vs system timer). Added subtle additive green halo when magnetized.
- Power-up pickup integration (`src/core/VampireSurvivorsGame.js`): magnet power-up now also calls `experience.activateGlobalMagnet(12.0)` to keep global magnet active for full duration.
- Developer hotkey: Shift+M in `VampireSurvivorsGame.handleKeyDown()` instantly activates `player.activatePowerUp('magnetBoost', 12)` + `experience.magnetizeAllGems()` + `experience.activateGlobalMagnet(12)`.
- Input improvements (`src/core/InputManager.js`): extended `validKeys` to include `m/M, d/D, r/R, h/H, F5`; preventDefault on F5 to avoid page refresh during telemetry toggle.
- HUD buff bar: `VampireSurvivorsGame.updatePowerUpIndicators()` renders compact pills into the `#powerup-indicators` container. Shows active boosts (Speed, Damage, Fire Rate, Invincible, Magnet) with live countdowns. Magnet time = `max(player.magnetBoost.timer, systems.experience.globalMagnetTimer)`.
- Fixed NaN floating text: `src/core/DamageNumberPool.js` now supports both numbers and strings.
    - `DamageNumber.init(...)` computes a `text` field; `render()` draws `text` instead of rounding `value`.
    - Prevents "NaN" when messages like `LEVEL 25` or `FULL HEAL` are displayed.
- Power-up drops polish: moved rendering to world-space, removed screen-space draw; enforced cap (8), size 14, lifetime 10s; elite/combination drop chance scales with active drop count.

## Debug & Hotkeys

- Shift+M: Activate magnetBoost and global magnet for 12s; instant gem pulse via `magnetizeAllGems()`.
- F1: Settings Menu.
- F2: Performance monitor/dashboard.
- F4/G: Debug overlay.
- F5: Toggle progression telemetry (browser refresh prevented).

Quick testing recipe:

- Start a run, press Shift+M. All gems should stream to the player; HUD shows a Magnet pill with a countdown.
- Collect standard boosts to see corresponding pills appear with timers.

## System Touchpoints (files/functions)

- `src/core/VampireSurvivorsGame.js`
    - `handleKeyDown()` → Shift+M handler.
    - `updateGameUI()` → calls `updatePowerUpIndicators()`.
    - `updatePowerUpIndicators()` → renders HUD pills into `#powerup-indicators`.
- `src/core/InputManager.js`
    - `inputValidator.validKeys`, keydown handler prevents default on F5.
- `src/systems/ExperienceSystem.js`
    - `activateGlobalMagnet()`, `isGlobalMagnetActive()`, `globalMagnetTimer`, `magnetizeAllGems()`.
- `src/entities/ExperienceGem.js`
    - Respects system magnet; additive halo when magnetized; time-based pull speed.
- `src/core/DamageNumberPool.js`
    - `DamageNumber` uses `text` to render numbers/labels safely (no NaN).
- `src/systems/ParticleSystemCore.js`, `src/systems/VisualEffectsSystem.js`
    - Route damage text through `globalDamageNumberPool`.

## Notes for Future Work

- Magnet polish: light trail particles and SFX while magnet is active.
- HUD: optional progress bars on pills and stacking indicators for overlapping durations.
- Balance: refine magnet pull speed caps for late waves; recheck durations (Damage 10s, Speed 8s, Fire Rate 15s, Invincible 3–5s).
- Testing: add smoke tests for overlapping player magnet vs system magnet timers.

## Performance Considerations

- **Entity Limits**: Optimized for 200+ entities at 60+ FPS
- **Memory Management**: Use object pools for frequently created/destroyed objects
- **Rendering**: Minimize canvas state changes, batch similar operations
- **Collision Detection**: Use spatial partitioning for large numbers of entities

## Developer Log (Agent #4 — 2026-02-24)

- **AdaptiveMusicSystem.js**: 4-layer procedural music (bass drone, rhythmic pulse, C-minor arpeggios, intensity filter sweep). Shares `AudioManager.audioContext`. Intensity = 60% FlowState stress + 40% enemy density + player health urgency. Starts on `startGame()`, stops on `gameOver()`/`returnToMenu()`. Melodic fragments triggered by combo milestones.
- **PassiveItemSystem.js**: 6 items × 5 levels. Integrated into `generateLevelUpOptions()` and `selectLevelUpOption()` as `new_passive`/`passive_upgrade` types. Stats applied in `Player.getEffectiveStats()`. Armor reduction in `Player.takeDamageEnhanced()`. HUD via `updatePassiveItemsHUD()`. Attractorb `pickupRange` modifier is read by `ExperienceSystem.autoCollectGems()` (formula fixed in Agent #23).
- **Enemy death animations**: Per-type effects in `Enemy.die()`: fast=scatter, tank=dissolve, ranged=explosion, elite=multi-stage, basic=radial burst. Scale with combo level. Stack with existing `createEnhancedDeathEffect()`.
- **Not browser-tested** — code follows established patterns but next agent should verify on first load.

## Sprint #29 - UI/UX Polish & Handover
- Re-engineered main menu layout to use adaptive spacing based on canvas height, fixing overlap issues.
- Implemented native canvas pause menu with Resume, Settings, and Return to Menu options.
- Polished run timer HUD with pill background and repositioned below XP bar.
- Fixed ESC key conflict between DOM settings overlay and canvas pause state.
- Prepared comprehensive architectural `HANDOVER.md` with 5 major expansion ideas for future development.
