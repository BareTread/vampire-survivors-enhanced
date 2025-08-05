/**
 * Movement System - ECS-based Movement and Physics
 * 
 * Handles entity movement, velocity, and basic physics using proper
 * ECS architecture with component-based data and system-based logic.
 * 
 * Features:
 * - Velocity-based movement with acceleration
 * - Drag and friction simulation
 * - Collision-aware movement
 * - Performance-optimized spatial updates
 * - Configurable physics parameters
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { TransformComponent, VelocityComponent, CollisionComponent } from '../core/Components.js';
import { Config } from '../core/ConfigManager.js';
import { LoggerInstance as Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';

/**
 * Movement System for handling entity movement and basic physics
 */
export class MovementSystem extends BaseSystem {
    /**
     * Initialize movement system
     * @param {World} world - ECS world reference
     * @param {string} name - System name
     * @param {object} config - System configuration
     */
    constructor(world, name = 'movement', config = {}) {
        super(world, name, config);
        
        // Physics configuration
        this.physicsConfig = {
            maxVelocity: config.maxVelocity || 1000,
            minVelocity: config.minVelocity || 0.1,
            gravityX: config.gravityX || 0,
            gravityY: config.gravityY || 0,
            defaultDrag: config.defaultDrag || 0.98,
            enableCollisionResponse: config.enableCollisionResponse !== false,
            spatialOptimization: config.spatialOptimization !== false
        };

        // Spatial optimization
        this.spatialGrid = new Map();
        this.gridSize = config.gridSize || 64;
        this.lastSpatialUpdate = 0;
        this.spatialUpdateInterval = config.spatialUpdateInterval || 50; // ms

        // Performance tracking
        this.movementStats = {
            entitiesProcessed: 0,
            collisionChecks: 0,
            spatialUpdates: 0
        };

        // Collision system integration
        this.collisionSystem = null;
    }

    /**
     * System-specific initialization
     */
    onInit() {
        // Create entity queries for performance
        this.createEntityQuery('moveable', 'transform', 'velocity');
        this.createEntityQuery('collidable', 'transform', 'velocity', 'collision');
        this.createEntityQuery('static', 'transform', 'collision');

        // Set up event handlers
        this.addEventListener('entityAdded', this.onEntityAdded.bind(this));
        this.addEventListener('entityRemoved', this.onEntityRemoved.bind(this));

        Logger.debug('MovementSystem initialized', {
            physicsConfig: this.physicsConfig,
            gridSize: this.gridSize
        });
    }

    /**
     * Handle entity added to world
     * @param {object} event - Entity added event
     */
    onEntityAdded(event) {
        const entity = event.entity;
        if (entity.hasComponents('transform', 'velocity')) {
            this.invalidateCache();
        }
    }

    /**
     * Handle entity removed from world
     * @param {object} event - Entity removed event
     */
    onEntityRemoved(event) {
        const entity = event.entity;
        if (entity.hasComponents('transform', 'velocity')) {
            this.removeFromSpatialGrid(entity);
            this.invalidateCache();
        }
    }

    /**
     * Main movement update
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Reset stats
        this.movementStats.entitiesProcessed = 0;
        this.movementStats.collisionChecks = 0;
        this.movementStats.spatialUpdates = 0;

        // Update spatial grid if needed
        this.updateSpatialGrid();

        // Process movement for all entities with transform and velocity
        const moveableEntities = this.executeQuery('moveable');
        
        for (const entity of moveableEntities) {
            this.updateEntityMovement(entity, deltaTime);
            this.movementStats.entitiesProcessed++;
        }

        // Handle collision responses for collidable entities
        if (this.physicsConfig.enableCollisionResponse) {
            this.handleCollisionResponses(deltaTime);
        }

        // Apply world bounds constraints
        this.applyWorldBounds(moveableEntities);

        // Update performance stats
        this.performanceStats.entityCount = moveableEntities.length;
    }

    /**
     * Update movement for a single entity
     * @param {Entity} entity - Entity to update
     * @param {number} deltaTime - Time delta
     * @private
     */
    updateEntityMovement(entity, deltaTime) {
        const transform = entity.getComponent('transform');
        const velocity = entity.getComponent('velocity');

        if (!transform || !velocity) return;

        // Store previous position for collision detection
        transform.updatePrevious();

        // Apply gravity
        if (this.physicsConfig.gravityX !== 0 || this.physicsConfig.gravityY !== 0) {
            velocity.addForce(
                this.physicsConfig.gravityX * deltaTime,
                this.physicsConfig.gravityY * deltaTime
            );
        }

        // Apply acceleration to velocity
        velocity.vx += velocity.ax * deltaTime;
        velocity.vy += velocity.ay * deltaTime;

        // Reset acceleration (forces are applied each frame)
        velocity.ax = 0;
        velocity.ay = 0;

        // Apply drag
        const drag = velocity.drag || this.physicsConfig.defaultDrag;
        if (drag > 0) {
            velocity.vx *= Math.pow(drag, deltaTime * 60); // Frame-rate independent
            velocity.vy *= Math.pow(drag, deltaTime * 60);
        }

        // Limit velocity to max speed
        velocity.limitSpeed();

        // Apply velocity damping for very small velocities
        if (Math.abs(velocity.vx) < this.physicsConfig.minVelocity) velocity.vx = 0;
        if (Math.abs(velocity.vy) < this.physicsConfig.minVelocity) velocity.vy = 0;

        // Update position based on velocity
        transform.translate(
            velocity.vx * deltaTime,
            velocity.vy * deltaTime
        );

        // Validate position for numerical stability
        this.validateEntityPosition(entity);
    }

    /**
     * Handle collision responses
     * @param {number} deltaTime - Time delta
     * @private
     */
    handleCollisionResponses(deltaTime) {
        const collidableEntities = this.executeQuery('collidable');
        
        for (const entity of collidableEntities) {
            const collision = entity.getComponent('collision');
            
            if (!collision || collision.collidingWith.length === 0) continue;
            
            this.resolveCollisions(entity, deltaTime);
            this.movementStats.collisionChecks += collision.collidingWith.length;
        }
    }

    /**
     * Resolve collisions for an entity
     * @param {Entity} entity - Entity with collisions
     * @param {number} deltaTime - Time delta
     * @private
     */
    resolveCollisions(entity, deltaTime) {
        const transform = entity.getComponent('transform');
        const velocity = entity.getComponent('velocity');
        const collision = entity.getComponent('collision');

        if (!transform || !velocity || !collision) return;

        for (const otherEntity of collision.collidingWith) {
            const otherCollision = otherEntity.getComponent('collision');
            if (!otherCollision) continue;

            // Skip trigger collisions for movement response
            if (collision.isTrigger || otherCollision.isTrigger) continue;

            // Apply collision response based on physics properties
            this.applyCollisionResponse(entity, otherEntity, deltaTime);
        }
    }

    /**
     * Apply collision response between two entities
     * @param {Entity} entityA - First entity
     * @param {Entity} entityB - Second entity
     * @param {number} deltaTime - Time delta
     * @private
     */
    applyCollisionResponse(entityA, entityB, deltaTime) {
        const transformA = entityA.getComponent('transform');
        const velocityA = entityA.getComponent('velocity');
        const collisionA = entityA.getComponent('collision');

        const transformB = entityB.getComponent('transform');
        const velocityB = entityB.getComponent('velocity');
        const collisionB = entityB.getComponent('collision');

        if (!transformA || !velocityA || !collisionA) return;

        // Calculate collision normal
        const dx = transformA.x - (transformB?.x || 0);
        const dy = transformA.y - (transformB?.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const normalX = dx / distance;
        const normalY = dy / distance;

        // Separate entities to prevent overlap
        const overlap = (collisionA.radius || 10) + (collisionB?.radius || 10) - distance;
        if (overlap > 0) {
            const separationX = normalX * overlap * 0.5;
            const separationY = normalY * overlap * 0.5;

            // Move both entities if they're both dynamic
            if (!collisionA.isStatic && !collisionB?.isStatic && velocityB) {
                transformA.translate(separationX, separationY);
                transformB.translate(-separationX, -separationY);
            } else if (!collisionA.isStatic) {
                // Only move the first entity if the second is static
                transformA.translate(separationX * 2, separationY * 2);
            }
        }

        // Apply velocity response for elastic collision
        if (collisionA.bounce > 0 || collisionB?.bounce > 0) {
            const bounce = Math.max(collisionA.bounce, collisionB?.bounce || 0);
            
            // Calculate relative velocity along normal
            const relativeVelX = velocityA.vx - (velocityB?.vx || 0);
            const relativeVelY = velocityA.vy - (velocityB?.vy || 0);
            const velAlongNormal = relativeVelX * normalX + relativeVelY * normalY;

            // Don't resolve if velocities are separating
            if (velAlongNormal > 0) return;

            // Calculate impulse
            const massA = collisionA.mass || 1;
            const massB = collisionB?.mass || 1;
            const impulse = -(1 + bounce) * velAlongNormal / (massA + massB);

            // Apply impulse
            velocityA.vx += impulse * normalX * massB;
            velocityA.vy += impulse * normalY * massB;

            if (velocityB && !collisionB?.isStatic) {
                velocityB.vx -= impulse * normalX * massA;
                velocityB.vy -= impulse * normalY * massA;
            }
        } else {
            // Inelastic collision - reduce velocity along normal
            const velocityReduction = 0.5;
            const normalVelocity = velocityA.vx * normalX + velocityA.vy * normalY;
            
            if (normalVelocity < 0) {
                velocityA.vx -= normalX * normalVelocity * velocityReduction;
                velocityA.vy -= normalY * normalVelocity * velocityReduction;
            }
        }
    }

    /**
     * Apply world bounds constraints
     * @param {Entity[]} entities - Entities to constrain
     * @private
     */
    applyWorldBounds(entities) {
        const worldBounds = Config.get('game.worldBounds');
        if (!worldBounds) return;

        const halfWidth = worldBounds.width / 2;
        const halfHeight = worldBounds.height / 2;

        for (const entity of entities) {
            const transform = entity.getComponent('transform');
            const velocity = entity.getComponent('velocity');
            
            if (!transform || !velocity) continue;

            // Check bounds and apply constraints
            if (transform.x < -halfWidth) {
                transform.x = -halfWidth;
                velocity.vx = Math.max(0, velocity.vx); // Stop moving left
            } else if (transform.x > halfWidth) {
                transform.x = halfWidth;
                velocity.vx = Math.min(0, velocity.vx); // Stop moving right
            }

            if (transform.y < -halfHeight) {
                transform.y = -halfHeight;
                velocity.vy = Math.max(0, velocity.vy); // Stop moving up
            } else if (transform.y > halfHeight) {
                transform.y = halfHeight;
                velocity.vy = Math.min(0, velocity.vy); // Stop moving down
            }
        }
    }

    /**
     * Validate entity position for numerical stability
     * @param {Entity} entity - Entity to validate
     * @private
     */
    validateEntityPosition(entity) {
        const transform = entity.getComponent('transform');
        if (!transform) return;

        // Check for invalid positions
        if (!isFinite(transform.x) || !isFinite(transform.y)) {
            Logger.warn(`Invalid position detected for entity ${entity.id}`, {
                x: transform.x,
                y: transform.y
            });

            // Reset to safe position
            transform.x = 0;
            transform.y = 0;
            
            const velocity = entity.getComponent('velocity');
            if (velocity) {
                velocity.vx = 0;
                velocity.vy = 0;
            }
        }

        // Check for extreme positions that might cause issues
        const maxCoordinate = 10000;
        if (Math.abs(transform.x) > maxCoordinate || Math.abs(transform.y) > maxCoordinate) {
            Logger.warn(`Extreme position detected for entity ${entity.id}`, {
                x: transform.x,
                y: transform.y
            });

            // Clamp to reasonable bounds
            transform.x = Math.sign(transform.x) * Math.min(Math.abs(transform.x), maxCoordinate);
            transform.y = Math.sign(transform.y) * Math.min(Math.abs(transform.y), maxCoordinate);
        }
    }

    /**
     * Update spatial grid for collision optimization
     * @private
     */
    updateSpatialGrid() {
        const now = performance.now();
        if (now - this.lastSpatialUpdate < this.spatialUpdateInterval) return;

        this.spatialGrid.clear();
        
        const collidableEntities = this.executeQuery('collidable');
        
        for (const entity of collidableEntities) {
            this.addToSpatialGrid(entity);
        }

        this.lastSpatialUpdate = now;
        this.movementStats.spatialUpdates++;
    }

    /**
     * Add entity to spatial grid
     * @param {Entity} entity - Entity to add
     * @private
     */
    addToSpatialGrid(entity) {
        const transform = entity.getComponent('transform');
        if (!transform) return;

        const gridX = Math.floor(transform.x / this.gridSize);
        const gridY = Math.floor(transform.y / this.gridSize);
        const key = `${gridX},${gridY}`;

        if (!this.spatialGrid.has(key)) {
            this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push(entity);
    }

    /**
     * Remove entity from spatial grid
     * @param {Entity} entity - Entity to remove
     * @private
     */
    removeFromSpatialGrid(entity) {
        const transform = entity.getComponent('transform');
        if (!transform) return;

        const gridX = Math.floor(transform.x / this.gridSize);
        const gridY = Math.floor(transform.y / this.gridSize);
        const key = `${gridX},${gridY}`;

        const gridCell = this.spatialGrid.get(key);
        if (gridCell) {
            const index = gridCell.indexOf(entity);
            if (index !== -1) {
                gridCell.splice(index, 1);
                if (gridCell.length === 0) {
                    this.spatialGrid.delete(key);
                }
            }
        }
    }

    /**
     * Get nearby entities using spatial grid
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} radius - Search radius
     * @returns {Entity[]} Nearby entities
     */
    getNearbyEntities(x, y, radius) {
        const entities = [];
        const gridRadius = Math.ceil(radius / this.gridSize);
        const centerGridX = Math.floor(x / this.gridSize);
        const centerGridY = Math.floor(y / this.gridSize);

        for (let gx = centerGridX - gridRadius; gx <= centerGridX + gridRadius; gx++) {
            for (let gy = centerGridY - gridRadius; gy <= centerGridY + gridRadius; gy++) {
                const key = `${gx},${gy}`;
                const gridCell = this.spatialGrid.get(key);
                
                if (gridCell) {
                    for (const entity of gridCell) {
                        const transform = entity.getComponent('transform');
                        if (transform) {
                            const dx = transform.x - x;
                            const dy = transform.y - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance <= radius) {
                                entities.push(entity);
                            }
                        }
                    }
                }
            }
        }

        return entities;
    }

    /**
     * Handle configuration changes
     * @param {string} path - Configuration path
     * @param {*} value - New value
     */
    onConfigChanged(path, value) {
        super.onConfigChanged(path, value);

        if (path.includes('physics')) {
            // Update physics configuration
            Object.assign(this.physicsConfig, Config.getSection('systems.movement.physics'));
            Logger.debug('Movement physics config updated', this.physicsConfig);
        }

        if (path.includes('spatial')) {
            // Update spatial optimization settings
            this.gridSize = Config.get('systems.movement.gridSize') || this.gridSize;
            this.spatialUpdateInterval = Config.get('systems.movement.spatialUpdateInterval') || this.spatialUpdateInterval;
            this.invalidateCache();
        }
    }

    /**
     * Get movement statistics
     * @returns {object} Movement statistics
     */
    getMovementStats() {
        return {
            ...this.movementStats,
            spatialGridSize: this.spatialGrid.size,
            physicsConfig: this.physicsConfig
        };
    }

    /**
     * Get debug information
     * @returns {object} Debug information
     */
    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            movementStats: this.getMovementStats(),
            entityQueries: {
                moveable: this.executeQuery('moveable').length,
                collidable: this.executeQuery('collidable').length,
                static: this.executeQuery('static').length
            }
        };
    }

    /**
     * Validate system requirements
     * @returns {boolean} True if requirements are met
     */
    validateRequirements() {
        // Check if required components are available
        const requiredComponents = [TransformComponent, VelocityComponent];
        
        for (const ComponentClass of requiredComponents) {
            if (!ComponentClass) {
                Logger.error(`MovementSystem requires ${ComponentClass?.name || 'unknown'} component`);
                return false;
            }
        }

        return true;
    }

    /**
     * System cleanup
     */
    onCleanup() {
        this.spatialGrid.clear();
        this.movementStats = {
            entitiesProcessed: 0,
            collisionChecks: 0,
            spatialUpdates: 0
        };
    }
}