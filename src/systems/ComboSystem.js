/**
 * Combo System - Combat combo management and effects
 * 
 * Manages combo system for enhanced combat engagement:
 * - Tracks consecutive kills within time windows
 * - Applies damage and experience multipliers
 * - Triggers visual and audio effects
 * - Provides combo UI feedback
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { ComboComponent } from '../core/Components.js';
import { LoggerInstance as Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';
import { Config } from '../core/ConfigManager.js';

export class ComboSystem extends BaseSystem {
    constructor(world, name, config = {}) {
        super(world, name, config);
        
        // System state
        this.globalComboStats = {
            totalCombos: 0,
            highestCombo: 0,
            combosThisSession: 0
        };
        
        // Effect tracking
        this.activeEffects = new Set();
        this.effectTimers = new Map();
        
        // UI elements for combo display
        this.comboUI = null;
        this.comboNotifications = [];
        
        // Performance tracking
        this.updateCount = 0;
        this.lastUpdateTime = 0;
    }

    onInit() {
        // Create entity queries
        this.createEntityQuery('combatants', 'combo');
        this.createEntityQuery('players', 'combo', 'health');
        this.createEntityQuery('enemies', 'health', 'ai');
        
        // Set up event listeners for combat events
        this.setupEventListeners();
        
        // Initialize combo UI
        this.initializeComboUI();
        
        Logger.debug('ComboSystem initialized');
    }

    /**
     * Set up event listeners for combat-related events
     * @private
     */
    setupEventListeners() {
        // Listen for enemy death events
        this.world.eventBus?.on('enemyKilled', this.onEnemyKilled.bind(this));
        this.world.eventBus?.on('playerDamaged', this.onPlayerDamaged.bind(this));
        this.world.eventBus?.on('playerDied', this.onPlayerDied.bind(this));
        this.world.eventBus?.on('levelCompleted', this.onLevelCompleted.bind(this));
    }

    /**
     * Initialize combo UI elements
     * @private
     */
    initializeComboUI() {
        // Find or create combo UI container
        let comboContainer = document.getElementById('combo-display');
        if (!comboContainer) {
            comboContainer = document.createElement('div');
            comboContainer.id = 'combo-display';
            comboContainer.style.cssText = `
                position: absolute;
                top: 50px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                border: 2px solid #FFD700;
                min-width: 150px;
                text-align: center;
                display: none;
                z-index: 1000;
                font-family: 'Segoe UI', Arial, sans-serif;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
            `;
            
            comboContainer.innerHTML = `
                <div id="combo-count" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">0</div>
                <div id="combo-rank" style="font-size: 12px; text-transform: uppercase; margin-bottom: 5px;">NONE</div>
                <div id="combo-multiplier" style="font-size: 14px; color: #FFD700;">x1.0</div>
                <div id="combo-timer" style="width: 100%; height: 4px; background: #333; margin-top: 8px; border-radius: 2px;">
                    <div id="combo-timer-fill" style="height: 100%; background: linear-gradient(90deg, #FFD700, #FFA500); border-radius: 2px; width: 0%; transition: width 0.1s ease;"></div>
                </div>
            `;
            
            document.body.appendChild(comboContainer);
            this.comboUI = comboContainer;
        }
    }

    /**
     * Handle enemy killed event
     * @param {object} event - Enemy killed event data
     */
    onEnemyKilled(event) {
        const playerEntities = this.executeQuery('players');
        
        for (const player of playerEntities) {
            const combo = player.getComponent('combo');
            if (combo) {
                // Add to combo
                combo.addCombo(1, this.world.time);
                
                // Apply combo effects
                this.applyComboEffects(player, combo);
                
                // Create visual feedback
                this.createComboFeedback(combo, event.position);
                
                // Update global stats
                this.updateGlobalStats(combo);
            }
        }
    }

    /**
     * Handle player damaged event (breaks some combos)
     * @param {object} event - Player damaged event data
     */
    onPlayerDamaged(event) {
        const player = event.entity;
        const combo = player?.getComponent('combo');
        
        if (combo && combo.isActive()) {
            // Reduce combo time on damage (but don't reset completely)
            combo.currentTime *= 0.7;
            
            if (combo.currentTime <= 0) {
                combo.endCombo();
                this.hideComboUI();
            }
        }
    }

    /**
     * Handle player death (resets combo)
     * @param {object} event - Player death event data
     */
    onPlayerDied(event) {
        const player = event.entity;
        const combo = player?.getComponent('combo');
        
        if (combo) {
            combo.forceReset();
            this.hideComboUI();
        }
    }

    /**
     * Handle level completion
     * @param {object} event - Level completed event data
     */
    onLevelCompleted(event) {
        const playerEntities = this.executeQuery('players');
        
        for (const player of playerEntities) {
            const combo = player.getComponent('combo');
            if (combo) {
                // Save combo stats for the level
                this.globalComboStats.combosThisSession += combo.combosThisLevel;
                combo.combosThisLevel = 0;
            }
        }
    }

    /**
     * Apply combo effects to the player
     * @param {Entity} player - Player entity
     * @param {ComboComponent} combo - Combo component
     * @private
     */
    applyComboEffects(player, combo) {
        // Screen shake effect
        if (combo.streakEffects.screenShake && this.world.camera) {
            const intensity = Math.min(8, 2 + combo.count * 0.1);
            this.world.camera.shake(intensity, 0.2);
        }
        
        // Damage boost effect
        if (combo.streakEffects.damageBoost) {
            this.applyDamageBoost(player, combo.multiplier);
        }
        
        // Time slowdown effect (for epic combos)
        if (combo.streakEffects.timeSlowdown) {
            this.applyTimeSlowdown(0.8, 1.0); // 20% slowdown for 1 second
        }
        
        // Visual effects through particle system
        if (this.world.particleSystem) {
            this.createComboParticles(player, combo);
        }
    }

    /**
     * Apply temporary damage boost
     * @param {Entity} player - Player entity
     * @param {number} multiplier - Damage multiplier
     * @private
     */
    applyDamageBoost(player, multiplier) {
        // This would integrate with the weapon system
        // For now, we'll store the effect for other systems to use
        if (!this.effectTimers.has('damageBoost')) {
            this.effectTimers.set('damageBoost', {
                duration: 3.0,
                currentTime: 3.0,
                multiplier: multiplier,
                target: player
            });
            this.activeEffects.add('damageBoost');
        }
    }

    /**
     * Apply temporary time slowdown effect
     * @param {number} factor - Time scale factor (0.5 = half speed)
     * @param {number} duration - Effect duration in seconds
     * @private
     */
    applyTimeSlowdown(factor, duration) {
        if (this.world.timeScale !== undefined) {
            this.world.timeScale = factor;
            
            this.effectTimers.set('timeSlowdown', {
                duration: duration,
                currentTime: duration,
                originalScale: 1.0,
                targetScale: factor
            });
            this.activeEffects.add('timeSlowdown');
        }
    }

    /**
     * Create combo particle effects
     * @param {Entity} player - Player entity
     * @param {ComboComponent} combo - Combo component
     * @private
     */
    createComboParticles(player, combo) {
        const transform = player.getComponent('transform');
        if (!transform) return;
        
        const particleSystem = this.world.particleSystem;
        if (!particleSystem) return;
        
        // Create particles based on combo level
        const color = combo.getComboColor();
        const intensity = Math.min(combo.count / 10, 3.0);
        
        // Ring of particles around player
        const particleCount = Math.min(combo.count, 20);
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const distance = 30 + intensity * 10;
            const x = transform.x + Math.cos(angle) * distance;
            const y = transform.y + Math.sin(angle) * distance;
            
            particleSystem.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 50,
                vy: Math.sin(angle) * 50,
                life: 1.0 + intensity * 0.5,
                size: 3 + intensity,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }

    /**
     * Create combo visual feedback
     * @param {ComboComponent} combo - Combo component
     * @param {object} position - Position for feedback
     * @private
     */
    createComboFeedback(combo, position) {
        // Update combo UI
        this.updateComboUI(combo);
        
        // Create floating combo text
        if (position && combo.count % 5 === 0) { // Show every 5 hits
            this.createFloatingComboText(combo, position);
        }
        
        // Combo milestone notifications
        if (this.isComboMilestone(combo.count)) {
            this.createComboNotification(combo);
        }
    }

    /**
     * Update combo UI display
     * @param {ComboComponent} combo - Combo component
     * @private
     */
    updateComboUI(combo) {
        if (!this.comboUI || !combo.isActive()) {
            this.hideComboUI();
            return;
        }
        
        const stats = combo.getStats();
        
        // Show combo UI
        this.comboUI.style.display = 'block';
        this.comboUI.style.borderColor = stats.color;
        
        // Update values
        document.getElementById('combo-count').textContent = stats.current;
        document.getElementById('combo-count').style.color = stats.color;
        document.getElementById('combo-rank').textContent = stats.rank;
        document.getElementById('combo-multiplier').textContent = `x${stats.multiplier.toFixed(1)}`;
        
        // Update timer bar
        const timerFill = document.getElementById('combo-timer-fill');
        if (timerFill) {
            const percentage = (stats.timeRemaining / combo.timeWindow) * 100;
            timerFill.style.width = `${Math.max(0, percentage)}%`;
        }
        
        // Add pulsing effect for high combos
        if (stats.current >= 20) {
            this.comboUI.style.animation = 'pulse 0.5s ease-in-out infinite alternate';
        } else {
            this.comboUI.style.animation = 'none';
        }
    }

    /**
     * Hide combo UI
     * @private
     */
    hideComboUI() {
        if (this.comboUI) {
            this.comboUI.style.display = 'none';
        }
    }

    /**
     * Create floating combo text
     * @param {ComboComponent} combo - Combo component
     * @param {object} position - Position for text
     * @private
     */
    createFloatingComboText(combo, position) {
        const text = document.createElement('div');
        text.style.cssText = `
            position: absolute;
            left: ${position.x - 50}px;
            top: ${position.y - 20}px;
            color: ${combo.getComboColor()};
            font-size: ${Math.min(24 + combo.count * 0.3, 48)}px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            pointer-events: none;
            z-index: 2000;
            animation: floatUp 2s ease-out forwards;
        `;
        text.textContent = `${combo.count} HIT COMBO!`;
        
        // Add CSS animation if not exists
        if (!document.getElementById('combo-float-style')) {
            const style = document.createElement('style');
            style.id = 'combo-float-style';
            style.textContent = `
                @keyframes floatUp {
                    0% { opacity: 1; transform: translateY(0px) scale(1); }
                    50% { opacity: 1; transform: translateY(-30px) scale(1.2); }
                    100% { opacity: 0; transform: translateY(-60px) scale(1); }
                }
                @keyframes pulse {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.05); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(text);
        
        // Remove after animation
        setTimeout(() => {
            text.remove();
        }, 2000);
    }

    /**
     * Create combo milestone notification
     * @param {ComboComponent} combo - Combo component
     * @private
     */
    createComboNotification(combo) {
        const notification = {
            text: `${combo.getComboRank()} COMBO!`,
            color: combo.getComboColor(),
            time: 0,
            duration: 2.0
        };
        
        this.comboNotifications.push(notification);
        
        // Limit notification count
        if (this.comboNotifications.length > 3) {
            this.comboNotifications.shift();
        }
    }

    /**
     * Check if combo count is a milestone
     * @param {number} count - Combo count
     * @returns {boolean} True if milestone
     * @private
     */
    isComboMilestone(count) {
        return [5, 10, 20, 50, 100].includes(count);
    }

    /**
     * Update global combo statistics
     * @param {ComboComponent} combo - Combo component
     * @private
     */
    updateGlobalStats(combo) {
        if (combo.count > this.globalComboStats.highestCombo) {
            this.globalComboStats.highestCombo = combo.count;
        }
    }

    /**
     * Update system
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        this.updateCount++;
        this.lastUpdateTime += deltaTime;
        
        // Update combo components
        const combatants = this.executeQuery('combatants');
        for (const entity of combatants) {
            const combo = entity.getComponent('combo');
            if (combo) {
                combo.update(deltaTime);
                
                // Update UI if this is the player
                if (entity.hasComponent('input')) {
                    this.updateComboUI(combo);
                }
            }
        }
        
        // Update active effects
        this.updateEffects(deltaTime);
        
        // Update notifications
        this.updateNotifications(deltaTime);
    }

    /**
     * Update active combo effects
     * @param {number} deltaTime - Time elapsed
     * @private
     */
    updateEffects(deltaTime) {
        for (const [effectName, effect] of this.effectTimers.entries()) {
            effect.currentTime -= deltaTime;
            
            if (effect.currentTime <= 0) {
                // Effect expired
                this.endEffect(effectName, effect);
                this.effectTimers.delete(effectName);
                this.activeEffects.delete(effectName);
            }
        }
    }

    /**
     * End an active effect
     * @param {string} effectName - Name of the effect
     * @param {object} effect - Effect data
     * @private
     */
    endEffect(effectName, effect) {
        switch (effectName) {
            case 'timeSlowdown':
                if (this.world.timeScale !== undefined) {
                    this.world.timeScale = effect.originalScale;
                }
                break;
            case 'damageBoost':
                // Damage boost naturally expires
                break;
        }
    }

    /**
     * Update combo notifications
     * @param {number} deltaTime - Time elapsed
     * @private
     */
    updateNotifications(deltaTime) {
        for (let i = this.comboNotifications.length - 1; i >= 0; i--) {
            const notification = this.comboNotifications[i];
            notification.time += deltaTime;
            
            if (notification.time >= notification.duration) {
                this.comboNotifications.splice(i, 1);
            }
        }
    }

    /**
     * Get active combo effects for other systems
     * @returns {object} Active effects data
     */
    getActiveEffects() {
        const effects = {};
        
        for (const [effectName, effect] of this.effectTimers.entries()) {
            effects[effectName] = {
                timeRemaining: effect.currentTime,
                duration: effect.duration,
                multiplier: effect.multiplier || 1.0,
                progress: 1.0 - (effect.currentTime / effect.duration)
            };
        }
        
        return effects;
    }

    /**
     * Get combo system statistics
     * @returns {object} System statistics
     */
    getStats() {
        return {
            ...this.globalComboStats,
            activeEffects: Array.from(this.activeEffects),
            updateCount: this.updateCount,
            avgUpdateTime: this.updateCount > 0 ? this.lastUpdateTime / this.updateCount * 1000 : 0
        };
    }

    /**
     * Reset combo system state
     */
    reset() {
        // Clear all effects
        this.activeEffects.clear();
        this.effectTimers.clear();
        
        // Reset world time scale
        if (this.world.timeScale !== undefined) {
            this.world.timeScale = 1.0;
        }
        
        // Clear notifications
        this.comboNotifications.length = 0;
        
        // Hide UI
        this.hideComboUI();
        
        // Reset session stats
        this.globalComboStats.combosThisSession = 0;
    }

    /**
     * Cleanup system resources
     */
    cleanup() {
        this.reset();
        
        // Remove UI elements
        if (this.comboUI && this.comboUI.parentNode) {
            this.comboUI.parentNode.removeChild(this.comboUI);
        }
        
        super.cleanup();
    }
}