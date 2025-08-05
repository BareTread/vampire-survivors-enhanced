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
 * Configuration file paths - JSON files are the single source of truth
 */
const CONFIG_FILES = [
    'configs/game.json',
    'configs/player.json', 
    'configs/enemies.json',
    'configs/weapons.json',
    'configs/rendering.json',
    'configs/audio.json',
    'configs/performance.json',
    'configs/debug.json'
];

/**
 * Configuration Manager class
 * Handles loading, validation, and runtime modification of game configuration
 */
export class ConfigManager {
    constructor() {
        this.config = {};
        this.listeners = new Map();
        this.environment = this.detectEnvironment();
        this.configLoaded = false;
        
        // Load configuration from JSON files
        this.loadConfigurationFiles();
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
     * Load configuration from JSON files
     */
    async loadConfigurationFiles() {
        try {
            // Load all configuration files
            for (const filePath of CONFIG_FILES) {
                try {
                    const response = await fetch(filePath);
                    if (!response.ok) {
                        console.warn(`Failed to load config file: ${filePath}`);
                        continue;
                    }
                    
                    const configData = await response.json();
                    const fileName = filePath.split('/').pop().replace('.json', '');
                    
                    // Store configuration section
                    this.config[fileName] = configData;
                    
                } catch (error) {
                    console.error(`Error loading config file ${filePath}:`, error);
                }
            }
            
            this.configLoaded = true;
            
            // Load environment-specific overrides
            this.loadEnvironmentConfig();
            
            // Notify listeners that config is loaded
            this.notifyListeners('*', this.config);
            
        } catch (error) {
            console.error('Failed to load configuration files:', error);
            // Fall back to minimal config
            this.loadFallbackConfig();
        }
    }

    /**
     * Load fallback configuration if JSON files fail
     */
    loadFallbackConfig() {
        this.config = {
            game: { targetFPS: 60, debugMode: false },
            player: { health: 100, speed: 120 },
            enemies: { maxActive: 150, spawnRate: 2.0 },
            weapons: {},
            rendering: { particleLimit: 200 },
            audio: { masterVolume: 0.7 },
            performance: { entityPoolSize: 100 },
            debug: { logLevel: 'warn' }
        };
        this.configLoaded = true;
    }

    /**
     * Load environment-specific configuration overrides
     */
    loadEnvironmentConfig() {
        const overrides = {
            development: {
                debug: {
                    showPerformanceMetrics: true,
                    logLevel: 'debug'
                },
                game: {
                    debugMode: true
                }
            },
            
            debug: {
                debug: {
                    showBounds: true,
                    showSpatialGrid: true,
                    showPerformanceMetrics: true,
                    logLevel: 'debug'
                },
                game: {
                    debugMode: true,
                    showPerformanceStats: true
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
     * @param {string} path - Configuration path (e.g., 'player.baseStats.health')
     * @returns {*} Configuration value
     */
    get(path) {
        if (!this.configLoaded) {
            console.warn('Configuration not yet loaded, returning undefined for:', path);
            return undefined;
        }
        
        const parts = path.split('.');
        let current = this.config;
        
        for (const part of parts) {
            if (current === null || current === undefined) {
                console.warn(`Configuration path '${path}' not found`);
                return undefined;
            }
            current = current[part];
        }
        
        return current;
    }

    /**
     * Set a configuration value by path
     * @param {string} path - Configuration path
     * @param {*} value - New value
     * @returns {boolean} True if set successfully
     */
    set(path, value) {
        if (!this.configLoaded) {
            console.warn('Configuration not yet loaded, cannot set:', path);
            return false;
        }
        
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
        
        // Set the value directly (JSON structure is simple)
        current[key] = value;
        
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
        if (!this.configLoaded) {
            console.warn('Configuration not yet loaded, returning empty section for:', section);
            return {};
        }
        
        const sectionConfig = this.config[section];
        if (!sectionConfig) {
            console.warn(`Configuration section '${section}' not found`);
            return {};
        }
        
        // Return the section directly (JSON structure is already simple)
        return { ...sectionConfig };
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
        if (!this.configLoaded) {
            console.warn('Configuration not yet loaded, returning empty export');
            return '{}';
        }
        
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Reset configuration to defaults (reload from JSON files)
     */
    async reset() {
        this.config = {};
        this.configLoaded = false;
        await this.loadConfigurationFiles();
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
 * Configuration loading is async, check Config.configLoaded before using
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