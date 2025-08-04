/**
 * Vampire Survivors - Modern Game Bootstrap
 * 
 * Entry point for the refactored Vampire Survivors game showcasing
 * professional browser game architecture with ECS, dependency injection,
 * and modern JavaScript patterns.
 * 
 * @author Game Architecture Specialist
 * @version 2.0.0
 */

import { VampireSurvivorsGameFactory } from './VampireSurvivorsGame.js';
import { Config } from './core/ConfigManager.js';
import { Logger, GlobalErrorHandler } from './core/ErrorHandler.js';

/**
 * Simple Input Manager for demonstration
 */
class SimpleInputManager {
    constructor() {
        this.keys = new Set();
        this.mouse = { x: 0, y: 0, pressed: false };
        this.listeners = new Map();
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
            this.emit('keyDown', e.key);
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
            this.emit('keyUp', e.key);
        });
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.emit('mouseMove', this.mouse);
        });
        
        window.addEventListener('click', (e) => {
            this.emit('click', { x: e.clientX, y: e.clientY });
        });
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
    
    isPressed(key) {
        return this.keys.has(key.toLowerCase());
    }
}

/**
 * Mock Audio Manager for demonstration
 */
class MockAudioManager {
    constructor() {
        this.enabled = Config.get('audio.enableAudio');
        this.masterVolume = Config.get('audio.masterVolume');
        
        Logger.debug('MockAudioManager initialized', {
            enabled: this.enabled,
            masterVolume: this.masterVolume
        });
    }
    
    playSound(soundId, volume = 1.0, pitch = 1.0) {
        if (!this.enabled) return;
        
        Logger.debug(`Playing sound: ${soundId}`, { volume, pitch });
        // In a real implementation, this would play actual audio
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        Config.set('audio.masterVolume', this.masterVolume);
    }
    
    stopAll() {
        Logger.debug('Stopping all audio');
    }
}

/**
 * Game Bootstrap Class
 */
class GameBootstrap {
    constructor() {
        this.canvas = null;
        this.game = null;
        this.inputManager = null;
        this.audioManager = null;
    }
    
    /**
     * Initialize and start the game
     */
    async init() {
        try {
            Logger.info('🎮 Initializing Vampire Survivors (ECS Architecture Demo)');
            
            // Set up canvas
            this.setupCanvas();
            
            // Create dependencies
            this.createDependencies();
            
            // Load configuration
            this.loadConfiguration();
            
            // Create game instance
            this.createGame();
            
            // Start the game
            this.startGame();
            
            Logger.info('✅ Game initialization complete');
            
        } catch (error) {
            Logger.error('❌ Failed to initialize game', { error: error.message });
            this.showErrorMessage('Failed to initialize game: ' + error.message);
        }
    }
    
    /**
     * Set up game canvas
     */
    setupCanvas() {
        // Try to find existing canvas
        this.canvas = document.getElementById('gameCanvas');
        
        if (!this.canvas) {
            // Create canvas if it doesn't exist
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            this.canvas.width = 800;
            this.canvas.height = 600;
            this.canvas.style.cssText = `
                border: 2px solid #4A90E2;
                background: #000;
                display: block;
                margin: 20px auto;
            `;
            
            document.body.appendChild(this.canvas);
        }
        
        // Set canvas dimensions
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        Logger.debug('Canvas set up', {
            width: this.canvas.width,
            height: this.canvas.height
        });
    }
    
    /**
     * Create game dependencies
     */
    createDependencies() {
        // Create input manager
        this.inputManager = new SimpleInputManager();
        
        // Create audio manager
        this.audioManager = new MockAudioManager();
        
        Logger.debug('Dependencies created');
    }
    
    /**
     * Load game configuration
     */
    loadConfiguration() {
        // Load configuration from URL parameters
        Config.loadFromURLParams();
        
        // Set up development configuration if in debug mode
        if (window.location.search.includes('debug')) {
            Logger.info('🔧 Debug mode enabled');
            Config.set('debug.showPerformanceMetrics', true);
            Config.set('debug.logLevel', 'debug');
            Config.set('game.debugMode', true);
        }
        
        Logger.debug('Configuration loaded', {
            environment: Config.detectEnvironment(),
            debugMode: Config.get('game.debugMode')
        });
    }
    
    /**
     * Create game instance
     */
    createGame() {
        const dependencies = {
            inputManager: this.inputManager,
            audioManager: this.audioManager
        };
        
        // Create game instance
        if (Config.get('game.debugMode')) {
            this.game = VampireSurvivorsGameFactory.createDebug(this.canvas, dependencies);
        } else {
            this.game = VampireSurvivorsGameFactory.create(this.canvas, dependencies);
        }
        
        // Set up global debug access
        if (Config.get('debug.enableConsoleCommands')) {
            window.game = this.game;
            window.gameConfig = Config;
            window.gameLogger = Logger;
            
            Logger.info('🛠️ Debug console access enabled');
            Logger.info('Available: window.game, window.gameConfig, window.gameLogger');
        }
    }
    
    /**
     * Start the game
     */
    startGame() {
        // Set up error recovery
        this.setupErrorRecovery();
        
        // Start game engine
        this.game.start();
        
        Logger.info('🚀 Game started successfully');
        
        // Show instructions
        this.showInstructions();
    }
    
    /**
     * Set up error recovery mechanisms
     */
    setupErrorRecovery() {
        // Listen for critical errors
        window.addEventListener('criticalError', (event) => {
            Logger.fatal('Critical error detected', event.detail);
            this.handleCriticalError(event.detail);
        });
        
        // Set up performance monitoring
        setInterval(() => {
            if (this.game) {
                const stats = this.game.getPerformanceMetrics();
                
                if (stats.fps < 30) {
                    Logger.warn('Performance degradation detected', stats);
                    this.handlePerformanceIssue(stats);
                }
            }
        }, 5000);
    }
    
    /**
     * Handle critical errors
     */
    handleCriticalError(errorInfo) {
        Logger.error('Handling critical error', errorInfo);
        
        // Try to save game state
        try {
            const gameState = this.game?.getGameStats();
            if (gameState) {
                localStorage.setItem('vs_crash_recovery', JSON.stringify({
                    ...gameState,
                    timestamp: Date.now(),
                    error: errorInfo
                }));
            }
        } catch (saveError) {
            Logger.error('Failed to save crash recovery data', { error: saveError.message });
        }
    }
    
    /**
     * Handle performance issues
     */
    handlePerformanceIssue(stats) {
        // Automatically reduce quality settings
        if (stats.fps < 20) {
            Config.set('rendering.particleLimit', Math.max(10, Config.get('rendering.particleLimit') * 0.5));
            Config.set('rendering.backgroundComplexity', 'low');
            Logger.info('Automatically reduced graphics quality due to low FPS');
        }
    }
    
    /**
     * Show game instructions
     */
    showInstructions() {
        const instructions = document.createElement('div');
        instructions.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
            max-width: 250px;
        `;
        
        instructions.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4A90E2;">🧛 Vampire Survivors ECS</h3>
            <div style="margin-bottom: 8px;"><strong>WASD:</strong> Move</div>
            <div style="margin-bottom: 8px;"><strong>ESC:</strong> Pause</div>
            <div style="margin-bottom: 8px;"><strong>F1:</strong> Debug Info</div>
            <div style="margin-bottom: 8px;"><strong>F2:</strong> Performance</div>
            <div style="margin-bottom: 12px;"><strong>Space:</strong> Start Game</div>
            <div style="font-size: 12px; opacity: 0.7;">
                Professional ECS Architecture Demo<br>
                ${Config.get('game.debugMode') ? '🔧 Debug Mode Active' : ''}
            </div>
        `;
        
        document.body.appendChild(instructions);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (instructions.parentNode) {
                instructions.remove();
            }
        }, 10000);
    }
    
    /**
     * Show error message to user
     */
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #8B0000;
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <h2>⚠️ Error</h2>
            <p>${message}</p>
            <button onclick="window.location.reload()" style="
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin-top: 15px;
            ">Reload Page</button>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        if (this.game) {
            this.game.cleanup();
        }
        
        Logger.info('Game cleanup complete');
    }
}

/**
 * Initialize game when page loads
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Set up page styles
    document.body.style.cssText = `
        margin: 0;
        padding: 0;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        color: white;
        font-family: 'Segoe UI', Arial, sans-serif;
        overflow: hidden;
    `;
    
    // Add title
    const title = document.createElement('h1');
    title.style.cssText = `
        text-align: center;
        margin: 20px 0;
        color: #4A90E2;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    `;
    title.textContent = '🧛 Vampire Survivors - ECS Architecture Demo';
    document.body.appendChild(title);
    
    // Initialize game
    const bootstrap = new GameBootstrap();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        bootstrap.cleanup();
    });
    
    // Start the game
    await bootstrap.init();
});

// Export for module access
export { GameBootstrap };
