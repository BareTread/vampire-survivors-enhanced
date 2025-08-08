import { Player } from '../entities/Player.js';
import { EnemySystem } from '../systems/EnemySystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { ExperienceSystem } from '../systems/ExperienceSystem.js';
import { ParticleSystemCore } from '../systems/ParticleSystemCore.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
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
import { ProjectileDebugger } from '../debug/ProjectileDebugger.js';
import { ProgressionTelemetry } from '../debug/ProgressionTelemetry.js';
import { ResponsiveCanvas } from '../core/ResponsiveCanvas.js';
import { SettingsMenu } from '../ui/SettingsMenu.js';
import { HelpOverlay } from '../ui/HelpOverlay.js';

export class VampireSurvivorsGame {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config;
        
        // Game state
        this.gameState = 'menu'; // menu, playing, paused, levelUp, gameOver
        this.timeScale = 1.0;
        this.gameTime = 0;
        this.score = 0;
        
        // Core systems
        this.world = new World(); // ECS World for entity management
        this.camera = new Camera(canvas.width, canvas.height);
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
        this.maxPowerUpDrops = 8; // Cap to reduce clutter
        
        // Game loop
        this.lastTime = 0;
        this.deltaTime = 0;
        this.running = false;
        this.frameCount = 0;
        
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
            ['throwing_knife', ThrowingKnife]
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
        
        // Mouse controls (handled by player when active)
        this.inputManager.on('click', (e) => {
            this.handleClick(e);
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
        document.querySelectorAll('div').forEach(div => {
            // Keep only essential elements
            if (div.id === 'gameCanvas' || 
                div.id === 'game-ui' ||  // CRITICAL: Keep game-ui container
                div.id === 'performanceMonitor' ||
                div.id === 'controlsHelp' ||
                div.classList.contains('game-button')) {
                return;
            }
            
            // Remove everything else
            div.remove();
        });
        
        // Also remove any styles that might cause issues
        document.querySelectorAll('style').forEach(style => {
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
        
        // Create game over UI
        this.createGameOverUI(uiContainer);
        
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
                <span style="color: #FFD700; font-weight: bold;">F1</span>: Performance | 
                <span style="color: #FFD700; font-weight: bold;">G</span>: Debug
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
    
    createGameOverUI(container) {
        const gameOverUI = document.createElement('div');
        gameOverUI.id = 'game-over-ui';
        gameOverUI.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            background: linear-gradient(145deg, rgba(25, 25, 112, 0.95), rgba(75, 0, 130, 0.95));
            border: 4px solid #8B008B;
            border-radius: 20px;
            padding: 50px;
            color: #E6E6FA;
            font-family: 'Cinzel', 'Times New Roman', serif;
            text-align: center;
            display: none;
            pointer-events: auto;
            z-index: 600;
            box-shadow: 0 0 40px rgba(75, 0, 130, 0.8), inset 0 0 20px rgba(138, 43, 226, 0.3);
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            opacity: 0;
            transition: opacity 200ms ease, transform 200ms ease;
        `;
        
        gameOverUI.innerHTML = `
            <h2 style="color: #FF6B6B; margin-bottom: 30px; font-size: 36px; text-transform: uppercase; letter-spacing: 3px; text-shadow: 4px 4px 8px rgba(255, 107, 107, 0.8);">💀 FALLEN IN BATTLE 💀</h2>
            <div id="final-stats" style="margin-bottom: 40px; font-size: 18px; line-height: 1.6;">
                <p style="color: #FFD700; margin-bottom: 8px;">⚔ Final Level: <span id="final-level" style="font-weight: bold;">1</span> ⚔</p>
                <p style="color: #98FB98; margin-bottom: 8px;">⏰ Time Survived: <span id="final-time" style="font-weight: bold;">0:00</span></p>
                <p style="color: #FFA500; margin-bottom: 8px;">👹 Enemies Slain: <span id="final-score" style="font-weight: bold;">0</span></p>
                <p style="color: #DDA0DD; margin-bottom: 8px;">⚡ Wave Reached: <span id="final-wave" style="font-weight: bold;">1</span></p>
            </div>
            <button id="restart-button" style="
                background: linear-gradient(145deg, #4CAF50, #45a049);
                color: white;
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-weight: bold;
                border: 2px solid #2e7d32;
                padding: 18px 35px;
                font-size: 18px;
                border-radius: 12px;
                cursor: pointer;
                margin-right: 15px;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🔄 Rise Again</button>
            <button id="menu-button" style="
                background: linear-gradient(145deg, #8B008B, #6a006a);
                color: white;
                font-family: 'Cinzel', 'Times New Roman', serif;
                font-weight: bold;
                border: 2px solid #4b0082;
                padding: 18px 35px;
                font-size: 18px;
                border-radius: 12px;
                cursor: pointer;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(139, 0, 139, 0.4);
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🏰 Return Home</button>
            <p style="margin-top: 18px; color: #ccc; font-size: 14px; opacity: 0.9;">Press <strong>R</strong> to Rise Again or <strong>M</strong> to Return Home</p>
        `;
        
        container.appendChild(gameOverUI);
        
        // Add event listeners
        document.getElementById('restart-button').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.getElementById('menu-button').addEventListener('click', () => {
            this.returnToMenu();
        });
    }
    
    createNotificationsUI(container) {
        // Subtle toasts pinned to top-right
        const notifications = document.createElement('div');
        notifications.id = 'notifications';
        notifications.style.cssText = `
            position: absolute;
            top: 16px; /* fallback */
            top: max(16px, env(safe-area-inset-top));
            right: 16px; /* fallback */
            right: max(16px, env(safe-area-inset-right));
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-end;
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
            background: rgba(10, 10, 20, 0.55);
            color: ${color};
            border: 1px solid rgba(120, 120, 160, 0.35);
            padding: 4px 8px;
            border-radius: 6px;
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
        const names = {
            health: 'Health',
            invincible: 'Invincibility',
            speedBoost: 'Speed',
            damageBoost: 'Damage',
            magnetBoost: 'Magnet',
            fireRate: 'Fire Rate'
        };
        return names[type] || 'Power-up';
    }

    getPowerUpPickupHint(type) {
        const hints = {
            health: 'Heal 50%',
            invincible: 'Invincible 5s',
            speedBoost: 'Speed x2 (8s)',
            damageBoost: 'Damage x3 (10s)',
            magnetBoost: 'Pull all gems',
            fireRate: 'Fire rate +30% (15s)'
        };
        return hints[type] || 'Power-up';
    }
    
    handleKeyDown(key) {
        switch (key.toLowerCase()) {
            case 'escape':
                if (this.gameState === 'playing') {
                    this.pauseGame();
                } else if (this.gameState === 'paused') {
                    this.resumeGame();
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
                if (this.gameState === 'gameOver') {
                    this.restartGame();
                }
                break;
            case 'm':
                if (this.inputManager.keys['shift']) {
                    // Debug: Activate global magnet and magnet boost for quick testing
                    if (this.player && this.systems && this.systems.experience) {
                        this.player.activatePowerUp('magnetBoost', 12.0, 1.0);
                        this.systems.experience.magnetizeAllGems();
                        if (typeof this.systems.experience.activateGlobalMagnet === 'function') {
                            this.systems.experience.activateGlobalMagnet(12.0);
                        }
                        console.log('🧲 Debug: Global magnet activated for 12s');
                    }
                } else if (this.gameState === 'gameOver') {
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
            case 'g':
            case 'G':
                this.showDebug = !this.showDebug;
                if (document.getElementById('debug-info')) {
                    document.getElementById('debug-info').style.display = 
                        this.showDebug ? 'block' : 'none';
                }
                console.log('Debug overlay:', this.showDebug ? 'ON' : 'OFF');
                break;
            case 'f5':
                // Toggle progression telemetry
                this.progressionTelemetry.enabled = !this.progressionTelemetry.enabled;
                console.log(`📊 Progression Telemetry: ${this.progressionTelemetry.enabled ? 'ENABLED' : 'DISABLED'}`);
                break;
            case ' ':
                if (this.gameState === 'menu') {
                    this.startGame();
                }
                break;
            case '1': case '2': case '3': case '4': case '5':
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
        const pushEntry = (key, label, seconds, color, icon) => {
            if (seconds > 0.05) {
                entries.push({ key, label, seconds, color, icon });
            }
        };
        
        // Speed
        if (p.speedBoost?.active) {
            pushEntry('speedBoost', 'Speed', p.speedBoost.timer, '#4ade80', '⚡');
        }
        // Damage
        if (p.damageBoost?.active) {
            pushEntry('damageBoost', 'Damage', p.damageBoost.timer, '#f59e0b', '🗡️');
        }
        // Fire rate
        if (p.fireRate?.active) {
            pushEntry('fireRate', 'Fire Rate', p.fireRate.timer, '#60a5fa', '🔥');
        }
        // Invincibility
        if (p.invincible?.active) {
            pushEntry('invincible', 'Invincible', p.invincible.timer, '#fde047', '🛡️');
        }
        // Magnet: combine player magnetBoost and system-level global magnet timer
        const playerMagnet = p.magnetBoost?.active ? (p.magnetBoost.timer || 0) : 0;
        const systemMagnet = (this.systems && this.systems.experience && this.systems.experience.globalMagnetTimer) ? this.systems.experience.globalMagnetTimer : 0;
        const magnetTime = Math.max(playerMagnet, systemMagnet);
        if (magnetTime > 0.05) {
            pushEntry('magnet', 'Magnet', magnetTime, '#22d3ee', '🧲');
        }
        
        // Render compact pills with remaining time (no heavy DOM churn)
        if (entries.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        const html = entries.map(e => {
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
                    <span style="margin-right:6px;">${e.icon}</span>
                    <strong style="color:${e.color}">${e.label}</strong>
                    <span style="opacity:.85; margin-left:6px; color:#E6E6FA">${secs}s</span>
                </span>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    handleKeyUp(key) {
        // Handle key releases if needed
    }
    
    handleClick(e) {
        if (this.levelUpActive) {
            // Level up UI clicking is handled by DOM events
            return;
        }
        
        if (this.gameState === 'menu') {
            this.startGame();
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.timeScale = 1.0; // Ensure gameplay resumes after game over
        this.gameTime = 0;
        this.score = 0;
        
        // Hide menu
        this.hideMenuMessage();
        
        // Initialize graphics upgrades
        this.initializeGraphicsUpgrades();
        
        // Initialize player
        this.player = new Player(this, this.canvas.width / 2, this.canvas.height / 2);
        
        // Give player starting weapon
        this.player.addWeapon(MagicMissile);
        
        // Reset all systems
        this.systems.terrain.reset();
        this.systems.enemy.reset();
        this.systems.projectile.clearAll();
        this.systems.experience.clearAll();
        this.systems.particle.clear();
        this.systems.statusEffect.clearAllEffects();
        this.powerUpDrops = [];
        
        // Set up camera to follow player
        this.camera.targetX = this.player.x;
        this.camera.targetY = this.player.y;
        
        // Add atmospheric vignette
        this.camera.addVignette(0.3);
        
        // Start vampire ambient sounds
        if (this.audioManager && this.audioManager.startVampireAmbient) {
            this.audioManager.startVampireAmbient();
        }
        
        // Hide menu UI, show game UI
        this.updateUIVisibility();
        
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.timeScale = 0;
        }
    }
    
    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.timeScale = 1.0;
        }
    }
    
    restartGame() {
        this.gameState = 'menu';
        this.hideGameOverUI();
        this.startGame();
    }
    
    returnToMenu() {
        this.gameState = 'menu';
        this.timeScale = 1.0;
        this.hideGameOverUI();
        
        // Clear world state so the menu is clean
        try {
            this.systems.projectile.clearAll();
            this.systems.experience.clearAll();
            this.systems.particle.clear();
            this.systems.enemy.reset();
            if (this.audioManager && this.audioManager.stopAll) {
                this.audioManager.stopAll();
            }
        } catch (e) {
            console.warn('Minor cleanup issue on returnToMenu:', e);
        }
        this.powerUpDrops = [];
        this.player = null;
        
        this.updateUIVisibility();
        this.showMenuMessage();
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.timeScale = 0;
        
        
        // Update final stats
        this.updateFinalStats();
        this.showGameOverUI();
        
    }
    
    showLevelUpUI() {
        // FIXED: Prevent multiple level-up UIs from showing simultaneously
        if (this.levelUpActive) {
            console.log('Level-up UI already active, skipping duplicate show request');
            return;
        }
        
        this.levelUpActive = true;
        this.gameState = 'levelUp';
        this.timeScale = 0; // Pause game during level up
        
        // Generate level up options
        this.generateLevelUpOptions();
        
        // Show UI
        const levelUpUI = document.getElementById('level-up-ui');
        if (levelUpUI) {
            levelUpUI.style.display = 'block';
        } else {
            console.warn('Level-up UI element not found');
        }
    }
    
    hideLevelUpUI() {
        this.levelUpActive = false;
        this.gameState = 'playing';
        this.timeScale = 1.0; // Resume game
        
        document.getElementById('level-up-ui').style.display = 'none';
        
        // Clear any lingering flash effects to prevent red overlay bug
        if (this.camera && this.camera.clearFlash) {
            this.camera.clearFlash();
        }
        
        // Also clear particle system screen effects
        if (this.systems.particle && this.systems.particle.clearScreenEffects) {
            this.systems.particle.clearScreenEffects();
        }
        
        // FIXED: Process next queued level-up after player makes selection
        if (this.player && this.player.completeLevelUpSelection) {
            this.player.completeLevelUpSelection();
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
        if (this.player.weapons.size < this.player.maxWeapons) {
            const availableWeapons = ['whip', 'throwing_knife'];
            for (const weaponType of availableWeapons) {
                if (!Array.from(this.player.weapons.values()).some(w => w.id === weaponType)) {
                    const WeaponClass = this.weaponClasses.get(weaponType);
                    if (WeaponClass) {
                        const tempWeapon = new WeaponClass(this, this.player);
                        options.push({
                            type: 'new_weapon',
                            weaponType: weaponType,
                            name: tempWeapon.name,
                            description: tempWeapon.description
                        });
                    }
                }
            }
        }
        
        // Stat upgrades
        const statUpgrades = [
            { stat: 'damage', name: 'Damage +20%', description: 'Increase weapon damage' },
            { stat: 'speed', name: 'Speed +15%', description: 'Move faster' },
            { stat: 'health', name: 'Max Health +25%', description: 'Increase maximum health' },
            { stat: 'luck', name: 'Luck +10%', description: 'Better experience and drops' },
            { stat: 'area', name: 'Area +15%', description: 'Bigger projectiles and AoE radius' },
            { stat: 'cooldown', name: 'Cooldown -10%', description: 'Weapons fire faster' }
        ];
        
        for (const upgrade of statUpgrades) {
            options.push({
                type: 'stat_upgrade',
                stat: upgrade.stat,
                name: upgrade.name,
                description: upgrade.description
            });
        }
        
        // Randomly select 3-5 options
        this.levelUpOptions = this.shuffleArray(options).slice(0, Math.min(options.length, 3 + Math.floor(Math.random() * 3)));
        
        // Update UI
        this.updateLevelUpOptionsUI();
    }
    
    updateLevelUpOptionsUI() {
        const container = document.getElementById('level-up-options');
        container.innerHTML = '';
        
        this.levelUpOptions.forEach((option, index) => {
            const button = document.createElement('button');
            button.style.cssText = `
                background: #333;
                border: 2px solid #666;
                color: white;
                padding: 15px;
                border-radius: 5px;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
            `;
            
            button.innerHTML = `
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                    ${index + 1}. ${option.name}
                </div>
                <div style="font-size: 14px; color: #ccc;">
                    ${option.description}
                </div>
            `;
            
            button.addEventListener('click', () => this.selectLevelUpOption(index));
            button.addEventListener('mouseenter', () => {
                button.style.background = '#555';
                button.style.borderColor = '#FFD700';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = '#333';
                button.style.borderColor = '#666';
            });
            
            container.appendChild(button);
        });
    }
    
    selectLevelUpOption(index) {
        const option = this.levelUpOptions[index];
        if (!option) return;
        
        switch (option.type) {
            case 'weapon_upgrade':
                this.player.upgradeWeapon(option.weaponId);
                // Play weapon upgrade sound
                if (this.audioManager && this.audioManager.playWeaponUpgrade) {
                    this.audioManager.playWeaponUpgrade();
                }
                break;
            case 'new_weapon':
                const WeaponClass = this.weaponClasses.get(option.weaponType);
                if (WeaponClass) {
                    this.player.addWeapon(WeaponClass);
                }
                // Play weapon upgrade sound
                if (this.audioManager && this.audioManager.playWeaponUpgrade) {
                    this.audioManager.playWeaponUpgrade();
                }
                break;
            case 'stat_upgrade':
                this.applyStatUpgrade(option.stat);
                // Play level up sound
                if (this.audioManager && this.audioManager.playLevelUp) {
                    this.audioManager.playLevelUp();
                }
                // Subtle toast for clarity
                this.showToast(`${option.name}: ${option.description}`, '#7CF2FF', 1300);
                break;
        }
        
        // Enhanced visual effects - reduced intensity to prevent overlay
        this.systems.particle.createEvolutionEffect(this.player.x, this.player.y);
        // Removed Gothic explosion that was causing the overlay effect
        // this.systems.particle.createGothicExplosion(this.player.x, this.player.y, 60);
        // Small camera shake for feedback
        this.camera.shake(3, 0.2);
        
        this.hideLevelUpUI();
        
    }
    
    applyStatUpgrade(stat) {
        switch (stat) {
            case 'damage':
                this.player.stats.damage *= 1.2;
                break;
            case 'speed':
                this.player.stats.speed *= 1.15;
                break;
            case 'health':
                const oldMaxHealth = this.player.maxHealth;
                this.player.maxHealth = Math.floor(this.player.maxHealth * 1.25);
                this.player.health += this.player.maxHealth - oldMaxHealth; // Heal for the difference
                break;
            case 'luck':
                this.player.stats.luck *= 1.1;
                break;
            case 'area':
                this.player.stats.area *= 1.15;
                break;
            case 'cooldown':
                this.player.stats.cooldown *= 1.1; // Actually makes cooldowns shorter
                break;
        }
        
        // Update weapon stats
        for (const weapon of this.player.weapons.values()) {
            weapon.updateStats();
        }
    }
    
    showGameOverUI() {
        const el = document.getElementById('game-over-ui');
        if (!el) return;
        el.style.display = 'block';
        // Trigger fade-in
        requestAnimationFrame(() => {
            el.style.opacity = '1';
            el.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    }
    
    hideGameOverUI() {
        const el = document.getElementById('game-over-ui');
        if (!el) return;
        // Fade out then hide
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, -50%) scale(0.97)';
        setTimeout(() => {
            el.style.display = 'none';
        }, 200);
    }
    
    updateFinalStats() {
        document.getElementById('final-level').textContent = this.player ? this.player.level : 1;
        document.getElementById('final-time').textContent = this.formatTime(this.gameTime);
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-wave').textContent = this.systems.enemy.getCurrentWave();
    }
    
    updateUIVisibility() {
        const hud = document.getElementById('game-hud');
        if (hud) {
            hud.style.display = this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'levelUp' ? 'block' : 'none';
        }
    }
    
    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.gameState = 'menu';
        
        // Show initial menu message
        this.showMenuMessage();
        
        this.gameLoop();
    }
    
    showMenuMessage() {
        // Ensure we don't duplicate the overlay
        this.hideMenuMessage();
        // Create a simple menu overlay
        const menuMessage = document.createElement('div');
        menuMessage.id = 'menu-message';
        menuMessage.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            text-align: center;
            font-size: 24px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 200;
        `;
        menuMessage.innerHTML = `
            <h1 style="color: #FFD700; margin-bottom: 20px;">VAMPIRE SURVIVORS</h1>
            <p style="margin-bottom: 10px;">Press SPACE or click to start</p>
            <p style="font-size: 16px; color: #ccc;">WASD to move, auto-attacks, survive as long as possible!</p>
        `;
        document.body.appendChild(menuMessage);
    }
    
    hideMenuMessage() {
        const menuMessage = document.getElementById('menu-message');
        if (menuMessage) {
            menuMessage.remove();
        }
    }
    
    async initializeGraphicsUpgrades() {
        try {
            await this.graphicsUpgrade.initialize();
            console.log('🎨 Graphics upgrades successfully initialized');
        } catch (error) {
            console.warn('⚠️ Graphics upgrades failed to initialize, using fallback rendering:', error);
        }
    }
    
    gameLoop = (currentTime) => {
        try {
            if (!this.running) return;
            
            // Memory pressure check - prevent crashes at high levels
            if (this.frameCount % 1800 === 0) { // Every 30 seconds at 60fps
                this.performMemoryCleanup();
            }
            
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
            
            // OPTIMIZED: Ultra-fast deltaTime calculation with minimal operations
            const rawDeltaTime = (currentTime - this.lastTime) * 0.001; // Multiply is faster than divide
            this.deltaTime = rawDeltaTime > 0.033 ? 0.033 : (rawDeltaTime < 0.001 ? 0.001 : rawDeltaTime); // Branchless clamp
            this.lastTime = currentTime;
            this.frameCount++;
            
            // Track FPS for throttling
            this.performanceThrottle.samples.push(rawDeltaTime);
            if (this.performanceThrottle.samples.length > this.performanceThrottle.sampleSize) {
                this.performanceThrottle.samples.shift();
            }
            
            // Adjust quality if needed
            if (currentTime - this.performanceThrottle.lastAdjust > this.performanceThrottle.adjustInterval) {
                this.adjustPerformanceQuality();
                this.performanceThrottle.lastAdjust = currentTime;
            }
            
            // Apply time scale with single multiplication
            const scaledDeltaTime = this.deltaTime * this.timeScale;
            
            // OPTIMIZED: Timing tracking for frame budget management
            const updateStart = performance.now();
            try {
                this.update(scaledDeltaTime);
            } catch (updateError) {
                console.error('Update error:', updateError);
                // Emergency cleanup on critical update errors
                this.handleCriticalError(updateError);
                // Continue with rendering even if update fails
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
            const entityCount = (this.systems.enemy?.getEnemyCount?.() || 0) + (this.systems.projectile?.activeProjectiles?.length || 0);
            const monitoringFreq = entityCount > 150 ? 60 : entityCount > 100 ? 45 : 30;
            
            if (this.frameCount % monitoringFreq === 0) {
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
            managedSetTimeout(() => {
                console.log('Attempting to restart game loop...');
                if (this.running) {
                    requestAnimationFrame(this.gameLoop);
                }
            }, 1000, this);
        }
    }
    /**
     * Adjust quality settings based on performance
     */
    adjustPerformanceQuality() {
        if (!this.performanceThrottle || !this.performanceThrottle.samples.length) return;
        
        // Calculate average FPS from samples
        const avgDeltaTime = this.performanceThrottle.samples.reduce((a, b) => a + b, 0) / this.performanceThrottle.samples.length;
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
            
            console.log(`⚡ Performance auto-adjust: Quality ${(newQuality * 100).toFixed(0)}%, FPS: ${avgFPS.toFixed(1)}`);
        }
    }
    
    /**
     * Perform memory cleanup to prevent crashes at high levels
     */
    performMemoryCleanup() {
        try {
            // Clear damage number pool periodically
            if (globalDamageNumberPool.getStats().available < 20) {
                globalDamageNumberPool.clear();
            }
            
            // Clean up particle systems
            if (this.systems.particle && this.systems.particle.clear) {
                const particleStats = this.systems.particle.getPerformanceInfo();
                if (particleStats.effectParticles > 300) {
                    // Reduce particle count by half
                    this.systems.particle.adaptParticleLimits();
                }
            }
            
            // Force garbage collection hint (if available)
            if (window.gc) {
                window.gc();
            }
            
            console.log('🧹 Memory cleanup performed');
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
                    enemies.sort((a, b) => (b.maxHealth + b.damage) - (a.maxHealth + a.damage));
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
            
            // Clear experience gems if too many
            if (this.systems.experience && this.systems.experience.activeGems) {
                const gems = this.systems.experience.activeGems;
                if (gems.length > 100) {
                    const toRemove = gems.slice(0, gems.length - 50);
                    for (const gem of toRemove) {
                        gem.active = false;
                    }
                    
                    console.log(`💎 Emergency cleanup: removed ${toRemove.length} gems`);
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
    
    update(dt) {
        if (this.gameState === 'playing' || this.gameState === 'levelUp') {
            this.gameTime += dt;
            
            // FIXED: Apply timeScale for proper game pausing during level-up
            const scaledDt = dt * this.timeScale;
            
            // OPTIMIZED: Smart update ordering for cache efficiency
            if (this.player) {
                // FIXED: Only update player UI effects during pause, not gameplay mechanics
                if (this.gameState === 'levelUp') {
                    // During level-up: only update visual effects (glow, particles, etc.)
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
            
            // FIXED: Only update game systems when not paused (timeScale > 0)
            if (this.timeScale > 0) {
                // OPTIMIZED: Strategic system update order for minimal cache misses
                // 1. Terrain (provides spatial context)
                this.systems.terrain.update(scaledDt);
                
                // 2. Enemies (movement and AI)
                this.systems.enemy.update(scaledDt);
                
                // 3. Projectiles (collision detection benefits from updated enemy positions)
                this.systems.projectile.update(scaledDt);
                
                // 4. Experience (collision with updated player position)
                this.systems.experience.update(scaledDt);
                
                // 5. Status effects (depend on updated entity states)
                this.systems.statusEffect.update(scaledDt);
                
                // 6. Power-ups (benefit from all position updates)
                this.updatePowerUpDrops(scaledDt);
                
                // 7. Audio intensity updates (only when game is active)
                const entityCount = this.systems.enemy.getEnemyCount() + this.systems.projectile.activeProjectiles.length;
                const audioFreq = entityCount > 120 ? 16 : 8;
                if (this.frameCount % audioFreq === 0 && this.audioManager && this.audioManager.setGameIntensity) {
                    const intensity = Math.min(1, entityCount * 0.02);
                    this.audioManager.setGameIntensity(intensity);
                }
                
                // 8. UI updates (adaptive frequency based on entity density)
                const uiUpdateFreq = entityCount > 180 ? 30 : entityCount > 120 ? 20 : entityCount > 80 ? 15 : 12;
                if (this.frameCount % uiUpdateFreq === 0) {
                    this.updateGameUI();
                }
            }
            
            // Visual systems always update (even when paused) for smooth UI
            // Particles (visual effects based on all game state)
            this.systems.particle.update(dt, this.qualitySettings);
            
            // Update damage numbers from centralized pool
            globalDamageNumberPool.update(dt);
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
        
        if (this.gameState === 'menu') {
            this.renderMenu();
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
        
        // 2. Experience gems (can be batched by color/size)
        this.systems.experience.render(this.renderer);
        
        // 2.5 Power-ups (world-space, render with entities)
        this.renderPowerUpDrops(this.renderer);
        
        // 3. Enemies (group by type for potential batching)
        this.systems.enemy.render(this.renderer);
        
        // 4. Player (single entity, high priority)
        if (this.player) {
            // Debug: ensure player is visible
            if (!this.player.x || !this.player.y) {
                console.error('Player position invalid:', this.player.x, this.player.y);
                this.player.x = this.canvas.width / 2;
                this.player.y = this.canvas.height / 2;
            }
            this.player.render(this.renderer);
        } else {
            console.error('No player object to render!');
        }
        
        // 5. Projectiles (batch by type and color)
        this.systems.projectile.render(this.renderer);
        
        // 6. Particles (alpha blending, render last)
        this.systems.particle.render(this.renderer, this.qualitySettings);
        
        // 7. Damage numbers (rendered after particles for proper layering)
        globalDamageNumberPool.render(this.ctx, this.camera);
        
        // Restore camera transform
        this.ctx.restore();
        
        // 7. Combo UI (screen-space, render after camera restore)
        // this.systems.combo.render(this.renderer);
        
        // OPTIMIZED: Batch UI and effects with minimal state changes
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Camera effects (flash, shake) - no culling needed
        this.camera.renderFlash(this.ctx);
        this.camera.renderPostEffects(this.ctx);
        
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
        
        // UI overlays (screen space)
        this.renderUIOverlays();
        
        // OPTIMIZED: End frame processing for batching and statistics
        this.renderer.endFrame();
    }
    
    renderMenu() {
        // Simple animated background
        const time = performance.now() * 0.001;
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, `hsl(${(time * 20) % 360}, 70%, 20%)`);
        gradient.addColorStop(1, `hsl(${(time * 20 + 180) % 360}, 70%, 10%)`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Animated particles
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(time + i) * 0.5 + 0.5) * this.canvas.width;
            const y = (Math.cos(time * 0.7 + i) * 0.5 + 0.5) * this.canvas.height;
            const alpha = 0.3 + 0.2 * Math.sin(time * 2 + i);
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
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
        
        allElements.forEach(el => {
            // Skip essential elements
            if (el.id === 'gameCanvas' || 
                el.tagName === 'CANVAS' || 
                el.tagName === 'HTML' || 
                el.tagName === 'BODY' ||
                el.tagName === 'SCRIPT' ||
                el.tagName === 'STYLE' ||
                el.id === 'gameHUD' ||
                el.id === 'performanceMonitor' ||
                el.id === 'controlsHelp') return;
            
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            // Check if element is visible and potentially problematic
            if (style.display !== 'none' && 
                style.visibility !== 'hidden' && 
                rect.width > 0 && 
                rect.height > 0) {
                
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
                if (inlineStyle.includes('background: white') || 
                    inlineStyle.includes('background-color: white') ||
                    inlineStyle.includes('background: #fff') ||
                    inlineStyle.includes('background: rgb(255, 255, 255)')) {
                    shouldRemove = true;
                    reason = 'White inline style';
                }
                
                // Remove any div without proper game-related IDs/classes
                if (el.tagName === 'DIV' && !el.id && !el.className && 
                    (style.position === 'absolute' || style.position === 'fixed')) {
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
            problematicElements.forEach(item => {
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
        
        selectorsToClean.forEach(selector => {
            try {
                document.querySelectorAll(selector).forEach(el => {
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
            ctx.fillText('BOUNDARY', hudX + hudSize/2, hudY + hudSize + 20);
            ctx.fillText(`${Math.round(minDistance)}m`, hudX + hudSize/2, hudY + hudSize + 35);
            
            // Directional arrow pointing to closest boundary
            ctx.strokeStyle = '#FF6060';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            let arrowX = hudX + hudSize/2;
            let arrowY = hudY + hudSize/2;
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
                arrowEndX - arrowSize * Math.cos(angle - Math.PI/6),
                arrowEndY - arrowSize * Math.sin(angle - Math.PI/6)
            );
            ctx.moveTo(arrowEndX, arrowEndY);
            ctx.lineTo(
                arrowEndX - arrowSize * Math.cos(angle + Math.PI/6),
                arrowEndY - arrowSize * Math.sin(angle + Math.PI/6)
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
            this.performanceStats.fps = Math.round(this.frameCount * 1000 / (currentTime - this.performanceStats.lastFpsUpdate));
            
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
        
        // Only log performance issues, not regular reports
        if (stats.fps < 45 || stats.entityCount > 300 || stats.dropped60FpsFrames > 30) {
            console.warn(`⚠️ Performance Issue - FPS: ${stats.fps}, Entities: ${stats.entityCount}, Dropped: ${stats.dropped60FpsFrames}, Quality: ${stats.qualityLevel}%`);
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
        // Enhanced wave announcements with different types
        const isSpecialWave = waveNumber % 5 === 0;
        const isBossWave = waveNumber % 10 === 0;
        const isMilestoneWave = [25, 50, 75, 100].includes(waveNumber);
        
        // Determine wave type and styling
        let waveText, color, size, intensity;
        if (isMilestoneWave) {
            waveText = `🔥 MILESTONE WAVE ${waveNumber} 🔥`;
            color = '#FF0066';
            size = 48;
            intensity = 3.0;
        } else if (isBossWave) {
            waveText = `💀 BOSS WAVE ${waveNumber} 💀`;
            color = '#FF4444';
            size = 42;
            intensity = 2.5;
        } else if (isSpecialWave) {
            waveText = `⚡ ELITE WAVE ${waveNumber} ⚡`;
            color = '#FF6600';
            size = 38;
            intensity = 2.0;
        } else {
            waveText = `WAVE ${waveNumber}`;
            color = '#FFD700';
            size = 36;
            intensity = 1.5;
        }
        
        // Create enhanced notification with animation
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            top: 25%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: ${color};
            font-size: ${size}px;
            font-weight: bold;
            text-shadow: 4px 4px 8px rgba(0,0,0,0.9);
            z-index: 150;
            pointer-events: none;
            text-align: center;
            animation: waveAnnouncement 3s ease-out forwards;
            white-space: nowrap;
        `;
        notification.textContent = waveText;
        
        // Add CSS animation if not exists
        if (!document.getElementById('wave-animation-style')) {
            const style = document.createElement('style');
            style.id = 'wave-animation-style';
            style.textContent = `
                @keyframes waveAnnouncement {
                    0% { 
                        opacity: 0; 
                        transform: translate(-50%, -50%) scale(0.5); 
                    }
                    20% { 
                        opacity: 1; 
                        transform: translate(-50%, -50%) scale(1.2); 
                    }
                    60% { 
                        opacity: 1; 
                        transform: translate(-50%, -50%) scale(1.0); 
                    }
                    100% { 
                        opacity: 0; 
                        transform: translate(-50%, -50%) scale(0.8); 
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to UI container instead of body to prevent artifacts
        const uiContainer = document.getElementById('game-ui');
        if (uiContainer) {
            uiContainer.appendChild(notification);
        } else {
            document.body.appendChild(notification);
        }
        
        // Remove after animation
        managedSetTimeout(() => {
            notification.remove();
        }, 3000, this);
        
        // Enhanced visual effects based on wave type
        if (this.camera) {
            this.camera.flash(color, 0.8 * intensity);
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
                managedSetTimeout(() => {
                    this.systems.particle.createBurst(this.player.x, this.player.y, 'gemExplosion', {
                        color: '#FFFFFF',
                        count: 40,
                        spread: 100,
                        intensity: intensity
                    });
                }, 300, this);
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
            } else {
                // Standard wave effect
                this.systems.particle.createBurst(this.player.x, this.player.y, 'collect', {
                    color: color,
                    count: 15,
                    spread: 50,
                    intensity: intensity
                });
            }
        }
        
        // Enhanced audio feedback
        if (this.audioManager) {
            if (isMilestoneWave) {
                this.audioManager.playVampireSound('levelUp', 1.0, 1.5);
                managedSetTimeout(() => {
                    this.audioManager.playVampireSound('criticalHit', 0.8, 1.8);
                }, 400, this);
            } else if (isBossWave) {
                this.audioManager.playVampireSound('vampireBite', 1.0, 0.7); // Deep, ominous
                managedSetTimeout(() => {
                    this.audioManager.playVampireSound('criticalHit', 0.9, 1.2);
                }, 300, this);
            } else if (isSpecialWave) {
                this.audioManager.playVampireSound('weaponUpgrade', 0.9, 1.3);
            } else {
                this.audioManager.playVampireSound('experienceGain', 0.7, 1.2);
            }
        }
        
        // Special rewards and effects
        if (isMilestoneWave && this.player) {
            // Give massive rewards for milestone waves
            this.player.gainExperience(waveNumber * 10);
            this.player.activatePowerUp('invincible', 5.0, 1.0);
            this.player.activatePowerUp('damageBoost', 15.0, 2.0);
            this.spawnPowerUpDrop(this.player.x, this.player.y);
        } else if (isBossWave && this.player) {
            // Health restoration for boss waves
            this.player.heal(this.player.maxHealth * 0.5);
            this.spawnPowerUpDrop(this.player.x, this.player.y);
        } else if (isSpecialWave && this.player) {
            // XP magnet effect for elite waves
            if (this.systems.experience) {
                this.systems.experience.magnetizeAllGems();
            }
            this.spawnPowerUpDrop(this.player.x, this.player.y);
        }
        
        // Warning text for dangerous waves
        if (isBossWave || isMilestoneWave) {
            managedSetTimeout(() => {
                const warningText = document.createElement('div');
                warningText.style.cssText = `
                    position: absolute;
                    top: 35%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #FF4444;
                    font-size: 24px;
                    font-weight: bold;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                    z-index: 149;
                    pointer-events: none;
                    text-align: center;
                    animation: waveWarning 2s ease-out forwards;
                `;
                warningText.textContent = isMilestoneWave ? 'PREPARE FOR CHAOS!' : 'DANGER INCOMING!';
                
                // Add warning animation if not exists
                if (!document.getElementById('wave-warning-style')) {
                    const warnStyle = document.createElement('style');
                    warnStyle.id = 'wave-warning-style';
                    warnStyle.textContent = `
                        @keyframes waveWarning {
                            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                        }
                    `;
                    document.head.appendChild(warnStyle);
                }
                
                // Add to UI container instead of body
                const uiContainer = document.getElementById('game-ui');
                if (uiContainer) {
                    uiContainer.appendChild(warningText);
                } else {
                    document.body.appendChild(warningText);
                }
                managedSetTimeout(() => warningText.remove(), 2000, this);
            }, 1000, this);
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
    
    spawnPowerUpDrop(x, y) {
        // Ensure storage and respect cap to reduce clutter
        if (!this.powerUpDrops) this.powerUpDrops = [];
        const cap = this.maxPowerUpDrops || 8;
        if (this.powerUpDrops.length >= cap) {
            return; // Skip spawning when at cap
        }

        // Random power-up type
        const powerUpTypes = ['health', 'invincible', 'speedBoost', 'damageBoost', 'magnetBoost', 'fireRate'];
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
                
                if (distance < 30) {
                    this.collectPowerUp(powerUp);
                    powerUp.collected = true;
                    this.powerUpDrops.splice(i, 1);
                }
            }
        }
    }
    
    collectPowerUp(powerUp) {
        if (!this.player) return;
        
        
        // Apply power-up effect
        switch (powerUp.type) {
            case 'health':
                this.player.heal(this.player.maxHealth * 0.5);
                break;
            case 'invincible':
                this.player.activatePowerUp('invincible', 5.0, 1.0);
                break;
            case 'speedBoost':
                // Match label: Speed x2 (base multiplier 2.0, intensity 1.0)
                this.player.activatePowerUp('speedBoost', 8.0, 1.0);
                break;
            case 'damageBoost':
                // Match label: Damage x3 (base multiplier 3.0, intensity 1.0)
                this.player.activatePowerUp('damageBoost', 10.0, 1.0);
                break;
            case 'magnetBoost':
                // Global magnet effect should ignore range but not be excessively strong
                this.player.activatePowerUp('magnetBoost', 12.0, 1.0);
                this.systems.experience.magnetizeAllGems();
                // Ensure continuous global pull for the duration
                if (this.systems && this.systems.experience && typeof this.systems.experience.activateGlobalMagnet === 'function') {
                    this.systems.experience.activateGlobalMagnet(12.0);
                }
                break;
            case 'fireRate':
                // Match label: Fire rate +30% (base reduction 0.3, intensity 1.0)
                this.player.activatePowerUp('fireRate', 15.0, 1.0);
                break;
        }
        
         // Subtle pickup toast for clarity
        try {
            const name = this.getPowerUpName(powerUp.type);
            const hint = this.getPowerUpPickupHint(powerUp.type);
            this.showPickupToast(`${name} — ${hint}`, this.getPowerUpColor(powerUp.type));
        } catch (_) {}
        
        // Collection effects
        this.systems.particle.createPowerUpCollectEffect(powerUp.x, powerUp.y, this.getPowerUpColor(powerUp.type));
        
        if (this.audioManager) {
            this.audioManager.playPowerUpCollect();
        }
    }
    
    renderPowerUpDrops(renderer) {
        if (!this.powerUpDrops) return;
        
        const ctx = renderer.ctx;
        
        for (const powerUp of this.powerUpDrops) {
            if (!powerUp.active || powerUp.collected) continue;
            
            ctx.save();
            
            // Pulsing effect
            const pulse = 1.0 + Math.sin(powerUp.pulsePhase) * 0.3;
            const size = powerUp.size * pulse;
            
            // Glow effect
            ctx.shadowColor = this.getPowerUpColor(powerUp.type);
            ctx.shadowBlur = 15;
            
            // Draw power-up
            ctx.fillStyle = this.getPowerUpColor(powerUp.type);
            ctx.beginPath();
            ctx.arc(powerUp.x, powerUp.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw icon/symbol
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.getPowerUpSymbol(powerUp.type), powerUp.x, powerUp.y);
            
            // Nearby hint label to explain the drop
            if (this.player) {
                const dx = powerUp.x - this.player.x;
                const dy = powerUp.y - this.player.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 240) {
                    const label = this.getPowerUpPickupHint(powerUp.type);
                    const alpha = Math.max(0.35, 1 - dist / 240);
                    ctx.globalAlpha = alpha;
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    const textWidth = ctx.measureText(label).width;
                    const padX = 6, padY = 3;
                    // Background box above the drop
                    ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
                    ctx.strokeStyle = 'rgba(138, 43, 226, 0.5)';
                    ctx.lineWidth = 1;
                    const bx = powerUp.x, by = powerUp.y - size - 8;
                    ctx.beginPath();
                    ctx.rect(bx - textWidth / 2 - padX, by - 14, textWidth + padX * 2, 16 + padY);
                    ctx.fill();
                    ctx.stroke();
                    // Text
                    ctx.fillStyle = '#E6E6FA';
                    ctx.fillText(label, bx, by - 2);
                    ctx.globalAlpha = 1;
                }
            }
            
            ctx.restore();
        }
    }
    
    getPowerUpColor(type) {
        const colors = {
            health: '#FF4444',
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        return colors[type] || '#FFFFFF';
    }
    
    getPowerUpSymbol(type) {
        const symbols = {
            health: '+',
            invincible: '◊',
            speedBoost: '»',
            damageBoost: '!',
            magnetBoost: '○',
            fireRate: '‹›'
        };
        return symbols[type] || '?';
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
            player: this.player ? {
                level: this.player.level,
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                experience: this.player.experience,
                experienceToNext: this.player.experienceToNext
            } : null
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
            systems: {
                enemy: this.systems.enemy.getDebugInfo(),
                projectile: this.systems.projectile.getDebugInfo(),
                experience: this.systems.experience.getDebugInfo()
            }
        };
    }
}