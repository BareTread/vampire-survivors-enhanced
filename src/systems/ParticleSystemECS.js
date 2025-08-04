/**
 * Particle System - ECS-based Particle Effects
 * 
 * Handles particle effects and visual feedback using
 * component-based architecture.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Logger } from '../core/ErrorHandler.js';

export class ParticleSystem extends BaseSystem {
    onInit() {
        this.createEntityQuery('particles', 'transform', 'velocity', 'render', 'lifetime');
        Logger.debug('ParticleSystem initialized');
    }

    onUpdate(deltaTime) {
        const particles = this.executeQuery('particles');
        
        // Particles are automatically updated by LifetimeSystem and MovementSystem
        // This system can add special particle behaviors
        
        for (const particle of particles) {
            this.updateParticle(particle, deltaTime);
        }
    }

    updateParticle(particle, deltaTime) {
        const render = particle.getComponent('render');
        const lifetime = particle.getComponent('lifetime');
        
        if (!render || !lifetime) return;

        // Update particle opacity based on lifetime
        if (lifetime.fadeOut) {
            render.opacity = lifetime.getFadeAlpha();
        }

        // Update pulse animation
        render.updatePulse(deltaTime);
    }

    createLevelUpEffect(x, y) {
        // Create multiple particles for level up effect
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            
            const particleConfig = {
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#FFD700',
                size: 3 + Math.random() * 3,
                lifetime: 1.0 + Math.random() * 0.5,
                glow: true
            };

            // Would create particle entity using EntityFactory
            Logger.debug('Level up particle created', particleConfig);
        }
    }

    createHitEffect(x, y, color = '#FF4444') {
        // Create hit effect particles
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 50;
            
            const particleConfig = {
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: 2 + Math.random() * 2,
                lifetime: 0.3 + Math.random() * 0.2
            };

            Logger.debug('Hit effect particle created', particleConfig);
        }
    }

    createTrailEffect(x, y, direction) {
        const particleConfig = {
            x: x,
            y: y,
            vx: -direction.x * 20,
            vy: -direction.y * 20,
            color: '#AAAAAA',
            size: 1,
            lifetime: 0.5
        };

        Logger.debug('Trail particle created', particleConfig);
    }
}