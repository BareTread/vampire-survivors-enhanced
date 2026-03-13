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

- `vampire-survivors.html` - Main HTML file and game launcher
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
├── DynamicEventSystem.js    # Timed narrative events (Treasure chest, Golden Swarm, Blood Moon, Calm Eye)
└── AmbientParticleSystem.js # Persistent atmospheric particles (fog wisps, dust motes, floating embers)
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
    └── BoneBoomerang.js     # Out-and-back boomerang projectile
```

## Game Features

### Weapon System

- **Auto-targeting**: Weapons automatically target nearest enemies
- **Upgradeable**: Level up weapons through experience system
- **Multiple Weapons**: 8 total | Magic Missile, Whip, Throwing Knife, Lightning Chain, Garlic Aura, Holy Bible, Fire Wand, Bone Boomerang. Distinct playstyles — each with unique behaviors
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
- **ESC**: Pause/Resume
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
- **PassiveItemSystem.js**: 6 items × 5 levels. Integrated into `generateLevelUpOptions()` and `selectLevelUpOption()` as `new_passive`/`passive_upgrade` types. Stats applied in `Player.getEffectiveStats()`. Armor reduction in `Player.takeDamageEnhanced()`. HUD via `updatePassiveItemsHUD()`. Note: Attractorb `pickupRange` modifier is set but not read by ExperienceSystem yet.
- **Enemy death animations**: Per-type effects in `Enemy.die()`: fast=scatter, tank=dissolve, ranged=explosion, elite=multi-stage, basic=radial burst. Scale with combo level. Stack with existing `createEnhancedDeathEffect()`.
- **Not browser-tested** — code follows established patterns but next agent should verify on first load.
