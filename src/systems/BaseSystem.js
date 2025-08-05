/**
 * Base System Class for Vampire Survivors
 * 
 * Provides a consistent foundation for all game systems with:
 * - Standardized lifecycle management
 * - Performance monitoring
 * - Error handling
 * - Configuration integration
 * - Entity querying utilities
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { System } from '../core/ECS.js';
import { Config } from '../core/ConfigManager.js';
import { LoggerInstance as Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';

/**
 * Base system class with common functionality for game systems
 */
export class BaseSystem extends System {
    /**
     * Initialize base system
     * @param {World} world - ECS world reference
     * @param {string} name - System name
     * @param {object} config - System configuration
     */
    constructor(world, name, config = {}) {
        super(world, config.priority || 0);
        
        this.systemName = name;
        this.config = config;
        
        // Performance tracking
        this.performanceStats = {
            updateTime: 0,
            renderTime: 0,
            entityCount: 0,
            averageUpdateTime: 0,
            maxUpdateTime: 0,
            updateCount: 0,
            lastUpdate: 0
        };

        // System state
        this.initialized = false;
        this.enabled = config.enabled !== false;
        
        // Cached entity queries for performance
        this.entityQueries = new Map();
        this.queryCache = new Map();
        this.cacheInvalidationTime = 0;
        this.maxCacheAge = config.maxCacheAge || 100; // milliseconds

        // Configuration listeners
        this.configListeners = [];
        
        // Event handlers
        this.eventHandlers = new Map();
        
        Logger.debug(`System '${this.systemName}' created`, {
            priority: this.priority,
            enabled: this.enabled
        });
    }

    /**
     * Initialize the system (called once when added to world)
     */
    init() {
        if (this.initialized) {
            Logger.warn(`System '${this.systemName}' already initialized`);
            return;
        }

        Logger.debug(`Initializing system '${this.systemName}'`);

        try {
            // Set up configuration listeners
            this.setupConfigListeners();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Call system-specific initialization
            this.onInit();
            
            this.initialized = true;
            Logger.info(`System '${this.systemName}' initialized successfully`);
            
        } catch (error) {
            Logger.error(`Failed to initialize system '${this.systemName}'`, {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * System-specific initialization (override in subclasses)
     */
    onInit() {
        // Override in subclasses
    }

    /**
     * Set up configuration listeners
     * @private
     */
    setupConfigListeners() {
        // Listen for system-specific config changes
        const configPath = `systems.${this.systemName}`;
        this.addConfigListener(configPath, (value, path) => {
            this.onConfigChanged(path, value);
        });

        // Listen for global performance config changes
        this.addConfigListener('performance.*', (value, path) => {
            this.onPerformanceConfigChanged(path, value);
        });
    }

    /**
     * Set up event handlers
     * @private
     */
    setupEventHandlers() {
        // Set up system-specific event handlers
        this.onSetupEventHandlers();
    }

    /**
     * System-specific event handler setup (override in subclasses)
     */
    onSetupEventHandlers() {
        // Override in subclasses
    }

    /**
     * Add a configuration listener
     * @param {string} path - Configuration path to listen to
     * @param {function} callback - Callback function
     */
    addConfigListener(path, callback) {
        Config.addListener(path, callback);
        this.configListeners.push({ path, callback });
    }

    /**
     * Handle configuration changes
     * @param {string} path - Configuration path that changed
     * @param {*} value - New value
     */
    onConfigChanged(path, value) {
        Logger.debug(`System '${this.systemName}' config changed: ${path} = ${value}`);
        // Override in subclasses for specific handling
    }

    /**
     * Handle performance configuration changes
     * @param {string} path - Configuration path that changed
     * @param {*} value - New value
     */
    onPerformanceConfigChanged(path, value) {
        // Handle performance-related config changes
        if (path.includes('cacheAge')) {
            this.maxCacheAge = value;
            this.invalidateCache();
        }
    }

    /**
     * Main update method with performance tracking
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        if (!this.enabled || !this.initialized) return;

        const startTime = performance.now();

        try {
            // Update system-specific logic
            this.onUpdate(deltaTime);
            
            // Update performance stats
            this.updatePerformanceStats(startTime);
            
        } catch (error) {
            Logger.error(`Error in system '${this.systemName}' update`, {
                error: error.message,
                deltaTime,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * System-specific update logic (override in subclasses)
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Override in subclasses
    }

    /**
     * Render method with error handling
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Camera} camera - Camera for transformations
     */
    render(ctx, camera) {
        if (!this.enabled || !this.initialized) return;

        const startTime = performance.now();

        try {
            // System-specific rendering
            this.onRender(ctx, camera);
            
            // Update render performance stats
            this.performanceStats.renderTime = performance.now() - startTime;
            
        } catch (error) {
            Logger.error(`Error in system '${this.systemName}' render`, {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * System-specific rendering logic (override in subclasses)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Camera} camera - Camera for transformations
     */
    onRender(ctx, camera) {
        // Override in subclasses
    }

    /**
     * Get entities with caching for performance
     * @param {...string} componentTypes - Required component types
     * @returns {Entity[]} Matching entities
     */
    getEntitiesWithCache(...componentTypes) {
        const cacheKey = componentTypes.join(',');
        const now = performance.now();
        
        // Check cache validity
        const cached = this.queryCache.get(cacheKey);
        if (cached && (now - cached.timestamp) < this.maxCacheAge) {
            return cached.entities;
        }
        
        // Query entities
        const entities = this.world.getEntitiesWith(...componentTypes);
        
        // Cache results
        this.queryCache.set(cacheKey, {
            entities,
            timestamp: now
        });
        
        return entities;
    }

    /**
     * Create a reusable entity query
     * @param {string} queryName - Name for the query
     * @param {...string} componentTypes - Required component types
     */
    createEntityQuery(queryName, ...componentTypes) {
        this.entityQueries.set(queryName, componentTypes);
    }

    /**
     * Execute a named entity query
     * @param {string} queryName - Query name
     * @returns {Entity[]} Matching entities
     */
    executeQuery(queryName) {
        const componentTypes = this.entityQueries.get(queryName);
        if (!componentTypes) {
            Logger.warn(`Query '${queryName}' not found in system '${this.systemName}'`);
            return [];
        }
        
        return this.getEntitiesWithCache(...componentTypes);
    }

    /**
     * Invalidate entity cache
     */
    invalidateCache() {
        this.queryCache.clear();
        this.cacheInvalidationTime = performance.now();
    }

    /**
     * Add an event listener for this system
     * @param {string} eventType - Event type
     * @param {function} handler - Event handler
     */
    addEventListener(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
        
        // Register with world event system
        this.world.on(eventType, handler);
    }

    /**
     * Remove an event listener
     * @param {string} eventType - Event type
     * @param {function} handler - Event handler
     */
    removeEventListener(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
                this.world.off(eventType, handler);
            }
        }
    }

    /**
     * Emit an event from this system
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     */
    emit(eventType, data) {
        this.world.emit(eventType, {
            ...data,
            source: this.systemName,
            timestamp: performance.now()
        });
    }

    /**
     * Update performance statistics
     * @param {number} startTime - Update start time
     * @private
     */
    updatePerformanceStats(startTime) {
        const updateTime = performance.now() - startTime;
        
        this.performanceStats.updateTime = updateTime;
        this.performanceStats.updateCount++;
        this.performanceStats.lastUpdate = performance.now();
        
        // Update running averages
        const alpha = 0.1; // Smoothing factor
        this.performanceStats.averageUpdateTime = 
            this.performanceStats.averageUpdateTime * (1 - alpha) + updateTime * alpha;
        
        // Track maximum update time
        this.performanceStats.maxUpdateTime = Math.max(
            this.performanceStats.maxUpdateTime, 
            updateTime
        );
        
        // Reset max every 1000 updates to prevent stale data
        if (this.performanceStats.updateCount % 1000 === 0) {
            this.performanceStats.maxUpdateTime = updateTime;
        }
    }

    /**
     * Enable the system
     */
    enable() {
        this.enabled = true;
        Logger.info(`System '${this.systemName}' enabled`);
        this.onEnabled();
    }

    /**
     * Disable the system
     */
    disable() {
        this.enabled = false;
        Logger.info(`System '${this.systemName}' disabled`);
        this.onDisabled();
    }

    /**
     * Called when system is enabled
     */
    onEnabled() {
        // Override in subclasses
    }

    /**
     * Called when system is disabled
     */
    onDisabled() {
        // Override in subclasses
    }

    /**
     * Get system configuration
     * @param {string} key - Configuration key (optional)
     * @returns {*} Configuration value or entire config
     */
    getConfig(key = null) {
        const systemConfig = Config.getSection(`systems.${this.systemName}`);
        return key ? systemConfig[key] : systemConfig;
    }

    /**
     * Set system configuration
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     */
    setConfig(key, value) {
        Config.set(`systems.${this.systemName}.${key}`, value);
    }

    /**
     * Get system performance statistics
     * @returns {object} Performance statistics
     */
    getPerformanceStats() {
        return {
            ...this.performanceStats,
            entityCacheSize: this.queryCache.size,
            queryCount: this.entityQueries.size,
            enabled: this.enabled,
            initialized: this.initialized
        };
    }

    /**
     * Get debug information
     * @returns {object} Debug information
     */
    getDebugInfo() {
        return {
            name: this.systemName,
            priority: this.priority,
            enabled: this.enabled,
            initialized: this.initialized,
            performance: this.getPerformanceStats(),
            entityQueries: Array.from(this.entityQueries.keys()),
            eventHandlers: Array.from(this.eventHandlers.keys()),
            config: this.getConfig()
        };
    }

    /**
     * Cleanup system resources
     */
    cleanup() {
        Logger.debug(`Cleaning up system '${this.systemName}'`);

        try {
            // Call system-specific cleanup
            this.onCleanup();
            
            // Remove configuration listeners
            this.configListeners.forEach(({ path, callback }) => {
                Config.removeListener(path, callback);
            });
            this.configListeners.length = 0;
            
            // Remove event handlers
            for (const [eventType, handlers] of this.eventHandlers.entries()) {
                handlers.forEach(handler => {
                    this.world.off(eventType, handler);
                });
            }
            this.eventHandlers.clear();
            
            // Clear caches
            this.queryCache.clear();
            this.entityQueries.clear();
            
            this.initialized = false;
            Logger.debug(`System '${this.systemName}' cleanup complete`);
            
        } catch (error) {
            Logger.error(`Error during system '${this.systemName}' cleanup`, {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * System-specific cleanup (override in subclasses)
     */
    onCleanup() {
        // Override in subclasses
    }

    /**
     * Validate system requirements
     * @returns {boolean} True if requirements are met
     */
    validateRequirements() {
        // Override in subclasses to check for required dependencies
        return true;
    }

    /**
     * Get system health status
     * @returns {object} Health status
     */
    getHealthStatus() {
        const stats = this.getPerformanceStats();
        const health = {
            status: 'healthy',
            issues: [],
            recommendations: []
        };

        // Check performance issues
        if (stats.averageUpdateTime > 5) {
            health.status = 'warning';
            health.issues.push('High average update time');
            health.recommendations.push('Consider optimizing update logic');
        }

        if (stats.maxUpdateTime > 16.67) {
            health.status = 'warning';
            health.issues.push('Frame drops detected');
            health.recommendations.push('Check for expensive operations in update loop');
        }

        // Check cache efficiency
        if (stats.entityCacheSize > 50) {
            health.issues.push('Large entity cache');
            health.recommendations.push('Consider reducing cache size or frequency');
        }

        if (health.issues.length > 2) {
            health.status = 'critical';
        }

        return health;
    }

    /**
     * String representation of the system
     * @returns {string} System string representation
     */
    toString() {
        return `${this.systemName}System(enabled=${this.enabled}, priority=${this.priority})`;
    }
}

/**
 * System factory for creating configured systems
 */
export class SystemFactory {
    /**
     * Create a system with default configuration
     * @param {function} SystemClass - System class constructor
     * @param {World} world - ECS world
     * @param {string} name - System name
     * @param {object} config - System configuration
     * @returns {BaseSystem} Configured system instance
     */
    static create(SystemClass, world, name, config = {}) {
        // Merge with default config
        const defaultConfig = {
            enabled: true,
            priority: 0,
            maxCacheAge: 100,
            performanceWarningThreshold: 5.0
        };

        const finalConfig = { ...defaultConfig, ...config };
        
        // Create system instance
        const system = new SystemClass(world, name, finalConfig);
        
        // Validate requirements
        if (!system.validateRequirements()) {
            throw new Error(`System '${name}' requirements not met`);
        }

        return system;
    }

    /**
     * Create a performance-optimized system
     * @param {function} SystemClass - System class constructor
     * @param {World} world - ECS world
     * @param {string} name - System name
     * @param {object} config - System configuration
     * @returns {BaseSystem} Performance-optimized system instance
     */
    static createOptimized(SystemClass, world, name, config = {}) {
        const optimizedConfig = {
            ...config,
            maxCacheAge: 50, // Faster cache invalidation
            performanceWarningThreshold: 3.0, // Stricter performance monitoring
            priority: config.priority || -1 // Higher priority for critical systems
        };

        return SystemFactory.create(SystemClass, world, name, optimizedConfig);
    }
}