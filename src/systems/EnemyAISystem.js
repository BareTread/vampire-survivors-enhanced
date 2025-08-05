/**
 * Enemy AI System - ECS-based AI Behavior
 * 
 * Handles enemy AI behaviors, spawning, and decision making
 * using component-based architecture.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Config } from '../core/ConfigManager.js';
import { LoggerInstance as Logger } from '../core/ErrorHandler.js';

export class EnemyAISystem extends BaseSystem {
    constructor(world, name = 'enemyAI', config = {}) {
        super(world, name, config);
        
        this.spawning = false;
        this.spawnTimer = 0;
        this.spawnRate = Config.get('enemies.baseSpawnRate');
        this.maxEnemies = Config.get('enemies.maxActive');
        this.activeEnemyCount = 0;
    }

    onInit() {
        this.createEntityQuery('enemies', 'transform', 'velocity', 'ai');
        this.createEntityQuery('players', 'transform');
        Logger.debug('EnemyAISystem initialized');
    }

    onUpdate(deltaTime) {
        // Update spawning
        if (this.spawning) {
            this.updateSpawning(deltaTime);
        }

        // Update AI behaviors
        const enemies = this.executeQuery('enemies');
        this.activeEnemyCount = enemies.length;

        for (const enemy of enemies) {
            this.updateEnemyAI(enemy, deltaTime);
        }
    }

    updateSpawning(deltaTime) {
        if (this.activeEnemyCount >= this.maxEnemies) return;

        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = 1.0 / this.spawnRate;
        }
    }

    spawnEnemy() {
        const players = this.executeQuery('players');
        if (players.length === 0) return;

        const player = players[0];
        const playerTransform = player.getComponent('transform');
        if (!playerTransform) return;

        // Spawn enemy at random position around player
        const angle = Math.random() * Math.PI * 2;
        const distance = Config.get('enemies.spawnDistance');
        const x = playerTransform.x + Math.cos(angle) * distance;
        const y = playerTransform.y + Math.sin(angle) * distance;

        // Create enemy entity (placeholder - would use EntityFactory)
        Logger.debug('Enemy spawned', { x, y });
    }

    updateEnemyAI(enemy, deltaTime) {
        const ai = enemy.getComponent('ai');
        const transform = enemy.getComponent('transform');
        const velocity = enemy.getComponent('velocity');

        if (!ai || !transform || !velocity) return;

        // Update AI timers
        ai.updateTimers(deltaTime);

        // Make decisions periodically
        if (ai.shouldMakeDecision(deltaTime)) {
            this.makeAIDecision(enemy);
        }

        // Apply current behavior
        this.applyAIBehavior(enemy, deltaTime);
    }

    makeAIDecision(enemy) {
        const ai = enemy.getComponent('ai');
        if (!ai) return;

        // Simple state machine
        switch (ai.state) {
            case 'idle':
                ai.setState('seeking');
                break;
            case 'seeking':
                if (this.findTarget(enemy)) {
                    ai.setState('attacking');
                }
                break;
            case 'attacking':
                if (!ai.target || !this.isTargetValid(enemy, ai.target)) {
                    ai.setState('seeking');
                }
                break;
        }
    }

    findTarget(enemy) {
        const players = this.executeQuery('players');
        if (players.length === 0) return false;

        const ai = enemy.getComponent('ai');
        ai.target = players[0]; // Simple - target first player
        return true;
    }

    isTargetValid(enemy, target) {
        if (!target || !target.active) return false;
        
        const transform = enemy.getComponent('transform');
        const targetTransform = target.getComponent('transform');
        const ai = enemy.getComponent('ai');
        
        if (!transform || !targetTransform || !ai) return false;

        const dx = transform.x - targetTransform.x;
        const dy = transform.y - targetTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= ai.sightRange;
    }

    applyAIBehavior(enemy, deltaTime) {
        const ai = enemy.getComponent('ai');
        const transform = enemy.getComponent('transform');
        const velocity = enemy.getComponent('velocity');

        if (!ai || !transform || !velocity) return;

        switch (ai.state) {
            case 'seeking':
            case 'attacking':
                this.moveTowardsTarget(enemy);
                break;
            case 'idle':
                velocity.vx = 0;
                velocity.vy = 0;
                break;
        }
    }

    moveTowardsTarget(enemy) {
        const ai = enemy.getComponent('ai');
        const transform = enemy.getComponent('transform');
        const velocity = enemy.getComponent('velocity');

        if (!ai || !ai.target || !transform || !velocity) return;

        const targetTransform = ai.target.getComponent('transform');
        if (!targetTransform) return;

        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const speed = velocity.maxSpeed;
            velocity.vx = (dx / distance) * speed;
            velocity.vy = (dy / distance) * speed;
        }
    }

    startSpawning() {
        this.spawning = true;
        this.spawnTimer = 0;
        Logger.info('Enemy spawning started');
    }

    stopSpawning() {
        this.spawning = false;
        Logger.info('Enemy spawning stopped');
    }

    getActiveEnemyCount() {
        return this.activeEnemyCount;
    }
}