/**
 * Collision System - ECS-based Collision Detection
 * 
 * High-performance collision detection and response system using
 * spatial partitioning and component-based architecture.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { LoggerInstance as Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * Collision System for handling collision detection and response
 */
export class CollisionSystem extends BaseSystem {
    constructor(world, name = 'collision', config = {}) {
        super(world, name, config);
        
        // Collision configuration
        this.collisionConfig = {
            enableBroadPhase: config.enableBroadPhase !== false,
            spatialGridSize: config.spatialGridSize || 64,
            maxCollisionsPerEntity: config.maxCollisionsPerEntity || 10
        };
        
        // Spatial grid for broad phase collision detection
        this.spatialGrid = new Map();
        this.lastGridUpdate = 0;
        this.gridUpdateInterval = 50; // ms
        
        // Collision stats
        this.collisionStats = {
            broadPhaseChecks: 0,
            narrowPhaseChecks: 0,
            collisionsDetected: 0
        };
    }

    onInit() {
        this.createEntityQuery('collidable', 'transform', 'collision');
        Logger.debug('CollisionSystem initialized');
    }

    onUpdate(deltaTime) {
        // Reset stats
        this.collisionStats.broadPhaseChecks = 0;
        this.collisionStats.narrowPhaseChecks = 0;
        this.collisionStats.collisionsDetected = 0;

        // Update spatial grid
        this.updateSpatialGrid();

        // Clear previous collision state
        this.clearCollisionState();

        // Detect collisions
        this.detectCollisions();

        // Emit collision events
        this.processCollisionEvents();
    }

    updateSpatialGrid() {
        const now = performance.now();
        if (now - this.lastGridUpdate < this.gridUpdateInterval) return;

        this.spatialGrid.clear();
        
        const entities = this.executeQuery('collidable');
        
        for (const entity of entities) {
            this.addToSpatialGrid(entity);
        }

        this.lastGridUpdate = now;
    }

    addToSpatialGrid(entity) {
        const transform = entity.getComponent('transform');
        const collision = entity.getComponent('collision');
        
        if (!transform || !collision) return;

        const gridX = Math.floor(transform.x / this.collisionConfig.spatialGridSize);
        const gridY = Math.floor(transform.y / this.collisionConfig.spatialGridSize);
        const key = `${gridX},${gridY}`;

        if (!this.spatialGrid.has(key)) {
            this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push(entity);
    }

    clearCollisionState() {
        const entities = this.executeQuery('collidable');
        
        for (const entity of entities) {
            const collision = entity.getComponent('collision');
            if (collision) {
                collision.isColliding = false;
                collision.collidingWith.length = 0;
            }
        }
    }

    detectCollisions() {
        const entities = this.executeQuery('collidable');
        
        for (const entity of entities) {
            this.detectEntityCollisions(entity);
        }
    }

    detectEntityCollisions(entity) {
        const transform = entity.getComponent('transform');
        const collision = entity.getComponent('collision');
        
        if (!transform || !collision) return;

        // Get nearby entities using spatial grid
        const nearbyEntities = this.getNearbyEntities(entity);
        this.collisionStats.broadPhaseChecks += nearbyEntities.length;

        for (const otherEntity of nearbyEntities) {
            if (entity === otherEntity) continue;
            if (collision.collidingWith.length >= this.collisionConfig.maxCollisionsPerEntity) break;

            const otherCollision = otherEntity.getComponent('collision');
            if (!otherCollision) continue;

            // Check collision layers
            if (!collision.canCollideWith(otherCollision.layer)) continue;

            // Narrow phase collision detection
            if (this.checkCollision(entity, otherEntity)) {
                this.handleCollision(entity, otherEntity);
                this.collisionStats.collisionsDetected++;
            }
            
            this.collisionStats.narrowPhaseChecks++;
        }
    }

    getNearbyEntities(entity) {
        if (!this.collisionConfig.enableBroadPhase) {
            return this.executeQuery('collidable');
        }

        const transform = entity.getComponent('transform');
        const collision = entity.getComponent('collision');
        
        if (!transform || !collision) return [];

        const entities = [];
        const searchRadius = Math.ceil((collision.radius || 20) / this.collisionConfig.spatialGridSize);
        const centerGridX = Math.floor(transform.x / this.collisionConfig.spatialGridSize);
        const centerGridY = Math.floor(transform.y / this.collisionConfig.spatialGridSize);

        for (let gx = centerGridX - searchRadius; gx <= centerGridX + searchRadius; gx++) {
            for (let gy = centerGridY - searchRadius; gy <= centerGridY + searchRadius; gy++) {
                const key = `${gx},${gy}`;
                const gridEntities = this.spatialGrid.get(key);
                
                if (gridEntities) {
                    entities.push(...gridEntities);
                }
            }
        }

        return entities;
    }

    checkCollision(entityA, entityB) {
        const transformA = entityA.getComponent('transform');
        const collisionA = entityA.getComponent('collision');
        const transformB = entityB.getComponent('transform');
        const collisionB = entityB.getComponent('collision');

        if (!transformA || !collisionA || !transformB || !collisionB) return false;

        // Circle-circle collision (simplified) - using squared distance for performance
        if (collisionA.type === 'circle' && collisionB.type === 'circle') {
            const distanceSquared = MathUtils.distanceSquared(
                transformA.x, transformA.y, transformB.x, transformB.y
            );
            const minDistance = collisionA.radius + collisionB.radius;
            const minDistanceSquared = minDistance * minDistance;
            
            return distanceSquared < minDistanceSquared;
        }

        // Add more collision types as needed
        return false;
    }

    handleCollision(entityA, entityB) {
        const collisionA = entityA.getComponent('collision');
        const collisionB = entityB.getComponent('collision');

        if (!collisionA || !collisionB) return;

        // Add to collision lists
        if (!collisionA.collidingWith.includes(entityB)) {
            collisionA.collidingWith.push(entityB);
            collisionA.isColliding = true;
        }

        if (!collisionB.collidingWith.includes(entityA)) {
            collisionB.collidingWith.push(entityA);
            collisionB.isColliding = true;
        }
    }

    processCollisionEvents() {
        const entities = this.executeQuery('collidable');
        
        for (const entity of entities) {
            const collision = entity.getComponent('collision');
            
            if (collision && collision.isColliding) {
                for (const otherEntity of collision.collidingWith) {
                    this.emit('collision', {
                        entityA: entity,
                        entityB: otherEntity,
                        timestamp: performance.now()
                    });
                }
            }
        }
    }

    /**
     * Get entities within a radius of a position
     * Primary interface for spatial queries - replaces individual system spatial grids
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} radius - Search radius
     * @param {function} filterFn - Optional filter function
     * @returns {Array} Entities within radius
     */
    getEntitiesInRadius(x, y, radius, filterFn = null) {
        const radiusSquared = radius * radius;
        const results = [];
        
        // Calculate grid bounds for search
        const gridRadius = Math.ceil(radius / this.collisionConfig.spatialGridSize);
        const centerGridX = Math.floor(x / this.collisionConfig.spatialGridSize);
        const centerGridY = Math.floor(y / this.collisionConfig.spatialGridSize);
        
        // Search spatial grid cells
        for (let gx = centerGridX - gridRadius; gx <= centerGridX + gridRadius; gx++) {
            for (let gy = centerGridY - gridRadius; gy <= centerGridY + gridRadius; gy++) {
                const key = `${gx},${gy}`;
                const gridEntities = this.spatialGrid.get(key);
                
                if (gridEntities) {
                    for (const entity of gridEntities) {
                        const transform = entity.getComponent('transform');
                        if (!transform) continue;
                        
                        // Check distance using MathUtils for consistency
                        const distanceSquared = MathUtils.distanceSquared(
                            transform.x, transform.y, x, y
                        );
                        
                        if (distanceSquared <= radiusSquared) {
                            // Apply optional filter
                            if (!filterFn || filterFn(entity)) {
                                results.push(entity);
                            }
                        }
                    }
                }
            }
        }
        
        return results;
    }

    /**
     * Get entities with specific components within radius
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} radius - Search radius
     * @param {...string} componentTypes - Required component types
     * @returns {Array} Filtered entities within radius
     */
    getEntitiesWithComponentsInRadius(x, y, radius, ...componentTypes) {
        return this.getEntitiesInRadius(x, y, radius, entity => {
            return entity.hasComponents(...componentTypes);
        });
    }

    /**
     * Get nearest entity to a position with optional filter
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} maxRadius - Maximum search radius
     * @param {function} filterFn - Optional filter function
     * @returns {Object|null} {entity, distance} or null if none found
     */
    getNearestEntity(x, y, maxRadius = Infinity, filterFn = null) {
        let nearestEntity = null;
        let nearestDistanceSquared = maxRadius * maxRadius;
        
        const entities = this.getEntitiesInRadius(x, y, maxRadius, filterFn);
        
        for (const entity of entities) {
            const transform = entity.getComponent('transform');
            if (!transform) continue;
            
            const distanceSquared = MathUtils.distanceSquared(
                transform.x, transform.y, x, y
            );
            
            if (distanceSquared < nearestDistanceSquared) {
                nearestDistanceSquared = distanceSquared;
                nearestEntity = entity;
            }
        }
        
        return nearestEntity ? {
            entity: nearestEntity,
            distance: Math.sqrt(nearestDistanceSquared),
            distanceSquared: nearestDistanceSquared
        } : null;
    }

    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            collisionStats: this.collisionStats,
            spatialGridSize: this.spatialGrid.size,
            collisionConfig: this.collisionConfig
        };
    }
}