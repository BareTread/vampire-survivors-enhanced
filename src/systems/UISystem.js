/**
 * UI System - ECS-based User Interface
 * 
 * Handles UI updates and interactions using game state
 * and component data.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Logger } from '../core/ErrorHandler.js';

export class UISystem extends BaseSystem {
    onInit() {
        this.createEntityQuery('players', 'transform', 'health');
        Logger.debug('UISystem initialized');
    }

    onUpdate(deltaTime) {
        // UI updates are typically handled by the main game class
        // This system can handle entity-specific UI elements like health bars
        
        const players = this.executeQuery('players');
        
        for (const player of players) {
            this.updatePlayerUI(player);
        }
    }

    updatePlayerUI(player) {
        const health = player.getComponent('health');
        if (!health) return;

        // Update health bar visibility based on damage taken
        const healthPercent = health.getHealthPercentage();
        
        // This would update a health bar component or UI element
        Logger.debug('Player UI updated', { healthPercent });
    }

    onRender(ctx, camera) {
        // Render UI elements that are part of the world
        const players = this.executeQuery('players');
        
        for (const player of players) {
            this.renderPlayerUI(ctx, camera, player);
        }
    }

    renderPlayerUI(ctx, camera, player) {
        const transform = player.getComponent('transform');
        const health = player.getComponent('health');
        
        if (!transform || !health) return;

        // Render health bar above player
        const barWidth = 30;
        const barHeight = 4;
        const x = transform.x - barWidth / 2;
        const y = transform.y - 20;

        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Health
        const healthPercent = health.getHealthPercentage();
        const healthColor = healthPercent > 0.6 ? '#44FF44' : 
                          healthPercent > 0.3 ? '#FFAA44' : '#FF4444';
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
}