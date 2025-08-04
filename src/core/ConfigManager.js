/**
 * Configuration Management System
 * 
 * Centralized configuration management with environment-based overrides,
 * validation, and runtime modification capabilities. Follows the
 * configuration-as-code principle for maintainable game tuning.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

/**
 * Configuration schema validation
 */
const ConfigSchema = {
    /**
     * Validate a configuration value against a schema
     * @param {*} value - Value to validate
     * @param {object} schema - Validation schema
     * @returns {boolean} True if valid
     */
    validate(value, schema) {
        if (schema.type && typeof value !== schema.type) {
            console.warn(`Config validation failed: expected ${schema.type}, got ${typeof value}`);
            return false;
        }
        
        if (schema.min !== undefined && value < schema.min) {
            console.warn(`Config validation failed: ${value} is less than minimum ${schema.min}`);
            return false;
        }
        
        if (schema.max !== undefined && value > schema.max) {
            console.warn(`Config validation failed: ${value} is greater than maximum ${schema.max}`);
            return false;
        }
        
        if (schema.enum && !schema.enum.includes(value)) {
            console.warn(`Config validation failed: ${value} not in allowed values ${schema.enum}`);
            return false;
        }
        
        return true;
    }
};

/**
 * Default game configuration
 * All magic numbers should be defined here for easy tuning
 */
const DEFAULT_CONFIG = {
    // Game Settings
    game: {
        targetFPS: { value: 60, type: 'number', min: 30, max: 120 },
        debugMode: { value: false, type: 'boolean' },
        showPerformanceStats: { value: false, type: 'boolean' },
        maxEntities: { value: 500, type: 'number', min: 100, max: 2000 },
        worldBounds: {
            value: { width: 4000, height: 4000 },
            type: 'object'
        }
    },

    // Player Configuration
    player: {
        health: { value: 100, type: 'number', min: 1, max: 1000 },
        speed: { value: 100, type: 'number', min: 10, max: 500 },
        size: { value: 12, type: 'number', min: 5, max: 50 },
        invulnerabilityTime: { value: 1.0, type: 'number', min: 0.1, max: 5.0 },
        maxWeapons: { value: 6, type: 'number', min: 1, max: 10 },
        
        // Experience system
        baseExperienceRequired: { value: 100, type: 'number', min: 10, max: 1000 },
        experienceGrowthRate: { value: 1.15, type: 'number', min: 1.0, max: 2.0 },
        
        // Combo system
        comboTimeWindow: { value: 3.0, type: 'number', min: 1.0, max: 10.0 },
        comboMultiplierBase: { value: 0.1, type: 'number', min: 0.01, max: 1.0 },
        
        // Near-death mechanics
        nearDeathThreshold: { value: 0.25, type: 'number', min: 0.1, max: 0.5 },
        nearDeathDamageReduction: { value: 0.3, type: 'number', min: 0.0, max: 0.8 },
        nearDeathExpMultiplier: { value: 3.0, type: 'number', min: 1.0, max: 10.0 }
    },

    // Enemy Configuration
    enemies: {
        maxActive: { value: 150, type: 'number', min: 10, max: 500 },
        spawnDistance: { value: 400, type: 'number', min: 200, max: 800 },
        despawnDistance: { value: 600, type: 'number', min: 300, max: 1000 },
        baseSpawnRate: { value: 2.0, type: 'number', min: 0.1, max: 10.0 },
        
        // Difficulty scaling
        difficultyGrowthRate: { value: 0.01, type: 'number', min: 0.001, max: 0.1 },
        waveMultiplier: { value: 0.08, type: 'number', min: 0.01, max: 0.5 },
        maxDifficultyMultiplier: { value: 100.0, type: 'number', min: 1.0, max: 1000.0 },
        
        // Elite spawning
        baseEliteChance: { value: 0.05, type: 'number', min: 0.0, max: 1.0 },
        maxEliteChance: { value: 0.35, type: 'number', min: 0.0, max: 1.0 },
        
        // Wave system
        waveDuration: { value: 60, type: 'number', min: 10, max: 300 },
        bossWaveInterval: { value: 5, type: 'number', min: 1, max: 20 }
    },

    // Weapon Configuration
    weapons: {
        // Magic Missile
        magicMissile: {
            damage: { value: 25, type: 'number', min: 1, max: 1000 },
            speed: { value: 200, type: 'number', min: 50, max: 1000 },
            range: { value: 300, type: 'number', min: 100, max: 800 },
            cooldown: { value: 1.5, type: 'number', min: 0.1, max: 10.0 },
            maxLevel: { value: 8, type: 'number', min: 1, max: 20 }
        },
        
        // Whip
        whip: {
            damage: { value: 35, type: 'number', min: 1, max: 1000 },
            range: { value: 80, type: 'number', min: 20, max: 200 },
            cooldown: { value: 2.0, type: 'number', min: 0.1, max: 10.0 },
            duration: { value: 0.3, type: 'number', min: 0.1, max: 2.0 },
            maxLevel: { value: 8, type: 'number', min: 1, max: 20 }
        },
        
        // Throwing Knife
        throwingKnife: {
            damage: { value: 20, type: 'number', min: 1, max: 1000 },
            speed: { value: 300, type: 'number', min: 50, max: 1000 },
            piercing: { value: 2, type: 'number', min: 1, max: 10 },
            cooldown: { value: 1.2, type: 'number', min: 0.1, max: 10.0 },
            maxLevel: { value: 8, type: 'number', min: 1, max: 20 }
        }
    },

    // Rendering Configuration
    rendering: {
        enableVSync: { value: true, type: 'boolean' },
        lowQualityThreshold: { value: 30, type: 'number', min: 10, max: 60 },
        particleLimit: { value: 200, type: 'number', min: 10, max: 1000 },
        backgroundComplexity: { 
            value: 'medium', 
            type: 'string', 
            enum: ['low', 'medium', 'high'] 
        },
        
        // Camera settings
        camera: {
            followSmoothness: { value: 0.1, type: 'number', min: 0.01, max: 1.0 },
            shakeDecay: { value: 0.9, type: 'number', min: 0.1, max: 1.0 },
            maxShake: { value: 20, type: 'number', min: 1, max: 100 },
            flashDecay: { value: 0.95, type: 'number', min: 0.5, max: 1.0 }
        }
    },

    // Audio Configuration
    audio: {
        masterVolume: { value: 0.7, type: 'number', min: 0.0, max: 1.0 },
        sfxVolume: { value: 0.8, type: 'number', min: 0.0, max: 1.0 },
        musicVolume: { value: 0.5, type: 'number', min: 0.0, max: 1.0 },
        enableAudio: { value: true, type: 'boolean' },
        maxSimultaneousSounds: { value: 10, type: 'number', min: 1, max: 50 }
    },

    // Performance Configuration
    performance: {
        // Update rates for different systems
        uiUpdateRate: { value: 12, type: 'number', min: 1, max: 60 },
        spatialGridUpdateRate: { value: 3, type: 'number', min: 1, max: 30 },
        performanceReportInterval: { value: 5000, type: 'number', min: 1000, max: 30000 },
        
        // Thresholds for performance scaling
        highEntityThreshold: { value: 100, type: 'number', min: 10, max: 500 },
        criticalEntityThreshold: { value: 200, type: 'number', min: 50, max: 1000 },
        
        // Object pooling sizes
        entityPoolSize: { value: 100, type: 'number', min: 10, max: 500 },
        projectilePoolSize: { value: 200, type: 'number', min: 50, max: 1000 },
        particlePoolSize: { value: 500, type: 'number', min: 100, max: 2000 }
    },

    // Development Tools
    debug: {
        showBounds: { value: false, type: 'boolean' },
        showSpatialGrid: { value: false, type: 'boolean' },
        showPerformanceMetrics: { value: false, type: 'boolean' },
        enableConsoleCommands: { value: true, type: 'boolean' },
        logLevel: { 
            value: 'warn', 
            type: 'string', 
            enum: ['error', 'warn', 'info', 'debug'] 
        }
    }
};

/**
 * Configuration Manager class
 * Handles loading, validation, and runtime modification of game configuration
 */
export class ConfigManager {
    constructor() {
        this.config = {};
        this.listeners = new Map();
        this.environment = this.detectEnvironment();
        
        // Load default configuration
        this.loadDefaults();
        
        // Load environment-specific overrides
        this.loadEnvironmentConfig();
    }

    /**
     * Detect the current environment (development, production, etc.)
     * @returns {string} Environment name
     */
    detectEnvironment() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('debug')) return 'debug';
        if (urlParams.has('dev')) return 'development';
        
        // Check hostname
        if (window.location.hostname === 'localhost' || 
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname === '127.0.0.1') {
            return 'development';
        }
        
        return 'production';
    }

    /**
     * Load default configuration values
     */
    loadDefaults() {
        this.config = this.deepClone(DEFAULT_CONFIG);
    }

    /**
     * Load environment-specific configuration overrides
     */
    loadEnvironmentConfig() {
        const overrides = {
            development: {
                debug: {
                    showPerformanceMetrics: { value: true },
                    logLevel: { value: 'debug' }
                },
                game: {
                    debugMode: { value: true }
                }
            },
            
            debug: {
                debug: {
                    showBounds: { value: true },
                    showSpatialGrid: { value: true },
                    showPerformanceMetrics: { value: true },
                    logLevel: { value: 'debug' }
                },
                game: {
                    debugMode: { value: true },
                    showPerformanceStats: { value: true }
                }
            }
        };

        const envConfig = overrides[this.environment];
        if (envConfig) {
            this.mergeConfig(envConfig);
        }
    }

    /**
     * Get a configuration value by path
     * @param {string} path - Configuration path (e.g., 'player.health.value')
     * @returns {*} Configuration value
     */
    get(path) {
        const parts = path.split('.');
        let current = this.config;
        
        for (const part of parts) {
            if (current === null || current === undefined) {
                console.warn(`Configuration path '${path}' not found`);
                return undefined;
            }
            current = current[part];
        }
        
        // Return the actual value if it's a config object
        return current && typeof current === 'object' && 'value' in current 
            ? current.value 
            : current;
    }

    /**
     * Set a configuration value by path
     * @param {string} path - Configuration path
     * @param {*} value - New value
     * @returns {boolean} True if set successfully
     */
    set(path, value) {
        const parts = path.split('.');
        const configPath = parts.slice(0, -1);
        const key = parts[parts.length - 1];
        
        let current = this.config;
        
        // Navigate to the parent object
        for (const part of configPath) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Validate the new value if schema exists
        const configObj = current[key];
        if (configObj && typeof configObj === 'object' && 'value' in configObj) {
            if (!ConfigSchema.validate(value, configObj)) {
                return false;
            }
            configObj.value = value;
        } else {
            current[key] = { value: value };
        }
        
        // Notify listeners
        this.notifyListeners(path, value);
        
        return true;
    }

    /**
     * Get the full configuration object for a section
     * @param {string} section - Configuration section
     * @returns {object} Configuration section object
     */
    getSection(section) {
        const sectionConfig = this.config[section];
        if (!sectionConfig) {
            console.warn(`Configuration section '${section}' not found`);
            return {};
        }
        
        // Convert config objects to simple values
        const result = {};
        for (const [key, value] of Object.entries(sectionConfig)) {
            if (typeof value === 'object' && 'value' in value) {
                result[key] = value.value;
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Register a listener for configuration changes
     * @param {string} path - Configuration path to watch
     * @param {function} callback - Callback function
     */
    addListener(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, []);
        }
        this.listeners.get(path).push(callback);
    }

    /**
     * Remove a configuration change listener
     * @param {string} path - Configuration path
     * @param {function} callback - Callback function to remove
     */
    removeListener(path, callback) {
        const pathListeners = this.listeners.get(path);
        if (pathListeners) {
            const index = pathListeners.indexOf(callback);
            if (index !== -1) {
                pathListeners.splice(index, 1);
            }
        }
    }

    /**
     * Load configuration from JSON object
     * @param {object} configData - Configuration data
     */
    loadFromObject(configData) {
        this.mergeConfig(configData);
        this.notifyListeners('*', this.config);
    }

    /**
     * Load configuration from URL parameters
     */
    loadFromURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        
        for (const [key, value] of urlParams.entries()) {
            if (key.startsWith('config.')) {
                const path = key.substring(7); // Remove 'config.' prefix
                const parsedValue = this.parseValue(value);
                this.set(path, parsedValue);
            }
        }
    }

    /**
     * Load configuration from external JSON files
     * @param {string[]} configFiles - Array of config file paths to load
     * @returns {Promise<void>} Promise that resolves when all configs are loaded
     */
    async loadExternalConfigs(configFiles = []) {
        const loadPromises = configFiles.map(async (filePath) => {
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    console.warn(`Failed to load config file: ${filePath}`);
                    return;
                }
                
                const configData = await response.json();
                const fileName = filePath.split('/').pop().replace('.json', '');
                
                // Merge the loaded config into the appropriate section
                this.mergeExternalConfig(fileName, configData);
                
            } catch (error) {
                console.error(`Error loading config file ${filePath}:`, error);
            }
        });
        
        await Promise.all(loadPromises);
        this.notifyListeners('*', this.config);
    }

    /**
     * Merge external configuration data into the main config
     * @param {string} configType - Type of configuration (enemies, weapons, player)
     * @param {object} configData - Configuration data to merge
     * @private
     */
    mergeExternalConfig(configType, configData) {
        switch (configType) {
            case 'enemies':
                this.config.enemies = this.config.enemies || {};
                this.config.enemies.types = configData.enemyTypes;
                this.config.enemies.variants = configData.variants;
                this.config.enemies.spawnSettings = configData.spawnSettings;
                this.config.enemies.scalingSettings = configData.scalingSettings;
                this.config.enemies.combatSettings = configData.combatSettings;
                break;
                
            case 'weapons':
                this.config.weapons = this.config.weapons || {};
                Object.assign(this.config.weapons, configData.weaponTypes);
                this.config.weapons.upgradeProgression = configData.upgradeProgression;
                this.config.weapons.projectileSettings = configData.projectileSettings;
                this.config.weapons.effectSettings = configData.effectSettings;
                break;
                
            case 'player':
                this.config.player = this.config.player || {};
                Object.assign(this.config.player, configData.baseStats);
                this.config.player.levelProgression = configData.levelProgression;
                this.config.player.upgrades = configData.upgrades;
                this.config.player.combo = configData.combo;
                this.config.player.magnetRange = configData.magnetRange;
                this.config.player.invulnerabilityTime = { value: configData.invulnerabilityTime };
                this.config.player.criticalHitChance = { value: configData.criticalHitChance };
                this.config.player.criticalHitMultiplier = { value: configData.criticalHitMultiplier };
                break;
                
            default:
                console.warn(`Unknown config type: ${configType}`);
                break;
        }
    }

    /**
     * Export current configuration as JSON
     * @returns {string} JSON configuration
     */
    exportJSON() {
        const exportConfig = {};
        
        const processObject = (source, target) => {
            for (const [key, value] of Object.entries(source)) {
                if (typeof value === 'object' && 'value' in value) {
                    target[key] = value.value;
                } else if (typeof value === 'object' && value !== null) {
                    target[key] = {};
                    processObject(value, target[key]);
                } else {
                    target[key] = value;
                }
            }
        };
        
        processObject(this.config, exportConfig);
        return JSON.stringify(exportConfig, null, 2);
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.loadDefaults();
        this.loadEnvironmentConfig();
        this.notifyListeners('*', this.config);
    }

    /**
     * Get performance-related configuration
     * @returns {object} Performance configuration
     */
    getPerformanceConfig() {
        return this.getSection('performance');
    }

    /**
     * Update performance settings based on current performance
     * @param {object} performanceStats - Current performance statistics
     */
    adaptPerformanceSettings(performanceStats) {
        const { fps, entityCount } = performanceStats;
        
        // Reduce rendering quality if performance is poor
        if (fps < this.get('rendering.lowQualityThreshold')) {
            this.set('rendering.particleLimit', Math.max(50, this.get('rendering.particleLimit') * 0.8));
            this.set('rendering.backgroundComplexity', 'low');
        }
        
        // Reduce enemy count if too many entities
        if (entityCount > this.get('performance.criticalEntityThreshold')) {
            this.set('enemies.maxActive', Math.max(50, this.get('enemies.maxActive') * 0.9));
        }
    }

    /**
     * Parse a string value to appropriate type
     * @param {string} value - String value
     * @returns {*} Parsed value
     * @private
     */
    parseValue(value) {
        // Try boolean
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // Try number
        const numValue = Number(value);
        if (!isNaN(numValue)) return numValue;
        
        // Return as string
        return value;
    }

    /**
     * Deep clone an object
     * @param {object} obj - Object to clone
     * @returns {object} Cloned object
     * @private
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }

    /**
     * Merge configuration objects
     * @param {object} newConfig - New configuration to merge
     * @private
     */
    mergeConfig(newConfig) {
        const merge = (target, source) => {
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (typeof source[key] === 'object' && source[key] !== null && !('value' in source[key])) {
                        if (!target[key]) target[key] = {};
                        merge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        };
        
        merge(this.config, newConfig);
    }

    /**
     * Notify configuration change listeners
     * @param {string} path - Changed configuration path
     * @param {*} value - New value
     * @private
     */
    notifyListeners(path, value) {
        // Notify specific path listeners
        const pathListeners = this.listeners.get(path);
        if (pathListeners) {
            pathListeners.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error(`Error in config listener for '${path}':`, error);
                }
            });
        }
        
        // Notify wildcard listeners
        const wildcardListeners = this.listeners.get('*');
        if (wildcardListeners) {
            wildcardListeners.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error(`Error in wildcard config listener:`, error);
                }
            });
        }
    }
}

/**
 * Global configuration manager instance
 */
export const Config = new ConfigManager();

/**
 * Configuration decorator for easy access in classes
 * @param {string} configPath - Configuration path
 * @returns {function} Decorator function
 */
export function configurable(configPath) {
    return function(target, propertyName, descriptor) {
        const originalValue = descriptor.value;
        
        descriptor.value = function(...args) {
            // Inject configuration as first argument
            const configValue = Config.get(configPath);
            return originalValue.call(this, configValue, ...args);
        };
        
        return descriptor;
    };
}

/**
 * Utility functions for configuration management
 */
export const ConfigUtils = {
    /**
     * Create a configuration watcher
     * @param {string} path - Configuration path to watch
     * @param {function} callback - Callback for changes
     * @returns {function} Unwatch function
     */
    watch(path, callback) {
        Config.addListener(path, callback);
        return () => Config.removeListener(path, callback);
    },

    /**
     * Create a configuration binding for UI elements
     * @param {string} path - Configuration path
     * @param {HTMLElement} element - DOM element to bind
     * @param {string} property - Element property to bind
     */
    bindToElement(path, element, property = 'value') {
        const updateElement = (value) => {
            element[property] = value;
        };
        
        const updateConfig = () => {
            Config.set(path, element[property]);
        };
        
        // Initial sync
        updateElement(Config.get(path));
        
        // Setup bidirectional binding
        Config.addListener(path, updateElement);
        element.addEventListener('input', updateConfig);
        element.addEventListener('change', updateConfig);
    }
};