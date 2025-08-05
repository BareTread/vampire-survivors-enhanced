/**
 * ECS Adapter for ParticleSystemOptimized
 * 
 * Wraps the optimized particle system to work with the ECS architecture
 * while maintaining high performance and compatibility.
 */

import { BaseSystem } from './BaseSystem.js';
import { ParticleSystemCore } from './ParticleSystemCore.js';
import { LoggerInstance as Logger } from '../core/ErrorHandler.js';

export class ParticleSystemECSAdapter extends BaseSystem {
    constructor(world, name, config = {}) {
        super(world, name, config);
        
        // Create the optimized particle system
        // Note: We pass a mock game object that provides what ParticleSystemOptimized needs
        this.particleSystem = new ParticleSystemCore({
            canvas: this.world.game?.canvas,
            ctx: this.world.game?.ctx || this.world.game?.canvas?.getContext('2d'),
            camera: this.world.game?.camera
        });
        
        Logger.debug('ParticleSystemECSAdapter initialized');
    }
    
    onInit() {
        // Create entity queries if needed
        this.createEntityQuery('particles', 'transform', 'velocity', 'render', 'lifetime');
        Logger.debug('ParticleSystemECSAdapter initialized');
    }
    
    update(deltaTime) {
        // Update the optimized particle system
        this.particleSystem.update(deltaTime);
    }
    
    render(renderer) {
        // Render using the optimized particle system
        this.particleSystem.render(renderer);
    }
    
    // Proxy methods to the optimized particle system
    createEffectParticle(x, y, options = {}) {
        return this.particleSystem.createEffectParticle(x, y, options);
    }
    
    createDamageNumber(x, y, damage, isCritical = false) {
        return this.particleSystem.createDamageNumber(x, y, damage, isCritical);
    }
    
    createBloodSplatter(x, y, color = '#4B0082') {
        return this.particleSystem.createBloodSplatter(x, y, color);
    }
    
    createHitEffect(x, y, colorOrIntensity = 1.0) {
        return this.particleSystem.createHitEffect(x, y, colorOrIntensity);
    }
    
    createCriticalEffect(x, y, color) {
        return this.particleSystem.createCriticalEffect(x, y, color);
    }
    
    createDeathEffect(x, y, color) {
        return this.particleSystem.createDeathEffect(x, y, color);
    }
    
    createLevelUpEffect(x, y) {
        return this.particleSystem.createLevelUpEffect(x, y);
    }
    
    getPerformanceInfo() {
        return this.particleSystem.getPerformanceInfo();
    }
    
    clear() {
        return this.particleSystem.clear();
    }
    
    cleanup() {
        if (this.particleSystem.cleanup) {
            this.particleSystem.cleanup();
        }
        super.cleanup();
    }
}