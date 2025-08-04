/**
 * Game Components for ECS Architecture
 * 
 * Component definitions following pure data-oriented design.
 * Components contain only data, no logic. All game logic
 * should be implemented in Systems.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { Component } from './ECS.js';

/**
 * Transform Component - Position, rotation, and scale
 */
export class TransformComponent extends Component {
    constructor(x = 0, y = 0, rotation = 0, scaleX = 1, scaleY = 1) {
        super('transform');
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
        
        // Previous frame position for interpolation
        this.previousX = x;
        this.previousY = y;
    }

    reset() {
        super.reset();
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.previousX = 0;
        this.previousY = 0;
    }

    /**
     * Update previous position for interpolation
     */
    updatePrevious() {
        this.previousX = this.x;
        this.previousY = this.y;
    }

    /**
     * Set position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    setPosition(x, y) {
        this.previousX = this.x;
        this.previousY = this.y;
        this.x = x;
        this.y = y;
    }

    /**
     * Translate position
     * @param {number} dx - X delta
     * @param {number} dy - Y delta
     */
    translate(dx, dy) {
        this.previousX = this.x;
        this.previousY = this.y;
        this.x += dx;
        this.y += dy;
    }
}

/**
 * Velocity Component - Movement velocity and acceleration
 */
export class VelocityComponent extends Component {
    constructor(vx = 0, vy = 0, maxSpeed = Infinity) {
        super('velocity');
        this.vx = vx;
        this.vy = vy;
        this.maxSpeed = maxSpeed;
        
        // Acceleration
        this.ax = 0;
        this.ay = 0;
        
        // Drag/friction
        this.drag = 0;
    }

    reset() {
        super.reset();
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = Infinity;
        this.ax = 0;
        this.ay = 0;
        this.drag = 0;
    }

    /**
     * Get current speed (magnitude of velocity)
     * @returns {number} Current speed
     */
    getSpeed() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    /**
     * Set velocity by angle and speed
     * @param {number} angle - Angle in radians
     * @param {number} speed - Speed magnitude
     */
    setFromAngle(angle, speed) {
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    /**
     * Add force to acceleration
     * @param {number} fx - Force X
     * @param {number} fy - Force Y
     */
    addForce(fx, fy) {
        this.ax += fx;
        this.ay += fy;
    }

    /**
     * Limit velocity to max speed
     */
    limitSpeed() {
        const speed = this.getSpeed();
        if (speed > this.maxSpeed) {
            const factor = this.maxSpeed / speed;
            this.vx *= factor;
            this.vy *= factor;
        }
    }
}

/**
 * Render Component - Visual representation data
 */
export class RenderComponent extends Component {
    constructor(config = {}) {
        super('render');
        this.type = config.type || 'circle';
        this.color = config.color || '#FFFFFF';
        this.size = config.size || 10;
        this.width = config.width || this.size;
        this.height = config.height || this.size;
        
        // Visibility
        this.visible = config.visible !== false;
        this.opacity = config.opacity !== undefined ? config.opacity : 1.0;
        
        // Effects
        this.glow = config.glow || false;
        this.glowColor = config.glowColor || this.color;
        this.glowIntensity = config.glowIntensity || 10;
        
        // Animation
        this.pulse = config.pulse || false;
        this.pulseSpeed = config.pulseSpeed || 2.0;
        this.pulseMin = config.pulseMin || 0.8;
        this.pulseMax = config.pulseMax || 1.2;
        this.pulsePhase = Math.random() * Math.PI * 2;
        
        // Sprite data (for future sprite support)
        this.sprite = config.sprite || null;
        this.spriteFrame = config.spriteFrame || 0;
        
        // Z-order for layered rendering
        this.zIndex = config.zIndex || 0;
        
        // Render flags
        this.castShadow = config.castShadow || false;
        this.receiveShadow = config.receiveShadow || false;
    }

    reset() {
        super.reset();
        this.type = 'circle';
        this.color = '#FFFFFF';
        this.size = 10;
        this.width = 10;
        this.height = 10;
        this.visible = true;
        this.opacity = 1.0;
        this.glow = false;
        this.glowColor = '#FFFFFF';
        this.glowIntensity = 10;
        this.pulse = false;
        this.pulseSpeed = 2.0;
        this.pulseMin = 0.8;
        this.pulseMax = 1.2;
        this.pulsePhase = 0;
        this.sprite = null;
        this.spriteFrame = 0;
        this.zIndex = 0;
        this.castShadow = false;
        this.receiveShadow = false;
    }

    /**
     * Update pulse animation
     * @param {number} deltaTime - Time elapsed
     */
    updatePulse(deltaTime) {
        if (this.pulse) {
            this.pulsePhase += deltaTime * this.pulseSpeed;
            const pulseValue = (Math.sin(this.pulsePhase) + 1) * 0.5;
            this.opacity = this.pulseMin + (this.pulseMax - this.pulseMin) * pulseValue;
        }
    }
}

/**
 * Health Component - Health and damage system
 */
export class HealthComponent extends Component {
    constructor(maxHealth = 100, health = null) {
        super('health');
        this.maxHealth = maxHealth;
        this.health = health !== null ? health : maxHealth;
        this.lastDamageTime = 0;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        
        // Regeneration
        this.regeneration = 0; // Health per second
        this.regenerationDelay = 0; // Delay after taking damage
        this.timeSinceLastDamage = 0;
        
        // Death handling
        this.isDead = false;
        this.deathTime = 0;
    }

    reset() {
        super.reset();
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.regeneration = 0;
        this.regenerationDelay = 0;
        this.timeSinceLastDamage = 0;
        this.isDead = false;
        this.deathTime = 0;
    }

    /**
     * Get health as percentage
     * @returns {number} Health percentage (0-1)
     */
    getHealthPercentage() {
        return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    }

    /**
     * Check if entity is at low health
     * @param {number} threshold - Low health threshold (0-1)
     * @returns {boolean} True if at low health
     */
    isLowHealth(threshold = 0.25) {
        return this.getHealthPercentage() <= threshold;
    }

    /**
     * Heal the entity
     * @param {number} amount - Amount to heal
     * @returns {number} Actual amount healed
     */
    heal(amount) {
        if (this.isDead) return 0;
        
        const oldHealth = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        return this.health - oldHealth;
    }

    /**
     * Deal damage to the entity
     * @param {number} amount - Damage amount
     * @param {number} currentTime - Current game time
     * @returns {number} Actual damage dealt
     */
    takeDamage(amount, currentTime) {
        if (this.isDead || this.invulnerable || amount <= 0) return 0;
        
        const oldHealth = this.health;
        this.health = Math.max(0, this.health - amount);
        this.lastDamageTime = currentTime;
        this.timeSinceLastDamage = 0;
        
        if (this.health <= 0 && !this.isDead) {
            this.isDead = true;
            this.deathTime = currentTime;
        }
        
        return oldHealth - this.health;
    }

    /**
     * Update health regeneration and invulnerability
     * @param {number} deltaTime - Time elapsed
     * @param {number} currentTime - Current game time
     */
    update(deltaTime, currentTime) {
        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerabilityTime -= deltaTime;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update regeneration
        this.timeSinceLastDamage += deltaTime;
        if (this.regeneration > 0 && 
            this.timeSinceLastDamage >= this.regenerationDelay && 
            !this.isDead) {
            this.heal(this.regeneration * deltaTime);
        }
    }
}

/**
 * Collision Component - Collision detection data
 */
export class CollisionComponent extends Component {
    constructor(config = {}) {
        super('collision');
        this.type = config.type || 'circle'; // 'circle', 'rectangle', 'polygon'
        this.radius = config.radius || 10;
        this.width = config.width || 20;
        this.height = config.height || 20;
        
        // Offset from transform position
        this.offsetX = config.offsetX || 0;
        this.offsetY = config.offsetY || 0;
        
        // Collision layers/masks
        this.layer = config.layer || 'default';
        this.mask = config.mask || ['default'];
        
        // Collision response
        this.isTrigger = config.isTrigger || false;
        this.isStatic = config.isStatic || false;
        
        // Physics properties
        this.mass = config.mass || 1;
        this.bounce = config.bounce || 0;
        this.friction = config.friction || 0;
        
        // Current collision state
        this.isColliding = false;
        this.collidingWith = [];
    }

    reset() {
        super.reset();
        this.type = 'circle';
        this.radius = 10;
        this.width = 20;
        this.height = 20;
        this.offsetX = 0;
        this.offsetY = 0;
        this.layer = 'default';
        this.mask = ['default'];
        this.isTrigger = false;
        this.isStatic = false;
        this.mass = 1;
        this.bounce = 0;
        this.friction = 0;
        this.isColliding = false;
        this.collidingWith.length = 0;
    }

    /**
     * Get actual collision bounds accounting for offset
     * @param {TransformComponent} transform - Entity transform
     * @returns {object} Collision bounds
     */
    getBounds(transform) {
        const centerX = transform.x + this.offsetX;
        const centerY = transform.y + this.offsetY;
        
        if (this.type === 'circle') {
            return {
                type: 'circle',
                x: centerX,
                y: centerY,
                radius: this.radius
            };
        } else if (this.type === 'rectangle') {
            return {
                type: 'rectangle',
                x: centerX,
                y: centerY,
                width: this.width,
                height: this.height,
                left: centerX - this.width / 2,
                right: centerX + this.width / 2,
                top: centerY - this.height / 2,
                bottom: centerY + this.height / 2
            };
        }
        
        return null;
    }

    /**
     * Check if this collision component can collide with another layer
     * @param {string} otherLayer - Other collision layer
     * @returns {boolean} True if can collide
     */
    canCollideWith(otherLayer) {
        return this.mask.includes(otherLayer) || this.mask.includes('*');
    }
}

/**
 * Lifetime Component - Entity lifetime management
 */
export class LifetimeComponent extends Component {
    constructor(lifetime = 1.0) {
        super('lifetime');
        this.maxLifetime = lifetime;
        this.currentLifetime = lifetime;
        this.destroyOnExpire = true;
        
        // Fade effects
        this.fadeOut = false;
        this.fadeInTime = 0;
        this.fadeOutTime = 0.2;
    }

    reset() {
        super.reset();
        this.currentLifetime = this.maxLifetime;
        this.destroyOnExpire = true;
        this.fadeOut = false;
        this.fadeInTime = 0;
        this.fadeOutTime = 0.2;
    }

    /**
     * Update lifetime
     * @param {number} deltaTime - Time elapsed
     * @returns {boolean} True if still alive
     */
    update(deltaTime) {
        this.currentLifetime -= deltaTime;
        return this.currentLifetime > 0;
    }

    /**
     * Get lifetime as percentage
     * @returns {number} Lifetime percentage (0-1)
     */
    getLifetimePercentage() {
        return this.maxLifetime > 0 ? this.currentLifetime / this.maxLifetime : 0;
    }

    /**
     * Get fade alpha based on lifetime
     * @returns {number} Alpha value (0-1)
     */
    getFadeAlpha() {
        const lifetimePercent = this.getLifetimePercentage();
        
        if (this.fadeOut && lifetimePercent < this.fadeOutTime / this.maxLifetime) {
            return lifetimePercent / (this.fadeOutTime / this.maxLifetime);
        }
        
        if (this.fadeInTime > 0 && lifetimePercent > (1 - this.fadeInTime / this.maxLifetime)) {
            return 1 - (lifetimePercent - (1 - this.fadeInTime / this.maxLifetime)) / (this.fadeInTime / this.maxLifetime);
        }
        
        return 1.0;
    }
}

/**
 * Input Component - Input handling state
 */
export class InputComponent extends Component {
    constructor() {
        super('input');
        
        // Movement input
        this.moveX = 0;
        this.moveY = 0;
        this.targetX = 0;
        this.targetY = 0;
        
        // Mouse input
        this.mouseX = 0;
        this.mouseY = 0;
        this.mousePressed = false;
        this.mouseJustPressed = false;
        this.mouseJustReleased = false;
        
        // Keyboard input
        this.keys = new Set();
        this.keysJustPressed = new Set();
        this.keysJustReleased = new Set();
        
        // Touch input (for mobile)
        this.touches = [];
    }

    reset() {
        super.reset();
        this.moveX = 0;
        this.moveY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mousePressed = false;
        this.mouseJustPressed = false;
        this.mouseJustReleased = false;
        this.keys.clear();
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
        this.touches.length = 0;
    }

    /**
     * Check if a key is currently pressed
     * @param {string} key - Key to check
     * @returns {boolean} True if pressed
     */
    isKeyPressed(key) {
        return this.keys.has(key.toLowerCase());
    }

    /**
     * Check if a key was just pressed this frame
     * @param {string} key - Key to check
     * @returns {boolean} True if just pressed
     */
    isKeyJustPressed(key) {
        return this.keysJustPressed.has(key.toLowerCase());
    }

    /**
     * Check if a key was just released this frame
     * @param {string} key - Key to check
     * @returns {boolean} True if just released
     */
    isKeyJustReleased(key) {
        return this.keysJustReleased.has(key.toLowerCase());
    }

    /**
     * Get normalized movement vector
     * @returns {object} Movement vector {x, y}
     */
    getMovementVector() {
        const magnitude = Math.sqrt(this.moveX * this.moveX + this.moveY * this.moveY);
        if (magnitude === 0) return { x: 0, y: 0 };
        
        return {
            x: this.moveX / magnitude,
            y: this.moveY / magnitude
        };
    }
}

/**
 * AI Component - AI behavior state
 */
export class AIComponent extends Component {
    constructor(behaviorType = 'none') {
        super('ai');
        this.behaviorType = behaviorType;
        this.state = 'idle';
        this.target = null;
        
        // AI parameters
        this.sightRange = 200;
        this.attackRange = 50;
        this.fleeRange = 100;
        this.wanderRadius = 150;
        
        // Behavior timers
        this.stateTimer = 0;
        this.decisionTimer = 0;
        this.decisionInterval = 0.5; // Make decisions every 0.5 seconds
        
        // Movement
        this.desiredDirection = { x: 0, y: 0 };
        this.avoidanceForce = { x: 0, y: 0 };
        
        // Pathfinding
        this.path = [];
        this.pathIndex = 0;
        
        // Behavior flags
        this.canAttack = true;
        this.canFlee = true;
        this.canWander = true;
        this.aggressive = true;
    }

    reset() {
        super.reset();
        this.behaviorType = 'none';
        this.state = 'idle';
        this.target = null;
        this.sightRange = 200;
        this.attackRange = 50;
        this.fleeRange = 100;
        this.wanderRadius = 150;
        this.stateTimer = 0;
        this.decisionTimer = 0;
        this.decisionInterval = 0.5;
        this.desiredDirection = { x: 0, y: 0 };
        this.avoidanceForce = { x: 0, y: 0 };
        this.path.length = 0;
        this.pathIndex = 0;
        this.canAttack = true;
        this.canFlee = true;
        this.canWander = true;
        this.aggressive = true;
    }

    /**
     * Check if it's time to make a new decision
     * @param {number} deltaTime - Time elapsed
     * @returns {boolean} True if should make decision
     */
    shouldMakeDecision(deltaTime) {
        this.decisionTimer += deltaTime;
        if (this.decisionTimer >= this.decisionInterval) {
            this.decisionTimer = 0;
            return true;
        }
        return false;
    }

    /**
     * Set AI state
     * @param {string} newState - New AI state
     */
    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.stateTimer = 0;
        }
    }

    /**
     * Update state timer
     * @param {number} deltaTime - Time elapsed
     */
    updateTimers(deltaTime) {
        this.stateTimer += deltaTime;
    }
}

/**
 * Weapon Component - Weapon system data
 */
export class WeaponComponent extends Component {
    constructor(config = {}) {
        super('weapon');
        this.weaponType = config.weaponType || 'basic';
        this.damage = config.damage || 10;
        this.range = config.range || 100;
        this.cooldown = config.cooldown || 1.0;
        this.currentCooldown = 0;
        
        // Projectile properties
        this.projectileSpeed = config.projectileSpeed || 200;
        this.projectileLifetime = config.projectileLifetime || 2.0;
        this.piercing = config.piercing || 1;
        
        // Auto-targeting
        this.autoTarget = config.autoTarget !== false;
        this.targetingRange = config.targetingRange || this.range;
        this.currentTarget = null;
        
        // Weapon upgrades
        this.level = 1;
        this.maxLevel = config.maxLevel || 10;
        
        // Ammo system (if applicable)
        this.maxAmmo = config.maxAmmo || -1; // -1 = infinite
        this.currentAmmo = this.maxAmmo;
        this.reloadTime = config.reloadTime || 2.0;
        this.reloading = false;
        this.reloadTimer = 0;
    }

    reset() {
        super.reset();
        this.weaponType = 'basic';
        this.damage = 10;
        this.range = 100;
        this.cooldown = 1.0;
        this.currentCooldown = 0;
        this.projectileSpeed = 200;
        this.projectileLifetime = 2.0;
        this.piercing = 1;
        this.autoTarget = true;
        this.targetingRange = 100;
        this.currentTarget = null;
        this.level = 1;
        this.maxLevel = 10;
        this.maxAmmo = -1;
        this.currentAmmo = -1;
        this.reloadTime = 2.0;
        this.reloading = false;
        this.reloadTimer = 0;
    }

    /**
     * Check if weapon can fire
     * @returns {boolean} True if can fire
     */
    canFire() {
        return this.currentCooldown <= 0 && 
               !this.reloading && 
               (this.maxAmmo === -1 || this.currentAmmo > 0);
    }

    /**
     * Fire the weapon
     */
    fire() {
        if (!this.canFire()) return false;
        
        this.currentCooldown = this.cooldown;
        
        if (this.maxAmmo > 0) {
            this.currentAmmo--;
            if (this.currentAmmo <= 0) {
                this.startReload();
            }
        }
        
        return true;
    }

    /**
     * Start reloading
     */
    startReload() {
        if (this.maxAmmo === -1) return;
        
        this.reloading = true;
        this.reloadTimer = this.reloadTime;
    }

    /**
     * Update weapon timers
     * @param {number} deltaTime - Time elapsed
     */
    update(deltaTime) {
        // Update cooldown
        if (this.currentCooldown > 0) {
            this.currentCooldown -= deltaTime;
        }
        
        // Update reload
        if (this.reloading) {
            this.reloadTimer -= deltaTime;
            if (this.reloadTimer <= 0) {
                this.reloading = false;
                this.currentAmmo = this.maxAmmo;
            }
        }
    }

    /**
     * Upgrade weapon to next level
     */
    upgrade() {
        if (this.level < this.maxLevel) {
            this.level++;
            
            // Apply level scaling
            const levelMultiplier = 1 + (this.level - 1) * 0.2;
            this.damage *= levelMultiplier;
            this.cooldown *= 0.95; // Slightly faster
            
            return true;
        }
        return false;
    }
}