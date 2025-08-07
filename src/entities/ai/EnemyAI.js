/**
 * EnemyAI.js
 * 
 * Handles AI behavior and movement logic for enemies
 * Extracted from Enemy.js for better code organization
 */

export class EnemyAI {
    constructor(enemy) {
        this.enemy = enemy;
        this.game = enemy.game;
        
        // AI parameters
        this.aggroRange = 250;
        this.attackRange = 30;
        this.separationDistance = 25;
        this.separationForce = 100;
        this.maxSteerForce = 200;
        
        // Pathfinding
        this.pathUpdateInterval = 500; // ms
        this.lastPathUpdate = 0;
        this.currentPath = [];
        this.pathIndex = 0;
    }
    
    update(deltaTime) {
        if (!this.enemy.active || !this.game.player) return;
        
        // Update AI based on enemy type
        switch (this.enemy.type) {
            case 'melee':
                this.updateMeleeAI(deltaTime);
                break;
            case 'ranged':
                this.updateRangedAI(deltaTime);
                break;
            case 'fast':
                this.updateFastAI(deltaTime);
                break;
            case 'tank':
                this.updateTankAI(deltaTime);
                break;
            case 'elite':
                this.updateEliteAI(deltaTime);
                break;
            default:
                this.updateBasicAI(deltaTime);
        }
    }
    
    updateBasicAI(deltaTime) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Calculate direction to player
        const dx = player.x - this.enemy.x;
        const dy = player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1) {
            // Move towards player with separation from other enemies
            const moveForce = {
                x: (dx / distance) * this.enemy.speed,
                y: (dy / distance) * this.enemy.speed
            };
            
            // Add separation force
            const separation = this.getSeparationForce();
            moveForce.x += separation.x * this.separationForce;
            moveForce.y += separation.y * this.separationForce;
            
            // Apply movement
            this.enemy.velocity.x = moveForce.x;
            this.enemy.velocity.y = moveForce.y;
            
            // Check for attack
            if (distance < this.attackRange) {
                this.enemy.meleeAttack();
            }
        }
    }
    
    updateMeleeAI(deltaTime) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.enemy.x;
        const dy = player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.attackRange) {
            // Enhanced pathfinding for melee units
            const targetPos = this.predictPlayerPosition(distance);
            const moveDir = this.calculateMoveDirection(targetPos.x, targetPos.y);
            
            // Apply flocking behavior
            const separation = this.getSeparationForce();
            const alignment = this.getAlignmentForce();
            
            this.enemy.velocity.x = moveDir.x * this.enemy.speed + 
                                    separation.x * this.separationForce * 1.5 +
                                    alignment.x * 50;
            this.enemy.velocity.y = moveDir.y * this.enemy.speed + 
                                    separation.y * this.separationForce * 1.5 +
                                    alignment.y * 50;
        } else {
            // In attack range
            this.enemy.velocity.x *= 0.5;
            this.enemy.velocity.y *= 0.5;
            this.enemy.meleeAttack();
        }
    }
    
    updateRangedAI(deltaTime) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        const dx = player.x - this.enemy.x;
        const dy = player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const optimalRange = 150; // Preferred distance for ranged attacks
        const fleeRange = 80; // Too close, need to back away
        
        if (distance < fleeRange) {
            // Too close - flee
            const fleeDir = {
                x: -dx / distance,
                y: -dy / distance
            };
            
            this.enemy.velocity.x = fleeDir.x * this.enemy.speed * 1.2;
            this.enemy.velocity.y = fleeDir.y * this.enemy.speed * 1.2;
        } else if (distance > optimalRange + 50) {
            // Too far - approach
            const moveDir = {
                x: dx / distance,
                y: dy / distance
            };
            
            this.enemy.velocity.x = moveDir.x * this.enemy.speed * 0.8;
            this.enemy.velocity.y = moveDir.y * this.enemy.speed * 0.8;
        } else {
            // In optimal range - strafe
            const strafeAngle = performance.now() * 0.001;
            this.enemy.velocity.x = Math.cos(strafeAngle) * this.enemy.speed * 0.3;
            this.enemy.velocity.y = Math.sin(strafeAngle) * this.enemy.speed * 0.3;
            
            // Attack
            if (this.enemy.attackCooldown <= 0) {
                this.enemy.rangedAttack();
            }
        }
        
        // Always apply separation
        const separation = this.getSeparationForce();
        this.enemy.velocity.x += separation.x * this.separationForce;
        this.enemy.velocity.y += separation.y * this.separationForce;
    }
    
    updateFastAI(deltaTime) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Hit and run tactics
        const dx = player.x - this.enemy.x;
        const dy = player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (this.enemy.hitAndRunPhase === 'approach') {
            // Approach quickly
            if (distance > this.attackRange) {
                const moveDir = {
                    x: dx / distance,
                    y: dy / distance
                };
                
                this.enemy.velocity.x = moveDir.x * this.enemy.speed * 1.5;
                this.enemy.velocity.y = moveDir.y * this.enemy.speed * 1.5;
            } else {
                // Attack and switch to retreat
                this.enemy.meleeAttack();
                this.enemy.hitAndRunPhase = 'retreat';
                this.enemy.hitAndRunTimer = 1.0; // Retreat for 1 second
            }
        } else {
            // Retreat phase
            this.enemy.hitAndRunTimer -= deltaTime;
            
            const fleeDir = {
                x: -dx / distance,
                y: -dy / distance
            };
            
            this.enemy.velocity.x = fleeDir.x * this.enemy.speed * 1.2;
            this.enemy.velocity.y = fleeDir.y * this.enemy.speed * 1.2;
            
            if (this.enemy.hitAndRunTimer <= 0) {
                this.enemy.hitAndRunPhase = 'approach';
            }
        }
        
        // Light separation force for agility
        const separation = this.getSeparationForce();
        this.enemy.velocity.x += separation.x * this.separationForce * 0.5;
        this.enemy.velocity.y += separation.y * this.separationForce * 0.5;
    }
    
    updateTankAI(deltaTime) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Slow but steady approach
        const dx = player.x - this.enemy.x;
        const dy = player.y - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1) {
            // Tank units push through other enemies
            const moveDir = {
                x: dx / distance,
                y: dy / distance
            };
            
            // Tanks ignore most separation forces (bulldoze through)
            const separation = this.getSeparationForce();
            
            this.enemy.velocity.x = moveDir.x * this.enemy.speed + 
                                    separation.x * this.separationForce * 0.2;
            this.enemy.velocity.y = moveDir.y * this.enemy.speed + 
                                    separation.y * this.separationForce * 0.2;
            
            // Area damage when close
            if (distance < this.attackRange * 1.5) {
                this.enemy.meleeAttack();
                
                // Chance for shockwave
                if (Math.random() < 0.1 * deltaTime) {
                    this.createShockwave();
                }
            }
        }
    }
    
    updateEliteAI(deltaTime) {
        // Elite units have special behaviors handled in Enemy.js
        // This is a placeholder for elite-specific movement patterns
        const player = this.game.player;
        if (!player || !player.isAlive()) return;
        
        // Intelligent movement with prediction
        const targetPos = this.predictPlayerPosition(200);
        const moveDir = this.calculateMoveDirection(targetPos.x, targetPos.y);
        
        // Elite units coordinate better
        const separation = this.getSeparationForce();
        const alignment = this.getAlignmentForce();
        const cohesion = this.getCohesionForce();
        
        this.enemy.velocity.x = moveDir.x * this.enemy.speed + 
                                separation.x * this.separationForce +
                                alignment.x * 30 +
                                cohesion.x * 20;
        this.enemy.velocity.y = moveDir.y * this.enemy.speed + 
                                separation.y * this.separationForce +
                                alignment.y * 30 +
                                cohesion.y * 20;
    }
    
    // Helper methods
    getSeparationForce() {
        let separationX = 0;
        let separationY = 0;
        let count = 0;
        
        // Get nearby enemies
        const nearbyEnemies = this.game.systems.enemy.getEnemiesInRange(
            this.enemy.x, 
            this.enemy.y, 
            this.separationDistance * 2
        );
        
        for (const other of nearbyEnemies) {
            if (other === this.enemy || !other.active) continue;
            
            const dx = this.enemy.x - other.x;
            const dy = this.enemy.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0 && distance < this.separationDistance) {
                // Stronger separation for closer enemies
                const force = 1 - (distance / this.separationDistance);
                separationX += (dx / distance) * force;
                separationY += (dy / distance) * force;
                count++;
            }
        }
        
        if (count > 0) {
            separationX /= count;
            separationY /= count;
            
            // Normalize
            const mag = Math.sqrt(separationX * separationX + separationY * separationY);
            if (mag > 0) {
                separationX = (separationX / mag);
                separationY = (separationY / mag);
            }
        }
        
        return { x: separationX, y: separationY };
    }
    
    getAlignmentForce() {
        let avgVx = 0;
        let avgVy = 0;
        let count = 0;
        
        const nearbyEnemies = this.game.systems.enemy.getEnemiesInRange(
            this.enemy.x, 
            this.enemy.y, 
            50
        );
        
        for (const other of nearbyEnemies) {
            if (other === this.enemy || !other.active) continue;
            
            avgVx += other.velocity.x;
            avgVy += other.velocity.y;
            count++;
        }
        
        if (count > 0) {
            avgVx /= count;
            avgVy /= count;
            
            // Steer towards average velocity
            const dx = avgVx - this.enemy.velocity.x;
            const dy = avgVy - this.enemy.velocity.y;
            const mag = Math.sqrt(dx * dx + dy * dy);
            
            if (mag > 0) {
                return {
                    x: (dx / mag) * Math.min(mag, this.maxSteerForce),
                    y: (dy / mag) * Math.min(mag, this.maxSteerForce)
                };
            }
        }
        
        return { x: 0, y: 0 };
    }
    
    getCohesionForce() {
        let centerX = 0;
        let centerY = 0;
        let count = 0;
        
        const nearbyEnemies = this.game.systems.enemy.getEnemiesInRange(
            this.enemy.x, 
            this.enemy.y, 
            100
        );
        
        for (const other of nearbyEnemies) {
            if (other === this.enemy || !other.active || other.type !== this.enemy.type) continue;
            
            centerX += other.x;
            centerY += other.y;
            count++;
        }
        
        if (count > 0) {
            centerX /= count;
            centerY /= count;
            
            // Steer towards center of mass
            const dx = centerX - this.enemy.x;
            const dy = centerY - this.enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 20) { // Don't cohese if already close
                return {
                    x: (dx / distance) * 0.5,
                    y: (dy / distance) * 0.5
                };
            }
        }
        
        return { x: 0, y: 0 };
    }
    
    predictPlayerPosition(distance) {
        const player = this.game.player;
        if (!player) return { x: this.enemy.x, y: this.enemy.y };
        
        // Simple linear prediction
        const timeToReach = distance / this.enemy.speed;
        const predictedX = player.x + player.velocity.x * timeToReach * 0.5;
        const predictedY = player.y + player.velocity.y * timeToReach * 0.5;
        
        return { x: predictedX, y: predictedY };
    }
    
    calculateMoveDirection(targetX, targetY) {
        const dx = targetX - this.enemy.x;
        const dy = targetY - this.enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.1) {
            return {
                x: dx / distance,
                y: dy / distance
            };
        }
        
        return { x: 0, y: 0 };
    }
    
    createShockwave() {
        // Visual effect
        if (this.game.systems.particle) {
            this.game.systems.particle.createExplosionEffect(
                this.enemy.x, 
                this.enemy.y, 
                '#8B4513', 
                2.0
            );
        }
        
        // Damage nearby player
        const player = this.game.player;
        if (player) {
            const dx = player.x - this.enemy.x;
            const dy = player.y - this.enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 100) {
                player.takeDamage(this.enemy.damage * 0.5);
                
                // Knockback
                const force = 300 * (1 - distance / 100);
                player.velocity.x += (dx / distance) * force;
                player.velocity.y += (dy / distance) * force;
            }
        }
    }
}