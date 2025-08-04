/**
 * Game Engine - Professional ECS-based Game Architecture
 * 
 * Modern, scalable game engine built on Entity-Component-System architecture
 * with clean separation of concerns, dependency injection, and professional
 * error handling. Designed to showcase best practices in browser game development.
 * 
 * Key Features:
 * - ECS Architecture with proper data-oriented design
 * - Configuration-driven development
 * - Comprehensive error handling and recovery
 * - Performance monitoring and adaptive optimization
 * - Clean module boundaries and dependency injection
 * - Professional logging and debugging tools
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { World, System } from './ECS.js';
import { Config } from './ConfigManager.js';
import { GlobalErrorHandler, Logger, ErrorCategory, ErrorHandling } from './ErrorHandler.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';

/**
 * Game State Management
 */
export const GameState = {
    INITIALIZING: 'initializing',
    MENU: 'menu',
    LOADING: 'loading',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_UP: 'levelUp',
    GAME_OVER: 'gameOver',
    ERROR: 'error'
};

/**
 * Game Events for loose coupling between systems
 */
export const GameEvents = {
    STATE_CHANGED: 'stateChanged',
    PLAYER_LEVELED_UP: 'playerLeveledUp',
    PLAYER_DIED: 'playerDied',
    ENEMY_SPAWNED: 'enemySpawned',
    ENEMY_KILLED: 'enemyKilled',
    WAVE_COMPLETED: 'waveCompleted',
    PERFORMANCE_WARNING: 'performanceWarning',
    CONFIG_CHANGED: 'configChanged'
};

/**
 * Core Game Engine class
 * 
 * Orchestrates all game systems using ECS architecture with proper
 * separation of concerns and dependency injection.
 */
export class GameEngine {
    /**
     * Initialize the game engine
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} dependencies - Injected dependencies
     */
    constructor(canvas, dependencies = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Validate canvas context
        if (!this.ctx) {
            throw new Error('Failed to get 2D rendering context');
        }

        // Initialize core components
        this.world = new World();
        this.state = GameState.INITIALIZING;
        this.previousState = null;
        this.gameTime = 0;
        this.deltaTime = 0;
        this.timeScale = 1.0;
        
        // Dependency injection
        this.inputManager = dependencies.inputManager;
        this.audioManager = dependencies.audioManager;
        this.assetManager = dependencies.assetManager;
        
        // Core subsystems
        this.camera = new Camera(canvas.width, canvas.height);
        this.renderer = new Renderer(canvas, this.ctx);
        
        // Performance monitoring
        this.performanceMonitor = {
            frameCount: 0,
            lastFrameTime: 0,
            averageFrameTime: 16.67, // Target 60 FPS
            frameTimeHistory: [],
            performanceWarningThreshold: 33.33, // 30 FPS warning
            lastPerformanceReport: 0
        };

        // Game loop control
        this.running = false;
        this.lastTime = 0;
        this.animationFrameId = null;

        // Event system for loose coupling
        this.eventHandlers = new Map();

        // System registry for dynamic system management
        this.systemRegistry = new Map();
        
        // Initialize engine
        this.initialize();
    }

    /**
     * Initialize the game engine
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    initialize() {
        Logger.info('Initializing Game Engine');

        try {
            // Set up error handling for this engine instance
            this.setupErrorHandling();
            
            // Set up configuration listeners
            this.setupConfigurationListeners();
            
            // Initialize core systems
            this.initializeCoreComponents();
            
            // Set up input handling
            this.setupInputHandling();
            
            // Register default systems
            this.registerDefaultSystems();
            
            // Initialize UI
            this.initializeUI();
            
            this.setState(GameState.MENU);
            Logger.info('Game Engine initialization complete');
            
        } catch (error) {
            Logger.fatal('Game Engine initialization failed', { error: error.message });
            this.setState(GameState.ERROR);
            throw error;
        }
    }

    /**
     * Set up error handling specific to this engine instance
     * @private
     */
    setupErrorHandling() {
        // Register game-specific error handlers
        GlobalErrorHandler.registerErrorHandler(ErrorCategory.RENDERING, (error, context, recovery) => {
            Logger.warn('Rendering error detected', { error: error.message, recovery });
            
            if (!recovery.recovered) {
                // Fallback to low-quality rendering
                Config.set('rendering.backgroundComplexity', 'low');
                Config.set('rendering.particleLimit', 50);
            }
        });

        GlobalErrorHandler.registerErrorHandler(ErrorCategory.PERFORMANCE, (error, context, recovery) => {
            this.emit(GameEvents.PERFORMANCE_WARNING, { error, context, recovery });
            
            // Adaptive performance settings
            this.adaptPerformanceSettings(context.metrics);
        });

        // Monitor critical errors
        window.addEventListener('criticalError', (event) => {
            Logger.fatal('Critical error state reached', event.detail);
            this.setState(GameState.ERROR);
            this.showCriticalErrorUI(event.detail);
        });
    }

    /**
     * Set up configuration change listeners
     * @private
     */
    setupConfigurationListeners() {
        // Listen for performance-related config changes
        Config.addListener('performance.*', (value, path) => {
            Logger.debug(`Performance config changed: ${path} = ${value}`);
            this.emit(GameEvents.CONFIG_CHANGED, { path, value });
        });

        // Listen for rendering config changes
        Config.addListener('rendering.*', (value, path) => {
            Logger.debug(`Rendering config changed: ${path} = ${value}`);
            this.renderer?.updateConfig?.(Config.getSection('rendering'));
        });

        // Listen for debug config changes
        Config.addListener('debug.*', (value, path) => {
            if (path === 'debug.logLevel') {
                Logger.setLevel(value);
            }
        });
    }

    /**
     * Initialize core engine components
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    initializeCoreComponents() {
        // Configure camera
        const cameraConfig = Config.getSection('rendering.camera');
        this.camera.configure(cameraConfig);

        // Configure renderer
        const renderingConfig = Config.getSection('rendering');
        this.renderer.configure(renderingConfig);

        // Set up performance monitoring
        this.setupPerformanceMonitoring();

        Logger.debug('Core components initialized');
    }

    /**
     * Set up performance monitoring
     * @private
     */
    setupPerformanceMonitoring() {
        const perfConfig = Config.getSection('performance');
        
        this.performanceMonitor.performanceWarningThreshold = 1000 / perfConfig.lowQualityThreshold;
        this.performanceMonitor.reportInterval = perfConfig.performanceReportInterval;
    }

    /**
     * Set up input handling
     * @private
     */
    setupInputHandling() {
        if (!this.inputManager) {
            Logger.warn('No input manager provided, input will be disabled');
            return;
        }

        // Global input handlers
        this.inputManager.on('keyDown', this.handleGlobalKeyDown.bind(this));
        this.inputManager.on('keyUp', this.handleGlobalKeyUp.bind(this));
        
        Logger.debug('Input handling initialized');
    }

    /**
     * Handle global key down events
     * @param {string} key - Key that was pressed
     * @private
     */
    handleGlobalKeyDown(key) {
        switch (key.toLowerCase()) {
            case 'escape':
                this.handleEscapeKey();
                break;
            case 'f1':
                this.toggleDebugInfo();
                break;
            case 'f2':
                this.togglePerformanceMonitor();
                break;
            case 'f3':
                Config.set('debug.showBounds', !Config.get('debug.showBounds'));
                break;
            case 'pause':
            case 'p':
                if (this.state === GameState.PLAYING) {
                    this.pauseGame();
                } else if (this.state === GameState.PAUSED) {
                    this.resumeGame();
                }
                break;
        }
    }

    /**
     * Handle global key up events
     * @param {string} key - Key that was released
     * @private
     */
    handleGlobalKeyUp(key) {
        // Handle key release events if needed
    }

    /**
     * Handle escape key press
     * @private
     */
    handleEscapeKey() {
        switch (this.state) {
            case GameState.PLAYING:
                this.pauseGame();
                break;
            case GameState.PAUSED:
                this.resumeGame();
                break;
            case GameState.LEVEL_UP:
                // Don't allow escaping from level up
                break;
            case GameState.MENU:
                // Could open settings or quit confirmation
                break;
        }
    }

    /**
     * Toggle debug information display
     * @private
     */
    toggleDebugInfo() {
        const current = Config.get('debug.showPerformanceMetrics');
        Config.set('debug.showPerformanceMetrics', !current);
        Logger.info(`Debug info ${!current ? 'enabled' : 'disabled'}`);
    }

    /**
     * Toggle performance monitor display
     * @private
     */
    togglePerformanceMonitor() {
        const current = Config.get('game.showPerformanceStats');
        Config.set('game.showPerformanceStats', !current);
        Logger.info(`Performance monitor ${!current ? 'enabled' : 'disabled'}`);
    }

    /**
     * Register default game systems
     * @private
     */
    registerDefaultSystems() {
        // Systems will be registered by the game implementation
        // This allows for flexible system composition
        Logger.debug('Default systems registration complete');
    }

    /**
     * Initialize user interface
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    initializeUI() {
        // UI initialization will be handled by specific game implementations
        // This provides a hook for game-specific UI setup
        Logger.debug('UI initialization complete');
    }

    /**
     * Register a system with the engine
     * @param {string} name - System name
     * @param {System} system - System instance
     * @param {object} config - System configuration
     */
    registerSystem(name, system, config = {}) {
        if (!(system instanceof System)) {
            throw new Error(`System '${name}' must extend System class`);
        }

        // Store system configuration
        this.systemRegistry.set(name, {
            system,
            config,
            enabled: config.enabled !== false
        });

        // Add to ECS world if enabled
        if (config.enabled !== false) {
            this.world.addSystem(system);
            Logger.debug(`System '${name}' registered and enabled`);
        } else {
            Logger.debug(`System '${name}' registered but disabled`);
        }
    }

    /**
     * Get a registered system by name
     * @param {string} name - System name
     * @returns {System|null} System instance or null
     */
    getSystem(name) {
        const entry = this.systemRegistry.get(name);
        return entry ? entry.system : null;
    }

    /**
     * Enable a system
     * @param {string} name - System name
     */
    enableSystem(name) {
        const entry = this.systemRegistry.get(name);
        if (entry && !entry.enabled) {
            entry.enabled = true;
            this.world.addSystem(entry.system);
            Logger.info(`System '${name}' enabled`);
        }
    }

    /**
     * Disable a system
     * @param {string} name - System name
     */
    disableSystem(name) {
        const entry = this.systemRegistry.get(name);
        if (entry && entry.enabled) {
            entry.enabled = false;
            this.world.removeSystem(entry.system);
            Logger.info(`System '${name}' disabled`);
        }
    }

    /**
     * Set the game state
     * @param {string} newState - New game state
     */
    setState(newState) {
        if (this.state === newState) return;

        const oldState = this.state;
        this.previousState = oldState;
        this.state = newState;

        Logger.info(`Game state changed: ${oldState} -> ${newState}`);

        // Handle state transitions
        this.onStateExit(oldState);
        this.onStateEnter(newState);

        // Emit state change event
        this.emit(GameEvents.STATE_CHANGED, {
            oldState,
            newState,
            timestamp: performance.now()
        });
    }

    /**
     * Handle state exit
     * @param {string} state - State being exited
     * @private
     */
    onStateExit(state) {
        switch (state) {
            case GameState.PLAYING:
                this.onExitPlaying();
                break;
            case GameState.PAUSED:
                this.onExitPaused();
                break;
        }
    }

    /**
     * Handle state entry
     * @param {string} state - State being entered
     * @private
     */
    onStateEnter(state) {
        switch (state) {
            case GameState.MENU:
                this.onEnterMenu();
                break;
            case GameState.PLAYING:
                this.onEnterPlaying();
                break;
            case GameState.PAUSED:
                this.onEnterPaused();
                break;
            case GameState.LEVEL_UP:
                this.onEnterLevelUp();
                break;
            case GameState.GAME_OVER:
                this.onEnterGameOver();
                break;
            case GameState.ERROR:
                this.onEnterError();
                break;
        }
    }

    /**
     * Handle entering menu state
     * @private
     */
    onEnterMenu() {
        this.timeScale = 0;
        // Menu-specific logic
    }

    /**
     * Handle entering playing state
     * @private
     */
    onEnterPlaying() {
        this.timeScale = 1.0;
        // Playing-specific logic
    }

    /**
     * Handle exiting playing state
     * @private
     */
    onExitPlaying() {
        // Save game state if needed
    }

    /**
     * Handle entering paused state
     * @private
     */
    onEnterPaused() {
        this.timeScale = 0;
        // Pause-specific logic
    }

    /**
     * Handle exiting paused state
     * @private
     */
    onExitPaused() {
        this.timeScale = 1.0;
        // Resume-specific logic
    }

    /**
     * Handle entering level up state
     * @private
     */
    onEnterLevelUp() {
        this.timeScale = 0;
        // Level up-specific logic
    }

    /**
     * Handle entering game over state
     * @private
     */
    onEnterGameOver() {
        this.timeScale = 0;
        // Game over-specific logic
    }

    /**
     * Handle entering error state
     * @private
     */
    onEnterError() {
        this.timeScale = 0;
        // Error state logic
    }

    /**
     * Start the game
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    start() {
        if (this.running) {
            Logger.warn('Game engine is already running');
            return;
        }

        Logger.info('Starting game engine');
        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    /**
     * Stop the game
     */
    stop() {
        Logger.info('Stopping game engine');
        this.running = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Pause the game
     */
    pauseGame() {
        if (this.state === GameState.PLAYING) {
            this.setState(GameState.PAUSED);
        }
    }

    /**
     * Resume the game
     */
    resumeGame() {
        if (this.state === GameState.PAUSED) {
            this.setState(GameState.PLAYING);
        }
    }

    /**
     * Main game loop
     * @private
     */
    @ErrorHandling.timed('gameLoop')
    gameLoop = () => {
        if (!this.running) return;

        const currentTime = performance.now();
        
        // Calculate delta time with clamping
        const rawDeltaTime = (currentTime - this.lastTime) / 1000;
        this.deltaTime = Math.max(0.001, Math.min(rawDeltaTime, 0.033)); // Clamp between 1ms and 33ms
        this.lastTime = currentTime;

        // Apply time scale
        const scaledDeltaTime = this.deltaTime * this.timeScale;

        // Update game time
        if (this.state === GameState.PLAYING) {
            this.gameTime += scaledDeltaTime;
        }

        // Update performance monitoring
        this.updatePerformanceMonitoring(currentTime);

        // Update systems
        this.update(scaledDeltaTime);

        // Render frame
        this.render();

        // Schedule next frame
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    };

    /**
     * Update all systems
     * @param {number} deltaTime - Scaled delta time
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    update(deltaTime) {
        Logger.startPerformanceMark('update');

        try {
            // Update ECS world
            this.world.update(deltaTime);

            // Update camera
            this.camera.update(deltaTime);

            // Process events
            this.processEvents();

        } finally {
            Logger.endPerformanceMark('update');
        }
    }

    /**
     * Render the game
     * @private
     */
    @ErrorHandling.safe(ErrorCategory.RENDERING)
    render() {
        Logger.startPerformanceMark('render');

        try {
            // Clear canvas
            this.renderer.clear();

            // Render world through ECS
            this.world.render(this.ctx, this.camera);

            // Render UI overlays
            this.renderUI();

            // Render debug information
            if (Config.get('debug.showPerformanceMetrics')) {
                this.renderDebugInfo();
            }

        } finally {
            Logger.endPerformanceMark('render');
        }
    }

    /**
     * Render UI elements
     * @private
     */
    renderUI() {
        // UI rendering will be implemented by specific game classes
        // This provides a hook for game-specific UI rendering
    }

    /**
     * Render debug information
     * @private
     */
    renderDebugInfo() {
        const ctx = this.ctx;
        const stats = this.getEngineStats();

        ctx.save();
        ctx.resetTransform();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 120);

        ctx.fillStyle = '#00FF00';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${stats.fps}`, 15, 25);
        ctx.fillText(`Frame Time: ${stats.frameTime.toFixed(2)}ms`, 15, 40);
        ctx.fillText(`Entities: ${stats.entityCount}`, 15, 55);
        ctx.fillText(`Systems: ${stats.systemCount}`, 15, 70);
        ctx.fillText(`Memory: ${stats.memoryUsage}MB`, 15, 85);
        ctx.fillText(`State: ${this.state}`, 15, 100);
        ctx.fillText(`Game Time: ${this.gameTime.toFixed(1)}s`, 15, 115);

        ctx.restore();
    }

    /**
     * Process queued events
     * @private
     */
    processEvents() {
        // Event processing implementation
        // This can be used for deferred event handling
    }

    /**
     * Update performance monitoring
     * @param {number} currentTime - Current time
     * @private
     */
    updatePerformanceMonitoring(currentTime) {
        this.performanceMonitor.frameCount++;
        
        const frameTime = this.deltaTime * 1000; // Convert to milliseconds
        this.performanceMonitor.lastFrameTime = frameTime;
        
        // Update frame time history
        this.performanceMonitor.frameTimeHistory.push(frameTime);
        if (this.performanceMonitor.frameTimeHistory.length > 60) {
            this.performanceMonitor.frameTimeHistory.shift();
        }
        
        // Calculate average frame time
        if (this.performanceMonitor.frameTimeHistory.length > 0) {
            const sum = this.performanceMonitor.frameTimeHistory.reduce((a, b) => a + b, 0);
            this.performanceMonitor.averageFrameTime = sum / this.performanceMonitor.frameTimeHistory.length;
        }
        
        // Check for performance issues
        if (frameTime > this.performanceMonitor.performanceWarningThreshold) {
            GlobalErrorHandler.handleError(
                new Error(`Performance warning: Frame time ${frameTime.toFixed(2)}ms`),
                { 
                    category: ErrorCategory.PERFORMANCE,
                    metrics: this.getPerformanceMetrics()
                }
            );
        }
        
        // Periodic performance reporting
        if (currentTime - this.performanceMonitor.lastPerformanceReport > Config.get('performance.performanceReportInterval')) {
            this.reportPerformance();
            this.performanceMonitor.lastPerformanceReport = currentTime;
        }
    }

    /**
     * Report performance metrics
     * @private
     */
    reportPerformance() {
        const metrics = this.getPerformanceMetrics();
        
        if (metrics.fps < 45 || metrics.entityCount > Config.get('performance.criticalEntityThreshold')) {
            Logger.warn('Performance issue detected', metrics);
        } else {
            Logger.debug('Performance report', metrics);
        }
    }

    /**
     * Adapt performance settings based on current performance
     * @param {object} metrics - Performance metrics
     * @private
     */
    adaptPerformanceSettings(metrics) {
        Config.adaptPerformanceSettings(metrics);
    }

    /**
     * Get performance metrics
     * @returns {object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            fps: Math.round(1000 / this.performanceMonitor.averageFrameTime),
            frameTime: this.performanceMonitor.lastFrameTime,
            averageFrameTime: this.performanceMonitor.averageFrameTime,
            entityCount: this.world.stats.activeEntityCount,
            systemCount: this.world.stats.systemCount,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Get memory usage information
     * @returns {number} Memory usage in MB
     * @private
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }
        return 0;
    }

    /**
     * Get comprehensive engine statistics
     * @returns {object} Engine statistics
     */
    getEngineStats() {
        return {
            ...this.getPerformanceMetrics(),
            state: this.state,
            gameTime: this.gameTime,
            timeScale: this.timeScale,
            worldStats: this.world.getStats(),
            errorStats: GlobalErrorHandler.getErrorStats()
        };
    }

    /**
     * Add event listener
     * @param {string} eventType - Event type
     * @param {function} handler - Event handler
     */
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {function} handler - Event handler
     */
    off(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     */
    emit(eventType, data) {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    Logger.error(`Error in event handler for '${eventType}':`, { error: error.message });
                }
            });
        }

        // Also emit to ECS world
        this.world.emit(eventType, data);
    }

    /**
     * Show critical error UI
     * @param {object} errorInfo - Error information
     * @private
     */
    showCriticalErrorUI(errorInfo) {
        // Create error overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(139, 0, 0, 0.9);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;

        errorOverlay.innerHTML = `
            <div style="text-align: center; max-width: 600px; padding: 40px;">
                <h2 style="color: #FFD700; margin-bottom: 20px;">⚠️ Critical Error</h2>
                <p style="margin-bottom: 20px;">
                    The game encountered multiple critical errors and needs to restart.
                </p>
                <p style="margin-bottom: 30px; font-size: 14px; opacity: 0.8;">
                    Error Count: ${errorInfo.errorCount}<br>
                    This helps us improve the game. Thank you for your patience.
                </p>
                <button onclick="window.location.reload()" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    font-size: 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Restart Game</button>
            </div>
        `;

        document.body.appendChild(errorOverlay);
    }

    /**
     * Clean up engine resources
     */
    cleanup() {
        Logger.info('Cleaning up game engine');
        
        this.stop();
        this.world.cleanup();
        this.eventHandlers.clear();
        this.systemRegistry.clear();
        
        // Clean up UI elements
        const errorOverlay = document.querySelector('div[style*="rgba(139, 0, 0"]');
        if (errorOverlay) {
            errorOverlay.remove();
        }
        
        Logger.info('Game engine cleanup complete');
    }
}

/**
 * Engine Factory for creating configured game engines
 */
export class EngineFactory {
    /**
     * Create a game engine with default configuration
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} options - Engine options
     * @returns {GameEngine} Configured game engine
     */
    static create(canvas, options = {}) {
        // Validate canvas
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Valid canvas element required');
        }

        // Create dependencies
        const dependencies = {
            inputManager: options.inputManager || null,
            audioManager: options.audioManager || null,
            assetManager: options.assetManager || null
        };

        // Create and configure engine
        const engine = new GameEngine(canvas, dependencies);
        
        // Apply custom configuration
        if (options.config) {
            Config.loadFromObject(options.config);
        }

        return engine;
    }

    /**
     * Create a debug-enabled engine
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {object} options - Engine options
     * @returns {GameEngine} Debug-enabled game engine
     */
    static createDebug(canvas, options = {}) {
        const debugConfig = {
            debug: {
                showPerformanceMetrics: { value: true },
                showBounds: { value: true },
                logLevel: { value: 'debug' }
            },
            game: {
                debugMode: { value: true },
                showPerformanceStats: { value: true }
            }
        };

        return EngineFactory.create(canvas, {
            ...options,
            config: { ...debugConfig, ...options.config }
        });
    }
}