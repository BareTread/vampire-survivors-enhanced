import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

// OPTIMIZED: High-performance particle system for 200+ entities at 60+ FPS
export class ParticleSystemCore {
    constructor(game) {
        this.game = game;
        
        // OPTIMIZED: Separate pools for different particle types
        this.effectParticles = [];
        // Note: Damage numbers now handled by globalDamageNumberPool
        this.bloodSplatters = [];
        
        // OPTIMIZED: Dramatically reduced limits for better visibility
        this.maxEffectParticles = 50;   // Much lower for visual clarity
        // Note: Damage numbers now managed by globalDamageNumberPool
        this.maxBloodSplatters = 15;    // Much fewer blood effects
        
        // OPTIMIZED: Performance-based quality scaling
        this.qualityLevel = 1.0;
        this.particleReduction = 1.0;
        this.lastPerformanceCheck = 0;
        this.performanceCheckInterval = 1000; // Check every second
        
        // OPTIMIZED: Object pools for zero-allocation updates
        this.particlePool = [];
        // Note: Damage pool now managed by globalDamageNumberPool
        this.splatterPool = [];
        this.initializePools();
        
        // OPTIMIZED: Batch rendering arrays
        this.renderBatches = {
            circles: { particles: [], color: null },
            rects: { particles: [], color: null },
            text: { particles: [] }
        };
        
        // OPTIMIZED: Spatial culling for off-screen particles
        this.viewBounds = { left: 0, top: 0, right: 800, bottom: 600 };
        this.culledParticles = 0;
        
        console.log('🔥 Optimized ParticleSystem initialized for maximum performance');
    }
    
    initializePools() {
        // OPTIMIZED: Pre-allocate particle objects
        for (let i = 0; i < 500; i++) {
            this.particlePool.push(this.createParticleObject());
        }
        
        // Note: Damage objects now managed by globalDamageNumberPool
        
        for (let i = 0; i < 100; i++) {
            this.splatterPool.push(this.createSplatterObject());
        }
    }
    
    createParticleObject() {
        return {
            x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
            life: 0, maxLife: 1, size: 3, alpha: 1,
            color: '#FFFFFF', active: false, type: 'effect',
            fadeOut: true, glow: false, trail: false,
            lastX: 0, lastY: 0 // For trail effects
        };
    }
    
    // createDamageObject removed - now handled by globalDamageNumberPool
    
    createSplatterObject() {
        return {
            x: 0, y: 0, size: 8, angle: 0,
            life: 0, maxLife: 3, alpha: 0.8,
            color: '#4B0082', active: false
        };
    }
    
    // OPTIMIZED: Fast particle creation with minimal allocations
    createEffectParticle(x, y, options = {}) {
        if (this.effectParticles.length >= this.maxEffectParticles * this.particleReduction) {
            return null; // Skip creation if at limit
        }
        
        const particle = this.getParticleFromPool();
        if (!particle) return null;
        
        // OPTIMIZED: Fast property assignment
        particle.x = x;
        particle.y = y;
        particle.lastX = x;
        particle.lastY = y;
        particle.vx = options.vx || (Math.random() - 0.5) * 200;
        particle.vy = options.vy || (Math.random() - 0.5) * 200;
        particle.ax = options.ax || 0;
        particle.ay = options.ay || 50; // Slight gravity
        particle.life = options.life || 1.0;
        particle.maxLife = particle.life;
        particle.size = options.size || 3;
        particle.color = options.color || '#FFFFFF';
        particle.alpha = options.alpha || 1;
        particle.fadeOut = options.fadeOut !== false;
        particle.glow = options.glow || false;
        particle.trail = options.trail || false;
        particle.active = true;
        
        this.effectParticles.push(particle);
        return particle;
    }
    
    createDamageNumber(x, y, damage, critical = false) {
        // Use centralized damage number pool
        const color = critical ? '#FF69B4' : '#FFFF00'; // Pink for critical, yellow for normal
        return globalDamageNumberPool.get(
            x + (Math.random() - 0.5) * 20,
            y,
            Math.floor(damage),
            color,
            critical
        );
    }
    
    // OPTIMIZED: Batch effect creation for common scenarios
    createHitEffect(x, y, intensity = 1.0) {
        // IMPROVED: More visible hit effects with better duration
        const count = Math.floor(5 * intensity * this.particleReduction); // Increased from 3
        const color = intensity > 1.5 ? '#FF69B4' : '#FFFF00'; // Pink for critical
        
        for (let i = 0; i < count; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 120 * intensity,
                vy: (Math.random() - 0.5) * 120 * intensity,
                life: 0.8 + Math.random() * 0.4, // Longer life - was 0.5 + 0.3
                size: 3 + Math.random() * 2, // Bigger particles
                color: color,
                glow: intensity > 1.2,
                fadeOut: true
            });
        }
    }
    
    createDeathEffect(x, y) {
        const count = Math.floor(6 * this.particleReduction);
        
        for (let i = 0; i < count; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.8 + Math.random() * 0.4,
                size: 3 + Math.random() * 2,
                color: '#4B0082', // Gothic purple
                fadeOut: true
            });
        }
        
        // Add blood splatter
        this.createBloodSplatter(x, y);
    }
    
    createBloodSplatter(x, y) {
        if (this.bloodSplatters.length >= this.maxBloodSplatters) return;
        
        const splatter = this.getSplatterFromPool();
        if (!splatter) return;
        
        splatter.x = x + (Math.random() - 0.5) * 30;
        splatter.y = y + (Math.random() - 0.5) * 30;
        splatter.size = 4 + Math.random() * 8;
        splatter.angle = Math.random() * Math.PI * 2;
        splatter.life = 3.0 + Math.random() * 2.0;
        splatter.maxLife = splatter.life;
        splatter.alpha = 0.6 + Math.random() * 0.2;
        splatter.color = '#4B0082';
        splatter.active = true;
        
        this.bloodSplatters.push(splatter);
    }
    
    update(dt, qualitySettings) {
        // OPTIMIZED: Apply quality settings
        if (qualitySettings) {
            this.particleReduction = qualitySettings.particleReduction;
            this.qualityLevel = qualitySettings.particleReduction;
        }
        
        // OPTIMIZED: Batch update all particle types
        this.updateEffectParticles(dt);
        // Note: Damage numbers now updated by globalDamageNumberPool
        this.updateBloodSplatters(dt);
        
        // OPTIMIZED: Adaptive performance monitoring
        if (performance.now() - this.lastPerformanceCheck > this.performanceCheckInterval) {
            this.adaptParticleLimits();
            this.lastPerformanceCheck = performance.now();
        }
    }
    
    updateEffectParticles(dt) {
        let writeIndex = 0;
        
        for (let i = 0; i < this.effectParticles.length; i++) {
            const particle = this.effectParticles[i];
            
            if (!particle.active) {
                this.returnParticleToPool(particle);
                continue;
            }
            
            // OPTIMIZED: Fast physics update
            particle.life -= dt;
            if (particle.life <= 0) {
                particle.active = false;
                this.returnParticleToPool(particle);
                continue;
            }
            
            // Update position
            particle.lastX = particle.x;
            particle.lastY = particle.y;
            particle.vx += particle.ax * dt;
            particle.vy += particle.ay * dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            
            // Update visual properties
            if (particle.fadeOut) {
                particle.alpha = particle.life / particle.maxLife;
            }
            
            // OPTIMIZED: Compact array without splice
            if (writeIndex !== i) {
                this.effectParticles[writeIndex] = particle;
            }
            writeIndex++;
        }
        
        this.effectParticles.length = writeIndex;
    }
    
    // updateDamageNumbers removed - now handled by globalDamageNumberPool
    
    updateBloodSplatters(dt) {
        let writeIndex = 0;
        
        for (let i = 0; i < this.bloodSplatters.length; i++) {
            const splatter = this.bloodSplatters[i];
            
            if (!splatter.active) {
                this.returnSplatterToPool(splatter);
                continue;
            }
            
            splatter.life -= dt;
            if (splatter.life <= 0) {
                splatter.active = false;
                this.returnSplatterToPool(splatter);
                continue;
            }
            
            // Fade out slowly
            splatter.alpha = (splatter.life / splatter.maxLife) * 0.8;
            
            if (writeIndex !== i) {
                this.bloodSplatters[writeIndex] = splatter;
            }
            writeIndex++;
        }
        
        this.bloodSplatters.length = writeIndex;
    }
    
    render(renderer, qualitySettings) {
        if (qualitySettings) {
            this.updateViewBounds(renderer);
        }
        
        // OPTIMIZED: Render in batches to minimize state changes
        this.renderBloodSplatters(renderer);
        this.renderEffectParticles(renderer);
        // Note: Damage numbers now rendered by globalDamageNumberPool
    }
    
    renderEffectParticles(renderer) {
        for (const particle of this.effectParticles) {
            if (!particle.active) continue;
            
            // OPTIMIZED: Frustum culling
            if (!this.isParticleVisible(particle)) {
                this.culledParticles++;
                continue;
            }
            
            renderer.save();
            renderer.setAlpha(particle.alpha);
            
            if (particle.glow) {
                renderer.drawGlowingCircle(particle.x, particle.y, particle.size, particle.color, 0.8);
            } else {
                renderer.drawCircle(particle.x, particle.y, particle.size, particle.color);
            }
            
            renderer.restore();
        }
    }
    
    // renderDamageNumbers removed - now handled by globalDamageNumberPool
    
    renderBloodSplatters(renderer) {
        for (const splatter of this.bloodSplatters) {
            if (!splatter.active) continue;
            
            if (!this.isSplatterVisible(splatter)) {
                this.culledParticles++;
                continue;
            }
            
            renderer.save();
            renderer.setAlpha(splatter.alpha);
            
            // Simple splatter shape
            renderer.drawCircle(splatter.x, splatter.y, splatter.size, splatter.color);
            
            renderer.restore();
        }
    }
    
    // OPTIMIZED: Pool management methods
    getParticleFromPool() {
        return this.particlePool.length > 0 ? this.particlePool.pop() : this.createParticleObject();
    }
    
    returnParticleToPool(particle) {
        if (this.particlePool.length < 500) {
            particle.active = false;
            this.particlePool.push(particle);
        }
    }
    
    // getDamageFromPool and returnDamageToPool removed - now handled by globalDamageNumberPool
    
    getSplatterFromPool() {
        return this.splatterPool.length > 0 ? this.splatterPool.pop() : this.createSplatterObject();
    }
    
    returnSplatterToPool(splatter) {
        if (this.splatterPool.length < 100) {
            splatter.active = false;
            this.splatterPool.push(splatter);
        }
    }
    
    // COMPATIBILITY LAYER: Map old particle system methods to optimized ones
    createMagicLaunchEffect(x, y, color = '#9370DB') {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 50,
                vy: Math.sin(angle) * 50,
                color: color,
                life: 0.8,
                size: 4,
                glow: true
            });
        }
    }
    
    createWhipCrackEffect(x, y, color = '#8B4513') {
        this.createEffectParticle(x, y, {
            vx: 0, vy: 0,
            color: color,
            life: 0.3,
            size: 12,
            glow: true
        });
    }
    
    createMeleeHitEffect(x, y, color = '#FFD700') {
        for (let i = 0; i < 4; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                color: color,
                life: 0.6,
                size: 3
            });
        }
    }
    
    createCriticalEffect(x, y, color = '#FF4444') {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                color: color,
                life: 1.0,
                size: 6,
                glow: true
            });
        }
    }
    
    createRicochetEffect(x, y, color = '#C0C0C0') {
        for (let i = 0; i < 3; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 60,
                vy: (Math.random() - 0.5) * 60,
                color: color,
                life: 0.5,
                size: 2
            });
        }
    }
    
    createEnhancedHitEffect(x, y, color, damage, critical) {
        const particleCount = Math.min(8, Math.floor(damage / 10) + 2);
        for (let i = 0; i < particleCount; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 120,
                vy: (Math.random() - 0.5) * 120,
                color: critical ? '#FF0000' : color,
                life: critical ? 1.2 : 0.8,
                size: critical ? 8 : 5,
                glow: true
            });
        }
    }
    
    createSkillShotEffect(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                color: '#FFD700',
                life: 1.5,
                size: 8,
                glow: true
            });
        }
    }
    
    createExplosionEffect(x, y, color, intensity = 1.0) {
        const particleCount = Math.floor(15 * intensity);
        for (let i = 0; i < particleCount; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 200 * intensity,
                vy: (Math.random() - 0.5) * 200 * intensity,
                color: color,
                life: 1.0 * intensity,
                size: 6 * intensity,
                glow: true
            });
        }
    }
    
    createEvolutionEffect(x, y) {
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 150,
                vy: Math.sin(angle) * 150,
                color: '#FFD700',
                life: 2.0,
                size: 10,
                glow: true
            });
        }
    }
    
    createEnhancedDeathEffect(x, y, color = '#FF4444', size = 1.0) {
        // REDUCED: Less particles, shorter lifetime for better performance
        const particleCount = Math.floor(3 * size); // Reduced from 6 to 3 particles
        for (let i = 0; i < particleCount; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 100 * size, // Reduced spread from 150
                vy: (Math.random() - 0.5) * 100 * size,
                color: color,
                life: 0.4 * size, // Much shorter life - was 1.2, now 0.4 seconds
                size: (2 + Math.random() * 2) * size, // Smaller particles
                glow: true,
                fadeOut: true
            });
        }
        
        // Small central burst particle for impact
        this.createEffectParticle(x, y, {
            vx: 0,
            vy: 0,
            color: color,
            life: 0.3,
            size: 8 * size,
            glow: true,
            fadeOut: true,
            expand: true
        });
    }
    
    // Additional missing methods for compatibility
    createBonusGemEffect(x, y, color = '#FFD700') {
        this.createBurst(x, y, 'bonusGem', { color, count: 3, spread: 60 });
    }
    
    createGemExplosionEffect(x, y) {
        this.createBurst(x, y, 'gemExplosion', { color: '#00FFFF', count: 4, spread: 80 });
    }
    
    createBossSpawnEffect(x, y) {
        this.createBurst(x, y, 'bossSpawn', { color: '#FF0000', count: 20, spread: 200, intensity: 2.0 });
    }
    
    createEnhancedDamageNumber(x, y, damage, critical = false) {
        this.createDamageNumber(x, y, damage.toString(), critical ? '#FF0000' : '#FFFFFF');
    }

    
    createKillStreakEffect(x, y, streakCount) {
        // Visual effect for kill streaks - intensity scales with streak count
        const intensity = Math.min(1.5, 1.0 + streakCount / 30);
        const particleCount = Math.min(8, 3 + Math.floor(streakCount / 5)); // Much smaller
        
        // Color progression based on streak count
        let color;
        if (streakCount < 15) {
            color = '#FFAA00'; // Orange for early streaks
        } else if (streakCount < 30) {
            color = '#FF6600'; // Red-orange for medium streaks
        } else {
            color = '#FF0066'; // Hot pink for high streaks
        }
        
        // Create central burst of particles
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 60 * intensity; // Reduced speed
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            this.create(x, y, {
                vx: vx,
                vy: vy,
                life: 0.8 + intensity * 0.3, // Shorter life
                size: 2 + Math.random() * 1.5, // Smaller size
                color: color,
                glow: true,
                fadeOut: true
            });
        }
        
        // Ring of sparks for higher streaks - much simpler
        if (streakCount >= 15) {
            const ringParticles = Math.min(6, 3 + Math.floor(streakCount / 10)); // Much fewer
            for (let i = 0; i < ringParticles; i++) {
                const angle = (i / ringParticles) * Math.PI * 2;
                const distance = 30 + streakCount;
                const sparkX = x + Math.cos(angle) * distance;
                const sparkY = y + Math.sin(angle) * distance;
                
                this.create(sparkX, sparkY, {
                    vx: Math.cos(angle) * 40, // Reduced speed
                    vy: Math.sin(angle) * 40,
                    life: 0.6,
                    size: 2,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true
                });
            }
        }
        
        // Lightning effect for epic streaks (50+) - much simpler
        if (streakCount >= 50) {
            // Just one bright flash particle
            this.create(x, y, {
                vx: 0,
                vy: 0,
                life: 0.8,
                size: 12,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createMagnetWave(x, y, radius) {
        // Create expanding magnetic wave effect - much simpler
        const waveParticles = 8; // Reduced from 32
        for (let i = 0; i < waveParticles; i++) {
            const angle = (i / waveParticles) * Math.PI * 2;
            const waveX = x + Math.cos(angle) * 30;
            const waveY = y + Math.sin(angle) * 30;
            
            // Create wave particles that expand outward
            this.create(waveX, waveY, {
                vx: Math.cos(angle) * 100, // Reduced speed
                vy: Math.sin(angle) * 100,
                life: 0.8, // Shorter life
                size: 3,
                color: '#00FFFF',
                glow: true,
                fadeOut: true,
                drag: 0.95
            });
        }
        
        // Simplified secondary ring - fewer particles, no delayed effects
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const ringX = x + Math.cos(angle) * 60;
            const ringY = y + Math.sin(angle) * 60;
            
            this.create(ringX, ringY, {
                vx: Math.cos(angle) * 60,
                vy: Math.sin(angle) * 60,
                life: 0.6,
                size: 2,
                color: '#AAFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createDamageNumber(x, y, text, color = '#FFFFFF') {
        // Use centralized damage number pool
        const isCritical = color === '#FF0000';
        return globalDamageNumberPool.get(
            x + (Math.random() - 0.5) * 20,
            y - 10,
            text,
            color,
            isCritical
        );
    }
    
    createComboExplosion(x, y, count) {
        const intensity = Math.min(count / 10, 3.0);
        this.createBurst(x, y, 'combo', { 
            color: '#FFD700', 
            count: Math.floor(8 * intensity), 
            spread: 150 * intensity,
            intensity 
        });
    }
    
    createComboSparks(x, y, count) {
        for (let i = 0; i < Math.min(count, 10); i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                color: '#FFFF00',
                life: 0.8,
                size: 3,
                glow: true
            });
        }
    }
    
    createComboBreakEffect(x, y) {
        this.createBurst(x, y, 'comboBreak', { color: '#FF4444', count: 8, spread: 100 });
    }
    
    createPowerUpEffect(x, y, color, intensity = 1.0) {
        this.createBurst(x, y, 'powerUp', { color, count: Math.floor(10 * intensity), spread: 120, intensity });
    }
    
    createHeartbeatEffect(x, y) {
        this.createEffectParticle(x, y, {
            vx: 0, vy: 0,
            color: '#FF0000',
            life: 1.0,
            size: 20,
            glow: true
        });
    }
    
    createImpactEffect(x, y, color = '#FFFF00') {
        // Simple impact burst effect
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                color: color,
                life: 0.5,
                size: 4,
                glow: true
            });
        }
    }
    
    createHitEffect(x, y, color = '#FFFFFF') {
        // Basic hit effect - similar to impact but smaller
        for (let i = 0; i < 4; i++) {
            this.createEffectParticle(x, y, {
                vx: (Math.random() - 0.5) * 80,
                vy: (Math.random() - 0.5) * 80,
                color: color,
                life: 0.4,
                size: 3,
                glow: true
            });
        }
    }
    
    // Additional missing particle methods
    createBloodSplatter(x, y) {
        this.createBurst(x, y, 'blood', { color: '#8B0000', count: 8, spread: 120 });
    }
    
    createBounceEffect(x, y, color = '#00FFFF') {
        this.createBurst(x, y, 'bounce', { color, count: 4, spread: 60 });
    }
    
    createEnhancedBurst(x, y, options = {}) {
        this.createBurst(x, y, 'enhanced', { ...options, intensity: 2.0 });
    }
    
    createEnhancedMuzzleFlash(x, y, color = '#FFAA00') {
        this.createBurst(x, y, 'muzzle', { color, count: 8, spread: 90, intensity: 1.5 });
    }
    
    createLastStandEffect(x, y) {
        this.createBurst(x, y, 'lastStand', { color: '#FF0000', count: 16, spread: 200, intensity: 3.0 });
    }
    
    createMiraculousSaveEffect(x, y) {
        this.createBurst(x, y, 'miraculous', { color: '#FFD700', count: 20, spread: 150, intensity: 2.5 });
    }
    
    createPerfectAimEffect(x, y) {
        this.createBurst(x, y, 'perfectAim', { color: '#00FF00', count: 12, spread: 100 });
    }
    
    createPrecisionRing(x, y, radius = 50) {
        const ringParticles = 16;
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            this.createEffectParticle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, {
                vx: 0, vy: -30,
                color: '#FFFFFF',
                life: 1.0,
                size: 2,
                glow: true
            });
        }
    }
    
    createPrecisionStrikeEffect(x, y) {
        this.createPrecisionRing(x, y, 40);
        this.createBurst(x, y, 'precision', { color: '#FFFF00', count: 6, spread: 80 });
    }
    
    createRecoveryEffect(x, y) {
        this.createBurst(x, y, 'recovery', { color: '#00FF00', count: 10, spread: 100 });
    }
    
    createStreakCelebration(x, y, streakCount) {
        const intensity = Math.min(streakCount / 5, 3.0);
        this.createBurst(x, y, 'streak', { 
            color: '#FFD700', 
            count: Math.floor(12 * intensity), 
            spread: 150 * intensity,
            intensity 
        });
    }
    
    createPowerUpSpawnEffect(x, y, color = '#FFD700') {
        // Power-up spawn effect with dramatic flair
        this.createBurst(x, y, 'powerUpSpawn', { 
            color, 
            count: 15, 
            spread: 180, 
            intensity: 2.0 
        });
        
        // Add a central glow effect
        this.createEffectParticle(x, y, {
            vx: 0, vy: 0,
            color: color,
            life: 1.5,
            size: 25,
            glow: true
        });
    }
    
    createPowerUpCollectEffect(x, y, color = '#FFD700') {
        // Subtle collection effect - not overwhelming
        this.createBurst(x, y, 'powerUpCollect', { 
            color, 
            count: 8, 
            spread: 100,
            intensity: 1.5
        });
    }

    // Generic method for simple effects
    create(x, y, options = {}) {
        return this.createEffectParticle(x, y, options);
    }
    
    createBurst(x, y, type, options = {}) {
        // Preserve special handling for common types
        if (type === 'hit') {
            this.createHitEffect(x, y, options.color || '#FFFFFF');
            return;
        }
        if (type === 'death') {
            this.createDeathEffect(x, y);
            return;
        }
        // Use adaptive quality for particle counts
        const baseCount = options.count || 8;
        const count = Math.floor(baseCount * this.qualityLevel);
        const spread = options.spread || 120;
        const intensity = options.intensity || 1.0;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            this.createEffectParticle(x, y, {
                vx: Math.cos(angle) * spread * intensity,
                vy: Math.sin(angle) * spread * intensity,
                color: options.color || '#FFFFFF',
                life: Math.min((options.life || 1.0) * intensity, 0.8), // Shorter life
                size: Math.min((options.size || 4) * intensity, 6), // Smaller size
                glow: options.glow !== false
            });
        }
    }

    // OPTIMIZED: Visibility culling methods
    updateViewBounds(renderer) {
        this.viewBounds = renderer.viewBounds || { left: 0, top: 0, right: 800, bottom: 600 };
    }
    
    isParticleVisible(particle) {
        const margin = particle.size + 50; // Extra margin for smooth transitions
        return !(particle.x + margin < this.viewBounds.left ||
                particle.x - margin > this.viewBounds.right ||
                particle.y + margin < this.viewBounds.top ||
                particle.y - margin > this.viewBounds.bottom);
    }
    
    // isDamageVisible removed - culling now handled by globalDamageNumberPool
    
    isSplatterVisible(splatter) {
        const margin = splatter.size + 20;
        return !(splatter.x + margin < this.viewBounds.left ||
                splatter.x - margin > this.viewBounds.right ||
                splatter.y + margin < this.viewBounds.top ||
                splatter.y - margin > this.viewBounds.bottom);
    }
    
    // OPTIMIZED: Adaptive performance management
    adaptParticleLimits() {
        const damageNumberCount = globalDamageNumberPool.getStats().inUse;
        const totalParticles = this.effectParticles.length + damageNumberCount + this.bloodSplatters.length;
        const fps = this.game.performanceStats?.fps || 60;
        
        if (fps < 45 && totalParticles > 100) {
            // Reduce particle limits for better performance
            this.maxEffectParticles = Math.max(200, this.maxEffectParticles * 0.8);
            this.maxDamageNumbers = Math.max(15, this.maxDamageNumbers * 0.8);
            this.maxBloodSplatters = Math.max(50, this.maxBloodSplatters * 0.8);
            console.log('🔥 Particle limits reduced for better performance');
        } else if (fps > 55 && totalParticles < 50) {
            // Restore particle limits when performance is good
            this.maxEffectParticles = Math.min(800, this.maxEffectParticles * 1.1);
            this.maxDamageNumbers = Math.min(30, this.maxDamageNumbers * 1.1);
            this.maxBloodSplatters = Math.min(100, this.maxBloodSplatters * 1.1);
        }
    }
    
    // Clear all particles (for game reset)
    clear() {
        // Return all particles to pools
        for (const particle of this.effectParticles) {
            this.returnParticleToPool(particle);
        }
        // Note: Damage numbers now cleared by globalDamageNumberPool.clear()
        for (const splatter of this.bloodSplatters) {
            this.returnSplatterToPool(splatter);
        }
        
        this.effectParticles.length = 0;
        // Note: damage numbers cleared separately
        this.bloodSplatters.length = 0;
        this.culledParticles = 0;
        
        // Clear damage numbers from pool
        globalDamageNumberPool.clear();
    }
    
    // Performance and debug info
    getPerformanceInfo() {
        const damagePoolStats = globalDamageNumberPool.getStats();
        return {
            effectParticles: this.effectParticles.length,
            damageNumbers: damagePoolStats.inUse, // Get from pool
            bloodSplatters: this.bloodSplatters.length,
            maxEffectParticles: this.maxEffectParticles,
            maxDamageNumbers: damagePoolStats.created, // Pool capacity info
            maxBloodSplatters: this.maxBloodSplatters,
            culledThisFrame: this.culledParticles,
            poolSizes: {
                particles: this.particlePool.length,
                damage: damagePoolStats.available, // From pool
                splatters: this.splatterPool.length
            },
            damagePoolStats: damagePoolStats, // Full pool statistics
            qualityLevel: this.qualityLevel,
            particleReduction: this.particleReduction
        };
    }
    
    showDamage(x, y, damage, isCritical = false) {
        const color = isCritical ? '#FF0000' : '#FFFFFF';
        this.createDamageNumber(x, y, String(damage), color);
        this.createHitEffect(x, y, color);
    }
}