/**
 * Vampire Survivors Game - Modern ECS Implementation
 * 
 * Professional game implementation showcasing modern browser game architecture:
 * - Clean ECS (Entity-Component-System) design
 * - Proper separation of concerns
 * - Configuration-driven development
 * - Comprehensive error handling
 * - Performance monitoring and optimization
 * - Extensible system architecture
 * 
 * This serves as a reference implementation for scalable browser games.
 * 
 * @author Game Architecture Specialist
 * @version 2.0.0
 */

import { GameEngine, GameState, GameEvents, EngineFactory } from './core/GameEngine.js';
import { Config } from './core/ConfigManager.js';
import { Logger, ErrorHandling, ErrorCategory } from './core/ErrorHandler.js';
import { EntityFactory, EntityFactoryPresets } from './core/EntityFactory.js';

// Import game systems
import { MovementSystem } from './systems/MovementSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js';
import { EnemyAISystem } from './systems/EnemyAISystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { ExperienceSystem } from './systems/ExperienceSystem.js';
import { ParticleSystemECSAdapter } from './systems/ParticleSystemECSAdapter.js';
import { ComboSystem } from './systems/ComboSystem.js';
import { UISystem } from './systems/UISystem.js';
import { AudioSystem } from './systems/AudioSystem.js';

/**
 * Main Vampire Survivors Game Class
 * 
 * Orchestrates the complete game experience using professional
 * architecture patterns and modern JavaScript features.
 */
export class VampireSurvivorsGame extends GameEngine {
    /**
     * Initialize Vampire Survivors game
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} dependencies - Injected dependencies
     */
    constructor(canvas, dependencies = {}) {
        super(canvas, dependencies);
        
        // Game-specific state
        this.gameMode = 'classic'; // classic, endless, challenge
        this.difficulty = 'normal'; // easy, normal, hard, nightmare
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('vs_highscore') || '0');
        this.waveNumber = 1;
        this.playerLevel = 1;
        
        // Game entities
        this.playerEntity = null;
        this.entityFactory = null;
        
        // Level up system
        this.levelUpOptions = [];
        this.availableWeapons = ['magicMissile', 'whip', 'throwingKnife'];
        this.availableUpgrades = ['damage', 'speed', 'health', 'area', 'cooldown'];
        
        // Game progression
        this.killCount = 0;
        this.experienceCollected = 0;
        this.survivalTime = 0;
        
        // UI elements
        this.uiElements = new Map();
        
        Logger.info('Vampire Survivors Game initialized');
    }

    /**
     * Initialize game-specific components
     */
    async onInit() {
        super.onInit();
        
        try {
            // Load external configuration files
            await this.loadExternalConfigs();
            
            // Create entity factory
            this.entityFactory = EntityFactoryPresets.createPerformanceOptimized(this.world);
            
            // Register game systems
            this.registerGameSystems();
            
            // Set up game-specific event handlers
            this.setupGameEventHandlers();
            
            // Initialize UI
            this.initializeGameUI();
            
            // Load saved preferences
            this.loadGamePreferences();
            
            Logger.info('Vampire Survivors Game components initialized');
            
        } catch (error) {
            Logger.error('Failed to initialize Vampire Survivors Game', { error: error.message });
            throw error;
        }
    }

    /**
     * Load external configuration files
     * @private
     */
    async loadExternalConfigs() {
        const configFiles = [
            'configs/enemies.json',
            'configs/weapons.json', 
            'configs/player.json'
        ];
        
        try {
            await Config.loadExternalConfigs(configFiles);
            Logger.info('External configuration files loaded successfully');
        } catch (error) {
            Logger.warn('Some configuration files failed to load, using defaults', { error: error.message });
        }
    }

    /**
     * Register all game systems with proper priorities
     * @private
     */
    registerGameSystems() {
        // Input system (highest priority)
        this.registerSystem('playerInput', new PlayerInputSystem(this.world, 'playerInput'), {
            priority: -10,
            enabled: true
        });

        // AI system
        this.registerSystem('enemyAI', new EnemyAISystem(this.world, 'enemyAI'), {
            priority: -5,
            enabled: true
        });

        // Physics and movement systems
        this.registerSystem('movement', new MovementSystem(this.world, 'movement'), {
            priority: 0,
            enabled: true
        });

        this.registerSystem('collision', new CollisionSystem(this.world, 'collision'), {
            priority: 1,
            enabled: true
        });

        // Game logic systems
        this.registerSystem('weapon', new WeaponSystem(this.world, 'weapon'), {
            priority: 2,
            enabled: true
        });

        this.registerSystem('experience', new ExperienceSystem(this.world, 'experience'), {
            priority: 3,
            enabled: true
        });

        this.registerSystem('combo', new ComboSystem(this.world, 'combo'), {
            priority: 4,
            enabled: true
        });

        // Visual systems (lower priority)
        this.registerSystem('particle', new ParticleSystemECSAdapter(this.world, 'particle'), {
            priority: 8,
            enabled: true
        });

        this.registerSystem('render', new RenderSystem(this.world, 'render'), {
            priority: 10,
            enabled: true
        });

        // UI and audio systems (lowest priority)
        this.registerSystem('ui', new UISystem(this.world, 'ui'), {
            priority: 15,
            enabled: true
        });

        this.registerSystem('audio', new AudioSystem(this.world, 'audio'), {
            priority: 20,
            enabled: !!this.audioManager
        });

        Logger.debug('Game systems registered', {
            systemCount: this.systemRegistry.size,
            systems: Array.from(this.systemRegistry.keys())
        });
    }

    /**
     * Set up game-specific event handlers
     * @private
     */
    setupGameEventHandlers() {
        // Player events
        this.on(GameEvents.PLAYER_LEVELED_UP, this.onPlayerLevelUp.bind(this));
        this.on(GameEvents.PLAYER_DIED, this.onPlayerDied.bind(this));
        
        // Enemy events
        this.on(GameEvents.ENEMY_KILLED, this.onEnemyKilled.bind(this));
        this.on(GameEvents.ENEMY_SPAWNED, this.onEnemySpawned.bind(this));
        
        // Wave events
        this.on(GameEvents.WAVE_COMPLETED, this.onWaveCompleted.bind(this));
        
        // UI events
        this.on('levelUpOptionSelected', this.onLevelUpOptionSelected.bind(this));
        this.on('gameRestart', this.onGameRestart.bind(this));
        this.on('returnToMenu', this.onReturnToMenu.bind(this));
        
        Logger.debug('Game event handlers set up');
    }

    /**
     * Initialize game-specific UI
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    initializeGameUI() {
        // Create UI container
        this.createUIContainer();
        
        // Create game HUD
        this.createGameHUD();
        
        // Create menu screens
        this.createMenuScreen();
        this.createLevelUpScreen();
        this.createGameOverScreen();
        this.createPauseScreen();
        
        // Set up UI event listeners
        this.setupUIEventListeners();
        
        Logger.debug('Game UI initialized');
    }

    /**
     * Create main UI container
     * @private
     */
    createUIContainer() {
        let container = document.getElementById('game-ui');
        if (!container) {
            container = document.createElement('div');
            container.id = 'game-ui';
            container.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                font-family: 'Segoe UI', Arial, sans-serif;
            `;
            document.body.appendChild(container);
        }
        
        this.uiElements.set('container', container);
    }

    /**
     * Create game HUD
     * @private
     */
    createGameHUD() {
        const hud = document.createElement('div');
        hud.id = 'game-hud';
        hud.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            border: 2px solid #4A90E2;
            min-width: 200px;
            display: none;
        `;
        
        hud.innerHTML = `
            <div class="hud-section">
                <div class="stat-line">Level: <span id="player-level">1</span></div>
                <div class="stat-line">Health: <span id="player-health">100</span>/<span id="player-max-health">100</span></div>
                <div class="stat-line">XP: <span id="player-exp">0</span>/<span id="player-exp-needed">100</span></div>
            </div>
            <div class="hud-section">
                <div class="stat-line">Wave: <span id="current-wave">1</span></div>
                <div class="stat-line">Enemies: <span id="enemy-count">0</span></div>
                <div class="stat-line">Score: <span id="current-score">0</span></div>
                <div class="stat-line">Time: <span id="survival-time">0:00</span></div>
            </div>
            <div class="hud-section" id="debug-section" style="display: none;">
                <div class="stat-line">FPS: <span id="fps-counter">60</span></div>
                <div class="stat-line">Entities: <span id="entity-count">0</span></div>
            </div>
        `;
        
        this.uiElements.get('container').appendChild(hud);
        this.uiElements.set('hud', hud);
    }

    /**
     * Create menu screen
     * @private
     */
    createMenuScreen() {
        const menu = document.createElement('div');
        menu.id = 'menu-screen';
        menu.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
        `;
        
        menu.innerHTML = `
            <h1 style="font-size: 3em; margin-bottom: 40px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
                🧛 VAMPIRE SURVIVORS
            </h1>
            <div style="text-align: center; margin-bottom: 40px;">
                <div style="font-size: 1.2em; margin-bottom: 20px;">High Score: ${this.highScore}</div>
                <button id="start-game-btn" class="menu-button">Start Game</button>
                <button id="settings-btn" class="menu-button">Settings</button>
                <button id="credits-btn" class="menu-button">Credits</button>
            </div>
            <div style="font-size: 0.9em; opacity: 0.7; text-align: center;">
                <div>WASD/Arrow Keys: Move</div>
                <div>ESC: Pause • F1: Debug Info</div>
            </div>
        `;
        
        this.uiElements.get('container').appendChild(menu);
        this.uiElements.set('menu', menu);
    }

    /**
     * Create level up screen
     * @private
     */
    createLevelUpScreen() {
        const levelUp = document.createElement('div');
        levelUp.id = 'level-up-screen';
        levelUp.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 40px;
            border-radius: 12px;
            border: 3px solid #FFD700;
            text-align: center;
            display: none;
            pointer-events: auto;
            min-width: 500px;
        `;
        
        levelUp.innerHTML = `
            <h2 style="color: #FFD700; margin-bottom: 30px; font-size: 2em;">LEVEL UP!</h2>
            <p style="margin-bottom: 30px;">Choose an upgrade:</p>
            <div id="level-up-options" style="display: flex; flex-direction: column; gap: 15px;">
                <!-- Options populated dynamically -->
            </div>
        `;
        
        this.uiElements.get('container').appendChild(levelUp);
        this.uiElements.set('levelUp', levelUp);
    }

    /**
     * Create game over screen
     * @private
     */
    createGameOverScreen() {
        const gameOver = document.createElement('div');
        gameOver.id = 'game-over-screen';
        gameOver.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(145deg, rgba(139, 0, 0, 0.95), rgba(75, 0, 130, 0.95));
            color: white;
            padding: 50px;
            border-radius: 15px;
            border: 4px solid #8B008B;
            text-align: center;
            display: none;
            pointer-events: auto;
            min-width: 400px;
        `;
        
        gameOver.innerHTML = `
            <h2 style="color: #FF6B6B; margin-bottom: 30px; font-size: 2.5em;">💀 GAME OVER 💀</h2>
            <div id="final-stats" style="margin-bottom: 40px; font-size: 1.2em;">
                <div style="margin-bottom: 10px;">Final Level: <span id="final-level">1</span></div>
                <div style="margin-bottom: 10px;">Survival Time: <span id="final-time">0:00</span></div>
                <div style="margin-bottom: 10px;">Enemies Killed: <span id="final-kills">0</span></div>
                <div style="margin-bottom: 10px;">Final Score: <span id="final-score">0</span></div>
                <div id="new-high-score" style="color: #FFD700; font-weight: bold; display: none;">NEW HIGH SCORE!</div>
            </div>
            <div>
                <button id="restart-btn" class="menu-button">Play Again</button>
                <button id="menu-btn" class="menu-button">Main Menu</button>
            </div>
        `;
        
        this.uiElements.get('container').appendChild(gameOver);
        this.uiElements.set('gameOver', gameOver);
    }

    /**
     * Create pause screen
     * @private
     */
    createPauseScreen() {
        const pause = document.createElement('div');
        pause.id = 'pause-screen';
        pause.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 40px;
            border-radius: 10px;
            border: 2px solid #4A90E2;
            text-align: center;
            display: none;
            pointer-events: auto;
        `;
        
        pause.innerHTML = `
            <h2 style="margin-bottom: 30px; font-size: 2em;">PAUSED</h2>
            <div>
                <button id="resume-btn" class="menu-button">Resume</button>
                <button id="pause-menu-btn" class="menu-button">Main Menu</button>
            </div>
        `;
        
        this.uiElements.get('container').appendChild(pause);
        this.uiElements.set('pause', pause);
    }

    /**
     * Set up UI event listeners
     * @private
     */
    setupUIEventListeners() {
        // Menu buttons
        document.getElementById('start-game-btn')?.addEventListener('click', () => {
            this.startGame();
        });

        // Game over buttons
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            this.emit('gameRestart');
        });

        document.getElementById('menu-btn')?.addEventListener('click', () => {
            this.emit('returnToMenu');
        });

        // Pause buttons
        document.getElementById('resume-btn')?.addEventListener('click', () => {
            this.resumeGame();
        });

        document.getElementById('pause-menu-btn')?.addEventListener('click', () => {
            this.emit('returnToMenu');
        });

        // Add CSS styles for menu buttons
        const style = document.createElement('style');
        style.textContent = `
            .menu-button {
                background: linear-gradient(145deg, #4A90E2, #357ABD);
                color: white;
                border: none;
                padding: 15px 30px;
                margin: 10px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .menu-button:hover {
                background: linear-gradient(145deg, #357ABD, #2968A3);
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(74, 144, 226, 0.4);
            }
            
            .stat-line {
                margin-bottom: 5px;
                font-size: 14px;
            }
            
            .hud-section {
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(74, 144, 226, 0.3);
            }
            
            .hud-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Start a new game
     */
    @ErrorHandling.safe(ErrorCategory.GAMEPLAY)
    startGame() {
        Logger.info('Starting new game');
        
        try {
            // Reset game state
            this.resetGameState();
            
            // Create player entity
            this.createPlayer();
            
            // Initialize level
            this.initializeLevel();
            
            // Show game UI
            this.showGameUI();
            
            // Start game
            this.setState(GameState.PLAYING);
            
            Logger.info('Game started successfully');
            
        } catch (error) {
            Logger.error('Failed to start game', { error: error.message });
            this.setState(GameState.ERROR);
        }
    }

    /**
     * Reset game state for new game
     * @private
     */
    resetGameState() {
        this.gameTime = 0;
        this.score = 0;
        this.waveNumber = 1;
        this.playerLevel = 1;
        this.killCount = 0;
        this.experienceCollected = 0;
        this.survivalTime = 0;
        this.levelUpOptions = [];
        
        // Clear any existing entities
        this.world.entities.forEach(entity => entity.destroy());
    }

    /**
     * Create player entity
     * @private
     */
    createPlayer() {
        const playerConfig = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            color: Config.get('player.color') || '#4A90E2'
        };
        
        this.playerEntity = this.entityFactory.createEntity('player', playerConfig);
        
        // Set up camera to follow player
        const transform = this.playerEntity.getComponent('transform');
        if (transform) {
            this.camera.setTarget(transform.x, transform.y);
        }
        
        Logger.debug('Player entity created', { playerId: this.playerEntity.id });
    }

    /**
     * Initialize level
     * @private
     */
    initializeLevel() {
        // Start enemy spawning
        const enemySystem = this.getSystem('enemyAI');
        if (enemySystem && enemySystem.startSpawning) {
            enemySystem.startSpawning();
        }
        
        // Initialize weapon system
        const weaponSystem = this.getSystem('weapon');
        if (weaponSystem && weaponSystem.givePlayerStartingWeapon) {
            weaponSystem.givePlayerStartingWeapon(this.playerEntity);
        }
    }

    /**
     * Show game UI elements
     * @private
     */
    showGameUI() {
        // Hide menu
        this.uiElements.get('menu').style.display = 'none';
        
        // Show HUD
        this.uiElements.get('hud').style.display = 'block';
        
        // Show debug info if enabled
        const debugSection = document.getElementById('debug-section');
        if (debugSection) {
            debugSection.style.display = Config.get('debug.showPerformanceMetrics') ? 'block' : 'none';
        }
    }

    /**
     * Handle player level up
     * @param {object} event - Level up event data
     */
    onPlayerLevelUp(event) {
        Logger.info('Player leveled up', { newLevel: event.level });
        
        this.playerLevel = event.level;
        this.generateLevelUpOptions();
        this.setState(GameState.LEVEL_UP);
        
        // Show level up UI
        this.showLevelUpUI();
    }

    /**
     * Generate level up options
     * @private
     */
    generateLevelUpOptions() {
        const options = [];
        
        // Get player's current weapons
        const weaponSystem = this.getSystem('weapon');
        const playerWeapons = weaponSystem ? weaponSystem.getPlayerWeapons(this.playerEntity) : [];
        
        // Weapon upgrades
        for (const weapon of playerWeapons) {
            if (weapon.canUpgrade()) {
                options.push({
                    type: 'weapon_upgrade',
                    weaponId: weapon.id,
                    name: `${weapon.name} (Level ${weapon.level + 1})`,
                    description: weapon.getUpgradeDescription()
                });
            }
        }
        
        // New weapons (if player has slots)
        const maxWeapons = Config.get('player.maxWeapons');
        if (playerWeapons.length < maxWeapons) {
            for (const weaponType of this.availableWeapons) {
                if (!playerWeapons.some(w => w.type === weaponType)) {
                    options.push({
                        type: 'new_weapon',
                        weaponType: weaponType,
                        name: `New ${weaponType}`,
                        description: `Acquire ${weaponType} weapon`
                    });
                }
            }
        }
        
        // Stat upgrades
        const statUpgrades = [
            { stat: 'damage', name: 'Damage +20%', description: 'Increase weapon damage' },
            { stat: 'speed', name: 'Speed +15%', description: 'Move faster' },
            { stat: 'health', name: 'Max Health +25%', description: 'Increase maximum health' },
            { stat: 'area', name: 'Area +15%', description: 'Increase weapon area' },
            { stat: 'cooldown', name: 'Cooldown -10%', description: 'Weapons fire faster' }
        ];
        
        options.push(...statUpgrades.map(upgrade => ({
            type: 'stat_upgrade',
            stat: upgrade.stat,
            name: upgrade.name,
            description: upgrade.description
        })));
        
        // Randomly select 3-4 options
        this.levelUpOptions = options
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(options.length, 3 + Math.floor(Math.random() * 2)));
    }

    /**
     * Show level up UI
     * @private
     */
    showLevelUpUI() {
        const levelUpScreen = this.uiElements.get('levelUp');
        const optionsContainer = document.getElementById('level-up-options');
        
        // Clear existing options
        optionsContainer.innerHTML = '';
        
        // Create option buttons
        this.levelUpOptions.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'menu-button';
            button.style.cssText += `
                text-align: left;
                width: 100%;
                padding: 20px;
                margin: 5px 0;
            `;
            
            button.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
                    ${index + 1}. ${option.name}
                </div>
                <div style="font-size: 14px; opacity: 0.8;">
                    ${option.description}
                </div>
            `;
            
            button.addEventListener('click', () => {
                this.emit('levelUpOptionSelected', { optionIndex: index });
            });
            
            optionsContainer.appendChild(button);
        });
        
        levelUpScreen.style.display = 'block';
    }

    /**
     * Handle level up option selection
     * @param {object} event - Selection event data
     */
    onLevelUpOptionSelected(event) {
        const option = this.levelUpOptions[event.optionIndex];
        if (!option) return;
        
        Logger.info('Level up option selected', option);
        
        // Apply the selected upgrade
        this.applyLevelUpOption(option);
        
        // Hide level up UI
        this.uiElements.get('levelUp').style.display = 'none';
        
        // Resume game
        this.setState(GameState.PLAYING);
    }

    /**
     * Apply level up option
     * @param {object} option - Selected option
     * @private
     */
    applyLevelUpOption(option) {
        const weaponSystem = this.getSystem('weapon');
        
        switch (option.type) {
            case 'weapon_upgrade':
                if (weaponSystem) {
                    weaponSystem.upgradeWeapon(this.playerEntity, option.weaponId);
                }
                break;
                
            case 'new_weapon':
                if (weaponSystem) {
                    weaponSystem.givePlayerWeapon(this.playerEntity, option.weaponType);
                }
                break;
                
            case 'stat_upgrade':
                this.applyStatUpgrade(option.stat);
                break;
        }
        
        // Visual feedback
        this.createLevelUpEffects();
    }

    /**
     * Apply stat upgrade to player
     * @param {string} stat - Stat to upgrade
     * @private
     */
    applyStatUpgrade(stat) {
        // This would be implemented based on how stats are stored in components
        // For now, this is a placeholder showing the pattern
        Logger.debug(`Applied stat upgrade: ${stat}`);
    }

    /**
     * Create level up visual effects
     * @private
     */
    createLevelUpEffects() {
        const particleSystem = this.getSystem('particle');
        if (particleSystem && this.playerEntity) {
            const transform = this.playerEntity.getComponent('transform');
            if (transform) {
                // Create level up particle effect
                particleSystem.createLevelUpEffect(transform.x, transform.y);
            }
        }
        
        // Camera flash
        this.camera.flash('#FFD700', 0.5);
        
        // Camera shake
        this.camera.shake(5, 0.3);
    }

    /**
     * Handle player death
     * @param {object} event - Death event data
     */
    onPlayerDied(event) {
        Logger.info('Player died', event);
        
        this.setState(GameState.GAME_OVER);
        this.showGameOverUI();
    }

    /**
     * Show game over UI
     * @private
     */
    showGameOverUI() {
        // Update final stats
        document.getElementById('final-level').textContent = this.playerLevel;
        document.getElementById('final-time').textContent = this.formatTime(this.gameTime);
        document.getElementById('final-kills').textContent = this.killCount;
        document.getElementById('final-score').textContent = this.score;
        
        // Check for high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('vs_highscore', this.highScore.toString());
            document.getElementById('new-high-score').style.display = 'block';
        }
        
        // Show game over screen
        this.uiElements.get('gameOver').style.display = 'block';
    }

    /**
     * Handle enemy killed
     * @param {object} event - Enemy killed event data
     */
    onEnemyKilled(event) {
        this.killCount++;
        this.score += event.scoreValue || 10;
        
        // Update UI
        this.updateScoreDisplay();
    }

    /**
     * Handle enemy spawned
     * @param {object} event - Enemy spawned event data
     */
    onEnemySpawned(event) {
        // Handle enemy spawn logic if needed
    }

    /**
     * Handle wave completed
     * @param {object} event - Wave completed event data
     */
    onWaveCompleted(event) {
        this.waveNumber = event.waveNumber;
        Logger.info(`Wave ${this.waveNumber} completed`);
        
        // Visual feedback
        this.showWaveNotification(this.waveNumber);
    }

    /**
     * Show wave notification
     * @param {number} waveNumber - Wave number
     * @private
     */
    showWaveNotification(waveNumber) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #FFD700;
            font-size: 48px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 2000;
            pointer-events: none;
            animation: waveNotification 2s ease-out forwards;
        `;
        notification.textContent = `WAVE ${waveNumber}`;
        
        // Add CSS animation
        if (!document.getElementById('wave-notification-style')) {
            const style = document.createElement('style');
            style.id = 'wave-notification-style';
            style.textContent = `
                @keyframes waveNotification {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
        
        // Camera effects
        this.camera.flash('#FFD700', 0.3);
        this.camera.shake(8, 0.4);
    }

    /**
     * Handle game restart
     */
    onGameRestart() {
        Logger.info('Restarting game');
        
        // Hide all UI screens
        this.hideAllUIScreens();
        
        // Start new game
        this.startGame();
    }

    /**
     * Handle return to menu
     */
    onReturnToMenu() {
        Logger.info('Returning to menu');
        
        // Hide all UI screens
        this.hideAllUIScreens();
        
        // Show menu
        this.uiElements.get('menu').style.display = 'flex';
        
        // Set state
        this.setState(GameState.MENU);
    }

    /**
     * Hide all UI screens
     * @private
     */
    hideAllUIScreens() {
        this.uiElements.get('hud').style.display = 'none';
        this.uiElements.get('menu').style.display = 'none';
        this.uiElements.get('levelUp').style.display = 'none';
        this.uiElements.get('gameOver').style.display = 'none';
        this.uiElements.get('pause').style.display = 'none';
    }

    /**
     * Update game loop - called every frame
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        super.update(deltaTime);
        
        if (this.state === GameState.PLAYING) {
            // Update survival time
            this.survivalTime += deltaTime;
            
            // Update UI periodically
            if (this.frameCount % 30 === 0) { // Every 30 frames
                this.updateGameUI();
            }
        }
    }

    /**
     * Update game UI elements
     * @private
     */
    updateGameUI() {
        if (!this.playerEntity) return;
        
        const healthComponent = this.playerEntity.getComponent('health');
        if (healthComponent) {
            document.getElementById('player-health').textContent = Math.ceil(healthComponent.health);
            document.getElementById('player-max-health').textContent = healthComponent.maxHealth;
        }
        
        // Update other UI elements
        document.getElementById('player-level').textContent = this.playerLevel;
        document.getElementById('current-wave').textContent = this.waveNumber;
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('survival-time').textContent = this.formatTime(this.survivalTime);
        
        // Update enemy count
        const enemySystem = this.getSystem('enemyAI');
        if (enemySystem) {
            document.getElementById('enemy-count').textContent = enemySystem.getActiveEnemyCount() || 0;
        }
        
        // Update debug info if visible
        if (Config.get('debug.showPerformanceMetrics')) {
            const stats = this.getPerformanceMetrics();
            document.getElementById('fps-counter').textContent = stats.fps;
            document.getElementById('entity-count').textContent = stats.entityCount;
        }
    }

    /**
     * Update score display
     * @private
     */
    updateScoreDisplay() {
        document.getElementById('current-score').textContent = this.score;
    }

    /**
     * Format time for display
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     * @private
     */
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Handle entering paused state
     * @private
     */
    onEnterPaused() {
        super.onEnterPaused();
        this.uiElements.get('pause').style.display = 'block';
    }

    /**
     * Handle exiting paused state
     * @private
     */
    onExitPaused() {
        super.onExitPaused();
        this.uiElements.get('pause').style.display = 'none';
    }

    /**
     * Load game preferences from storage
     * @private
     */
    loadGamePreferences() {
        try {
            const preferences = localStorage.getItem('vs_preferences');
            if (preferences) {
                const prefs = JSON.parse(preferences);
                
                // Apply loaded preferences to config
                if (prefs.volume !== undefined) {
                    Config.set('audio.masterVolume', prefs.volume);
                }
                
                if (prefs.difficulty !== undefined) {
                    this.difficulty = prefs.difficulty;
                }
                
                Logger.debug('Game preferences loaded', prefs);
            }
        } catch (error) {
            Logger.warn('Failed to load game preferences', { error: error.message });
        }
    }

    /**
     * Save game preferences to storage
     * @private
     */
    saveGamePreferences() {
        try {
            const preferences = {
                volume: Config.get('audio.masterVolume'),
                difficulty: this.difficulty,
                timestamp: Date.now()
            };
            
            localStorage.setItem('vs_preferences', JSON.stringify(preferences));
            Logger.debug('Game preferences saved', preferences);
            
        } catch (error) {
            Logger.warn('Failed to save game preferences', { error: error.message });
        }
    }

    /**
     * Get game statistics
     * @returns {object} Game statistics
     */
    getGameStats() {
        return {
            score: this.score,
            highScore: this.highScore,
            level: this.playerLevel,
            killCount: this.killCount,
            survivalTime: this.survivalTime,
            waveNumber: this.waveNumber,
            gameTime: this.gameTime
        };
    }

    /**
     * Cleanup game resources
     */
    cleanup() {
        // Save preferences before cleanup
        this.saveGamePreferences();
        
        // Cleanup UI elements
        const container = this.uiElements.get('container');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        this.uiElements.clear();
        
        // Cleanup entity factory
        if (this.entityFactory) {
            this.entityFactory.cleanup();
        }
        
        // Call parent cleanup
        super.cleanup();
        
        Logger.info('Vampire Survivors Game cleanup complete');
    }
}

/**
 * Game factory for creating Vampire Survivors instances
 */
export class VampireSurvivorsGameFactory {
    /**
     * Create a new Vampire Survivors game instance
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} dependencies - Game dependencies
     * @returns {VampireSurvivorsGame} Game instance
     */
    static create(canvas, dependencies = {}) {
        Logger.info('Creating Vampire Survivors game instance');
        
        try {
            const game = new VampireSurvivorsGame(canvas, dependencies);
            
            Logger.info('Vampire Survivors game instance created successfully');
            return game;
            
        } catch (error) {
            Logger.error('Failed to create Vampire Survivors game instance', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Create a debug-enabled game instance
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} dependencies - Game dependencies
     * @returns {VampireSurvivorsGame} Debug-enabled game instance
     */
    static createDebug(canvas, dependencies = {}) {
        // Enable debug configuration
        Config.set('debug.showPerformanceMetrics', true);
        Config.set('debug.showBounds', true);
        Config.set('game.debugMode', true);
        
        return VampireSurvivorsGameFactory.create(canvas, dependencies);
    }
}