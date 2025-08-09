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
├── EnemySystem.js           # Enemy spawning, AI, and behavior
├── ProjectileSystem.js      # Weapon projectiles and collision
├── ExperienceSystem.js      # XP collection and leveling
├── ParticleSystem.js        # Visual effects and particles
├── PsychologyFeedbackSystem.js  # Player engagement mechanics
└── FlowStateSystem.js       # Difficulty scaling
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
    └── ThrowingKnife.js     # Projectile weapon
```

## Game Features

### Weapon System
- **Auto-targeting**: Weapons automatically target nearest enemies
- **Upgradeable**: Level up weapons through experience system
- **Multiple Types**: Magic missiles, whips, throwing knives with unique behaviors
- **Factory Pattern**: Use `WeaponFactory` to create weapons, register new types in `VampireSurvivorsGame.weaponClasses`

### Performance Optimizations
- **Object Pooling**: Managed via `ObjectPoolManager.js`
- **Spatial Partitioning**: Efficient collision detection in `SpatialPartitioning.js`  
- **Frame Rate Management**: Target 60+ FPS with 200+ entities
- **Lazy Loading**: Asset loading optimization in `utils/LazyLoader.js`

### Game Psychology Systems
- **Flow State**: Dynamic difficulty adjustment
- **Reward Psychology**: Engagement mechanics and feedback loops
- **Visual Feedback**: Screen shake, particles, audio cues for player actions

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
3. Add to level-up options in experience system

### New Enemy Types
1. Extend `Enemy` class with new behavior patterns
2. Register in `EnemySystem.js` spawn logic
3. Add to wave progression system

### New Systems
1. Create system class in `src/systems/`
2. Initialize in `VampireSurvivorsGame.systems` object
3. Call update/render methods in game loop

## Developer Log (most recent first)

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