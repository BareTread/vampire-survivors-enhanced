import { ENEMY_ARRIVALS } from '../data/enemyNames.js';
import { getPowerUpSprite, getPowerUpGlow } from '../entities/rendering/PickupArt.js?v=20260924-pickups2';
import { Player } from '../entities/Player.js?v=20260924-pickups2';
import { EnemySystem } from '../systems/EnemySystem.js?v=20260924-pickups2';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { ExperienceSystem } from '../systems/ExperienceSystem.js?v=20260924-pickups2';
import { ParticleSystemCore } from '../systems/ParticleSystemCore.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { FlowStateSystem } from '../systems/FlowStateSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { RewardsSystem } from '../systems/RewardsSystem.js';
import { MicroChallengeSystem } from '../systems/MicroChallengeSystem.js';
import { AdaptiveMusicSystem } from '../systems/AdaptiveMusicSystem.js';
import { PassiveItemSystem } from '../systems/PassiveItemSystem.js';
import { KillMilestoneSystem } from '../systems/KillMilestoneSystem.js?v=20260924-pickups2';
import { ScreenEffectsSystem } from '../systems/ScreenEffectsSystem.js';
import { RunTimerSystem } from '../systems/RunTimerSystem.js?v=20260924-pickups2';
import { PersistenceSystem } from '../systems/PersistenceSystem.js';
import { GoldSystem } from '../systems/GoldSystem.js?v=20260924-pickups2';
import { WeaponEvolutionSystem } from '../systems/WeaponEvolutionSystem.js';
import { SynergySystem } from '../systems/SynergySystem.js';
import { RaritySystem } from '../systems/RaritySystem.js';
import { BossSystem } from '../systems/BossSystem.js?v=20260924-pickups2';
import { DynamicEventSystem } from '../systems/DynamicEventSystem.js?v=20260924-pickups2';
import { AmbientParticleSystem } from '../systems/AmbientParticleSystem.js';
import { GroundDecalSystem } from '../systems/GroundDecalSystem.js';
import { TitleScreenSystem } from '../systems/TitleScreenSystem.js';
import { RunSummarySystem } from '../systems/RunSummarySystem.js';
import { CanvasHUD } from '../systems/CanvasHUD.js?v=20260924-pickups2';
import { CHARACTERS } from '../data/characters.js';
import { globalDamageNumberPool } from './DamageNumberPool.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { GraphicsUpgrade } from './GraphicsUpgrade.js';
import { World } from './ECS.js';
import { globalTimerManager, managedSetTimeout } from './TimerManager.js';

// Import weapons
import { MagicMissile } from '../entities/weapons/MagicMissile.js';
import { Whip } from '../entities/weapons/Whip.js';
import { ThrowingKnife } from '../entities/weapons/ThrowingKnife.js';
import { LightningChain } from '../entities/weapons/LightningChain.js';
import { GarlicAura } from '../entities/weapons/GarlicAura.js?v=20260924-pickups2';
import { HolyBible } from '../entities/weapons/HolyBible.js';
import { FireWand } from '../entities/weapons/FireWand.js';
import { BoneBoomerang } from '../entities/weapons/BoneBoomerang.js';
import { IceShard } from '../entities/weapons/IceShard.js';
import { ShadowDagger } from '../entities/weapons/ShadowDagger.js';
import { ProjectileDebugger } from '../debug/ProjectileDebugger.js';
import { ProgressionTelemetry } from '../debug/ProgressionTelemetry.js';
import { ResponsiveCanvas } from '../core/ResponsiveCanvas.js';
import { SettingsMenu } from '../ui/SettingsMenu.js';
import { HelpOverlay } from '../ui/HelpOverlay.js';
import { InventoryOverlaySystem } from '../systems/InventoryOverlaySystem.js';
import { FloorItemSystem } from '../systems/FloorItemSystem.js?v=20260924-pickups2';
import { ChallengeSystem } from '../systems/ChallengeSystem.js';
import { CodexSystem } from '../systems/CodexSystem.js';
import { LevelUpOverlay } from '../systems/LevelUpOverlay.js?v=20260924-pickups2';
import { POWER_UPS, getProfile, listProfiles } from '../data/powerUps.js?v=20260924-pickups2';

// Static weapon metadata — avoids constructing throwaway weapon instances in level-up generation
const WEAPON_METADATA = {
    magic_missile: { name: 'Magic Missile', description: 'Automatically fires homing projectiles at nearby enemies' },
    whip: { name: 'Whip', description: 'Strikes in an arc, hitting multiple enemies' },
    throwing_knife: { name: 'Throwing Knife', description: 'Fast projectiles that pierce through enemies' },
    lightning_chain: {
        name: 'Lightning Chain',
        description: 'Strikes the nearest enemy with lightning that chains to nearby foes'
    },
    garlic_aura: { name: 'Garlic Aura', description: 'Damages nearby enemies with a pulsing aura of garlic essence' },
    holy_bible: {
        name: 'Holy Bible',
        description: 'Orbiting crosses that circle the player, damaging enemies on contact'
    },
    fire_wand: { name: 'Fire Wand', description: 'Launches fireballs that explode on impact, leaving burning ground' },
    bone_boomerang: {
        name: 'Bone Boomerang',
        description: 'Thrown bone that returns to the player, hitting enemies both ways'
    },
    ice_shard: { name: 'Ice Shard', description: 'Slow ice projectiles that freeze enemies on impact' },
    shadow_dagger: {
        name: 'Shadow Dagger',
        description: 'Teleports a shadow blade to the nearest enemy for massive burst damage'
    }
};

export class VampireSurvivorsGame {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config;

        // Game state
        this.gameState = 'menu'; // menu, characters, upgrades, challenges, statistics, codex, settings, playing, paused, levelUp, gameOver, summary
        this.timeScale = 1.0;
        this.gameTime = 0;
        this.score = 0;

        // Core systems
        this.world = new World(); // ECS World for entity management
        this.camera = new Camera(canvas.width, canvas.height);
        this.camera._game = this; // Reference for dynamic zoom
        this.renderer = new Renderer(canvas, this.ctx);

        this.inputManager = config.inputManager;
        this.audioManager = config.audioManager;

        // Graphics upgrade system
        this.graphicsUpgrade = new GraphicsUpgrade(this);

        // These will be initialized by GraphicsUpgrade
        this.spriteManager = null;
        this.visualEffects = null;
        this.qualitySettings = null;

        // Game systems
        this.systems = {
            terrain: new TerrainSystem(this),
            collision: new CollisionSystem(this.world, 'collision'), // ECS-based collision system
            enemy: new EnemySystem(this),
            projectile: new ProjectileSystem(this),
            experience: new ExperienceSystem(this),
            particle: new ParticleSystemCore(this),
            statusEffect: new StatusEffectSystem(this),
            // FOUNDATION systems — activate 20+ dormant callsites across the codebase
            flowState: new FlowStateSystem(this),
            achievement: new AchievementSystem(this),
            rewards: new RewardsSystem(this),
            microChallenge: new MicroChallengeSystem(this),
            adaptiveMusic: new AdaptiveMusicSystem(this),
            passiveItems: new PassiveItemSystem(this),
            killMilestone: new KillMilestoneSystem(this),
            screenEffects: new ScreenEffectsSystem(this),
            runTimer: new RunTimerSystem(this),
            persistence: new PersistenceSystem(this),
            gold: new GoldSystem(this),
            weaponEvolution: new WeaponEvolutionSystem(this),
            synergy: new SynergySystem(this),
            rarity: new RaritySystem(this),
            boss: new BossSystem(this),
            dynamicEvents: new DynamicEventSystem(this),
            ambientParticles: new AmbientParticleSystem(this),
            decals: new GroundDecalSystem(this),
            titleScreen: new TitleScreenSystem(this),
            runSummary: new RunSummarySystem(this),
            canvasHUD: new CanvasHUD(this),
            inventory: new InventoryOverlaySystem(this),
            levelUpOverlay: new LevelUpOverlay(this),
            floorItems: new FloorItemSystem(this),
            challenge: new ChallengeSystem(this),
            codex: new CodexSystem(this)
        };

        // Debug systems
        this.projectileDebugger = new ProjectileDebugger(this);
        this.progressionTelemetry = new ProgressionTelemetry(this);

        // Responsive canvas
        // DISABLED: ResponsiveCanvas was limiting canvas size and causing display issues
        // this.responsiveCanvas = new ResponsiveCanvas(canvas, this.camera);

        // Settings menu
        this.settingsMenu = new SettingsMenu(this);

        // Help overlay
        this.helpOverlay = new HelpOverlay(this);

        // Game entities
        this.player = null;

        // Power-up drops management
        this.powerUpDrops = [];
        this._lastRelicTime = -Infinity;
        this.maxPowerUpDrops = 3; // Relics on the floor at once

        // Game loop
        this.lastTime = 0;
        this.deltaTime = 0;
        this.running = false;
        this.frameCount = 0;
        this.totalFrameCount = 0;

        // OPTIMIZED: Frame rate management
        this.targetFrameTime = 16.67; // 60 FPS target
        this.frameSkipThreshold = 33.33; // 30 FPS minimum
        this.lastRenderTime = 0;

        // OPTIMIZED: Enhanced performance monitoring with adaptive scaling
        this.performanceStats = {
            fps: 0,
            frameTime: 0,
            entityCount: 0,
            lastFpsUpdate: 0,
            avgFrameTime: 0,
            worstFrameTime: 0,
            renderTime: 0,
            updateTime: 0,
            frameTimeHistory: [],
            dropped60FpsFrames: 0,
            dropped30FpsFrames: 0,
            qualityLevel: 100, // Percentage of full quality
            adaptiveMode: false,
            lastQualityAdjustment: 0
        };

        // OPTIMIZED: Quality scaling parameters
        this.qualitySettings = {
            particleReduction: 1.0,
            effectsReduction: 1.0,
            renderDistance: 1.0,
            animationDetail: 1.0,
            shadowQuality: 1.0
        };

        // Performance thresholds
        this.targetFrameTime = 16.67; // 60 FPS
        this.warningFrameTime = 33.33; // 30 FPS
        this.lastPerformanceReport = 0;
        this.performanceReportInterval = 5000; // Report every 5 seconds

        // UI state
        this.showDebug = false;
        this.levelUpOptions = [];
        this.levelUpActive = false;

        // Weapon registry
        this.weaponClasses = new Map([
            ['magic_missile', MagicMissile],
            ['whip', Whip],
            ['throwing_knife', ThrowingKnife],
            ['lightning_chain', LightningChain],
            ['garlic_aura', GarlicAura],
            ['holy_bible', HolyBible],
            ['fire_wand', FireWand],
            ['bone_boomerang', BoneBoomerang],
            ['ice_shard', IceShard],
            ['shadow_dagger', ShadowDagger]
        ]);

        this.setupInput();
        this.setupUI();
    }

    setupInput() {
        // Game controls
        this.inputManager.on('keyDown', (key) => {
            this.handleKeyDown(key);
        });

        this.inputManager.on('keyUp', (key) => {
            this.handleKeyUp(key);
        });

        this.inputManager.on('focusLost', () => {
            if (this.gameState === 'playing') this.pauseGame();
        });

        // Mouse controls (handled by player when active)
        this.inputManager.on('click', (e) => {
            this.handleClick(e);
        });

        // Mouse move for title/summary/level-up hover detection
        this._levelUpHoveredIndex = -1;
        this.inputManager.on('mouseMove', ({ x, y }) => {
            if (this.levelUpActive && this.levelUpOptions.length > 0) {
                this._levelUpHoveredIndex = this.systems.levelUpOverlay.hitTest(x, y);
                this.canvas.style.cursor = this._levelUpHoveredIndex >= 0 ? 'pointer' : 'default';
            } else if (this.gameState === 'paused') {
                this.systems.titleScreen.handlePauseMouseMove(x, y);
            } else if (
                this.gameState === 'menu' ||
                this.gameState === 'upgrades' ||
                this.gameState === 'characters' ||
                this.gameState === 'challenges' ||
                this.gameState === 'statistics' ||
                this.gameState === 'codex' ||
                this.gameState === 'settings'
            ) {
                this.systems.titleScreen.handleMouseMove(x, y);
            } else if (this.gameState === 'summary') {
                this.systems.runSummary.handleMouseMove(x, y);
            }
        });
    }

    setupUI() {
        // Clean up any artifacts from previous sessions
        this.initialCleanup();

        // Create UI elements if they don't exist
        this.createUIElements();
    }

    initialCleanup() {
        // Remove ALL non-essential DOM elements to start fresh
        document.querySelectorAll('div').forEach((div) => {
            // Keep only essential elements
            if (
                div.id === 'gameCanvas' ||
                div.id === 'game-ui' || // CRITICAL: Keep game-ui container
                div.id === 'performanceMonitor' ||
                div.id === 'controlsHelp' ||
                div.classList.contains('game-button')
            ) {
                return;
            }

            // Remove everything else
            div.remove();
        });

        // Also remove any styles that might cause issues
        document.querySelectorAll('style').forEach((style) => {
            if (style.id && (style.id.includes('wave') || style.id.includes('notification'))) {
                style.remove();
            }
        });

        console.log('✨ Initial cleanup complete');
    }

    createUIElements() {
        // Clean up any existing UI containers first
        const existingUI = document.getElementById('game-ui');
        if (existingUI) {
            existingUI.remove();
        }

        // Create fresh UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'game-ui';
        uiContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
            font-family: Arial, sans-serif;
            background: transparent !important;
            overflow: hidden !important;  /* CRITICAL: Prevent child elements from extending viewport */
        `;
        document.body.appendChild(uiContainer);

        // Create HUD
        this.createHUD(uiContainer);

        // Create level up UI
        this.createLevelUpUI(uiContainer);

        // Notifications / toasts overlay
        this.createNotificationsUI(uiContainer);
    }

    createHUD(container) {
        const hud = document.createElement('div');
        hud.id = 'game-hud';
        hud.style.cssText = `
            position: absolute;
            top: 20px; /* fallback */
            top: max(20px, env(safe-area-inset-top));
            left: 20px; /* fallback */
            left: max(20px, env(safe-area-inset-left));
            display: none;
            color: #E6E6FA;
            font-family: 'Cinzel', 'Times New Roman', serif;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(138, 43, 226, 0.4);
            pointer-events: none;
            background: linear-gradient(135deg, rgba(15, 15, 35, 0.92), rgba(45, 0, 80, 0.85));
            padding: 18px 20px;
            border-radius: 12px;
            border: 2px solid rgba(138, 43, 226, 0.7);
            box-shadow: 
                0 0 25px rgba(75, 0, 130, 0.6),
                inset 0 1px 2px rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(4px);
            max-width: 280px;
        `;

        hud.innerHTML = `
            <!-- Core Player Stats - Primary Hierarchy -->
            <div style="font-size: 22px; margin-bottom: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
                <div style="color: #FFD700; text-shadow: 3px 3px 6px rgba(218, 165, 32, 0.9); margin-bottom: 8px;">
                    ⚔ Level <span id="player-level">1</span> ⚔
                </div>
                <div style="color: #FF6B6B; text-shadow: 2px 2px 4px rgba(255, 107, 107, 0.8); font-size: 18px;">
                    ❤ <span id="player-health">100</span>/<span id="player-max-health">100</span>
                </div>
                <div style="color: #40E0D0; text-shadow: 2px 2px 4px rgba(64, 224, 208, 0.8); font-size: 16px; margin-top: 4px;">
                    ✦ <span id="player-exp">0</span>/<span id="player-exp-needed">100</span> XP
                </div>
            </div>
            
            <!-- Combo Display - Special Attention When Active -->
            <div style="font-size: 20px; margin-bottom: 12px; color: #FFD700; text-shadow: 3px 3px 6px rgba(218, 165, 32, 0.9);">
                <div id="combo-display" style="display: none; animation: pulse 1.5s infinite;">
                    🔥 COMBO: <span id="combo-count">0</span> (×<span id="combo-multiplier">1.0</span>)
                </div>
            </div>
            
            <!-- Game Progress - Secondary Hierarchy -->
            <div style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                <div style="color: #DDA0DD; margin-bottom: 4px;">⚡ Wave <span id="current-wave">1</span></div>
                <div style="color: #98FB98; margin-bottom: 4px;">⏰ <span id="game-time">0:00</span></div>
                <div style="color: #FFA500;">🏆 <span id="game-score">0</span></div>
            </div>
            
            <!-- Power-up Indicators - Dynamic Content -->
            <div id="powerup-indicators" style="font-size: 14px; margin-top: 12px; color: #00FFFF; text-shadow: 2px 2px 4px rgba(0, 255, 255, 0.8);">
                <!-- Power-up indicators will be added dynamically -->
            </div>
            
            <!-- Manual Aiming UI - Context-Sensitive -->
            <div id="manual-aiming-status" style="font-size: 14px; margin-top: 12px; display: none; color: #00FFFF; text-shadow: 2px 2px 4px rgba(0, 255, 255, 0.9); animation: pulse 1.5s infinite;">
                🎯 MANUAL AIM: <span id="aim-accuracy">0%</span> | <span id="aim-bonus">1.0x</span> DMG
                <div style="font-size: 12px; color: #FFAA00; margin-top: 3px;">
                    Shots: <span id="aim-total-shots">0</span> | Accuracy: <span id="aim-overall-accuracy">0%</span>
                </div>
            </div>
            
            <!-- Controls Hint - Minimal and Subtle -->
            <div id="controls-hint" style="font-size: 10px; margin-top: 10px; color: #888; opacity: 0.6; line-height: 1.3;">
                <span style="color: #FFD700; font-weight: bold;">SHIFT</span>: Manual Aim | 
                <span style="color: #FFD700; font-weight: bold;">F2</span>: Performance | 
                <span style="color: #FFD700; font-weight: bold;">F4/G</span>: Debug
            </div>
            
            <!-- Debug Overlay - Technical Metrics Only -->
            <div id="debug-info" style="font-size: 11px; margin-top: 12px; display: none; opacity: 0.8; color: #ccc; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; border-left: 3px solid #444;">
                <div style="color: #aaa; font-weight: bold; margin-bottom: 4px;">TECHNICAL DEBUG</div>
                <div>Entities: <span id="entity-count" style="color: #4ade80;">0</span></div>
                <div>Projectiles: <span id="projectile-count" style="color: #fbbf24;">0</span></div>
                <div>Experience Gems: <span id="gem-count" style="color: #8b5cf6;">0</span></div>
                <div>Enemies: <span id="enemy-count" style="color: #ef4444;">0</span></div>
            </div>
        `;

        // Add pulsing animation for combo
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        container.appendChild(hud);
    }

    createLevelUpUI(container) {
        const levelUpUI = document.createElement('div');
        levelUpUI.id = 'level-up-ui';
        levelUpUI.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            border: 3px solid #FFD700;
            border-radius: 10px;
            padding: 30px;
            color: white;
            text-align: center;
            display: none;
            pointer-events: auto;
            z-index: 500;
            max-width: 600px;
        `;

        levelUpUI.innerHTML = `
            <h2 style="color: #FFD700; margin-bottom: 20px;">LEVEL UP!</h2>
            <p style="margin-bottom: 30px;">Choose an upgrade:</p>
            <div id="level-up-options" style="display: flex; flex-direction: column; gap: 15px;">
                <!-- Options will be populated dynamically -->
            </div>
        `;

        container.appendChild(levelUpUI);
    }

    createNotificationsUI(container) {
        // Subtle toasts stacked top-center, just under the run timer — clear
        // of the character panel (left) and the gold/kills panel (right)
        const notifications = document.createElement('div');
        notifications.id = 'notifications';
        notifications.style.cssText = `
            position: absolute;
            top: 112px; /* below the timer and the achievement card */
            top: max(112px, calc(env(safe-area-inset-top) + 104px));
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: center;
            pointer-events: none;
            z-index: 300;
        `;
        container.appendChild(notifications);
    }

    showToast(message, color = '#FFD700', duration = 1500) {
        const container = document.getElementById('notifications');
        if (!container) return;
        const el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = `
            background: linear-gradient(180deg, rgba(22, 14, 30, 0.82), rgba(12, 8, 18, 0.82));
            color: ${color};
            border: 1px solid rgba(201, 168, 106, 0.45);
            padding: 4px 12px;
            border-radius: 4px;
            white-space: nowrap;
            font-family: 'Cinzel', 'Times New Roman', serif;
            font-size: 12px;
            letter-spacing: 0.3px;
            text-shadow: 0 1px 1px rgba(0,0,0,0.35);
            opacity: 0;
            transform: translateY(-4px);
            transition: opacity 160ms ease, transform 160ms ease;
            pointer-events: none;
        `;
        container.appendChild(el);
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-4px)';
            setTimeout(() => el.remove(), 200);
        }, duration);

        // Keep only a few toasts visible
        while (container.children.length > 4) {
            container.firstChild.remove();
        }
    }

    showPickupToast(text, color = '#FFD700') {
        this.showToast(text, color, 1400);
    }

    getPowerUpName(type) {
        return POWER_UPS[type]?.name || 'Power-up';
    }

    getPowerUpPickupHint(type) {
        return POWER_UPS[type]?.hint || 'Power-up';
    }


    handleKeyDown(key) {
        switch (key.toLowerCase()) {
            case 'escape':
                if (this.systems.inventory?.visible) {
                    this.systems.inventory.hide();
                    break;
                }
                if (
                    this.gameState === 'upgrades' ||
                    this.gameState === 'characters' ||
                    this.gameState === 'challenges' ||
                    this.gameState === 'statistics' ||
                    this.gameState === 'codex' ||
                    this.gameState === 'settings'
                ) {
                    this.gameState = 'menu';
                } else if (this.gameState === 'summary') {
                    this.returnToMenu();
                } else if (this.gameState === 'playing') {
                    this.pauseGame();
                } else if (this.gameState === 'paused') {
                    // Don't resume if DOM settings overlay is open (ESC closes that first)
                    if (!this.settingsMenu?.isVisible) {
                        this.systems.titleScreen.handlePauseInput('escape');
                    }
                }
                break;
            case 'f1':
                // Toggle settings menu
                this.settingsMenu.toggle();
                break;
            case 'f2':
                // Toggle performance dashboard
                if (this.performanceDashboard) {
                    this.performanceDashboard.toggle();
                }
                break;
            case 'r':
                if (this.gameState === 'summary') {
                    this.restartGame();
                }
                break;
            case 'm':
                if (this.inputManager.keys['shift']) {
                    // Debug: Magnetic Field + global magnet pulse for quick testing
                    if (this.player && this.systems && this.systems.experience) {
                        const profile = getProfile('pickup', 'magnetBoost');
                        this.player.activatePowerUp('magnetBoost', profile.duration, profile.intensity);
                        this.systems.experience.activateMagneticField(profile.duration);
                        if (typeof this.systems.experience.activateGlobalMagnet === 'function') {
                            this.systems.experience.activateGlobalMagnet(profile.duration);
                        }
                        console.log('🧲 Debug: Magnetic field activated for 12s');
                    }
                } else if (this.gameState === 'summary') {
                    this.returnToMenu();
                }
                break;
            case 'd':
                // Toggle projectile debugger (D key to avoid F3 browser find)
                if (this.inputManager.keys['shift']) {
                    this.projectileDebugger.toggle();
                }
                break;
            case 'h':
                // Toggle help overlay
                this.helpOverlay.toggle();
                break;
            case 'tab':
                // Toggle build inventory overlay
                if (this.gameState === 'playing' || this.systems.inventory?.visible) {
                    this.systems.inventory.toggle();
                }
                break;
            case 'f4':
            case 'g':
            case 'G':
                this.showDebug = !this.showDebug;
                if (document.getElementById('debug-info')) {
                    document.getElementById('debug-info').style.display = this.showDebug ? 'block' : 'none';
                }
                console.log('Debug overlay:', this.showDebug ? 'ON' : 'OFF');
                break;
            case 'f5':
                // Toggle progression telemetry
                this.progressionTelemetry.enabled = !this.progressionTelemetry.enabled;
                console.log(`📊 Progression Telemetry: ${this.progressionTelemetry.enabled ? 'ENABLED' : 'DISABLED'}`);
                break;
            case ' ':
                if (this.gameState === 'playing' && !this.systems.inventory?.visible &&
                    !this.settingsMenu?.isVisible) {
                    this.player?.startDash();
                    break;
                }
                // Otherwise Space retains its menu and pause confirmation behavior.
            case 'enter':
                if (
                    this.gameState === 'menu' ||
                    this.gameState === 'upgrades' ||
                    this.gameState === 'characters' ||
                    this.gameState === 'challenges' ||
                    this.gameState === 'statistics' ||
                    this.gameState === 'codex' ||
                    this.gameState === 'settings'
                ) {
                    this.systems.titleScreen.handleInput(key);
                } else if (this.gameState === 'paused') {
                    this.systems.titleScreen.handlePauseInput(key.toLowerCase());
                } else if (this.gameState === 'summary') {
                    this.systems.runSummary.handleInput(key);
                }
                break;
            case 'arrowup':
            case 'arrowdown':
            case 'arrowleft':
            case 'arrowright':
                if (
                    this.gameState === 'menu' ||
                    this.gameState === 'upgrades' ||
                    this.gameState === 'characters' ||
                    this.gameState === 'challenges' ||
                    this.gameState === 'statistics' ||
                    this.gameState === 'codex' ||
                    this.gameState === 'settings'
                ) {
                    this.systems.titleScreen.handleInput(key);
                } else if (this.gameState === 'paused') {
                    this.systems.titleScreen.handlePauseInput(key.toLowerCase());
                } else if (this.gameState === 'summary') {
                    this.systems.runSummary.handleInput(key);
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (this.levelUpActive) {
                    const optionIndex = parseInt(key) - 1;
                    if (optionIndex < this.levelUpOptions.length) {
                        this.selectLevelUpOption(optionIndex);
                    }
                }
                break;
        }
    }

    updatePowerUpIndicators() {
        const container = document.getElementById('powerup-indicators');
        if (!container || !this.player) return;

        const entries = [];
        const p = this.player.powerUps || {};

        // Helper to push an entry
        const pushEntry = (key, label, seconds, color) => {
            if (seconds > 0.05) {
                entries.push({ key, label, seconds, color });
            }
        };

        // Speed
        if (p.speedBoost?.active) {
            const d = POWER_UPS.speedBoost;
            pushEntry('speedBoost', d.name, p.speedBoost.timer, d.hudColor);
        }
        // Damage
        if (p.damageBoost?.active) {
            const d = POWER_UPS.damageBoost;
            pushEntry('damageBoost', d.name, p.damageBoost.timer, d.hudColor);
        }
        // Fire rate
        if (p.fireRate?.active) {
            const d = POWER_UPS.fireRate;
            pushEntry('fireRate', d.name, p.fireRate.timer, d.hudColor);
        }
        // Invincibility
        if (p.invincible?.active) {
            const d = POWER_UPS.invincible;
            pushEntry('invincible', d.name, p.invincible.timer, d.hudColor);
        }
        // Magnet: combine player magnetBoost, system-level global magnet timer, and area magnet timer
        const playerMagnet = p.magnetBoost?.active ? p.magnetBoost.timer || 0 : 0;
        const systemMagnet =
            this.systems && this.systems.experience && this.systems.experience.globalMagnetTimer
                ? this.systems.experience.globalMagnetTimer
                : 0;
        const areaMagnet =
            this.systems && this.systems.experience && this.systems.experience.areaMagnetTimer
                ? this.systems.experience.areaMagnetTimer
                : 0;
        const magnetTime = Math.max(playerMagnet, systemMagnet, areaMagnet);
        if (magnetTime > 0.05) {
            const d = POWER_UPS.magnetBoost;
            pushEntry('magnet', d.name, magnetTime, d.hudColor);
        }
        // Render compact pills with remaining time (no heavy DOM churn)
        if (entries.length === 0) {
            container.innerHTML = '';
            return;
        }

        const html = entries
            .map((e) => {
                const secs = Math.max(0, e.seconds).toFixed(1);
                return `
                <span 
                    style="
                        display:inline-block;
                        margin-right:8px; margin-bottom:6px;
                        padding:3px 8px; border-radius:10px;
                        background: rgba(0,0,0,0.45);
                        border: 1px solid ${e.color};
                        color: ${e.color};
                        font-size: 12px; line-height: 1; letter-spacing: .3px;
                        text-shadow: 0 0 6px rgba(255,255,255,0.2);
                        box-shadow: 0 0 10px rgba(0,0,0,0.35), inset 0 0 8px rgba(255,255,255,0.06);
                        pointer-events: none;
                    ">
                    <strong style="color:${e.color}">${e.label}</strong>
                    <span style="opacity:.85; margin-left:6px; color:#E6E6FA">${secs}s</span>
                </span>
            `;
            })
            .join('');

        container.innerHTML = html;
    }

    updatePassiveItemsHUD() {
        // Ensure container exists
        let container = document.getElementById('passive-items-bar');
        if (!container) {
            const hud = document.getElementById('game-hud');
            if (!hud) return;
            container = document.createElement('div');
            container.id = 'passive-items-bar';
            container.style.cssText = `
                margin-top: 8px;
                font-size: 13px;
                pointer-events: none;
            `;
            hud.appendChild(container);
        }

        if (!this.systems.passiveItems) {
            container.innerHTML = '';
            return;
        }

        const items = this.systems.passiveItems.getOwnedItems();
        if (items.length === 0) {
            container.innerHTML = '';
            return;
        }

        const html = items
            .map((item) => {
                const pips = '●'.repeat(item.currentLevel) + '○'.repeat(item.maxLevel - item.currentLevel);
                return `
                <span style="
                    display: inline-block;
                    margin-right: 6px; margin-bottom: 4px;
                    padding: 2px 6px; border-radius: 8px;
                    background: rgba(0,0,0,0.45);
                    border: 1px solid ${item.color};
                    color: ${item.color};
                    font-size: 11px; line-height: 1;
                    letter-spacing: .2px;
                    pointer-events: none;
                ">
                    <span style="margin-right:3px;">${item.icon}</span>
                    <span style="font-size:9px; opacity:0.8;">${pips}</span>
                </span>
            `;
            })
            .join('');

        container.innerHTML = html;
    }

    handleKeyUp(key) {
        // Handle key releases if needed
    }

    handleClick(e) {
        const x = typeof e?.x === 'number' ? e.x : e?.clientX;
        const y = typeof e?.y === 'number' ? e.y : e?.clientY;
        if (typeof x !== 'number' || typeof y !== 'number') {
            return;
        }

        if (this.levelUpActive && this.levelUpOptions.length > 0) {
            const index = this.systems.levelUpOverlay.hitTest(x, y);
            if (index >= 0) this.selectLevelUpOption(index);
            return;
        }

        if (this.gameState === 'paused') {
            this.systems.titleScreen.handlePauseClick(x, y);
        } else if (
            this.gameState === 'menu' ||
            this.gameState === 'upgrades' ||
            this.gameState === 'characters' ||
            this.gameState === 'challenges' ||
            this.gameState === 'statistics' ||
            this.gameState === 'codex' ||
            this.gameState === 'settings'
        ) {
            this.systems.titleScreen.handleClick(x, y);
        } else if (this.gameState === 'summary') {
            this.systems.runSummary.handleClick(x, y);
        }
    }

    startGame() {
        this.gameState = 'playing';
        this.timeScale = 1.0; // Ensure gameplay resumes after game over
        this.gameTime = 0;
        this.score = 0;
        this.levelUpActive = false;
        this.levelUpOptions = [];
        this._levelUpHoveredIndex = -1;
        this.canvas.style.cursor = 'default';

        this.disposePlayer();

        // Initialize graphics upgrades
        this.initializeGraphicsUpgrades();

        // Get selected character config
        const charId = this.systems.persistence.getSelectedCharacter();
        const character = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];

        // Initialize player
        this.player = new Player(this, 0, 0);

        // Apply character color + identity (drives hunter headgear art)
        this.player.color = character.color;
        this.player.characterId = character.id;

        // Apply character stat modifiers
        for (const [stat, value] of Object.entries(character.statModifiers)) {
            if (stat === 'projectiles') {
                this.player.stats.projectiles += value;
            } else if (stat === 'health') {
                this.player.maxHealth = Math.floor(this.player.maxHealth * value);
                this.player.health = this.player.maxHealth;
            } else if (this.player.stats[stat] !== undefined) {
                this.player.stats[stat] *= value;
            }
        }

        this.player.applyPersistentUpgrades();

        // Apply challenge modifiers (must come AFTER persistent upgrades so HP is final)
        this.systems.challenge.applyToRun(this.player);

        // Give character starting weapon
        const WeaponClass = this.weaponClasses.get(character.startingWeapon);
        this.player.addWeapon(WeaponClass || MagicMissile);
        this.systems.codex?.discoverWeapon(character.startingWeapon);

        // Reset all systems
        this.systems.terrain.reset();
        this.systems.enemy.reset();
        this.systems.projectile.clearAll();
        this.systems.experience.clearAll();
        this.systems.particle.clear();
        this.systems.statusEffect.clearAllEffects();
        this.systems.flowState.reset();
        this.systems.achievement.reset();
        this.systems.rewards.reset();
        this.systems.microChallenge.reset();
        this.systems.passiveItems.reset();
        this.systems.killMilestone.reset();
        this.systems.screenEffects.reset();
        this.systems.runTimer.reset();
        this.systems.gold.reset();
        this.systems.weaponEvolution.reset();
        this.systems.synergy.reset();
        this.systems.inventory.reset();
        this.systems.boss.reset();
        this.systems.dynamicEvents.reset();
        this.systems.ambientParticles.reset();
        this.systems.decals.reset();
        this.systems.canvasHUD.reset();
        this.systems.floorItems.reset();
        this.systems.challenge.reset(); // clear per-run multipliers
        this.systems.rarity.reset(); // clear stat pick counts for new run
        // Note: persistence not reset (cross-run data)
        this.powerUpDrops = [];
        this._lastRelicTime = -Infinity;

        // Set up camera to follow player
        this.camera.x = this.camera.targetX = this.player.x;
        this.camera.y = this.camera.targetY = this.player.y;
        this.camera.leadX = this.camera.leadY = 0;
        this.camera._lastPlayerX = this.player.x;
        this.camera._lastPlayerY = this.player.y;
        this.camera.resetEffects();
        this.camera.zoom = this.camera.targetZoom = this.camera.dynamicZoomTarget = this.camera.baseZoom;

        // Add atmospheric vignette
        this.camera.addVignette(0.3);

        // Start vampire ambient sounds
        if (this.audioManager && this.audioManager.startVampireAmbient) {
            this.audioManager.startVampireAmbient();
        }

        // Start adaptive music
        if (this.systems.adaptiveMusic) {
            this.systems.adaptiveMusic.start();
        }

        // Hide menu UI, show game UI
        this.updateUIVisibility();
    }

    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.timeScale = 0;
            this.systems.titleScreen.pauseSelectedIndex = 0;
            this.systems.titleScreen.pauseHoveredIndex = -1;
        }
    }

    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.timeScale = 1.0;
        }
    }

    restartGame() {
        this.systems.runSummary.reset();
        this.startGame();
    }

    disposePlayer() {
        if (!this.player) return;

        if (typeof this.player.destroy === 'function') {
            this.player.destroy();
        }

        this.player = null;
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.timeScale = 1.0;
        this.levelUpActive = false;
        this.levelUpOptions = [];
        this._levelUpHoveredIndex = -1;
        this.canvas.style.cursor = 'default';
        this.systems.inventory.reset();
        this.systems.runSummary.reset();
        this.systems.titleScreen.reset();

        // Clear world state so the menu is clean
        try {
            this.systems.projectile.clearAll();
            this.systems.experience.clearAll();
            this.systems.particle.clear();
            this.systems.enemy.reset();
            this.systems.dynamicEvents.reset();
            if (this.audioManager && this.audioManager.stopAll) {
                this.audioManager.stopAll();
            }
            if (this.systems.adaptiveMusic) {
                this.systems.adaptiveMusic.stop();
            }
        } catch (e) {
            console.warn('Minor cleanup issue on returnToMenu:', e);
        }
        this.powerUpDrops = [];
        this._lastRelicTime = -Infinity;
        // Reset clears queued picks, progress, and level-up grace immunity.
        this.player?.resetRewardState?.();
        this.disposePlayer();

        this.updateUIVisibility();
    }

    gameOver() {
        this.gameState = 'gameOver';
        this.timeScale = 0;
        this._deathTime = performance.now();

        // Stop adaptive music on game over
        if (this.systems.adaptiveMusic) {
            this.systems.adaptiveMusic.stop();
        }

        // Collect run data BEFORE persisting (so summary can compare records)
        const runData = {
            kills: this.systems.killMilestone ? this.systems.killMilestone.totalKills : 0,
            survivalTime: this.gameTime,
            level: this.player ? this.player.level : 1,
            goldEarned: this.systems.gold ? this.systems.gold.runGold : 0,
            combo: this.player && this.player.combo ? this.player.combo.maxCombo : 0,
            weaponsUsed: this.player ? Array.from(this.player.weapons.keys()) : [],
            damageDealt: this.score || 0,
            score: this.score || 0,
            wave: this.systems.enemy.getCurrentWave(),
            killedBy: this.player?.lastDamageSource || null
        };

        // Show summary (computes record comparisons against current records)
        this.systems.runSummary.show(runData);

        // THEN persist (updates records for next run)
        if (this.systems.persistence && this.player) {
            this.systems.persistence.recordRunEnd(runData);
        }

        // Transition to summary after 1.5s death pause
        managedSetTimeout(() => {
            if (this.gameState === 'gameOver') {
                this.gameState = 'summary';
            }
        }, 1500);
    }

    showLevelUpUI() {
        // Prevent multiple level-up UIs from showing simultaneously
        if (this.levelUpActive) return;

        this.levelUpActive = true;
        this.gameState = 'levelUp';
        this.timeScale = 0; // Pause game during level up
        this._levelUpHoveredIndex = -1;

        // Generate level up options — canvas overlay renders automatically via render()
        this.generateLevelUpOptions();
    }

    hideLevelUpUI() {
        this._levelUpHoveredIndex = -1;
        this.canvas.style.cursor = 'default';

        // Clear any lingering flash effects to prevent red overlay bug
        if (this.camera && this.camera.clearFlash) {
            this.camera.clearFlash();
        }

        // Also clear particle system screen effects
        if (this.systems.particle && this.systems.particle.clearScreenEffects) {
            this.systems.particle.clearScreenEffects();
        }

        // Queued level-ups chain synchronously: completeLevelUpSelection shows
        // the next pick immediately, so the game never leaves the paused
        // 'levelUp' state between picks (no timer-driven playing gap).
        this.levelUpActive = false;
        if (this.player && this.player.completeLevelUpSelection) {
            this.player.completeLevelUpSelection();
        }
        if (this.levelUpActive) return; // next queued pick is already showing

        // Final pick: resume with a brief no-flash immunity grace.
        this.gameState = 'playing';
        this.timeScale = 1.0; // Resume game
        if (this.player) {
            this.player.grantLevelUpGrace();
        }
    }

    generateLevelUpOptions() {
        const options = [];

        // Weapon upgrades
        for (const weapon of this.player.weapons.values()) {
            if (weapon.level < weapon.maxLevel) {
                options.push({
                    type: 'weapon_upgrade',
                    weaponId: weapon.id,
                    name: `${weapon.name} (Level ${weapon.level + 1})`,
                    description: `Upgrade ${weapon.name}`
                });
            }
        }

        // New weapons (if player has weapon slots)
        // Uses static metadata to avoid constructing throwaway weapon instances
        if (this.player.weapons.size < this.player.maxWeapons) {
            const availableWeapons = [
                'whip',
                'magic_missile',
                'throwing_knife',
                'lightning_chain',
                'garlic_aura',
                'holy_bible',
                'fire_wand',
                'bone_boomerang',
                'ice_shard',
                'shadow_dagger'
            ];
            for (const weaponType of availableWeapons) {
                if (!Array.from(this.player.weapons.values()).some((w) => w.id === weaponType)) {
                    const meta = WEAPON_METADATA[weaponType];
                    if (meta && this.weaponClasses.has(weaponType)) {
                        options.push({
                            type: 'new_weapon',
                            weaponType: weaponType,
                            name: meta.name,
                            description: meta.description
                        });
                    }
                }
            }
        }

        // Stat upgrades — still valuable, but less generically run-winning than before
        const statUpgrades = [
            { stat: 'damage', name: 'Damage +15%', description: 'Increase weapon damage' },
            { stat: 'speed', name: 'Speed +10%', description: 'Move faster' },
            { stat: 'health', name: 'Max Health +20%', description: 'Increase maximum health' },
            { stat: 'luck', name: 'Luck +8%', description: 'Better experience and drops' },
            { stat: 'area', name: 'Area +12%', description: 'Bigger projectiles and AoE radius' },
            { stat: 'cooldown', name: 'Cooldown -8%', description: 'Weapons fire faster' }
        ];

        for (const upgrade of this.shuffleArray([...statUpgrades]).slice(0, 4)) {
            options.push({
                type: 'stat_upgrade',
                stat: upgrade.stat,
                name: upgrade.name,
                description: upgrade.description
            });
        }

        // Passive item options (upgrades + new items) — blocked by iron_will challenge
        const allowPassives = !this.systems.challenge?.hasModifier('iron_will');
        if (allowPassives && this.systems.passiveItems) {
            const passiveOptions = this.systems.passiveItems.getLevelUpOptions();
            options.push(...passiveOptions);
        }

        // Weapon Evolution options (special legendary tier — always offered if available)
        const evolutionOptions = this.systems.weaponEvolution ? this.systems.weaponEvolution.getEvolutionOptions() : [];

        // Randomly select 3-5 options from normal pool
        let selected = this.shuffleArray(options).slice(0, Math.min(options.length, 3 + Math.floor(Math.random() * 3)));

        // Inject evolution options at front (guaranteed to appear)
        if (evolutionOptions.length > 0) {
            selected = [
                ...evolutionOptions.slice(0, 1),
                ...selected.slice(0, selected.length > 2 ? selected.length - 1 : selected.length)
            ];
        }

        // Assign rarity tiers to each option
        if (this.systems.rarity) {
            selected = selected.map((opt) => this.systems.rarity.assignRarity(opt));
        }

        this.levelUpOptions = selected;
    }

    selectLevelUpOption(index) {
        const option = this.levelUpOptions[index];
        if (!option) return;

        // FIX: Validate that the option is still applicable (queued level-ups
        // can cause stale options where e.g. a weapon is already at max level).
        switch (option.type) {
            case 'weapon_upgrade': {
                const weapon = this.player.weapons.get(option.weaponId);
                if (!weapon || weapon.level >= weapon.maxLevel) {
                    this.showToast('Option no longer available', '#FF6666', 1200);
                    return; // Don't close UI — let player pick another
                }
                this.player.upgradeWeapon(option.weaponId);
                if (this.audioManager && this.audioManager.playWeaponUpgrade) {
                    this.audioManager.playWeaponUpgrade();
                }
                break;
            }
            case 'new_weapon': {
                if (this.player.weapons.size >= this.player.maxWeapons) {
                    this.showToast('Weapon slots full', '#FF6666', 1200);
                    return;
                }
                if (Array.from(this.player.weapons.values()).some(w => w.id === option.weaponType)) {
                    this.showToast('Already have this weapon', '#FF6666', 1200);
                    return;
                }
                const WeaponClass = this.weaponClasses.get(option.weaponType);
                if (WeaponClass) {
                    this.player.addWeapon(WeaponClass);
                }
                this.systems.codex?.discoverWeapon(option.weaponType);
                if (this.audioManager && this.audioManager.playWeaponUpgrade) {
                    this.audioManager.playWeaponUpgrade();
                }
                break;
            }
            case 'stat_upgrade':
                this.applyStatUpgrade(option.stat);
                if (this.systems.rarity) {
                    this.systems.rarity.recordStatPick(option.stat);
                }
                if (this.audioManager && this.audioManager.playLevelUp) {
                    this.audioManager.playLevelUp();
                }
                this.showToast(`${option.name}: ${option.description}`, '#7CF2FF', 1300);
                break;
            case 'evolution':
                if (this.systems.weaponEvolution) {
                    const canEvolve = this.systems.weaponEvolution.getEvolutionOptions()
                        .some(e => e.weaponId === option.weaponId);
                    if (!canEvolve) {
                        this.showToast('Evolution no longer available', '#FF6666', 1200);
                        return;
                    }
                    this.systems.weaponEvolution.evolveWeapon(option.weaponId);
                }
                break;
            case 'new_passive':
            case 'passive_upgrade':
                if (this.systems.passiveItems) {
                    this.systems.passiveItems.addItem(option.itemId);
                }
                break;
        }

        // Enhanced visual effects - reduced intensity to prevent overlay
        this.systems.particle.createEvolutionEffect(this.player.x, this.player.y);

        this.hideLevelUpUI();
    }

    applyStatUpgrade(stat) {
        switch (stat) {
            case 'damage':
                this.player.stats.damage *= 1.15;
                break;
            case 'speed':
                this.player.stats.speed *= 1.10;
                break;
            case 'health':
                const oldMaxHealth = this.player.maxHealth;
                this.player.maxHealth = Math.floor(this.player.maxHealth * 1.20);
                this.player.health += this.player.maxHealth - oldMaxHealth; // Heal for the difference only
                break;
            case 'luck':
                this.player.stats.luck *= 1.08;
                break;
            case 'area':
                this.player.stats.area *= 1.12;
                break;
            case 'cooldown':
                this.player.stats.cooldown *= 0.94;
                break;
        }

        // Update weapon stats
        for (const weapon of this.player.weapons.values()) {
            weapon.updateStats();
        }
    }

    updateUIVisibility() {
        // DOM HUD hidden — replaced by CanvasHUD
        const hud = document.getElementById('game-hud');
        if (hud) {
            hud.style.display = 'none';
        }
        // Hide game-over DOM element if it still exists from old sessions
        const gameOverEl = document.getElementById('game-over-ui');
        if (gameOverEl) gameOverEl.style.display = 'none';
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.gameState = 'menu';
        this.frameCount = 0;
        this.totalFrameCount = 0;
        this.performanceStats.lastFpsUpdate = this.lastTime;
        this.lastPerformanceReport = this.lastTime;
        this.updateUIVisibility();

        requestAnimationFrame(this.gameLoop);
    }

    async initializeGraphicsUpgrades() {
        try {
            await this.graphicsUpgrade.initialize();
            console.log('🎨 Graphics upgrades successfully initialized');
        } catch (error) {
            console.warn('⚠️ Graphics upgrades failed to initialize, using fallback rendering:', error);
        }
    }

    /**
     * Measures the display's vsync interval and returns true for vsyncs that
     * should be skipped so a 120/144/240Hz monitor renders at ~60-80 FPS.
     */
    _shouldSkipFrame(now) {
        const p = this._pacing || (this._pacing = { last: 0, samples: [], divisor: 1, tick: 0 });
        if (p.last) {
            const d = now - p.last;
            if (d > 0 && d < 50) {
                p.samples.push(d);
                if (p.samples.length > 90) p.samples.shift();
                if (p.samples.length >= 30 && (p.tick & 31) === 0) {
                    const sorted = p.samples.slice().sort((a, b) => a - b);
                    const hz = 1000 / sorted[sorted.length >> 1];
                    p.divisor = Math.max(1, Math.floor(hz / 58));
                }
            }
        }
        p.last = now;
        p.tick++;
        if (this.uncappedFrameRate || p.divisor <= 1) return false;
        return p.tick % p.divisor !== 0;
    }

    gameLoop = (currentTime) => {
        try {
            if (!this.running) return;

            // PERFORMANCE THROTTLING for low-end devices
            // Track FPS and auto-adjust quality
            if (!this.performanceThrottle) {
                this.performanceThrottle = {
                    samples: [],
                    sampleSize: 60,
                    qualityLevel: 1.0,
                    lastAdjust: 0,
                    adjustInterval: 2000 // Check every 2 seconds
                };
            }

            // Frame pacing: on 100Hz+ displays render every Nth vsync (~60-80
            // FPS) unless the player opted into an uncapped frame rate. Even
            // divisors keep pacing perfectly regular; skipped vsyncs cost ~0.
            if (this._shouldSkipFrame(currentTime)) {
                requestAnimationFrame(this.gameLoop);
                return;
            }

            // OPTIMIZED: Ultra-fast deltaTime calculation with minimal operations
            const rawDeltaTime = (currentTime - this.lastTime) * 0.001; // Multiply is faster than divide
            this.deltaTime = rawDeltaTime > 0.033 ? 0.033 : rawDeltaTime < 0.001 ? 0.001 : rawDeltaTime; // Branchless clamp
            this.lastTime = currentTime;
            this.frameCount++;
            this.totalFrameCount++;

            // Memory pressure check - prevent crashes at high levels
            if (this.totalFrameCount % 1800 === 0) {
                // Every 30 seconds at 60fps
                this.performMemoryCleanup();
            }

            // Track FPS for throttling
            this.performanceThrottle.samples.push(rawDeltaTime);
            if (this.performanceThrottle.samples.length > this.performanceThrottle.sampleSize) {
                this.performanceThrottle.samples.shift();
            }

            // A camera hit-stop finishing during level-up must not resume the clock.
            if (this.gameState === 'levelUp') this.timeScale = 0;
            // Apply time scale with single multiplication
            const scaledDeltaTime = this.deltaTime * this.timeScale;

            // OPTIMIZED: Timing tracking for frame budget management
            const updateStart = performance.now();
            try {
                this.update(scaledDeltaTime, this.deltaTime);
            } catch (updateError) {
                console.error('Update error:', updateError);
                // Track errors visibly instead of nuking game state
                if (!this._errorLog) this._errorLog = [];
                if (this._errorLog.length < 10) {
                    this._errorLog.push({
                        msg: updateError.message,
                        stack: updateError.stack?.split('\n')[1]?.trim(),
                        time: Date.now()
                    });
                }
                // Only do emergency cleanup for truly catastrophic cases (not every frame)
                if (!this._lastErrorCleanup || performance.now() - this._lastErrorCleanup > 5000) {
                    this._lastErrorCleanup = performance.now();
                    this.handleCriticalError(updateError);
                }
            }
            this.performanceStats.updateTime = performance.now() - updateStart;

            const renderStart = performance.now();
            try {
                this.render();
            } catch (renderError) {
                console.error('Render error:', renderError);
                // Continue with next frame even if render fails
            }
            this.performanceStats.renderTime = performance.now() - renderStart;

            // OPTIMIZED: Adaptive performance monitoring frequency based on entity count
            const entityCount =
                (this.systems.enemy?.getEnemyCount?.() || 0) +
                (this.systems.projectile?.activeProjectiles?.length || 0);
            const monitoringFreq = entityCount > 150 ? 60 : entityCount > 100 ? 45 : 30;

            if (this.totalFrameCount % monitoringFreq === 0) {
                try {
                    this.updatePerformanceStats(currentTime);

                    // OPTIMIZED: Automatic quality scaling for consistent 60 FPS
                    if (this.performanceStats.avgFrameTime > 18.0 && entityCount > 100) {
                        this.adaptiveQualityReduction();
                    } else if (this.performanceStats.avgFrameTime < 14.0 && entityCount < 80) {
                        this.adaptiveQualityRestoration();
                    }

                    // Emergency brake at very high entity counts
                    if (entityCount > 500) {
                        console.warn('Emergency entity limit reached, forcing cleanup');
                        this.emergencyEntityCleanup();
                    }
                } catch (perfError) {
                    console.warn('Performance monitoring error:', perfError);
                }
            }

            requestAnimationFrame(this.gameLoop);
        } catch (criticalError) {
            console.error('Critical game loop error:', criticalError);
            console.error('Error stack:', criticalError.stack);

            // Save game state before potential crash
            try {
                this.saveEmergencyState();
            } catch (saveError) {
                console.error('Failed to save emergency state:', saveError);
            }

            // Emergency fallback - try to restart the game loop after a delay
            managedSetTimeout(
                () => {
                    console.log('Attempting to restart game loop...');
                    if (this.running) {
                        requestAnimationFrame(this.gameLoop);
                    }
                },
                1000,
                this
            );
        }
    };
    /**
     * Adjust quality settings based on performance
     */
    adjustPerformanceQuality() {
        if (!this.performanceThrottle || !this.performanceThrottle.samples.length) return;

        // Calculate average FPS from samples
        const avgDeltaTime =
            this.performanceThrottle.samples.reduce((a, b) => a + b, 0) / this.performanceThrottle.samples.length;
        const avgFPS = 1 / avgDeltaTime;

        const currentQuality = this.performanceThrottle.qualityLevel;
        let newQuality = currentQuality;

        // Auto-adjust quality based on FPS
        if (avgFPS < 25) {
            // Very poor performance - reduce quality significantly
            newQuality = Math.max(0.3, currentQuality - 0.2);
        } else if (avgFPS < 40) {
            // Poor performance - reduce quality
            newQuality = Math.max(0.5, currentQuality - 0.1);
        } else if (avgFPS > 55) {
            // Good performance - can increase quality
            newQuality = Math.min(1.0, currentQuality + 0.05);
        }

        // Apply quality changes if needed
        if (newQuality !== currentQuality) {
            this.performanceThrottle.qualityLevel = newQuality;

            // Adjust particle limits
            if (this.systems.particle) {
                this.systems.particle.qualityLevel = newQuality;
                this.systems.particle.maxEffectParticles = Math.floor(50 * newQuality);
            }

            // Adjust enemy spawn cap for performance
            if (this.systems.enemy) {
                const baseMax = 300;
                this.systems.enemy.maxActiveEnemies = Math.floor(baseMax * (0.5 + newQuality * 0.5));
            }

            // Adjust render distance
            if (this.camera) {
                this.camera.renderDistance = 600 * (0.7 + newQuality * 0.3);
            }

            console.log(
                `⚡ Performance auto-adjust: Quality ${(newQuality * 100).toFixed(0)}%, FPS: ${avgFPS.toFixed(1)}`
            );
        }
    }

    /**
     * Perform memory cleanup to prevent crashes at high levels
     */
    performMemoryCleanup() {
        try {
            let cleanupActions = 0;

            // Clear damage number pool periodically
            if (globalDamageNumberPool.getStats().available < 20) {
                globalDamageNumberPool.clear();
                cleanupActions++;
            }

            // Clean up particle systems
            if (this.systems.particle && this.systems.particle.clear) {
                const particleStats = this.systems.particle.getPerformanceInfo();
                const effectParticles = particleStats.effectParticles || particleStats.original?.effectParticles || 0;
                if (effectParticles > 300) {
                    // Reduce particle count by half
                    this.systems.particle.adaptParticleLimits();
                    cleanupActions++;
                }
            }

            // Force garbage collection hint (if available)
            if (window.gc) {
                window.gc();
            }

            if (this.showDebug && cleanupActions > 0) {
                console.log(`🧹 Memory cleanup performed (${cleanupActions} actions)`);
            }
        } catch (error) {
            console.warn('Memory cleanup failed:', error);
        }
    }

    /**
     * Handle critical errors that could crash the game
     */
    handleCriticalError(error) {
        try {
            // Emergency entity cleanup
            this.emergencyEntityCleanup();

            // Reset particle systems
            if (this.systems.particle && this.systems.particle.clear) {
                this.systems.particle.clear();
            }

            // Reset weapon firing state to prevent re-triggering same error
            if (this.player && this.player.weapons) {
                this.player.weapons.forEach((w) => {
                    if (w._chainTargets) w._chainTargets = [];
                    if (w._firing) w._firing = false;
                });
            }

            // Clear timer manager
            globalTimerManager.clearAll();

            console.log('🚨 Critical error handled, systems reset');
        } catch (cleanupError) {
            console.error('Emergency cleanup failed:', cleanupError);
        }
    }

    /**
     * Emergency entity cleanup when counts get too high
     */
    emergencyEntityCleanup() {
        try {
            // Limit enemies to reasonable count
            if (this.systems.enemy && this.systems.enemy.activeEnemies) {
                const enemies = this.systems.enemy.activeEnemies;
                if (enemies.length > 200) {
                    // Remove older/weaker enemies, keep stronger ones
                    enemies.sort((a, b) => b.maxHealth + b.damage - (a.maxHealth + a.damage));
                    const toRemove = enemies.slice(150); // Keep top 150

                    for (const enemy of toRemove) {
                        enemy.active = false;
                    }

                    console.log(`🔥 Emergency cleanup: removed ${toRemove.length} enemies`);
                }
            }

            // Limit projectiles
            if (this.systems.projectile && this.systems.projectile.activeProjectiles) {
                const projectiles = this.systems.projectile.activeProjectiles;
                if (projectiles.length > 300) {
                    // Remove oldest projectiles
                    const toRemove = projectiles.slice(0, projectiles.length - 200);
                    for (const projectile of toRemove) {
                        projectile.active = false;
                    }

                    console.log(`⚡ Emergency cleanup: removed ${toRemove.length} projectiles`);
                }
            }

            // Consolidate experience gems if too many — merge, never destroy value.
            // Claimed (in-flight vacuum/magnet) gems are never victims.
            if (this.systems.experience && this.systems.experience.activeGems) {
                const gems = this.systems.experience.activeGems;
                if (gems.length > 100 && typeof this.systems.experience.consolidateGems === 'function') {
                    const merged = this.systems.experience.consolidateGems(50);
                    console.log(`💎 Emergency cleanup: consolidated ${merged} gems`);
                }
            }
        } catch (error) {
            console.error('Emergency entity cleanup failed:', error);
        }
    }

    /**
     * Save emergency state for crash recovery
     */
    saveEmergencyState() {
        try {
            const emergencyState = {
                level: this.player?.level || 1,
                score: this.score || 0,
                gameTime: this.gameTime || 0,
                timestamp: Date.now()
            };

            localStorage.setItem('vampire-survivors-emergency', JSON.stringify(emergencyState));
            console.log('💾 Emergency state saved');
        } catch (error) {
            console.warn('Failed to save emergency state:', error);
        }
    }

    update(dt, uiDt = dt) {
        // Title screen / upgrade shop / character select animation
        if (
            this.gameState === 'menu' ||
            this.gameState === 'upgrades' ||
            this.gameState === 'characters' ||
            this.gameState === 'challenges' ||
            this.gameState === 'statistics' ||
            this.gameState === 'codex' ||
            this.gameState === 'settings'
        ) {
            this.systems.titleScreen.update(uiDt);
            return;
        }

        // Run summary animation (overlaid on frozen game)
        if (this.gameState === 'summary') {
            this.systems.runSummary.update(uiDt);
        }
        // Build inspection is a modal pause even if camera hit-stop restores timeScale.
        if (this.systems.inventory.visible) return;


        if (this.gameState === 'playing' || this.gameState === 'levelUp') {
            // Queued picks must observe zero simulation time: a camera hit-stop
            // finishing mid-selection restores timeScale, so pin it while the
            // upgrade UI owns the clock.
            if (this.gameState === 'levelUp') this.timeScale = 0;
            if (this.gameState === 'playing') this.gameTime += dt;

            // dt is already scaled by timeScale in gameLoop (scaledDeltaTime)

            // Smart update ordering for cache efficiency
            if (this.player) {
                // During level-up: only update visual effects (glow, particles, etc.)
                if (this.gameState === 'levelUp') {
                    this.player.updateLevelUpEffects(dt);
                    this.camera.follow(this.player.x, this.player.y, dt);
                } else {
                    // Normal gameplay: full player update
                    this.player.update(dt);
                    this.camera.follow(this.player.x, this.player.y, dt);
                }

                // Update progression telemetry for balance analysis
                this.progressionTelemetry.update(dt);
            }

            // Upgrade selection stays frozen even if a pending camera hit-stop restores timeScale.
            if (this.gameState === 'playing' && this.timeScale > 0) {
                this._updatePlayingSystems(dt);
            }

            // Visual systems always update (even when paused) for smooth UI
            // Canvas HUD animations (smooth bars, flashes)
            this.systems.canvasHUD.update(dt);

            // Particles (visual effects based on all game state)
            this.systems.particle.update(dt, this.qualitySettings);

            // Update damage numbers from centralized pool
            globalDamageNumberPool.update(dt);
        }
    }

    /**
     * Simulation systems, in cache-friendly order. A system can open the
     * level-up UI mid-frame (gem XP, streak bonuses, skill bonuses), so the
     * game state is re-checked between steps — nothing after the pick may
     * advance while the player is choosing.
     */
    _updatePlayingSystems(dt) {
        if (!this._simSteps) {
            this._simSteps = [
                'terrain', // spatial context first
                'enemy', // movement and AI
                'projectile', // collision benefits from updated enemy positions
                'experience', // collision with updated player position
                'statusEffect', // depends on updated entity states
                'flowState',
                'rewards',
                'achievement',
                'microChallenge',
                'adaptiveMusic',
                'killMilestone',
                'screenEffects',
                'runTimer',
                'gold',
                'weaponEvolution',
                'synergy',
                'boss',
                'dynamicEvents',
                'ambientParticles',
                'decals',
                'floorItems'
            ];
        }

        for (const key of this._simSteps) {
            this.systems[key].update(dt);
            if (this.gameState !== 'playing') return; // level-up opened mid-frame
        }

        // Power-ups (benefit from all position updates)
        this.updatePowerUpDrops(dt);
        if (this.gameState !== 'playing') return;

        // Audio intensity updates (only when game is active)
        const entityCount =
            this.systems.enemy.getEnemyCount() + this.systems.projectile.activeProjectiles.length;
        const audioFreq = entityCount > 120 ? 16 : 8;
        if (this.totalFrameCount % audioFreq === 0 && this.audioManager && this.audioManager.setGameIntensity) {
            const intensity = Math.min(1, entityCount * 0.02);
            this.audioManager.setGameIntensity(intensity);
        }

        // UI updates (adaptive frequency based on entity density)
        const uiUpdateFreq = entityCount > 180 ? 30 : entityCount > 120 ? 20 : entityCount > 80 ? 15 : 12;
        if (this.totalFrameCount % uiUpdateFreq === 0) {
            this.updateGameUI();
        }
    }

    render() {
        // OPTIMIZED: Ultra-fast canvas clearing and state management
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Ensure no stray fills - clear any white artifacts
        this.ctx.fillStyle = 'transparent';
        this.ctx.strokeStyle = 'transparent';

        // DOM manipulation removed - causes instability and performance issues

        // OPTIMIZED: Single state reset with renderer state tracking
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.renderer.resetState();

        if (
            this.gameState === 'menu' ||
            this.gameState === 'upgrades' ||
            this.gameState === 'characters' ||
            this.gameState === 'challenges' ||
            this.gameState === 'statistics' ||
            this.gameState === 'codex' ||
            this.gameState === 'settings'
        ) {
            this.systems.titleScreen.render(this.ctx);
            return;
        }

        // OPTIMIZED: Update renderer view bounds for frustum culling
        const cameraWorldBounds = this.camera.getWorldBounds();
        this.renderer.updateViewBounds(
            cameraWorldBounds.left,
            cameraWorldBounds.top,
            cameraWorldBounds.right - cameraWorldBounds.left,
            cameraWorldBounds.bottom - cameraWorldBounds.top
        );

        // Apply camera transform with state isolation
        this.ctx.save();
        this.camera.apply(this.ctx);

        // OPTIMIZED: Strategic render order for optimal batching and depth sorting
        // 1. Terrain (static background, single draw call)
        this.systems.terrain.render(this.renderer);

        // 1.4 Ground decals — kill splats soaking into the flagstones
        this.systems.decals.render(this.ctx);

        // 1.5 Ambient particles (fog, dust, embers — behind gameplay entities)
        this.systems.ambientParticles.render(this.ctx);

        // 2. Experience gems (can be batched by color/size)
        this.systems.experience.render(this.renderer);

        // 2.5 Power-ups (world-space, render with entities)
        this.renderPowerUpDrops(this.renderer);

        // 2.6 Gold coins (world-space, between power-ups and enemies)
        this.systems.gold.render(this.ctx);

        // 2.7 Floor items — health orbs, vacuum, rosary, treasure chests (world-space)
        this.systems.floorItems.render(this.ctx);

        // 3. Enemies (group by type for potential batching)
        this.systems.enemy.render(this.renderer);

        // 4. Player (single entity, high priority)
        if (this.player) {
            if (!Number.isFinite(this.player.x) || !Number.isFinite(this.player.y)) {
                console.error('Player position invalid:', this.player.x, this.player.y);
                this.player.x = 0;
                this.player.y = 0;
            }
            this.player.render(this.renderer);

            // 4b. Weapon visuals (aura rings, lightning bolts, charging effects)
            for (const weapon of this.player.weapons.values()) {
                if (weapon.render) {
                    weapon.render(this.renderer);
                }
            }
        } else {
            console.error('No player object to render!');
        }

        // 5. Projectiles (batch by type and color)
        this.systems.projectile.render(this.renderer);

        // 6. Particles (alpha blending, render last)
        this.systems.particle.render(this.renderer, this.qualitySettings);

        // 7. Damage numbers (rendered after particles for proper layering)
        if (this.gameState !== 'paused') {
            globalDamageNumberPool.render(this.ctx, this.camera);
            this.player?.renderCallout?.(this.ctx);
        }

        // 7b. Death entity (world-space, renders within camera transform)
        this.systems.runTimer.renderDeath(this.ctx);

        // 7c. Evolved weapon glow (world-space)
        this.systems.weaponEvolution.render(this.ctx);

        // 7d. Boss effects (telegraphs, attack visuals, boss aura — world-space)
        this.systems.boss.renderWorld(this.ctx);

        // 7e. Dynamic event world-space (chest, calm eye aura)
        this.systems.dynamicEvents.renderWorld(this.ctx);

        // Restore camera transform
        this.ctx.restore();

        // 7. Combo UI (screen-space, render after camera restore)
        // this.systems.combo.render(this.renderer);

        // OPTIMIZED: Batch UI and effects with minimal state changes
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';

        // Torchlight: the world falls off into gloom away from the hunter
        this.renderTorchlight(this.ctx);

        // Camera effects (flash, shake) - no culling needed
        this.camera.renderFlash(this.ctx);
        this.camera.renderPostEffects(this.ctx);

        // Danger effects (low-health glow, edge chromatic aberration)
        if (this.systems.screenEffects) {
            this.systems.screenEffects.renderDangerEffects(this.ctx);
        }

        // Debug overlays (render last, on top of everything)
        if (this.projectileDebugger.enabled) {
            this.ctx.save();
            this.camera.apply(this.ctx);
            this.projectileDebugger.render(this.renderer);
            this.ctx.restore();
        }

        // Progression telemetry overlay (screen space)
        if (this.progressionTelemetry.enabled) {
            this.progressionTelemetry.render(this.ctx);
        }

        // The run summary owns the whole screen — no HUD bleeding through it
        const hudVisible = this.gameState !== 'summary';

        // Achievement & micro-challenge overlays (screen space, above debug)
        if (this.gameState !== 'paused' && this.gameState !== 'levelUp' && hudVisible) {
            this.systems.achievement.render(this.ctx);
            this.systems.microChallenge.render(this.ctx, this.camera);
            this.systems.killMilestone.render(this.ctx);
        }

        // Run timer HUD (screen space)
        if (hudVisible) {
            this.systems.runTimer.render(this.ctx);
            this.systems.gold.renderHUD(this.ctx);
            this.systems.synergy.render(this.ctx);
            this.systems.boss.renderHUD(this.ctx);
            this.systems.dynamicEvents.render(this.ctx);
            this.systems.canvasHUD.render(this.ctx);
            this.systems.floorItems.renderOverlay?.(this.ctx);
        }

        // Build inventory overlay (renders on top of everything)
        if (this.systems.inventory) {
            this.systems.inventory.render(this.ctx);
        }

        // Pause menu overlay
        if (this.gameState === 'paused') {
            // Keep titleScreen time ticking for animations
            this.systems.titleScreen.time += this.deltaTime;
            this.systems.titleScreen.renderPauseMenu(this.ctx);
        }

        if (this.gameState === 'levelUp' && this.levelUpOptions.length > 0) {
            this.systems.levelUpOverlay.render(this.ctx);
        }

        // Death pause darkening overlay (1.5s transition)
        if (this.gameState === 'gameOver') {
            const t = Math.min(1, (performance.now() - (this._deathTime || performance.now())) / 1500);
            this.ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * t})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Run summary overlay (over frozen game scene)
        if (this.gameState === 'summary') {
            this.systems.runSummary.render(this.ctx);
        }

        // OPTIMIZED: End frame processing for batching and statistics
        this.renderer.endFrame();
    }

    /**
     * Screen-space darkness falloff centered on the player. The gradient is
     * baked once per viewport into an oversized canvas and blitted at the
     * player's screen offset — a 1:1 image copy instead of evaluating a
     * full-screen radial gradient every frame.
     */
    renderTorchlight(ctx) {
        if (!this.player || !this.camera) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const p = this.camera.worldToScreen(this.player.x, this.player.y);
        const t = this._torch || (this._torch = { canvas: null, w: 0, h: 0, m: 0 });
        const inner = Math.min(w, h) * 0.26;
        const outer = Math.hypot(w, h) * 0.62;

        if (typeof document !== 'undefined' && (t.w !== w || t.h !== h)) {
            const m = Math.ceil(Math.min(w, h) * 0.3);
            const c = t.canvas || document.createElement('canvas');
            c.width = w + m * 2;
            c.height = h + m * 2;
            const g = c.getContext('2d');
            const cx = c.width / 2;
            const cy = c.height / 2;
            const grad = g.createRadialGradient(cx, cy, inner, cx, cy, outer);
            grad.addColorStop(0, 'rgba(6, 3, 12, 0)');
            grad.addColorStop(0.55, 'rgba(6, 3, 12, 0.28)');
            grad.addColorStop(1, 'rgba(4, 2, 8, 0.62)');
            g.fillStyle = grad;
            g.fillRect(0, 0, c.width, c.height);
            Object.assign(t, { canvas: c, w, h, m });
        }

        const dx = Math.round(p.x - w / 2);
        const dy = Math.round(p.y - h / 2);
        ctx.save();
        if (t.canvas && Math.abs(dx) <= t.m && Math.abs(dy) <= t.m) {
            ctx.drawImage(t.canvas, dx - t.m, dy - t.m);
        } else {
            // Player far off-center (camera snap/teleport): draw directly
            const grad = ctx.createRadialGradient(p.x, p.y, inner, p.x, p.y, outer);
            grad.addColorStop(0, 'rgba(6, 3, 12, 0)');
            grad.addColorStop(0.55, 'rgba(6, 3, 12, 0.28)');
            grad.addColorStop(1, 'rgba(4, 2, 8, 0.62)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();
    }

    renderBackground() {
        // Simple performance-optimized background
        const bounds = this.camera.getWorldBounds(100);
        const entityCount = this.performanceStats.entityCount;

        // Calculate actual width and height from bounds
        const width = bounds.right - bounds.left;
        const height = bounds.bottom - bounds.top;

        if (entityCount > 100 || this.performanceStats.fps < 50) {
            // Simple solid background for high entity counts
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(bounds.left, bounds.top, width, height);
        } else {
            // Simple gradient background
            const gradient = this.ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#0f0f23');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(bounds.left, bounds.top, width, height);

            // Optional simple grid for low entity counts
            if (entityCount < 50) {
                this.renderGrid();
            }
        }
    }

    renderGrid() {
        // Simple grid for visual reference
        const gridSize = 100;
        const bounds = this.camera.getWorldBounds(50);

        this.ctx.strokeStyle = 'rgba(75, 0, 130, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        // Vertical lines
        const startX = Math.floor(bounds.left / gridSize) * gridSize;
        const endX = Math.ceil(bounds.right / gridSize) * gridSize;
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, bounds.top);
            this.ctx.lineTo(x, bounds.bottom);
        }

        // Horizontal lines
        const startY = Math.floor(bounds.top / gridSize) * gridSize;
        const endY = Math.ceil(bounds.bottom / gridSize) * gridSize;
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(bounds.left, y);
            this.ctx.lineTo(bounds.right, y);
        }

        this.ctx.stroke();
    }

    renderUIOverlays() {
        // UI overlays disabled - no minimap
    }

    // Removed cleanupStuckNotifications - DOM manipulation in game loop caused instability

    // Removed checkForWhiteArtifacts - DOM manipulation in game loop caused instability
    unusedCheckForWhiteArtifacts() {
        // Find and remove any problematic elements
        const problematicElements = [];

        // Get all elements in the DOM
        const allElements = document.querySelectorAll('*');

        allElements.forEach((el) => {
            // Skip essential elements
            if (
                el.id === 'gameCanvas' ||
                el.tagName === 'CANVAS' ||
                el.tagName === 'HTML' ||
                el.tagName === 'BODY' ||
                el.tagName === 'SCRIPT' ||
                el.tagName === 'STYLE' ||
                el.id === 'gameHUD' ||
                el.id === 'performanceMonitor' ||
                el.id === 'controlsHelp'
            )
                return;

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            // Check if element is visible and potentially problematic
            if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
                let shouldRemove = false;
                let reason = '';

                // Check for white or light backgrounds
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                    // Parse RGB values
                    const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                        const [_, r, g, b] = rgbMatch;
                        const rVal = parseInt(r);
                        const gVal = parseInt(g);
                        const bVal = parseInt(b);

                        // Check if it's white or very light (all values > 240)
                        if (rVal > 240 && gVal > 240 && bVal > 240) {
                            shouldRemove = true;
                            reason = `Light background: ${bg}`;
                        }

                        // Also check for pure white
                        if (rVal === 255 && gVal === 255 && bVal === 255) {
                            shouldRemove = true;
                            reason = `White background: ${bg}`;
                        }
                    }
                }

                // Check for large overlays positioned on the right side (like in the screenshot)
                if (rect.width > 100 && rect.height > window.innerHeight * 0.5) {
                    // Check if it's on the right edge
                    if (rect.right > window.innerWidth - 50 && rect.left > window.innerWidth * 0.7) {
                        shouldRemove = true;
                        reason = `Large right-side overlay: ${rect.width}x${rect.height} at x:${rect.left}`;
                    }
                }

                // Check for elements with white inline styles
                const inlineStyle = el.getAttribute('style') || '';
                if (
                    inlineStyle.includes('background: white') ||
                    inlineStyle.includes('background-color: white') ||
                    inlineStyle.includes('background: #fff') ||
                    inlineStyle.includes('background: rgb(255, 255, 255)')
                ) {
                    shouldRemove = true;
                    reason = 'White inline style';
                }

                // Remove any div without proper game-related IDs/classes
                if (
                    el.tagName === 'DIV' &&
                    !el.id &&
                    !el.className &&
                    (style.position === 'absolute' || style.position === 'fixed')
                ) {
                    shouldRemove = true;
                    reason = 'Anonymous positioned div';
                }

                if (shouldRemove) {
                    problematicElements.push({
                        element: el,
                        reason: reason,
                        details: {
                            id: el.id || 'none',
                            className: el.className || 'none',
                            tag: el.tagName,
                            position: `${rect.left},${rect.top}`,
                            size: `${rect.width}x${rect.height}`,
                            bg: style.backgroundColor
                        }
                    });
                }
            }
        });

        // Remove all problematic elements
        if (problematicElements.length > 0) {
            console.warn(`Found ${problematicElements.length} problematic elements:`);
            problematicElements.forEach((item) => {
                console.warn(`  - Removing: ${item.reason}`, item.details);
                try {
                    item.element.remove();
                } catch (e) {
                    // If remove fails, try to hide it
                    item.element.style.display = 'none';
                }
            });
        }

        // Also clean up any notification or warning elements that might be stuck
        const selectorsToClean = [
            '.notification',
            '.warning-text',
            '[class*="level-up"]',
            '[class*="game-over"]',
            '[id*="level-up"]',
            '[id*="game-over"]'
        ];

        selectorsToClean.forEach((selector) => {
            try {
                document.querySelectorAll(selector).forEach((el) => {
                    if (el.id !== 'gameHUD' && !el.classList.contains('game-button')) {
                        el.remove();
                    }
                });
            } catch (e) {
                // Ignore selector errors
            }
        });
    }

    renderBoundaryAwarenessHUD() {
        if (!this.player || !this.systems.terrain) return;

        const ctx = this.ctx;
        const worldBounds = this.systems.terrain.getWorldBounds();
        const playerX = this.player.x;
        const playerY = this.player.y;

        // Calculate distances to boundaries
        const distanceToLeft = playerX - worldBounds.left;
        const distanceToRight = worldBounds.right - playerX;
        const distanceToTop = playerY - worldBounds.top;
        const distanceToBottom = worldBounds.bottom - playerY;

        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

        // Only show when getting close to boundaries
        if (minDistance < 300) {
            ctx.save();

            // Draw mini-map style boundary indicator in top-right corner
            const hudX = this.canvas.width - 150;
            const hudY = 20;
            const hudSize = 120;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(hudX, hudY, hudSize, hudSize);

            // Border
            ctx.strokeStyle = '#FF3030';
            ctx.lineWidth = 2;
            ctx.strokeRect(hudX, hudY, hudSize, hudSize);

            // Map boundaries (scaled down)
            const worldWidth = worldBounds.right - worldBounds.left;
            const worldHeight = worldBounds.bottom - worldBounds.top;
            const scaleX = (hudSize - 20) / worldWidth;
            const scaleY = (hudSize - 20) / worldHeight;

            // Boundary walls
            ctx.strokeStyle = '#FF6060';
            ctx.lineWidth = 3;
            ctx.strokeRect(hudX + 10, hudY + 10, hudSize - 20, hudSize - 20);

            // Player position
            const playerHudX = hudX + 10 + (playerX - worldBounds.left) * scaleX;
            const playerHudY = hudY + 10 + (playerY - worldBounds.top) * scaleY;

            ctx.fillStyle = '#00FF00';
            ctx.fillRect(playerHudX - 2, playerHudY - 2, 4, 4);

            // Warning text
            ctx.fillStyle = '#FF4040';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('BOUNDARY', hudX + hudSize / 2, hudY + hudSize + 20);
            ctx.fillText(`${Math.round(minDistance)}m`, hudX + hudSize / 2, hudY + hudSize + 35);

            // Directional arrow pointing to closest boundary
            ctx.strokeStyle = '#FF6060';
            ctx.lineWidth = 3;
            ctx.beginPath();

            let arrowX = hudX + hudSize / 2;
            let arrowY = hudY + hudSize / 2;
            let arrowEndX = arrowX;
            let arrowEndY = arrowY;

            if (distanceToLeft === minDistance) {
                arrowEndX = hudX + 15;
            } else if (distanceToRight === minDistance) {
                arrowEndX = hudX + hudSize - 15;
            } else if (distanceToTop === minDistance) {
                arrowEndY = hudY + 15;
            } else if (distanceToBottom === minDistance) {
                arrowEndY = hudY + hudSize - 15;
            }

            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowEndX, arrowEndY);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(arrowEndY - arrowY, arrowEndX - arrowX);
            const arrowSize = 8;
            ctx.beginPath();
            ctx.moveTo(arrowEndX, arrowEndY);
            ctx.lineTo(
                arrowEndX - arrowSize * Math.cos(angle - Math.PI / 6),
                arrowEndY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(arrowEndX, arrowEndY);
            ctx.lineTo(
                arrowEndX - arrowSize * Math.cos(angle + Math.PI / 6),
                arrowEndY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();

            ctx.restore();
        }
    }

    resetCanvasState() {
        // OPTIMIZED: Minimal essential state reset only
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    updateGameUI() {
        if (!this.player) return;

        // Update player stats
        document.getElementById('player-level').textContent = this.player.level;
        document.getElementById('player-health').textContent = Math.ceil(this.player.health);
        document.getElementById('player-max-health').textContent = this.player.maxHealth;
        document.getElementById('player-exp').textContent = this.player.experience;
        document.getElementById('player-exp-needed').textContent = this.player.experienceToNext;

        // Update game stats
        document.getElementById('current-wave').textContent = this.systems.enemy.getCurrentWave();
        document.getElementById('enemy-count').textContent = this.systems.enemy.getEnemyCount();
        document.getElementById('game-time').textContent = this.formatTime(this.gameTime);
        document.getElementById('game-score').textContent = this.score;

        // Update manual aiming status
        this.updateManualAimingUI();

        // Update active power-up indicators (timers)
        this.updatePowerUpIndicators();

        // Update passive item indicators
        this.updatePassiveItemsHUD();

        // Update debug info (technical metrics only)
        if (this.showDebug) {
            document.getElementById('entity-count').textContent = this.performanceStats.entityCount;
            document.getElementById('projectile-count').textContent = this.systems.projectile.activeProjectiles.length;
            document.getElementById('gem-count').textContent = this.systems.experience.getActiveGemCount();
            document.getElementById('enemy-count').textContent = this.systems.enemy.getEnemyCount();
        }
    }

    updateManualAimingUI() {
        const aimingStatus = document.getElementById('manual-aiming-status');
        const aimingStats = this.player.getAimingStats();

        if (aimingStats) {
            // Show manual aiming UI
            aimingStatus.style.display = 'block';

            // Update current accuracy and damage bonus
            document.getElementById('aim-accuracy').textContent = aimingStats.currentAccuracy;
            document.getElementById('aim-bonus').textContent = aimingStats.damageBonus;

            // Update statistics
            document.getElementById('aim-total-shots').textContent = aimingStats.totalShots;
            document.getElementById('aim-overall-accuracy').textContent = aimingStats.overallAccuracy;
        } else {
            // Hide manual aiming UI when not active
            aimingStatus.style.display = 'none';
        }
    }

    updatePerformanceStats(currentTime) {
        // OPTIMIZED: Enhanced performance tracking
        const frameTime = this.deltaTime * 1000; // Convert to milliseconds

        this.performanceStats.entityCount =
            this.systems.enemy.getEnemyCount() +
            this.systems.projectile.activeProjectiles.length +
            this.systems.experience.getActiveGemCount();

        // Track frame time history
        this.performanceStats.frameTimeHistory.push(frameTime);
        if (this.performanceStats.frameTimeHistory.length > 60) {
            this.performanceStats.frameTimeHistory.shift();
        }

        // Track dropped frames
        if (frameTime > this.targetFrameTime) {
            this.performanceStats.dropped60FpsFrames++;
        }
        if (frameTime > this.warningFrameTime) {
            this.performanceStats.dropped30FpsFrames++;
        }

        // Update FPS and averages every second
        if (currentTime - this.performanceStats.lastFpsUpdate > 1000) {
            this.performanceStats.fps = Math.round(
                (this.frameCount * 1000) / (currentTime - this.performanceStats.lastFpsUpdate)
            );

            // Calculate average and worst frame times
            if (this.performanceStats.frameTimeHistory.length > 0) {
                const sum = this.performanceStats.frameTimeHistory.reduce((a, b) => a + b, 0);
                this.performanceStats.avgFrameTime = sum / this.performanceStats.frameTimeHistory.length;
                this.performanceStats.worstFrameTime = Math.max(...this.performanceStats.frameTimeHistory);
            }

            this.frameCount = 0;
            this.performanceStats.lastFpsUpdate = currentTime;

            // Periodic performance report
            if (currentTime - this.lastPerformanceReport > this.performanceReportInterval) {
                this.reportPerformance();
                this.lastPerformanceReport = currentTime;
            }
        }
    }

    reportPerformance() {
        const stats = this.performanceStats;
        const particleStats = this.systems.particle.getPerformanceInfo();
        const rendererStats = this.renderer.getPerformanceStats();
        const effectiveQuality = this.qualitySettings?.particleReduction
            ? Math.round(this.qualitySettings.particleReduction * 100)
            : stats.qualityLevel;

        // Only log performance issues, not regular reports
        if (stats.fps < 45 || stats.entityCount > 300 || stats.dropped60FpsFrames > 30) {
            console.warn(
                `⚠️ Performance Issue - FPS: ${stats.fps}, Entities: ${stats.entityCount}, Dropped: ${stats.dropped60FpsFrames}, Quality: ${effectiveQuality}%`
            );
        }

        // Reset counters
        stats.dropped60FpsFrames = 0;
        stats.dropped30FpsFrames = 0;
        this.renderer.resetPerformanceStats();
    }

    // OPTIMIZED: Adaptive quality scaling for consistent 60 FPS
    adaptiveQualityReduction() {
        const now = performance.now();
        if (now - this.performanceStats.lastQualityAdjustment < 2000) return; // Limit adjustments to every 2 seconds

        this.performanceStats.adaptiveMode = true;
        this.performanceStats.qualityLevel = Math.max(30, this.performanceStats.qualityLevel - 15);
        this.performanceStats.lastQualityAdjustment = now;

        // Apply quality reductions
        const qualityFactor = this.performanceStats.qualityLevel / 100;
        this.qualitySettings.particleReduction = Math.max(0.3, qualityFactor);
        this.qualitySettings.effectsReduction = Math.max(0.4, qualityFactor);
        this.qualitySettings.renderDistance = Math.max(0.7, qualityFactor);
        this.qualitySettings.animationDetail = Math.max(0.5, qualityFactor);

        // Reduce max entities in systems
        this.systems.enemy.maxActiveEnemies = Math.floor(150 * qualityFactor);
        this.systems.projectile.maxActiveProjectiles = Math.floor(300 * qualityFactor);
        this.systems.particle.maxParticles = Math.floor(1500 * this.qualitySettings.particleReduction);

        console.log(`🎛️ Quality reduced to ${this.performanceStats.qualityLevel}% for better performance`);
    }

    adaptiveQualityRestoration() {
        const now = performance.now();
        if (now - this.performanceStats.lastQualityAdjustment < 3000) return; // Wait longer before increasing quality

        if (this.performanceStats.qualityLevel < 100) {
            this.performanceStats.qualityLevel = Math.min(100, this.performanceStats.qualityLevel + 10);
            this.performanceStats.lastQualityAdjustment = now;

            // Restore quality settings
            const qualityFactor = this.performanceStats.qualityLevel / 100;
            this.qualitySettings.particleReduction = qualityFactor;
            this.qualitySettings.effectsReduction = qualityFactor;
            this.qualitySettings.renderDistance = qualityFactor;
            this.qualitySettings.animationDetail = qualityFactor;

            // Restore max entities
            this.systems.enemy.maxActiveEnemies = Math.floor(150 * qualityFactor);
            this.systems.projectile.maxActiveProjectiles = Math.floor(300 * qualityFactor);
            this.systems.particle.maxParticles = Math.floor(1500 * this.qualitySettings.particleReduction);

            if (this.performanceStats.qualityLevel === 100) {
                this.performanceStats.adaptiveMode = false;
                console.log('🎛️ Quality restored to 100%');
            }
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Wave notification
    showWaveNotification(waveNumber) {
        const isSpecialWave = waveNumber % 5 === 0;
        const isBossWave = waveNumber % 10 === 0;
        const isMilestoneWave = [25, 50, 75, 100].includes(waveNumber);

        let title, color, intensity;
        if (isMilestoneWave) {
            title = `Milestone Wave ${waveNumber}`;
            color = '#FF4A7A';
            intensity = 3.0;
        } else if (isBossWave) {
            title = `Wave ${waveNumber}`;
            color = '#FF5A4A';
            intensity = 2.5;
        } else if (isSpecialWave) {
            title = `Wave ${waveNumber}`;
            color = '#FF8A3A';
            intensity = 2.0;
        } else {
            title = `Wave ${waveNumber}`;
            color = '#E8C96A';
            intensity = 1.5;
        }

        // The subtitle tells the player what changed, so the banner means something
        const es = this.systems.enemy;
        const arrivals = es?.enemyTypes
            ? Object.entries(es.enemyTypes).filter(([, cfg]) => cfg.minWave === waveNumber).map(([t]) => ENEMY_ARRIVALS[t]).filter(Boolean)
            : [];
        let subtitle = arrivals[0] || '';
        if (!subtitle) {
            if (isMilestoneWave) subtitle = 'Prepare for chaos';
            else if (isBossWave) subtitle = 'Danger incoming';
            else if (isSpecialWave) subtitle = 'Elites lead the horde';
            else if (es?.waveType === 'rest') subtitle = 'A breath of calm';
            else if (es?.waveType === 'rush') subtitle = 'They grow restless';
        }
        this.systems.canvasHUD?.showWaveBanner?.(title, subtitle, color);

        if (this.camera) {
            if (isSpecialWave) this.camera.flash(color, 0.5);
            this.camera.shakeWaveStart();
        }

        // Enhanced particle effects
        if (this.systems.particle && this.player) {
            if (isMilestoneWave) {
                // Massive celebration for milestone waves
                this.systems.particle.createBurst(this.player.x, this.player.y, 'evolution', {
                    color: color,
                    count: 60,
                    spread: 120,
                    intensity: intensity
                });

                // Secondary burst
                managedSetTimeout(
                    () => {
                        this.systems.particle.createBurst(this.player.x, this.player.y, 'gemExplosion', {
                            color: '#FFFFFF',
                            count: 40,
                            spread: 100,
                            intensity: intensity
                        });
                    },
                    300,
                    this
                );
            } else if (isBossWave) {
                // Ominous effect for boss waves
                this.systems.particle.createBurst(this.player.x, this.player.y, 'bloodSplash', {
                    color: color,
                    count: 30,
                    spread: 80,
                    intensity: intensity
                });
            } else if (isSpecialWave) {
                // Electric effect for elite waves
                this.systems.particle.createBurst(this.player.x, this.player.y, 'lightning', {
                    color: color,
                    count: 25,
                    spread: 60,
                    intensity: intensity
                });
            }
        }

        // Enhanced audio feedback
        if (this.audioManager) {
            if (isMilestoneWave) {
                this.audioManager.playVampireSound('levelUp', 0.5, 1.5);
                managedSetTimeout(
                    () => {
                        this.audioManager.playVampireSound('criticalHit', 0.4, 1.8);
                    },
                    400,
                    this
                );
            } else if (isBossWave) {
                this.audioManager.playVampireSound('vampireBite', 0.5, 0.7); // Deep, ominous
                managedSetTimeout(
                    () => {
                        this.audioManager.playVampireSound('criticalHit', 0.45, 1.2);
                    },
                    300,
                    this
                );
            } else if (isSpecialWave) {
                this.audioManager.playVampireSound('weaponUpgrade', 0.45, 1.3);
            } else {
                this.audioManager.playVampireSound('experienceGain', 0.4, 1.2);
            }
        }

        // Special rewards and effects
        if (isMilestoneWave && this.player) {
            // Give massive rewards for milestone waves
            this.player.gainExperience(waveNumber * 10);
            for (const profile of listProfiles('wave', 'milestone')) {
                this.player.activatePowerUp(profile.id, profile.duration, profile.intensity);
            }
            this.spawnPowerUpDrop(this.player.x, this.player.y, true);
        } else if (isBossWave && this.player) {
            // Health restoration for boss waves
            this.player.heal(this.player.maxHealth * 0.5);
            this.spawnPowerUpDrop(this.player.x, this.player.y, true);
        } else if (isSpecialWave && this.player) {
            // XP magnet effect for elite waves
            if (this.systems.experience) {
                this.systems.experience.magnetizeAllGems();
            }
            this.spawnPowerUpDrop(this.player.x, this.player.y, true);
        }

    }

    // ADDICTION MECHANICS - UI Updates and Power-up System
    updateComboDisplay(count, multiplier) {
        const comboDisplay = document.getElementById('combo-display');
        const comboCount = document.getElementById('combo-count');
        const comboMultiplier = document.getElementById('combo-multiplier');

        if (count > 0) {
            comboDisplay.style.display = 'block';
            comboCount.textContent = count;
            comboMultiplier.textContent = multiplier.toFixed(1);

            // Color intensity based on combo level
            const intensity = Math.min(count / 50, 1.0);
            const r = Math.floor(255 * intensity);
            const g = Math.floor(255 * (1 - intensity * 0.3));
            const b = Math.floor(100 * (1 - intensity));

            comboDisplay.style.color = `rgb(${r}, ${g}, ${b})`;

            // Pulse effect for high combos
            if (count >= 25) {
                comboDisplay.style.animation = 'pulse 0.5s infinite alternate';
            } else {
                comboDisplay.style.animation = 'none';
            }
        } else {
            comboDisplay.style.display = 'none';
        }
    }

    spawnPowerUpDrop(x, y, force = false) {
        // Ensure storage and respect cap to reduce clutter
        if (!this.powerUpDrops) this.powerUpDrops = [];
        const cap = this.maxPowerUpDrops || 3;
        if (this.powerUpDrops.length >= cap) {
            return; // Skip spawning when at cap
        }
        // Global cooldown so relics stay special (wave rewards bypass it)
        const now = this.gameTime || 0;
        if (!force && now - (this._lastRelicTime ?? -Infinity) < 25) return;
        this._lastRelicTime = now;

        // Random power-up type (the power-ups table is the source of truth)
        const powerUpTypes = Object.keys(POWER_UPS);
        const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

        // Create power-up drop entity
        const powerUp = {
            x: x + (Math.random() - 0.5) * 100,
            y: y + (Math.random() - 0.5) * 100,
            type: type,
            size: 14, // slightly smaller for less visual dominance
            lifetime: 10.0, // reduced from 15s to 10s
            timer: 0,
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2,
            active: true
        };

        // Add to game systems
        this.powerUpDrops.push(powerUp);

        // Visual spawn effect
        this.systems.particle.createPowerUpSpawnEffect(powerUp.x, powerUp.y, type);
    }

    updatePowerUpDrops(dt) {
        if (!this.powerUpDrops) return;

        for (let i = this.powerUpDrops.length - 1; i >= 0; i--) {
            const powerUp = this.powerUpDrops[i];

            powerUp.timer += dt;
            powerUp.pulsePhase += dt * 4;

            // Remove expired power-ups
            if (powerUp.timer >= powerUp.lifetime) {
                this.powerUpDrops.splice(i, 1);
                continue;
            }

            // Check collection
            if (this.player && !powerUp.collected) {
                const dx = powerUp.x - this.player.x;
                const dy = powerUp.y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Relics drift to a hunter who comes close, so a near-miss still counts
                if (distance < 90 && distance > 0.001) {
                    const pull = (60 + 220 * (1 - distance / 90)) * dt;
                    powerUp.x -= (dx / distance) * Math.min(pull, distance);
                    powerUp.y -= (dy / distance) * Math.min(pull, distance);
                }

                if (distance < 30) {
                    // Unconsumed pickups (e.g. health at full HP) stay on the floor
                    if (this.collectPowerUp(powerUp) === false) continue;
                    powerUp.collected = true;
                    this.powerUpDrops.splice(i, 1);
                }
            }
        }
    }

    collectPowerUp(powerUp) {
        if (!this.player) return false;

        const def = POWER_UPS[powerUp.type];

        // Apply power-up effect
        switch (powerUp.type) {
            case 'health': {
                // Never wasted: at full HP or when healing is disallowed the
                // relic stays on the floor. heal() returns HP actually restored.
                const healed = this.player.heal(this.player.maxHealth * def.healFraction);
                if (healed <= 0) return false;
                this.player.callout?.(`+${Math.round(healed)} HP`, this.getPowerUpColor('health'), 2);
                break;
            }
            case 'magnetBoost': {
                // Magnetic Field: timed radius pull of XP and gold. The radius is
                // max(3 × effective pickup range, 360) — never viewport-derived —
                // and is recomputed while active if pickup range changes.
                const profile = getProfile('pickup', 'magnetBoost');
                this.player.activatePowerUp('magnetBoost', profile.duration, profile.intensity);
                if (
                    this.systems &&
                    this.systems.experience &&
                    typeof this.systems.experience.activateMagneticField === 'function'
                ) {
                    this.systems.experience.activateMagneticField(profile.duration);
                }
                break;
            }
            default: {
                const profile = getProfile('pickup', powerUp.type);
                if (!profile) break;
                this.player.activatePowerUp(powerUp.type, profile.duration, profile.intensity);
                break;
            }
        }

        // Collection effects
        this.systems.particle.createPowerUpCollectEffect(powerUp.x, powerUp.y, this.getPowerUpColor(powerUp.type));

        if (this.audioManager) {
            this.audioManager.playPowerUpCollect();
        }
        return true;
    }

    renderPowerUpDrops(renderer) {
        if (!this.powerUpDrops || this.powerUpDrops.length === 0) return;

        const ctx = renderer.ctx;
        const now = performance.now() * 0.001;

        for (const powerUp of this.powerUpDrops) {
            if (!powerUp.active || powerUp.collected) continue;

            const phase = powerUp.pulsePhase;
            // Pop in with a little overshoot
            const t = Math.min(1, powerUp.timer / 0.3);
            const pop = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.35 - (1 - t) * 0.6 : 1;
            const bob = Math.sin(phase * 0.55) * 2.5;
            // Last three seconds: blink faster and faster so expiry is readable
            const left = powerUp.lifetime - powerUp.timer;
            let alpha = 1;
            if (left < 3) {
                const rate = 6 + (3 - left) * 6;
                alpha = Math.sin(now * rate) > -0.2 ? 1 : 0.3;
            }

            ctx.save();
            ctx.globalAlpha = alpha;

            // Contact shadow stays on the floor while the relic hovers
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(powerUp.x, powerUp.y + 1, 8 - bob * 0.4, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            const glow = getPowerUpGlow(powerUp.type);
            if (glow) {
                const gr = 26 + Math.sin(phase) * 3;
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = alpha * (0.7 + Math.sin(phase) * 0.2);
                ctx.drawImage(glow, powerUp.x - gr, powerUp.y - 12 - gr, gr * 2, gr * 2);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = alpha;
            }

            const spr = getPowerUpSprite(powerUp.type);
            const scale = Math.max(0, pop);
            if (spr && scale > 0) {
                ctx.translate(powerUp.x, powerUp.y - 3 + bob);
                ctx.scale(scale, scale);
                ctx.drawImage(spr.canvas, -spr.ax, -spr.ay, spr.w, spr.h);
            } else if (!spr) {
                ctx.fillStyle = this.getPowerUpColor(powerUp.type);
                ctx.beginPath();
                ctx.arc(powerUp.x, powerUp.y - 10 + bob, 9, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    getPowerUpColor(type) {
        return POWER_UPS[type]?.color || '#FFFFFF';
    }

    stop() {
        this.running = false;
        if (this.audioManager) {
            this.audioManager.stopAll();
        }

        // Clear all managed timers to prevent memory leaks
        globalTimerManager.clearAll();
    }

    // Public API for external access
    getState() {
        return {
            gameState: this.gameState,
            gameTime: this.gameTime,
            score: this.score,
            player: this.player
                ? {
                      level: this.player.level,
                      health: this.player.health,
                      maxHealth: this.player.maxHealth,
                      experience: this.player.experience,
                      experienceToNext: this.player.experienceToNext
                  }
                : null
        };
    }

    getDebugInfo() {
        // Memory usage information
        let memoryInfo = {};
        if (performance.memory) {
            memoryInfo = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }

        return {
            performance: this.performanceStats,
            memory: memoryInfo,
            timers: globalTimerManager.getStats(),
            damageNumbers: globalDamageNumberPool.getStats(),
            audio: this.audioManager?.getDebugInfo ? this.audioManager.getDebugInfo() : null,
            systems: {
                enemy: this.systems.enemy.getDebugInfo(),
                projectile: this.systems.projectile.getDebugInfo(),
                experience: this.systems.experience.getDebugInfo(),
                adaptiveMusic: this.systems.adaptiveMusic?.getDebugInfo ? this.systems.adaptiveMusic.getDebugInfo() : null
            }
        };
    }
}
