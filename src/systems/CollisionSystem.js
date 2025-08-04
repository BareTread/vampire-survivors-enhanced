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
import { Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';

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

        // Circle-circle collision (simplified)
        if (collisionA.type === 'circle' && collisionB.type === 'circle') {
            const dx = transformA.x - transformB.x;
            const dy = transformA.y - transformB.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = collisionA.radius + collisionB.radius;
            
            return distance < minDistance;
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

    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            collisionStats: this.collisionStats,
            spatialGridSize: this.spatialGrid.size,
            collisionConfig: this.collisionConfig
        };
    }
}