/**
 * Player Input System - ECS-based Input Handling
 * 
 * Handles player input processing and translates input events
 * into component data for other systems to consume.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Logger } from '../core/ErrorHandler.js';

export class PlayerInputSystem extends BaseSystem {
    onInit() {
        this.createEntityQuery('playerControlled', 'transform', 'velocity', 'input');
        Logger.debug('PlayerInputSystem initialized');
    }

    onUpdate(deltaTime) {
        const entities = this.executeQuery('playerControlled');
        
        for (const entity of entities) {
            this.processPlayerInput(entity, deltaTime);
        }
    }

    processPlayerInput(entity, deltaTime) {
        const input = entity.getComponent('input');
        const velocity = entity.getComponent('velocity');
        
        if (!input || !velocity) return;

        // Reset movement
        input.moveX = 0;
        input.moveY = 0;

        // Process keyboard input
        if (input.isKeyPressed('w') || input.isKeyPressed('arrowup')) input.moveY = -1;
        if (input.isKeyPressed('s') || input.isKeyPressed('arrowdown')) input.moveY = 1;
        if (input.isKeyPressed('a') || input.isKeyPressed('arrowleft')) input.moveX = -1;
        if (input.isKeyPressed('d') || input.isKeyPressed('arrowright')) input.moveX = 1;

        // Normalize diagonal movement
        const movement = input.getMovementVector();
        
        // Apply movement to velocity
        const speed = velocity.maxSpeed;
        velocity.vx = movement.x * speed;
        velocity.vy = movement.y * speed;
    }
}