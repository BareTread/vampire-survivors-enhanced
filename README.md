# 🧛 Vampire Survivors - Enhanced Edition

A high-performance browser-based survival action game built with vanilla JavaScript and HTML5 Canvas. Fight endless waves of enemies, collect experience gems, level up, and survive as long as you can!

![Game Screenshot](https://img.shields.io/badge/Status-Playable-brightgreen)
![Performance target](https://img.shields.io/badge/Target-60%2B%20FPS-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%20Modules-yellow)
![Canvas](https://img.shields.io/badge/HTML5-Canvas%202D-orange)

## 🎮 Features

### Core Gameplay

- **Ten Weapons**: Distinct ranged, melee, orbiting, area, freezing, and bleeding builds
- **Auto-targeting Combat**: Weapons automatically target nearest enemies
- **Experience System**: Collect gems, level up, choose upgrades
- **Directional Evade**: Space triggers a short, terrain-aware burst with brief immunity and a 2.4-second cooldown
- **Wave-based Progression**: Increasingly challenging enemy waves
- **Enemy Variants**: 15% chance for enhanced enemies with special indicators
- **Kill Streak System**: Consecutive kills unlock bonus rewards

### Advanced Features

- **Lucky Gems**: 5% chance for gems worth 5x experience with special effects
- **Enhanced Visual Effects**: Professional sprite system with procedural generation
- **Cached World Art**: Procedural terrain, obstacles, hunters, and enemy silhouettes are baked for reuse
- **Performance Dashboard**: Real-time monitoring with F2 key
- **Adaptive Quality**: Automatic performance scaling based on hardware

### Visual Enhancements

- **Readable Characters**: Hooded hunters and distinct enemy silhouettes replace plain circular bodies
- **Enhanced Particle Effects**: High-impact, low-particle visual system
- **Color-coded Damage Numbers**: 9 tiers of damage indication
- **Screen Shake Effects**: Different shake patterns for various events
- **Health Bar Improvements**: Color-coded with glow effects
- **Gothic Interface**: Cathedral title scene, stone-panel menus, evade HUD, and animated run summary
- **Informed Upgrades**: Next-level base-stat previews and evolution partners; build-fit labels never multiply stats

### Audio — Anti-Fatigue Gothic Synth Engine

- **100% Procedural**: All audio is synthesized with the Web Audio API — zero external files
- **Split Mix Buses**: Dedicated SFX + music buses with automatic music ducking keep combat readable
- **Voice-Pooled**: 16-voice pool with priority-based stealing prevents clipping during swarms
- **Expanded Sound Families**: Weapons, bosses, pickups, and UI use softer, distinct synthesis recipes instead of generic fallback beeps
- **Harshness Governor**: A bus-level low-pass + presence dip automatically tamps down upper-mid fatigue when combat gets dense
- **Silence-First Adaptive Score**: Background music now defaults to near-silence at low intensity and only blooms when combat pressure justifies it
- **Variation Over Repetition**: Repeated families like deaths, lightning, pickups, whip cracks, garlic pulses, and orbiters now subtly vary pan, filter, envelope, and harmonic shape
- **Live Audio Telemetry**: `debugCommands.getDebugInfo()` now includes runtime mix data such as voice density, ducking, compressor reduction, and harshness-governor state for evidence-based tuning
- **Emergent Gem Melody**: Collecting gems still walks the D minor pentatonic, but with gentler chime voicing
- **Shorter Cathedral Reverb**: A tighter convolution reverb keeps the gothic atmosphere without washing out the mix
- **Settings Now Hit the Real Mix**: Master/music/SFX sliders drive `AudioManager` directly instead of a stale legacy path

## 🚀 Performance Optimizations

### Engine Features

- **ECS Architecture**: Entity-Component-System for optimal performance
- **Object Pooling**: Reusable objects for particles, projectiles, enemies
- **Spatial Partitioning**: Efficient collision detection
- **Cached Canvas Art**: Reused terrain patterns and entity sprites reduce repeated drawing work
- **Frame Rate Management**: Target 60+ FPS with 350+ entities

### Memory Management

- **Particle Limits**: Dramatically reduced (90% less) for visual clarity
- **Smart Culling**: Off-screen entity management
- **Cache Optimization**: Sprite caching and batch rendering
- **Error Recovery**: Bulletproof error handling prevents crashes

## 🎯 Controls

| Key                       | Action                               |
| ------------------------- | ------------------------------------ |
| **WASD** / **Arrow Keys** | Move player                          |
| **Mouse**                 | Look/aim direction                   |
| **Space**                 | Directional evade; 2.4s recharge      |
| **Tab**                   | Inspect build; Tab or ESC closes     |
| **ESC**                   | Pause/Resume                         |
| **1-5**                   | Select level-up options              |
| **F1**                    | Settings Menu                        |
| **F2**                    | Toggle performance monitor/dashboard |
| **F4/G**                  | Toggle debug overlay                 |

## 🛠️ Technical Architecture

### Core Systems

```
src/core/
├── VampireSurvivorsGame.js  # Main game engine
├── ECS.js                   # Entity-Component-System framework
├── AudioManager.js          # Split-bus anti-fatigue procedural audio engine (Web Audio API)
├── LayeredRenderer.js       # High-performance canvas layers
├── SpriteManager.js         # Procedural sprite generation
├── GraphicsUpgrade.js       # Advanced visual effects system
├── PerformanceDashboard.js  # Real-time performance monitoring
└── Camera.js                # 2D camera with effects
```

### Game Systems

```
src/systems/
├── EnemySystem.js           # AI, spawning, variants
├── ProjectileSystem.js      # Weapon projectiles
├── ExperienceSystem.js      # XP collection, lucky gems
├── ParticleSystemOptimized.js # Visual effects (90% optimized)
├── VisualEffectsSystem.js   # High-impact effects
└── FlowStateSystem.js       # Difficulty scaling
```

### Entities

```
src/entities/
├── Player.js                # Player character with kill streaks
├── Enemy.js                 # Enemy variants and enhanced AI
├── ExperienceGem.js         # Lucky gems and collection effects
└── weapons/                 # Weapon implementations
```

## 🎨 Graphics Features

### Sprite System

- **Procedural Generation**: 13+ sprites generated programmatically
- **High-Quality Rendering**: Anti-aliasing and smooth scaling
- **Effect Support**: Rotation, scaling, tinting, glow effects
- **Performance Tracking**: Cache hits/misses monitoring

### Visual Effects

- **Quality over Quantity**: Max 15 particles vs 150+ traditional
- **Effect Templates**: Critical hits, level ups, enemy deaths
- **Adaptive Quality**: Performance-based effect scaling
- **Adaptive Detail**: Enemy overlays reduce detail during crowded scenes

## 📊 Performance Metrics

- **Target Performance**: 60+ FPS with 350+ entities
- **Verification**: A controlled browser fixture renders 240 enemies across 10 archetypes without runtime errors
- **Scope**: Render-only fixture, not a sustained frame-rate or full-run balance benchmark
- **Entity Handling**: 1 player + multiple enemies + projectiles + effects

## 🚦 Getting Started

### Prerequisites

- Modern web browser with HTML5 Canvas support
- Local web server (for ES6 modules)

### Quick Start

1. Clone the repository
2. Start a local web server in the project directory
3. Open `index.html` (or the server root) in your browser
4. Use WASD to move, survive the waves!

After updating an existing checkout, hard-refresh the browser (Ctrl+Shift+R) to discard cached ES modules.

### September 2026 update

- Preserves existing characters, weapons, evolutions, challenges, and saved progress.
- Adds Space evasion, safe spawn placement, smoother pressure scaling, and focus-loss auto-pause.
- Reworks title, loading, menus, HUD, world art, and run summary.
- Upgrade drawing and pointer hit-testing share one responsive layout.
- Fixes origin teleportation, build-overlay Escape behavior, stale upgrade state across runs, and frozen summary reveals.
- Separates UI animation time from simulation time so death summaries animate while the world stays frozen.
- Regression suite: `npm test -- --runInBand`. Browser checks cover menus, controls, upgrade selection after resizing, death, and replay.
- Keyboard-first gameplay. Responsive menus do not imply touchscreen movement controls.

### Local Development

```bash
# Simple Python server
python -m http.server 8000

# Or Node.js serve
npx serve .

# Or any other local server
```

## 🏗️ Architecture Highlights

### Performance Innovations

- **Dynamic Method Forwarding**: JavaScript Proxy for automatic method forwarding
- **Error Recovery System**: Triple-layered error handling with automatic restart
- **Adaptive Rendering**: Quality scales based on performance metrics
- **Memory Pool Management**: Reusable objects with strict limits

### Code Quality Features

- **ES6 Modules**: Clean, modular architecture
- **Error Boundaries**: Graceful degradation on failures
- **Performance Monitoring**: Built-in profiling and optimization
- **Documentation**: Comprehensive inline documentation

## 🎯 Development Highlights

This enhanced edition includes:

- **90% particle reduction** for visual clarity
- **Professional sprite system** with procedural generation
- **Advanced performance monitoring** with real-time recommendations
- **Bulletproof error handling** preventing infinite crash loops
- **Layered canvas rendering** for significant FPS improvements
- **Enhanced visual feedback** with color-coded damage and effects

## 🚀 Built With

- **Vanilla JavaScript** - ES6 modules, modern syntax
- **HTML5 Canvas** - 2D rendering with layered optimization
- **Web APIs** - Performance timing, mouse/keyboard input
- **No Dependencies** - Pure browser technologies

## 📈 Performance Dashboard

Press **F2** in-game to access:

- Real-time FPS and frame time monitoring
- Entity count tracking
- Memory usage estimation
- Performance recommendations
- Quick optimization controls

## 🎮 Game Features in Detail

### Weapon System

- **Auto-targeting**: Weapons automatically find and engage enemies
- **Upgradeable**: Level up weapons through experience system
- **Unique Behaviors**: Each weapon type has distinct mechanics
- **Visual Effects**: Enhanced muzzle flashes and impact effects

### Enemy System

- **AI Behaviors**: Different enemy types with unique movement patterns
- **Health Indicators**: Color-coded health bars with glow effects
- **Variant System**: 15% chance for enhanced enemies
- **Wave Progression**: Increasing difficulty and enemy types

### Experience System

- **Lucky Gems**: 5% chance for 5x experience gems with special effects
- **Level Up Effects**: XP magnet and visual feedback
- **Progression**: Meaningful choices in upgrade selection
- **Visual Feedback**: Enhanced collection effects and numbers

---

**🧛 Survive the Night! 🌙**

_Built with passion for performance and visual excellence._
