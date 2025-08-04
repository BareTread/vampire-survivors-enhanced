/**
 * Entity Factory - Professional Entity Creation System
 * 
 * Factory pattern implementation for creating game entities with proper
 * component composition. Provides templates, validation, and optimization
 * for consistent entity creation throughout the game.
 * 
 * Features:
 * - Template-based entity creation
 * - Component validation and dependencies
 * - Performance optimization with object pooling
 * - Configuration-driven entity parameters
 * - Extensible entity type system
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { 
    TransformComponent, 
    VelocityComponent, 
    RenderComponent, 
    HealthComponent, 
    CollisionComponent, 
    LifetimeComponent,
    InputComponent,
    AIComponent,
    WeaponComponent
} from './Components.js';
import { Config } from './ConfigManager.js';
import { Logger, ErrorHandling, ErrorCategory } from './ErrorHandler.js';

/**
 * Entity template definitions
 */
const EntityTemplates = {
    // Player entity template
    player: {
        components: {
            transform: {
                class: TransformComponent,
                params: (config) => [config.x || 0, config.y || 0, 0]
            },
            velocity: {
                class: VelocityComponent,
                params: (config) => [0, 0, Config.get('player.speed')]
            },
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: 'circle',
                    color: config.color || '#4A90E2',
                    size: Config.get('player.size'),
                    glow: true,
                    glowColor: config.color || '#4A90E2',
                    zIndex: 10
                }]
            },
            health: {
                class: HealthComponent,
                params: (config) => [Config.get('player.health'), null]
            },
            collision: {
                class: CollisionComponent,
                params: (config) => [{
                    type: 'circle',
                    radius: Config.get('player.size'),
                    layer: 'player',
                    mask: ['enemy', 'enemyProjectile', 'pickup']
                }]
            },
            input: {
                class: InputComponent,
                params: () => []
            }
        },
        tags: ['player', 'controllable'],
        required: ['transform', 'velocity', 'render', 'health', 'collision', 'input'],
        dependencies: {
            'velocity': ['transform'],
            'collision': ['transform'],
            'render': ['transform']
        }
    },

    // Basic enemy template
    enemy: {
        components: {
            transform: {
                class: TransformComponent,
                params: (config) => [config.x || 0, config.y || 0, 0]
            },
            velocity: {
                class: VelocityComponent,
                params: (config) => [0, 0, config.maxSpeed || 50]
            },
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: 'circle',
                    color: config.color || '#FF4444',
                    size: config.size || 8,
                    glow: false,
                    zIndex: 5
                }]
            },
            health: {
                class: HealthComponent,
                params: (config) => [config.health || 20, null]
            },
            collision: {
                class: CollisionComponent,
                params: (config) => [{
                    type: 'circle',
                    radius: config.size || 8,
                    layer: 'enemy',
                    mask: ['player', 'playerProjectile']
                }]
            },
            ai: {
                class: AIComponent,
                params: (config) => [config.behaviorType || 'aggressive']
            }
        },
        tags: ['enemy', 'hostile'],
        required: ['transform', 'velocity', 'render', 'health', 'collision', 'ai'],
        dependencies: {
            'velocity': ['transform'],
            'collision': ['transform'],
            'render': ['transform'],
            'ai': ['transform']
        }
    },

    // Elite enemy template
    eliteEnemy: {
        extends: 'enemy',
        components: {
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: 'circle',
                    color: config.color || '#FF8800',
                    size: (config.size || 8) * 1.5,
                    glow: true,
                    glowColor: '#FFAA00',
                    glowIntensity: 15,
                    pulse: true,
                    zIndex: 6
                }]
            },
            health: {
                class: HealthComponent,
                params: (config) => [(config.health || 20) * 3, null]
            },
            collision: {
                class: CollisionComponent,
                params: (config) => [{
                    type: 'circle',
                    radius: (config.size || 8) * 1.5,
                    layer: 'enemy',
                    mask: ['player', 'playerProjectile']
                }]
            }
        },
        tags: ['enemy', 'hostile', 'elite']
    },

    // Projectile template
    projectile: {
        components: {
            transform: {
                class: TransformComponent,
                params: (config) => [config.x || 0, config.y || 0, config.rotation || 0]
            },
            velocity: {
                class: VelocityComponent,
                params: (config) => [
                    config.vx || 0, 
                    config.vy || 0, 
                    config.maxSpeed || 300
                ]
            },
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: config.shape || 'circle',
                    color: config.color || '#FFFF00',
                    size: config.size || 4,
                    glow: true,
                    glowColor: config.color || '#FFFF00',
                    zIndex: 8
                }]
            },
            collision: {
                class: CollisionComponent,
                params: (config) => [{
                    type: 'circle',
                    radius: config.size || 4,
                    layer: config.layer || 'playerProjectile',
                    mask: config.mask || ['enemy'],
                    isTrigger: true
                }]
            },
            lifetime: {
                class: LifetimeComponent,
                params: (config) => [config.lifetime || 2.0]
            }
        },
        tags: ['projectile'],
        required: ['transform', 'velocity', 'render', 'collision', 'lifetime'],
        dependencies: {
            'velocity': ['transform'],
            'collision': ['transform'],
            'render': ['transform']
        }
    },

    // Experience gem template
    experienceGem: {
        components: {
            transform: {
                class: TransformComponent,
                params: (config) => [config.x || 0, config.y || 0, 0]
            },
            velocity: {
                class: VelocityComponent,
                params: (config) => [0, 0, 150]
            },
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: 'circle',
                    color: config.color || '#00FFFF',
                    size: config.size || 6,
                    glow: true,
                    glowColor: '#00FFFF',
                    pulse: true,
                    pulseSpeed: 3.0,
                    zIndex: 7
                }]
            },
            collision: {
                class: CollisionComponent,
                params: (config) => [{
                    type: 'circle',
                    radius: config.size || 6,
                    layer: 'pickup',
                    mask: ['player'],
                    isTrigger: true
                }]
            },
            lifetime: {
                class: LifetimeComponent,
                params: (config) => [config.lifetime || 30.0]
            }
        },
        tags: ['pickup', 'experience'],
        required: ['transform', 'render', 'collision', 'lifetime'],
        dependencies: {
            'collision': ['transform'],
            'render': ['transform']
        }
    },

    // Particle template
    particle: {
        components: {
            transform: {
                class: TransformComponent,
                params: (config) => [config.x || 0, config.y || 0, 0]
            },
            velocity: {
                class: VelocityComponent,
                params: (config) => [
                    config.vx || 0, 
                    config.vy || 0, 
                    config.maxSpeed || 100
                ]
            },
            render: {
                class: RenderComponent,
                params: (config) => [{
                    type: 'circle',
                    color: config.color || '#FFFFFF',
                    size: config.size || 2,
                    glow: config.glow || false,
                    glowColor: config.color || '#FFFFFF',
                    zIndex: config.zIndex || 3
                }]
            },
            lifetime: {
                class: LifetimeComponent,
                params: (config) => [config.lifetime || 1.0]
            }
        },
        tags: ['particle', 'visual'],
        required: ['transform', 'velocity', 'render', 'lifetime'],
        dependencies: {
            'velocity': ['transform'],
            'render': ['transform']
        }
    }
};

/**
 * Entity Factory class for creating game entities
 */
export class EntityFactory {
    /**
     * Initialize entity factory
     * @param {World} world - ECS world reference
     */
    constructor(world) {
        this.world = world;
        this.templates = new Map();
        this.entityPools = new Map();
        this.creationStats = new Map();
        
        // Performance settings
        this.enablePooling = Config.get('performance.entityPoolSize') > 0;
        this.maxPoolSize = Config.get('performance.entityPoolSize');
        
        // Register default templates
        this.registerDefaultTemplates();
        
        Logger.debug('EntityFactory initialized', {
            templatesCount: this.templates.size,
            poolingEnabled: this.enablePooling,
            maxPoolSize: this.maxPoolSize
        });
    }

    /**
     * Register default entity templates
     * @private
     */
    registerDefaultTemplates() {
        for (const [name, template] of Object.entries(EntityTemplates)) {
            this.registerTemplate(name, template);
        }
    }

    /**
     * Register an entity template
     * @param {string} name - Template name
     * @param {object} template - Template definition
     */
    registerTemplate(name, template) {
        // Resolve template inheritance
        const resolvedTemplate = this.resolveTemplateInheritance(template);
        
        // Validate template
        this.validateTemplate(name, resolvedTemplate);
        
        this.templates.set(name, resolvedTemplate);
        
        // Initialize creation stats
        this.creationStats.set(name, {
            created: 0,
            pooled: 0,
            reused: 0
        });
        
        Logger.debug(`Template '${name}' registered`);
    }

    /**
     * Resolve template inheritance
     * @param {object} template - Template to resolve
     * @returns {object} Resolved template
     * @private
     */
    resolveTemplateInheritance(template) {
        if (!template.extends) return template;

        const parentTemplate = EntityTemplates[template.extends];
        if (!parentTemplate) {
            throw new Error(`Parent template '${template.extends}' not found`);
        }

        // Recursively resolve parent
        const resolvedParent = this.resolveTemplateInheritance(parentTemplate);
        
        // Merge templates
        return {
            components: { ...resolvedParent.components, ...template.components },
            tags: [...(resolvedParent.tags || []), ...(template.tags || [])],
            required: template.required || resolvedParent.required,
            dependencies: { ...resolvedParent.dependencies, ...template.dependencies }
        };
    }

    /**
     * Validate template definition
     * @param {string} name - Template name
     * @param {object} template - Template to validate
     * @private
     */
    validateTemplate(name, template) {
        if (!template.components || typeof template.components !== 'object') {
            throw new Error(`Template '${name}' must have components object`);
        }

        if (!template.required || !Array.isArray(template.required)) {
            throw new Error(`Template '${name}' must have required components array`);
        }

        // Validate required components exist
        for (const requiredComponent of template.required) {
            if (!template.components[requiredComponent]) {
                throw new Error(`Template '${name}' missing required component '${requiredComponent}'`);
            }
        }

        // Validate dependencies
        if (template.dependencies) {
            for (const [component, deps] of Object.entries(template.dependencies)) {
                if (!template.components[component]) {
                    throw new Error(`Template '${name}' has dependency for non-existent component '${component}'`);
                }
                
                for (const dep of deps) {
                    if (!template.components[dep]) {
                        throw new Error(`Template '${name}' component '${component}' depends on non-existent component '${dep}'`);
                    }
                }
            }
        }
    }

    /**
     * Create an entity from a template
     * @param {string} templateName - Template name
     * @param {object} config - Entity configuration
     * @returns {Entity} Created entity
     */
    @ErrorHandling.safe(ErrorCategory.SYSTEM)
    createEntity(templateName, config = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        Logger.debug(`Creating entity '${templateName}'`, config);

        let entity;
        
        // Try to reuse from pool
        if (this.enablePooling) {
            entity = this.getFromPool(templateName);
            if (entity) {
                this.creationStats.get(templateName).reused++;
            }
        }

        // Create new entity if not pooled
        if (!entity) {
            entity = this.world.createEntity();
            this.creationStats.get(templateName).created++;
        }

        try {
            // Add components in dependency order
            this.addComponentsInOrder(entity, template, config);
            
            // Add tags
            if (template.tags) {
                template.tags.forEach(tag => entity.addTag(tag));
            }

            // Validate entity
            this.validateEntity(entity, template);

            Logger.debug(`Entity '${templateName}' created successfully`, {
                id: entity.id,
                components: Array.from(entity.components.keys()),
                tags: Array.from(entity.tags)
            });

            return entity;

        } catch (error) {
            Logger.error(`Failed to create entity '${templateName}'`, {
                error: error.message,
                config,
                entityId: entity.id
            });
            
            // Clean up failed entity
            entity.destroy();
            throw error;
        }
    }

    /**
     * Add components to entity in dependency order
     * @param {Entity} entity - Entity to add components to
     * @param {object} template - Entity template
     * @param {object} config - Entity configuration
     * @private
     */
    addComponentsInOrder(entity, template, config) {
        const added = new Set();
        const toAdd = new Set(Object.keys(template.components));

        // Add components respecting dependencies
        while (toAdd.size > 0) {
            let addedInThisPass = false;

            for (const componentName of toAdd) {
                const dependencies = template.dependencies?.[componentName] || [];
                const canAdd = dependencies.every(dep => added.has(dep));

                if (canAdd) {
                    this.addComponent(entity, componentName, template.components[componentName], config);
                    added.add(componentName);
                    toAdd.delete(componentName);
                    addedInThisPass = true;
                }
            }

            if (!addedInThisPass && toAdd.size > 0) {
                throw new Error(`Circular dependency detected in components: ${Array.from(toAdd).join(', ')}`);
            }
        }
    }

    /**
     * Add a single component to an entity
     * @param {Entity} entity - Entity to add component to
     * @param {string} componentName - Component name
     * @param {object} componentConfig - Component configuration
     * @param {object} entityConfig - Entity configuration
     * @private
     */
    addComponent(entity, componentName, componentConfig, entityConfig) {
        const ComponentClass = componentConfig.class;
        const params = componentConfig.params ? componentConfig.params(entityConfig) : [];

        // Try to get component from pool first
        let component = this.world.getPooledComponent(componentName);
        
        if (!component) {
            component = new ComponentClass(...params);
        } else {
            // Reset and reconfigure pooled component
            component.reset();
            if (component.configure && params.length > 0) {
                component.configure(...params);
            }
        }

        entity.addComponent(component);
    }

    /**
     * Validate created entity
     * @param {Entity} entity - Entity to validate
     * @param {object} template - Template used to create entity
     * @private
     */
    validateEntity(entity, template) {
        // Check required components
        for (const requiredComponent of template.required) {
            if (!entity.hasComponent(requiredComponent)) {
                throw new Error(`Entity missing required component '${requiredComponent}'`);
            }
        }

        // Validate component states
        for (const component of entity.components.values()) {
            if (typeof component.validate === 'function') {
                if (!component.validate()) {
                    throw new Error(`Component '${component.type}' validation failed`);
                }
            }
        }
    }

    /**
     * Get entity from pool
     * @param {string} templateName - Template name
     * @returns {Entity|null} Pooled entity or null
     * @private
     */
    getFromPool(templateName) {
        const pool = this.entityPools.get(templateName) || [];
        return pool.length > 0 ? pool.pop() : null;
    }

    /**
     * Return entity to pool
     * @param {Entity} entity - Entity to pool
     * @param {string} templateName - Template name
     */
    returnToPool(entity, templateName) {
        if (!this.enablePooling) return;

        const pool = this.entityPools.get(templateName) || [];
        
        if (pool.length < this.maxPoolSize) {
            // Reset entity for reuse
            entity.reset();
            pool.push(entity);
            
            if (!this.entityPools.has(templateName)) {
                this.entityPools.set(templateName, pool);
            }
            
            this.creationStats.get(templateName).pooled++;
        }
    }

    /**
     * Create multiple entities at once
     * @param {Array} entitySpecs - Array of {template, config} objects
     * @returns {Entity[]} Created entities
     */
    createEntities(entitySpecs) {
        const entities = [];
        
        for (const spec of entitySpecs) {
            try {
                const entity = this.createEntity(spec.template, spec.config);
                entities.push(entity);
            } catch (error) {
                Logger.warn(`Failed to create entity from batch`, {
                    template: spec.template,
                    config: spec.config,
                    error: error.message
                });
            }
        }
        
        return entities;
    }

    /**
     * Create entity with custom components
     * @param {object} componentSpecs - Component specifications
     * @param {string[]} tags - Entity tags
     * @returns {Entity} Created entity
     */
    createCustomEntity(componentSpecs, tags = []) {
        const entity = this.world.createEntity();
        
        try {
            // Add specified components
            for (const [componentName, componentConfig] of Object.entries(componentSpecs)) {
                this.addComponent(entity, componentName, componentConfig, {});
            }
            
            // Add tags
            tags.forEach(tag => entity.addTag(tag));
            
            return entity;
            
        } catch (error) {
            entity.destroy();
            throw error;
        }
    }

    /**
     * Clone an existing entity
     * @param {Entity} sourceEntity - Entity to clone
     * @param {object} overrides - Component overrides
     * @returns {Entity} Cloned entity
     */
    cloneEntity(sourceEntity, overrides = {}) {
        const clonedEntity = this.world.createEntity();
        
        try {
            // Clone components
            for (const [componentType, component] of sourceEntity.components.entries()) {
                let clonedComponent;
                
                if (overrides[componentType]) {
                    // Use override configuration
                    const ComponentClass = component.constructor;
                    clonedComponent = new ComponentClass(...overrides[componentType]);
                } else {
                    // Clone existing component
                    clonedComponent = component.clone();
                }
                
                clonedEntity.addComponent(clonedComponent);
            }
            
            // Clone tags
            sourceEntity.tags.forEach(tag => clonedEntity.addTag(tag));
            
            return clonedEntity;
            
        } catch (error) {
            clonedEntity.destroy();
            throw error;
        }
    }

    /**
     * Get creation statistics
     * @returns {object} Creation statistics
     */
    getCreationStats() {
        const stats = {};
        
        for (const [templateName, stat] of this.creationStats.entries()) {
            stats[templateName] = { ...stat };
        }
        
        return {
            templates: stats,
            poolSizes: Object.fromEntries(
                Array.from(this.entityPools.entries()).map(([name, pool]) => [name, pool.length])
            ),
            poolingEnabled: this.enablePooling,
            maxPoolSize: this.maxPoolSize
        };
    }

    /**
     * Clear all entity pools
     */
    clearPools() {
        this.entityPools.clear();
        Logger.debug('Entity pools cleared');
    }

    /**
     * Get available templates
     * @returns {string[]} Template names
     */
    getAvailableTemplates() {
        return Array.from(this.templates.keys());
    }

    /**
     * Get template definition
     * @param {string} templateName - Template name
     * @returns {object} Template definition
     */
    getTemplate(templateName) {
        return this.templates.get(templateName);
    }

    /**
     * Check if template exists
     * @param {string} templateName - Template name
     * @returns {boolean} True if template exists
     */
    hasTemplate(templateName) {
        return this.templates.has(templateName);
    }

    /**
     * Cleanup factory resources
     */
    cleanup() {
        this.templates.clear();
        this.entityPools.clear();
        this.creationStats.clear();
        Logger.debug('EntityFactory cleanup complete');
    }
}

/**
 * Pre-configured entity factory instances
 */
export class EntityFactoryPresets {
    /**
     * Create a factory optimized for high-performance games
     * @param {World} world - ECS world
     * @returns {EntityFactory} Optimized factory
     */
    static createPerformanceOptimized(world) {
        const factory = new EntityFactory(world);
        
        // Register component pools for frequently used components
        world.registerComponentPool('transform', TransformComponent, 200);
        world.registerComponentPool('velocity', VelocityComponent, 200);
        world.registerComponentPool('render', RenderComponent, 200);
        world.registerComponentPool('collision', CollisionComponent, 100);
        world.registerComponentPool('lifetime', LifetimeComponent, 300);
        
        return factory;
    }

    /**
     * Create a factory for debugging and development
     * @param {World} world - ECS world
     * @returns {EntityFactory} Debug-enabled factory
     */
    static createDebugFactory(world) {
        const factory = new EntityFactory(world);
        factory.enablePooling = false; // Disable pooling for easier debugging
        return factory;
    }
}