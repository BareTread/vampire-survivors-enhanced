# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Vampire Survivors-style browser game** built with vanilla JavaScript and HTML5 Canvas. It's a survival action game where players fight endless waves of enemies, collect experience gems, level up, and upgrade weapons.

## Development Commands

### Running the Game
- **Local Development**: Open `vampire-survivors.html` in a web browser (requires local server for ES6 modules)
- **Debugging**: Press F4 in-game to toggle debug overlay, F1 for performance monitor
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
- **F1**: Toggle performance monitor (FPS, entity count, memory)
- **F4**: Toggle debug overlay
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

## Performance Considerations

- **Entity Limits**: Optimized for 200+ entities at 60+ FPS
- **Memory Management**: Use object pools for frequently created/destroyed objects
- **Rendering**: Minimize canvas state changes, batch similar operations
- **Collision Detection**: Use spatial partitioning for large numbers of entities