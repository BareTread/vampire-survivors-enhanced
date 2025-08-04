/**
 * Entity-Component-System (ECS) Architecture Framework
 * 
 * This module provides a clean, performant ECS implementation designed for
 * browser games. It emphasizes:
 * - Data-oriented design for performance
 * - Clear separation of concerns
 * - Type safety and developer experience
 * - Memory efficiency with object pooling
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

/**
 * Unique identifier generator for entities
 */
let entityIdCounter = 0;

/**
 * Base Component class - Pure data containers
 * Components should only contain data, no logic
 */
export class Component {
    /**
     * @param {string} type - Component type identifier
     */
    constructor(type) {
        this.type = type;
        this.active = true;
    }

    /**
     * Reset component to default state for object pooling
     */
    reset() {
        this.active = true;
    }

    /**
     * Create a shallow copy of the component
     * @returns {Component} Cloned component
     */
    clone() {
        const cloned = Object.create(Object.getPrototypeOf(this));
        return Object.assign(cloned, this);
    }
}

/**
 * Entity class - Lightweight container for components
 * Entities are just unique IDs with component collections
 */
export class Entity {
    constructor() {
        this.id = ++entityIdCounter;
        this.components = new Map();
        this.active = true;
        this.tags = new Set();
    }

    /**
     * Add a component to this entity
     * @param {Component} component - Component to add
     * @returns {Entity} This entity for chaining
     */
    addComponent(component) {
        if (!(component instanceof Component)) {
            throw new Error(`Invalid component: must extend Component class`);
        }
        
        this.components.set(component.type, component);
        return this;
    }

    /**
     * Get a component by type
     * @param {string} type - Component type
     * @returns {Component|null} The component or null if not found
     */
    getComponent(type) {
        return this.components.get(type) || null;
    }

    /**
     * Check if entity has a component
     * @param {string} type - Component type
     * @returns {boolean} True if component exists
     */
    hasComponent(type) {
        return this.components.has(type);
    }

    /**
     * Check if entity has all specified components
     * @param {...string} types - Component types to check
     * @returns {boolean} True if all components exist
     */
    hasComponents(...types) {
        return types.every(type => this.hasComponent(type));
    }

    /**
     * Remove a component
     * @param {string} type - Component type
     * @returns {Entity} This entity for chaining
     */
    removeComponent(type) {
        this.components.delete(type);
        return this;
    }

    /**
     * Add a tag to this entity
     * @param {string} tag - Tag to add
     * @returns {Entity} This entity for chaining
     */
    addTag(tag) {
        this.tags.add(tag);
        return this;
    }

    /**
     * Check if entity has a tag
     * @param {string} tag - Tag to check
     * @returns {boolean} True if tag exists
     */
    hasTag(tag) {
        return this.tags.has(tag);
    }

    /**
     * Remove entity from world (marks as inactive)
     */
    destroy() {
        this.active = false;
    }

    /**
     * Reset entity for object pooling
     */
    reset() {
        this.components.clear();
        this.tags.clear();
        this.active = true;
    }
}

/**
 * Base System class - Pure logic processors
 * Systems contain logic but no data (except caches)
 */
export class System {
    /**
     * @param {World} world - Reference to the ECS world
     * @param {number} priority - System execution priority (lower = first)
     */
    constructor(world, priority = 0) {
        this.world = world;
        this.priority = priority;
        this.active = true;
        this.name = this.constructor.name;
        
        // Performance tracking
        this.performanceStats = {
            updateTime: 0,
            entityCount: 0,
            lastUpdate: 0
        };
    }

    /**
     * Called once when system is added to world
     */
    init() {
        // Override in subclasses
    }

    /**
     * Main update loop - override in subclasses
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        // Override in subclasses
    }

    /**
     * Render method for systems that need to draw
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Camera} camera - Camera for world transformations
     */
    render(ctx, camera) {
        // Override in subclasses
    }

    /**
     * Called when system is removed from world
     */
    cleanup() {
        // Override in subclasses
    }

    /**
     * Get entities that match the required components
     * @param {...string} componentTypes - Required component types
     * @returns {Entity[]} Matching entities
     */
    getEntities(...componentTypes) {
        const startTime = performance.now();
        const entities = this.world.getEntitiesWith(...componentTypes);
        
        // Update performance stats
        this.performanceStats.entityCount = entities.length;
        this.performanceStats.lastUpdate = startTime;
        
        return entities;
    }

    /**
     * Get performance statistics for this system
     * @returns {object} Performance stats
     */
    getPerformanceStats() {
        return { ...this.performanceStats };
    }
}

/**
 * Component Query Builder for complex entity filtering
 */
export class Query {
    constructor(world) {
        this.world = world;
        this.requiredComponents = [];
        this.excludedComponents = [];
        this.requiredTags = [];
        this.excludedTags = [];
        this.customFilter = null;
    }

    /**
     * Require components
     * @param {...string} types - Component types
     * @returns {Query} This query for chaining
     */
    with(...types) {
        this.requiredComponents.push(...types);
        return this;
    }

    /**
     * Exclude components
     * @param {...string} types - Component types
     * @returns {Query} This query for chaining
     */
    without(...types) {
        this.excludedComponents.push(...types);
        return this;
    }

    /**
     * Require tags
     * @param {...string} tags - Required tags
     * @returns {Query} This query for chaining
     */
    withTag(...tags) {
        this.requiredTags.push(...tags);
        return this;
    }

    /**
     * Exclude tags
     * @param {...string} tags - Excluded tags
     * @returns {Query} This query for chaining
     */
    withoutTag(...tags) {
        this.excludedTags.push(...tags);
        return this;
    }

    /**
     * Add custom filter function
     * @param {function(Entity): boolean} filter - Custom filter
     * @returns {Query} This query for chaining
     */
    where(filter) {
        this.customFilter = filter;
        return this;
    }

    /**
     * Execute the query
     * @returns {Entity[]} Matching entities
     */
    execute() {
        return this.world.entities.filter(entity => {
            if (!entity.active) return false;

            // Check required components
            if (!entity.hasComponents(...this.requiredComponents)) return false;

            // Check excluded components
            if (this.excludedComponents.some(type => entity.hasComponent(type))) return false;

            // Check required tags
            if (!this.requiredTags.every(tag => entity.hasTag(tag))) return false;

            // Check excluded tags
            if (this.excludedTags.some(tag => entity.hasTag(tag))) return false;

            // Apply custom filter
            if (this.customFilter && !this.customFilter(entity)) return false;

            return true;
        });
    }
}

/**
 * Component Pool for memory efficiency
 */
class ComponentPool {
    constructor(componentClass, initialSize = 10) {
        this.componentClass = componentClass;
        this.pool = [];
        this.active = [];
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new componentClass());
        }
    }

    /**
     * Get a component from the pool
     * @returns {Component} Pooled component
     */
    acquire() {
        let component;
        
        if (this.pool.length > 0) {
            component = this.pool.pop();
            component.reset();
        } else {
            component = new this.componentClass();
        }
        
        this.active.push(component);
        return component;
    }

    /**
     * Return a component to the pool
     * @param {Component} component - Component to return
     */
    release(component) {
        const index = this.active.indexOf(component);
        if (index !== -1) {
            this.active.splice(index, 1);
            this.pool.push(component);
        }
    }

    /**
     * Get pool statistics
     * @returns {object} Pool stats
     */
    getStats() {
        return {
            total: this.pool.length + this.active.length,
            available: this.pool.length,
            active: this.active.length
        };
    }
}

/**
 * ECS World - Main coordinator for entities, components, and systems
 */
export class World {
    constructor() {
        this.entities = [];
        this.systems = [];
        this.componentPools = new Map();
        this.entityPool = [];
        
        // Performance tracking
        this.stats = {
            entityCount: 0,
            activeEntityCount: 0,
            systemCount: 0,
            frameTime: 0,
            updateTime: 0,
            renderTime: 0
        };

        // System execution order cache
        this.systemsUpdateOrder = [];
        this.systemsRenderOrder = [];
        this._systemOrderDirty = true;

        // Event system for loose coupling
        this.eventHandlers = new Map();
    }

    /**
     * Create a new entity
     * @returns {Entity} New entity
     */
    createEntity() {
        let entity;
        
        // Use pooled entity if available
        if (this.entityPool.length > 0) {
            entity = this.entityPool.pop();
            entity.reset();
        } else {
            entity = new Entity();
        }
        
        this.entities.push(entity);
        this.stats.entityCount++;
        return entity;
    }

    /**
     * Remove an entity from the world
     * @param {Entity} entity - Entity to remove
     */
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
            this.entityPool.push(entity);
            this.stats.entityCount--;
        }
    }

    /**
     * Get entities that have all specified components
     * @param {...string} componentTypes - Required component types
     * @returns {Entity[]} Matching entities
     */
    getEntitiesWith(...componentTypes) {
        return this.entities.filter(entity => 
            entity.active && entity.hasComponents(...componentTypes)
        );
    }

    /**
     * Create a query builder
     * @returns {Query} New query builder
     */
    query() {
        return new Query(this);
    }

    /**
     * Add a system to the world
     * @param {System} system - System to add
     */
    addSystem(system) {
        if (!(system instanceof System)) {
            throw new Error('System must extend System class');
        }

        this.systems.push(system);
        system.init();
        this._systemOrderDirty = true;
        this.stats.systemCount++;
    }

    /**
     * Remove a system from the world
     * @param {System} system - System to remove
     */
    removeSystem(system) {
        const index = this.systems.indexOf(system);
        if (index !== -1) {
            system.cleanup();
            this.systems.splice(index, 1);
            this._systemOrderDirty = true;
            this.stats.systemCount--;
        }
    }

    /**
     * Get a system by type
     * @param {function} SystemClass - System class
     * @returns {System|null} The system or null
     */
    getSystem(SystemClass) {
        return this.systems.find(system => system instanceof SystemClass) || null;
    }

    /**
     * Update all systems
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        const startTime = performance.now();

        // Update system execution order if needed
        if (this._systemOrderDirty) {
            this._updateSystemOrder();
        }

        // Clean up inactive entities
        this._cleanupEntities();

        // Update active systems
        for (const system of this.systemsUpdateOrder) {
            if (system.active) {
                const systemStart = performance.now();
                system.update(deltaTime);
                system.performanceStats.updateTime = performance.now() - systemStart;
            }
        }

        this.stats.updateTime = performance.now() - startTime;
        this.stats.activeEntityCount = this.entities.filter(e => e.active).length;
    }

    /**
     * Render all systems
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Camera} camera - Camera for transformations
     */
    render(ctx, camera) {
        const startTime = performance.now();

        for (const system of this.systemsRenderOrder) {
            if (system.active && typeof system.render === 'function') {
                system.render(ctx, camera);
            }
        }

        this.stats.renderTime = performance.now() - startTime;
    }

    /**
     * Register a component pool
     * @param {string} type - Component type
     * @param {function} ComponentClass - Component class
     * @param {number} initialSize - Initial pool size
     */
    registerComponentPool(type, ComponentClass, initialSize = 10) {
        this.componentPools.set(type, new ComponentPool(ComponentClass, initialSize));
    }

    /**
     * Get a pooled component
     * @param {string} type - Component type
     * @returns {Component|null} Pooled component or null
     */
    getPooledComponent(type) {
        const pool = this.componentPools.get(type);
        return pool ? pool.acquire() : null;
    }

    /**
     * Return a component to its pool
     * @param {Component} component - Component to pool
     */
    releaseComponent(component) {
        const pool = this.componentPools.get(component.type);
        if (pool) {
            pool.release(component);
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
            handlers.forEach(handler => handler(data));
        }
    }

    /**
     * Listen for an event
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
     * Remove an event listener
     * @param {string} eventType - Event type
     * @param {function} handler - Event handler to remove
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
     * Get world statistics
     * @returns {object} World stats
     */
    getStats() {
        return {
            ...this.stats,
            componentPools: Object.fromEntries(
                Array.from(this.componentPools.entries()).map(([type, pool]) => [
                    type, pool.getStats()
                ])
            )
        };
    }

    /**
     * Clean up the world
     */
    cleanup() {
        // Clean up all systems
        this.systems.forEach(system => system.cleanup());
        this.systems.length = 0;

        // Clear entities
        this.entities.length = 0;
        this.entityPool.length = 0;

        // Clear component pools
        this.componentPools.clear();

        // Clear event handlers
        this.eventHandlers.clear();
    }

    /**
     * Update system execution order based on priority
     * @private
     */
    _updateSystemOrder() {
        this.systemsUpdateOrder = [...this.systems]
            .filter(system => system.active)
            .sort((a, b) => a.priority - b.priority);

        this.systemsRenderOrder = [...this.systems]
            .filter(system => system.active && typeof system.render === 'function')
            .sort((a, b) => a.priority - b.priority);

        this._systemOrderDirty = false;
    }

    /**
     * Remove inactive entities
     * @private
     */
    _cleanupEntities() {
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            if (!entity.active) {
                // Return components to pools
                for (const component of entity.components.values()) {
                    this.releaseComponent(component);
                }
                
                this.removeEntity(entity);
            }
        }
    }
}

/**
 * ECS Factory for common patterns
 */
export class ECSFactory {
    constructor(world) {
        this.world = world;
    }

    /**
     * Create a basic game entity with transform and render components
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {object} renderConfig - Render configuration
     * @returns {Entity} Created entity
     */
    createBasicEntity(x, y, renderConfig = {}) {
        const entity = this.world.createEntity();
        
        // Add basic components
        entity.addComponent(this.createTransformComponent(x, y));
        entity.addComponent(this.createRenderComponent(renderConfig));
        
        return entity;
    }

    /**
     * Create a transform component
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} rotation - Rotation in radians
     * @returns {Component} Transform component
     */
    createTransformComponent(x = 0, y = 0, rotation = 0) {
        // This would be replaced with actual component classes
        return new Component('transform');
    }

    /**
     * Create a render component
     * @param {object} config - Render configuration
     * @returns {Component} Render component
     */
    createRenderComponent(config = {}) {
        // This would be replaced with actual component classes
        return new Component('render');
    }
}

/**
 * Performance Monitor for ECS debugging
 */
export class ECSPerformanceMonitor {
    constructor(world) {
        this.world = world;
        this.history = [];
        this.maxHistoryLength = 60; // 1 second at 60fps
    }

    /**
     * Update performance monitoring
     */
    update() {
        const stats = this.world.getStats();
        this.history.push({
            timestamp: performance.now(),
            ...stats
        });

        // Trim history
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
    }

    /**
     * Get performance report
     * @returns {object} Performance report
     */
    getReport() {
        if (this.history.length === 0) return null;

        const latest = this.history[this.history.length - 1];
        const avg = this.history.reduce((acc, frame) => {
            acc.updateTime += frame.updateTime;
            acc.renderTime += frame.renderTime;
            acc.entityCount += frame.entityCount;
            return acc;
        }, { updateTime: 0, renderTime: 0, entityCount: 0 });

        const count = this.history.length;
        return {
            current: latest,
            average: {
                updateTime: avg.updateTime / count,
                renderTime: avg.renderTime / count,
                entityCount: avg.entityCount / count
            },
            systems: this.world.systems.map(system => ({
                name: system.name,
                performance: system.getPerformanceStats()
            }))
        };
    }
}