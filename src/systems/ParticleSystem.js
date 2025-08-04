export class ParticleSystem {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.damageNumbers = [];
        this.bloodSplatters = [];
        this.maxParticles = 1500; // Increased for enhanced effects
        this.maxBloodSplatters = 200;
        this.maxDamageNumbers = 50;
        
        // Performance management
        this.performanceMode = 'high'; // high, medium, low
        this.frameTimeThreshold = 16.67; // 60 FPS threshold (in ms)
        this.recentFrameTimes = [];
        this.adaptiveQuality = true;
        this.lastPerformanceCheck = 0;
        
        // Particle pools for performance
        this.particlePool = [];
        this.damageNumberPool = [];
        this.bloodSplatterPool = [];
        this.initializePool();
        
        // Enhanced visual effects settings
        this.bloodTrails = new Map();
        this.screenShakeIntensity = 0;
        this.screenFlashColor = null;
        this.screenFlashAlpha = 0;
    }
    
    initializePool() {
        // Pre-create particle objects for performance
        for (let i = 0; i < 300; i++) {
            this.particlePool.push(this.createParticleObject());
        }
        
        // Pre-create damage number objects
        for (let i = 0; i < 50; i++) {
            this.damageNumberPool.push(this.createDamageNumberObject());
        }
        
        // Pre-create blood splatter objects
        for (let i = 0; i < 100; i++) {
            this.bloodSplatterPool.push(this.createBloodSplatterObject());
        }
    }
    
    createParticleObject() {
        return {
            x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
            life: 0, maxLife: 0, size: 0, currentSize: 0,
            color: '#FFFFFF', alpha: 1, active: false,
            fadeOut: false, shrink: false, glow: false,
            trail: false, trailPositions: [], spin: 0, spinSpeed: 0,
            blur: false, blurAmount: 0, pulse: false, pulseSpeed: 1,
            gravity: 0, bounce: false, bounceDamping: 0.8,
            sparkle: false, sparkleFreq: 0.1
        };
    }
    
    createDamageNumberObject() {
        return {
            x: 0, y: 0, vx: 0, vy: 0,
            life: 0, maxLife: 0, text: '',
            color: '#FFFFFF', alpha: 1, active: false,
            size: 16, scale: 1, critical: false,
            outline: true, shadow: true
        };
    }
    
    createBloodSplatterObject() {
        return {
            x: 0, y: 0, size: 0, angle: 0,
            life: 0, maxLife: 0, alpha: 1,
            color: '#4B0082', active: false, // Changed from red to indigo
            shape: 'splatter', fadeSpeed: 0.5
        };
    }
    
    getParticle() {
        if (this.particlePool.length > 0) {
            const particle = this.particlePool.pop();
            particle.active = true;
            particle.trailPositions = [];
            return particle;
        }
        return this.createParticleObject();
    }
    
    returnParticle(particle) {
        particle.active = false;
        if (this.particlePool.length < 300) {
            this.particlePool.push(particle);
        }
    }
    
    create(x, y, options = {}) {
        if (this.particles.length >= this.maxParticles) return;
        
        const particle = {
            x: x,
            y: y,
            vx: options.vx || 0,
            vy: options.vy || 0,
            ax: options.ax || 0,
            ay: options.ay || 0,
            life: options.life || 1,
            maxLife: options.life || 1,
            size: options.size || 3,
            color: options.color || '#FFFFFF',
            alpha: options.alpha || 1,
            fadeOut: options.fadeOut !== false,
            shrink: options.shrink || false,
            glow: options.glow || false,
            trail: options.trail || false,
            trailPositions: []
        };
        
        this.particles.push(particle);
        return particle;
    }
    
    createBurst(x, y, type, options = {}) {
        // Enhanced weapon firing effects and muzzle flashes
        const burstConfigs = {
            boost: {
                count: options.count || 8,  // was 20
                speed: 200,
                life: 0.5,
                size: 4,
                color: options.color || '#FFE066',
                glow: true
            },
            collect: {
                count: options.count || 4,  // was 10
                speed: 100,
                life: 1,
                size: 3,
                color: options.color || '#FFFFFF',
                fadeOut: true,
                shrink: true
            },
            massCollect: {
                count: options.count || 12,  // was 30
                speed: 150,
                life: 1.5,
                size: 5,
                color: options.color || '#FFE066',
                glow: true,
                trail: true
            },
            plant: {
                count: options.count || 6,  // was 15
                speed: 50,
                life: 2,
                size: 6,
                color: options.color || '#4ECDC4',
                fadeOut: true,
                ay: 50
            },
            // Combat effects
            hit: {
                count: options.count || 4,
                speed: 150,
                life: 0.6,
                size: 3,
                color: options.color || '#FFFF00',
                fadeOut: true,
                glow: true
            },
            meleeHit: {
                count: options.count || 5,
                speed: 180,
                life: 0.8,
                size: 4,
                color: options.color || '#FF6B6B',
                fadeOut: true,
                glow: true
            },
            critical: {
                count: options.count || 6,
                speed: 220,
                life: 1.0,
                size: 5,
                color: options.color || '#9370DB', // Changed from red to purple
                fadeOut: true,
                glow: true,
                trail: true
            },
            death: {
                count: options.count || 8,
                speed: 160,
                life: 1.2,
                size: 4,
                color: options.color || '#FF4444',
                fadeOut: true,
                shrink: true,
                ay: 100
            },
            explosion: {
                count: options.count || 10,
                speed: 250,
                life: 1.5,
                size: 6,
                color: options.color || '#FF8800',
                fadeOut: true,
                glow: true,
                ay: 50
            },
            magic: {
                count: options.count || 3,
                speed: 80,
                life: 0.8,
                size: 4,
                color: options.color || '#9B59B6',
                glow: true,
                fadeOut: true,
                trail: true
            },
            ricochet: {
                count: options.count || 3,
                speed: 120,
                life: 0.5,
                size: 3,
                color: options.color || '#C0C0C0',
                glow: true,
                fadeOut: true
            },
            bounce: {
                count: options.count || 2,
                speed: 100,
                life: 0.6,
                size: 3,
                color: options.color || '#44AAFF',
                fadeOut: true
            },
            gemExplosion: {
                count: options.count || 10,
                speed: 200,
                life: 1.8,
                size: 5,
                color: options.color || '#FFD700',
                glow: true,
                fadeOut: true,
                trail: true
            },
            weaponFire: {
                count: options.count || 5,
                speed: 120,
                life: 0.6,
                size: 4,
                color: options.color || '#FFD700',
                glow: true,
                fadeOut: true,
                sparkle: true
            },
            muzzleFlash: {
                count: options.count || 8,
                speed: 150,
                life: 0.3,
                size: 3,
                color: options.color || '#FFAA00',
                glow: true,
                fadeOut: true,
                shrink: true,
                spread: 25
            },
            shellEject: {
                count: options.count || 2,
                speed: 80,
                life: 1.2,
                size: 2,
                color: options.color || '#C0C0C0',
                fadeOut: true,
                ay: 200,
                bounce: true
            },
            bloodSplash: {
                count: options.count || 8,
                speed: 80,
                life: 1.0,
                size: 4,
                color: options.color || '#4B0082', // Changed from dark red to indigo
                fadeOut: true,
                ay: 100
            },
            whipCrack: {
                count: options.count || 8,
                speed: 120,
                life: 0.6,
                size: 3,
                color: options.color || '#D2B48C',
                fadeOut: true,
                ay: 80
            },
            dustExplosion: {
                count: options.count || 12,
                speed: 100,
                life: 0.8,
                size: 4,
                color: options.color || '#D2B48C',
                fadeOut: true,
                ay: 60
            }
        };
        
        const config = burstConfigs[type] || burstConfigs.collect;
        const spread = options.spread || 50;
        
        for (let i = 0; i < config.count; i++) {
            const angle = (Math.PI * 2 / config.count) * i + Math.random() * 0.2;
            const speed = config.speed * (0.5 + Math.random() * 0.5);
            
            this.create(
                x + (Math.random() - 0.5) * spread * 0.2,
                y + (Math.random() - 0.5) * spread * 0.2,
                {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    ax: config.ax || 0,
                    ay: config.ay || 0,
                    life: config.life * (0.8 + Math.random() * 0.4),
                    size: config.size * (0.8 + Math.random() * 0.4),
                    color: config.color,
                    fadeOut: config.fadeOut,
                    shrink: config.shrink,
                    glow: config.glow,
                    trail: config.trail
                }
            );
        }
    }

    
    createMagnetWave(x, y, radius) {
        // Create expanding magnetic wave effect
        const waveParticles = 32;
        for (let i = 0; i < waveParticles; i++) {
            const angle = (i / waveParticles) * Math.PI * 2;
            const waveX = x + Math.cos(angle) * 50; // Start close to player
            const waveY = y + Math.sin(angle) * 50;
            
            // Create wave particles that expand outward
            this.create(waveX, waveY, {
                vx: Math.cos(angle) * 150, // Fast expansion
                vy: Math.sin(angle) * 150,
                life: 1.0,
                size: 4,
                color: '#00FFFF',
                glow: true,
                fadeOut: true,
                drag: 0.95 // Slow down over time
            });
        }
        
        // Create secondary ring of particles
        setTimeout(() => {
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                const ringX = x + Math.cos(angle) * 100;
                const ringY = y + Math.sin(angle) * 100;
                
                this.create(ringX, ringY, {
                    vx: Math.cos(angle) * 100,
                    vy: Math.sin(angle) * 100,
                    life: 0.8,
                    size: 3,
                    color: '#AAFFFF',
                    glow: true,
                    fadeOut: true,
                    drag: 0.92
                });
            }
        }, 100);
        
        // Add sparkly trail effects for gems being magnetized
        setTimeout(() => {
            for (let i = 0; i < 20; i++) {
                const sparkleX = x + (Math.random() - 0.5) * radius;
                const sparkleY = y + (Math.random() - 0.5) * radius;
                
                this.create(sparkleX, sparkleY, {
                    vx: (x - sparkleX) * 0.3, // Move toward center
                    vy: (y - sparkleY) * 0.3,
                    life: 1.2,
                    size: 2,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true
                });
            }
        }, 200);
    }

    
    createKillStreakEffect(x, y, streakCount) {
        // Visual effect for kill streaks - intensity scales with streak count
        const intensity = Math.min(2.0, 1.0 + streakCount / 20);
        const particleCount = Math.min(25, 8 + streakCount);
        
        // Color progression based on streak count
        let color;
        if (streakCount < 15) {
            color = '#FFAA00'; // Orange for early streaks
        } else if (streakCount < 30) {
            color = '#FF6600'; // Red-orange for medium streaks
        } else {
            color = '#FF0066'; // Hot pink for high streaks
        }
        
        // Central burst
        this.createBurst(x, y, 'killStreak', {
            color: color,
            count: particleCount,
            spread: 60,
            intensity: intensity
        });
        
        // Ring of sparks for higher streaks
        if (streakCount >= 10) {
            const ringParticles = Math.min(12, 6 + Math.floor(streakCount / 5));
            for (let i = 0; i < ringParticles; i++) {
                const angle = (i / ringParticles) * Math.PI * 2;
                const distance = 40 + streakCount * 2;
                const sparkX = x + Math.cos(angle) * distance;
                const sparkY = y + Math.sin(angle) * distance;
                
                this.create(sparkX, sparkY, {
                    vx: Math.cos(angle) * 80,
                    vy: Math.sin(angle) * 80,
                    life: 1.0 + intensity * 0.5,
                    size: 4,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true
                });
            }
        }
        
        // Lightning effect for epic streaks (50+)
        if (streakCount >= 50) {
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 80 + Math.random() * 40;
                const lightningX = x + Math.cos(angle) * distance;
                const lightningY = y + Math.sin(angle) * distance;
                
                // Create lightning bolt particles
                for (let j = 0; j < 3; j++) {
                    this.create(lightningX + (Math.random() - 0.5) * 20, lightningY + (Math.random() - 0.5) * 20, {
                        vx: (Math.random() - 0.5) * 40,
                        vy: (Math.random() - 0.5) * 40,
                        life: 0.3,
                        size: 2,
                        color: '#FFFFFF',
                        glow: true,
                        fadeOut: true
                    });
                }
            }
        }
    }
    
    update(dt) {
        // Store deltaTime for rendering
        this.deltaTime = dt;
        
        // Update screen flash alpha to fade out
        if (this.screenFlashAlpha > 0) {
            this.screenFlashAlpha -= dt * 2; // Fade out over 0.5 seconds
            if (this.screenFlashAlpha <= 0) {
                this.screenFlashAlpha = 0;
                this.screenFlashColor = null;
            }
        }
        
        // Performance monitoring and adaptive quality
        this.updatePerformanceMonitoring(dt);
        
        // OPTIMIZED: Batch processing without filter
        let writeIndex = 0;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // OPTIMIZED: Fast physics update
            particle.vx += particle.ax * dt;
            particle.vy += particle.ay * dt;
            
            // Apply gravity if specified
            if (particle.gravity) {
                particle.vy += particle.gravity * dt;
            }
            
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            
            // OPTIMIZED: Trail update with array length management
            if (particle.trail) {
                particle.trailPositions.push({ x: particle.x, y: particle.y });
                if (particle.trailPositions.length > 10) {
                    particle.trailPositions.shift();
                }
            }
            
            // Update life
            particle.life -= dt;
            
            // OPTIMIZED: Early exit if particle is dead
            if (particle.life <= 0) {
                this.returnParticle(particle);
                continue;
            }
            
            // OPTIMIZED: Fast visual property updates
            if (particle.fadeOut) {
                particle.alpha = particle.life / particle.maxLife;
            }
            
            if (particle.shrink) {
                particle.currentSize = particle.size * (particle.life / particle.maxLife);
            } else {
                particle.currentSize = particle.size;
            }
            
            // OPTIMIZED: Compact array without splice
            if (writeIndex !== i) {
                this.particles[writeIndex] = particle;
            }
            writeIndex++;
        }
        
        // OPTIMIZED: Single array truncation
        this.particles.length = writeIndex;
    }
    
    render(renderer) {
        const ctx = renderer.ctx;
        
        // OPTIMIZED: Ultra-fast rendering with minimal operations
        let currentColor = null;
        let currentAlpha = 1;
        
        // OPTIMIZED: Skip all fancy effects in medium/low performance modes
        const skipFancyEffects = this.performanceMode !== 'high';
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // OPTIMIZED: Only change alpha if different
            if (particle.alpha !== currentAlpha) {
                ctx.globalAlpha = particle.alpha;
                currentAlpha = particle.alpha;
            }
            
            // OPTIMIZED: Skip ALL expensive effects unless in high performance mode
            if (!skipFancyEffects) {
                // Only render trails and glows in high performance mode
                if (particle.trail && particle.trailPositions.length > 1) {
                    if (particle.color !== currentColor) {
                        ctx.strokeStyle = particle.color;
                        currentColor = particle.color;
                    }
                    ctx.lineWidth = particle.currentSize * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particle.trailPositions[0].x, particle.trailPositions[0].y);
                    
                    for (let j = 1; j < particle.trailPositions.length; j++) {
                        const pos = particle.trailPositions[j];
                        ctx.lineTo(pos.x, pos.y);
                    }
                    ctx.stroke();
                }
                
                if (particle.glow) {
                    // Simplified glow without gradient creation
                    ctx.shadowBlur = particle.currentSize;
                    ctx.shadowColor = particle.color;
                }
            }
            
            // OPTIMIZED: Batch same-color particles
            if (particle.color !== currentColor) {
                ctx.fillStyle = particle.color;
                currentColor = particle.color;
            }
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.currentSize, 0, 6.283185307179586);
            ctx.fill();
            
            // Reset shadow for next particle
            if (!skipFancyEffects && particle.glow) {
                ctx.shadowBlur = 0;
            }
        }
        
        // Reset alpha for other renders
        ctx.globalAlpha = 1;
        
        // OPTIMIZED: Skip blood splatters except in high performance mode
        if (this.performanceMode === 'high' && this.bloodSplatters.length < 10) {
            this.renderBloodSplatters(renderer);
        }
        
        // Render damage numbers (always important for gameplay)
        this.renderDamageNumbers(renderer);
        
        // OPTIMIZED: Skip screen effects except in high performance mode
        if (this.performanceMode === 'high' && this.particles.length < 200) {
            this.renderScreenEffects(renderer);
        }
    }
    
    clear() {
        // Return all particles to pool
        for (const particle of this.particles) {
            this.returnParticle(particle);
        }
        this.particles = [];
        
        // Clear screen effects
        this.clearScreenEffects();
    }
    
    clearScreenEffects() {
        // Clear any lingering screen effects to prevent red overlay bug
        this.screenFlashAlpha = 0;
        this.screenFlashColor = null;
        this.screenShakeIntensity = 0;
    }
    
    // Performance management methods
    updatePerformanceMonitoring(dt) {
        if (!this.adaptiveQuality) return;
        
        // Track frame time (convert dt from seconds to milliseconds)
        const frameTime = dt * 1000;
        this.recentFrameTimes.push(frameTime);
        
        // Keep only last 10 frames for faster response
        if (this.recentFrameTimes.length > 10) {
            this.recentFrameTimes.shift();
        }
        
        // Check performance more frequently for faster response
        const now = performance.now();
        if (now - this.lastPerformanceCheck > 300) { // Every 300ms instead of 1000ms
            this.checkPerformance();
            this.lastPerformanceCheck = now;
        }
    }
    
    checkPerformance() {
        if (this.recentFrameTimes.length < 5) return; // Reduced threshold for faster response
        
        // OPTIMIZED: Fast average calculation
        let sum = 0;
        let max = 0;
        for (let i = 0; i < this.recentFrameTimes.length; i++) {
            const frameTime = this.recentFrameTimes[i];
            sum += frameTime;
            if (frameTime > max) max = frameTime;
        }
        const avgFrameTime = sum / this.recentFrameTimes.length;
        const worstFrameTime = max;
        
        // OPTIMIZED: Much more aggressive performance scaling
        let newMode = this.performanceMode;
        const particleCount = this.particles.length;
        
        // Much more aggressive thresholds for better performance
        if (avgFrameTime > 17 || worstFrameTime > 24 || particleCount > 300) {
            newMode = 'low';
        } else if (avgFrameTime > 16.2 || worstFrameTime > 20 || particleCount > 150) {
            newMode = 'medium';
        } else if (avgFrameTime < 15.5 && worstFrameTime < 18 && particleCount < 100) {
            newMode = 'high';
        }
        
        // Update performance mode if changed
        if (newMode !== this.performanceMode) {
            this.setPerformanceMode(newMode);
        }
    }
    
    setPerformanceMode(mode) {
        this.performanceMode = mode;
        
        // OPTIMIZED: Much more aggressive performance scaling for stability
        switch (mode) {
            case 'low':
                this.maxParticles = 50; // Even more aggressive reduction  
                this.maxBloodSplatters = 5;
                this.maxDamageNumbers = 4;
                console.log('🔽 Particle system: LOW performance mode (ULTRA AGGRESSIVE)');
                break;
            case 'medium':
                this.maxParticles = 150; // Further reduced
                this.maxBloodSplatters = 15;
                this.maxDamageNumbers = 10;
                console.log('⚡ Particle system: MEDIUM performance mode');
                break;
            case 'high':
            default:
                this.maxParticles = 300; // Reasonable limit for 60+ FPS
                this.maxBloodSplatters = 30;
                this.maxDamageNumbers = 20;
                console.log('🔥 Particle system: HIGH performance mode');
                break;
        }
        
        // Clean up excess particles if we lowered the limit
        this.enforceParticleLimits();
    }
    
    enforceParticleLimits() {
        // Remove excess particles if we're over the new limit
        while (this.particles.length > this.maxParticles) {
            const particle = this.particles.pop();
            this.returnParticle(particle);
        }
        
        while (this.bloodSplatters.length > this.maxBloodSplatters) {
            this.bloodSplatters.pop();
        }
        
        while (this.damageNumbers.length > this.maxDamageNumbers) {
            this.damageNumbers.pop();
        }
    }
    
    // Performance-aware effect creation
    getEffectIntensityMultiplier() {
        switch (this.performanceMode) {
            case 'low': return 0.5;
            case 'medium': return 0.75;
            case 'high': 
            default: return 1.0;
        }
    }
    
    shouldSkipEffect(effectIntensity = 1.0) {
        const multiplier = this.getEffectIntensityMultiplier();
        
        // Skip some effects based on performance mode
        if (this.performanceMode === 'low' && Math.random() > 0.7 * multiplier) {
            return true;
        }
        
        if (this.performanceMode === 'medium' && Math.random() > 0.85 * multiplier) {
            return true;
        }
        
        return false;
    }
    
    // Override effect creation methods to be performance-aware
    createBurstPerformant(x, y, type, options = {}) {
        if (this.shouldSkipEffect(options.intensity || 1.0)) {
            return; // Skip this effect for performance
        }
        
        // Reduce particle count based on performance mode
        const multiplier = this.getEffectIntensityMultiplier();
        if (options.count) {
            options.count = Math.floor(options.count * multiplier);
        }
        
        this.createBurst(x, y, type, options);
    }
    
    // Performance info for debugging
    getPerformanceInfo() {
        return {
            mode: this.performanceMode,
            avgFrameTime: this.recentFrameTimes.length > 0 ? 
                (this.recentFrameTimes.reduce((a, b) => a + b, 0) / this.recentFrameTimes.length).toFixed(2) : 0,
            particleCount: this.particles.length,
            maxParticles: this.maxParticles,
            utilizationPercent: ((this.particles.length / this.maxParticles) * 100).toFixed(1)
        };
    }
    
    // Combat-specific particle effects
    createHitEffect(x, y, color = '#FFFF00') {
        this.createBurst(x, y, 'hit', { color: color, count: 8 });
    }
    
    createMeleeHitEffect(x, y, color = '#FF6B6B') {
        this.createBurst(x, y, 'meleeHit', { color: color, count: 12 });
    }
    
    createCriticalEffect(x, y, color = '#FFD700') { // Changed from red to gold
        this.createBurst(x, y, 'critical', { color: color, count: 15 });
        
        // Add screen flash effect
        this.createScreenFlash(color, 0.3);
    }
    
    createDeathEffect(x, y, color = '#FF4444') {
        this.createBurst(x, y, 'death', { color: color, count: 20 });
    }
    
    createExplosionEffect(x, y, radius = 50, color = '#FF8800') {
        const particleCount = Math.floor(radius / 3);
        this.createBurst(x, y, 'explosion', { 
            color: color, 
            count: particleCount,
            spread: radius 
        });
        
        // Add shockwave ring
        this.createShockwave(x, y, radius, color);
    }
    
    createShockwave(x, y, radius, color = '#FFFFFF') {
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * Math.PI * 2;
            const endX = x + Math.cos(angle) * radius;
            const endY = y + Math.sin(angle) * radius;
            
            this.create(x, y, {
                vx: Math.cos(angle) * 300,
                vy: Math.sin(angle) * 300,
                life: 0.5,
                size: 3,
                color: color,
                fadeOut: true,
                glow: true
            });
        }
    }
    
    createMagicLaunchEffect(x, y, color = '#9B59B6') {
        this.createBurst(x, y, 'magic', { color: color, count: 6 });
    }
    
    createWhipCrackEffect(x, y, color = '#8B4513') {
        // Create dust particles
        for (let i = 0; i < 8; i++) {
            this.create(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, {
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                life: 0.8,
                size: 4,
                color: '#D2B48C',
                fadeOut: true,
                ay: 50
            });
        }
    }
    
    createRicochetEffect(x, y, color = '#C0C0C0') {
        this.createBurst(x, y, 'ricochet', { color: color, count: 6 });
        
        // Add spark effect
        for (let i = 0; i < 5; i++) {
            this.create(x, y, {
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.3,
                size: 2,
                color: '#FFFF00',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createBounceEffect(x, y, color = '#44AAFF') {
        this.createBurst(x, y, 'bounce', { color: color, count: 4 });
    }
    
    createCollectionEffect(x, y, color = '#FFD700') {
        // Sparkle effect for gem collection
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 0.6,
                size: 3,
                color: color,
                glow: true,
                fadeOut: true,
                shrink: true
            });
        }
    }
    
    createBonusGemEffect(x, y, color = '#9B59B6') {
        // Special effect for bonus gems
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 60,
                vy: Math.sin(angle) * 60,
                life: 1.0,
                size: 4,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createGemExplosionEffect(x, y) {
        this.createBurst(x, y, 'gemExplosion', { 
            color: '#FFD700', 
            count: 25,
            spread: 60
        });
    }
    
    createImpactEffect(x, y, options = {}) {
        // Handle both old format (color as second param) and new format (options object)
        const config = typeof options === 'string' ? { color: options } : options;
        
        const {
            color = '#FF4444',
            particleCount = 6,
            spread = Math.PI * 2,
            speed = 120,
            lifetime = 0.4,
            size = 3
        } = config;
        
        // Quick impact burst
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * spread - spread / 2;
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: lifetime,
                size: size,
                color: color,
                fadeOut: true
            });
        }
    }
    
    createEvolutionEffect(x, y) {
        // Special effect for weapon evolution
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const distance = 20 + Math.random() * 40;
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: Math.cos(angle) * -100,
                    vy: Math.sin(angle) * -100,
                    life: 1.5,
                    size: 5,
                    color: '#FFD700',
                    glow: true,
                    fadeOut: true
                }
            );
        }
    }
    
    createBossSpawnEffect(x, y) {
        // Dramatic boss spawn effect
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100;
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: Math.cos(angle) * -200,
                    vy: Math.sin(angle) * -200,
                    life: 2.0,
                    size: 6,
                    color: '#9B59B6',
                    glow: true,
                    fadeOut: true
                }
            );
        }
    }
    
    createScreenFlash(color = '#FFFFFF', duration = 0.5) {
        // This would be handled by the camera system (with enhanced safety check)
        if (this.game && this.game.camera && typeof this.game.camera.flash === 'function') {
            this.game.camera.flash(color, duration);
        } else {
            console.warn('Camera flash method not available');
        }
    }
    
    // ENHANCED PSYCHOLOGY FEEDBACK EFFECTS
    
    createEnhancedDamageNumber(x, y, damage, critical = false, color = '#FFFF00', size = 18, intensity = 1.0) {
        // Validate damage and skip if zero or invalid
        const validDamage = isFinite(damage) ? Math.floor(damage) : 0;
        if (validDamage <= 0) return; // Don't show zero or negative damage
        
        if (this.damageNumbers.length >= this.maxDamageNumbers) return;
        
        let damageNumber;
        if (this.damageNumberPool.length > 0) {
            damageNumber = this.damageNumberPool.pop();
        } else {
            damageNumber = this.createDamageNumberObject();
        }
        
        // Enhanced properties based on damage amount and intensity
        const damageMultiplier = Math.min(2.5, 1.0 + (validDamage / 100) * 0.5); // Scale with damage
        const scaleMultiplier = Math.min(2.0, 1.0 + intensity * 0.3) * damageMultiplier;
        const lifeMultiplier = Math.min(2.5, 1.0 + intensity * 0.2 + (validDamage / 200) * 0.3);
        
        // Enhanced movement for bigger damage
        const movementBoost = Math.min(1.5, 1.0 + (validDamage / 150) * 0.5);
        
        damageNumber.x = x + (Math.random() - 0.5) * 30;
        damageNumber.y = y;
        damageNumber.vx = (Math.random() - 0.5) * 50 * intensity * movementBoost;
        damageNumber.vy = -60 - Math.random() * 40 - intensity * 20 - (validDamage / 50) * 10;
        damageNumber.life = (critical ? 2.8 : 2.2) * lifeMultiplier;
        damageNumber.maxLife = damageNumber.life;
        damageNumber.text = validDamage.toString();
        damageNumber.color = color;
        damageNumber.alpha = 1;
        damageNumber.size = size * scaleMultiplier;
        damageNumber.scale = critical ? 1.8 * scaleMultiplier : 1.2 * scaleMultiplier;
        damageNumber.critical = critical;
        damageNumber.active = true;
        damageNumber.intensity = intensity;
        damageNumber.pulseSpeed = 2 + intensity + (validDamage / 100);
        damageNumber.glow = intensity > 2.0 || validDamage >= 75; // Glow for high damage or high intensity
        damageNumber.glowIntensity = Math.min(20, (validDamage / 25) + intensity * 2); // Variable glow strength
        
        this.damageNumbers.push(damageNumber);
    }
    
    createComboDisplay(x, y, combo, color = '#FFD700') {
        const comboText = `${combo}x COMBO!`;
        const size = 14 + Math.min(combo, 20);
        
        let damageNumber;
        if (this.damageNumberPool.length > 0) {
            damageNumber = this.damageNumberPool.pop();
        } else {
            damageNumber = this.createDamageNumberObject();
        }
        
        damageNumber.x = x;
        damageNumber.y = y;
        damageNumber.vx = 0;
        damageNumber.vy = -30;
        damageNumber.life = 1.5;
        damageNumber.maxLife = 1.5;
        damageNumber.text = comboText;
        damageNumber.color = color;
        damageNumber.alpha = 1;
        damageNumber.size = size;
        damageNumber.scale = 1.0;
        damageNumber.critical = false;
        damageNumber.active = true;
        damageNumber.glow = true;
        
        this.damageNumbers.push(damageNumber);
    }
    
    createStreakDisplay(x, y, streak, color = '#FF00FF') {
        const streakText = `${streak} KILLS!`;
        
        let damageNumber;
        if (this.damageNumberPool.length > 0) {
            damageNumber = this.damageNumberPool.pop();
        } else {
            damageNumber = this.createDamageNumberObject();
        }
        
        damageNumber.x = x;
        damageNumber.y = y;
        damageNumber.vx = 0;
        damageNumber.vy = -80;
        damageNumber.life = 2.0;
        damageNumber.maxLife = 2.0;
        damageNumber.text = streakText;
        damageNumber.color = color;
        damageNumber.alpha = 1;
        damageNumber.size = 24;
        damageNumber.scale = 1.5;
        damageNumber.critical = true;
        damageNumber.active = true;
        damageNumber.glow = true;
        
        this.damageNumbers.push(damageNumber);
    }
    
    createEnhancedBurst(x, y, type, options = {}) {
        const intensity = options.intensity || 1.0;
        const comboMultiplier = Math.min(2.0, 1.0 + (options.comboMultiplier || 0) * 0.1);
        const baseCount = options.count || 10;
        const finalCount = Math.floor(baseCount * intensity * comboMultiplier);
        
        // Enhanced burst configurations
        const enhancedConfigs = {
            hit: {
                count: finalCount,
                speed: 120 * intensity,
                life: 0.6 * comboMultiplier,
                size: 3 * intensity,
                color: options.color || '#FFFF44',
                glow: intensity > 1.5
            },
            meleeHit: {
                count: finalCount,
                speed: 150 * intensity,
                life: 0.8 * comboMultiplier,
                size: 4 * intensity,
                color: options.color || '#FF6644',
                glow: true,
                trail: intensity > 2.0
            },
            critical: {
                count: finalCount,
                speed: 200 * intensity,
                life: 1.0 * comboMultiplier,
                size: 5 * intensity,
                color: options.color || '#FF2222',
                glow: true,
                trail: true
            },
            explosion: {
                count: finalCount,
                speed: 250 * intensity,
                life: 1.2 * comboMultiplier,
                size: 6 * intensity,
                color: options.color || '#FF8800',
                glow: true,
                trail: true
            },
            godMode: {
                count: finalCount * 2,
                speed: 300 * intensity,
                life: 1.5 * comboMultiplier,
                size: 8 * intensity,
                color: options.color || '#FF00FF',
                glow: true,
                trail: true
            }
        };
        
        const config = enhancedConfigs[type] || enhancedConfigs.hit;
        
        // Create the burst with enhanced properties
        for (let i = 0; i < config.count; i++) {
            const angle = (Math.PI * 2 / config.count) * i + Math.random() * 0.3;
            const speed = config.speed * (0.6 + Math.random() * 0.4);
            
            this.create(
                x + (Math.random() - 0.5) * 20,
                y + (Math.random() - 0.5) * 20,
                {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: config.life * (0.8 + Math.random() * 0.4),
                    size: config.size * (0.8 + Math.random() * 0.4),
                    color: config.color,
                    glow: config.glow,
                    trail: config.trail,
                    fadeOut: true
                }
            );
        }
    }
    
    createComboRing(x, y, combo) {
        const ringSize = 30 + combo * 2;
        const particleCount = Math.min(32, 8 + combo);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const startX = x + Math.cos(angle) * ringSize;
            const startY = y + Math.sin(angle) * ringSize;
            
            this.create(startX, startY, {
                vx: Math.cos(angle) * 50,
                vy: Math.sin(angle) * 50,
                life: 1.0,
                size: 4,
                color: '#FFD700',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createComboExplosion(x, y, combo) {
        const explosionSize = Math.min(100, 30 + combo * 2);
        const particleCount = Math.min(50, 15 + combo);
        
        // Inner explosion
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.5,
                size: 6,
                color: '#FFD700',
                glow: true,
                fadeOut: true,
                trail: true
            });
        }
        
        // Outer ring
        this.createShockwave(x, y, explosionSize, '#FFAA00');
    }
    
    createStreakExplosion(x, y, streak) {
        const explosionIntensity = Math.min(5.0, 1.0 + streak * 0.1);
        const particleCount = Math.min(100, 20 + streak * 2);
        
        // Multiple colored rings
        const colors = ['#FF00FF', '#FF0088', '#8800FF', '#4400FF'];
        
        colors.forEach((color, index) => {
            const radius = 40 + index * 30;
            const delay = index * 100;
            
            setTimeout(() => {
                for (let i = 0; i < particleCount / colors.length; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 150 + Math.random() * 150;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 2.0,
                        size: 8,
                        color: color,
                        glow: true,
                        fadeOut: true,
                        trail: true
                    });
                }
                
                this.createShockwave(x, y, radius, color);
            }, delay);
        });
    }
    
    createGodModeEffect(x, y) {
        // Massive explosion with rainbow colors
        const colors = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0088FF', '#8800FF', '#FF00FF'];
        
        colors.forEach((color, index) => {
            const delay = index * 50;
            
            setTimeout(() => {
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 200 + Math.random() * 200;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 2.5,
                        size: 10,
                        color: color,
                        glow: true,
                        fadeOut: true,
                        trail: true
                    });
                }
            }, delay);
        });
        
        // Screen-filling shockwave
        this.createShockwave(x, y, 300, '#FFFFFF');
    }
    
    createEvolutionNova(x, y) {
        // Weapon evolution effect
        const waveCount = 5;
        
        for (let wave = 0; wave < waveCount; wave++) {
            const delay = wave * 200;
            const radius = 50 + wave * 30;
            const particleCount = 20 + wave * 10;
            
            setTimeout(() => {
                for (let i = 0; i < particleCount; i++) {
                    const angle = (i / particleCount) * Math.PI * 2;
                    const waveX = x + Math.cos(angle) * radius;
                    const waveY = y + Math.sin(angle) * radius;
                    
                    this.create(waveX, waveY, {
                        vx: Math.cos(angle) * -100,
                        vy: Math.sin(angle) * -100,
                        life: 1.5,
                        size: 8,
                        color: '#00FFFF',
                        glow: true,
                        fadeOut: true
                    });
                }
            }, delay);
        }
    }
    
    // Enhanced weapon-specific firing effects
    createEnhancedMuzzleFlash(x, y, weaponType, level = 1, options = {}) {
        const intensity = Math.min(3.0, 1.0 + level * 0.2);
        
        switch (weaponType) {
            case 'magicMissile':
                this.createMagicMuzzleFlash(x, y, intensity, options);
                break;
            case 'whip':
                this.createWhipFlash(x, y, intensity, options);
                break;
            case 'throwingKnife':
                this.createKnifeFlash(x, y, intensity, options);
                break;
            case 'firearm':
                this.createFirearmFlash(x, y, intensity, options);
                break;
            default:
                this.createGenericMuzzleFlash(x, y, intensity, options);
                break;
        }
    }
    
    createMagicMuzzleFlash(x, y, intensity, options = {}) {
        const particleCount = Math.floor(6 * intensity);
        const color = options.color || '#9B59B6';
        
        // Magical energy rings
        for (let ring = 0; ring < Math.ceil(intensity); ring++) {
            const delay = ring * 50;
            setTimeout(() => {
                for (let i = 0; i < particleCount; i++) {
                    const angle = (i / particleCount) * Math.PI * 2;
                    const radius = 15 + ring * 20;
                    const startX = x + Math.cos(angle) * radius;
                    const startY = y + Math.sin(angle) * radius;
                    
                    this.create(startX, startY, {
                        vx: Math.cos(angle) * -80,
                        vy: Math.sin(angle) * -80,
                        life: 0.5,
                        size: 4 * intensity,
                        color: color,
                        glow: true,
                        fadeOut: true,
                        sparkle: true
                    });
                }
            }, delay);
        }
        
        // Central energy burst
        this.createBurst(x, y, 'magic', {
            count: Math.floor(8 * intensity),
            color: color,
            intensity: intensity
        });
    }
    
    createWhipFlash(x, y, intensity, options = {}) {
        const color = options.color || '#8B4513';
        const angle = options.angle || 0;
        
        // Dust cloud from whip crack
        for (let i = 0; i < Math.floor(12 * intensity); i++) {
            const spread = Math.PI * 0.4; // 72 degrees spread
            const particleAngle = angle + (Math.random() - 0.5) * spread;
            const speed = 80 + Math.random() * 60;
            
            this.create(x, y, {
                vx: Math.cos(particleAngle) * speed,
                vy: Math.sin(particleAngle) * speed,
                life: 0.8,
                size: 5 * intensity,
                color: '#D2B48C', // Tan dust
                fadeOut: true,
                ay: 30
            });
        }
        
        // Whip trail sparkles
        for (let i = 0; i < Math.floor(6 * intensity); i++) {
            this.create(x, y, {
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                life: 0.6,
                size: 3,
                color: '#FFAA00',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createKnifeFlash(x, y, intensity, options = {}) {
        const color = options.color || '#C0C0C0';
        
        // Metallic glint effect
        for (let i = 0; i < Math.floor(4 * intensity); i++) {
            const angle = Math.random() * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 120,
                vy: Math.sin(angle) * 120,
                life: 0.3,
                size: 2,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
        
        // Steel spark trail
        this.createBurst(x, y, 'ricochet', {
            count: Math.floor(6 * intensity),
            color: color,
            intensity: intensity
        });
    }
    
    createFirearmFlash(x, y, intensity, options = {}) {
        const color = options.color || '#FFAA00';
        const angle = options.angle || 0;
        
        // Muzzle blast cone
        const coneParticles = Math.floor(10 * intensity);
        for (let i = 0; i < coneParticles; i++) {
            const spread = Math.PI * 0.3; // 54 degrees spread
            const particleAngle = angle + (Math.random() - 0.5) * spread;
            const speed = 150 + Math.random() * 100;
            
            this.create(x, y, {
                vx: Math.cos(particleAngle) * speed,
                vy: Math.sin(particleAngle) * speed,
                life: 0.4,
                size: 3 * intensity,
                color: color,
                glow: true,
                fadeOut: true,
                shrink: true
            });
        }
        
        // Shell ejection
        if (Math.random() < 0.7) {
            const shellAngle = angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.5;
            this.create(x, y, {
                vx: Math.cos(shellAngle) * 60,
                vy: Math.sin(shellAngle) * 60 - 20,
                life: 1.5,
                size: 2,
                color: '#B8860B', // Dark golden rod
                fadeOut: true,
                ay: 200,
                bounce: true,
                spin: true,
                spinSpeed: 10
            });
        }
        
        // Smoke puff
        for (let i = 0; i < Math.floor(3 * intensity); i++) {
            this.create(x, y, {
                vx: Math.cos(angle) * 30 + (Math.random() - 0.5) * 40,
                vy: Math.sin(angle) * 30 + (Math.random() - 0.5) * 40 - 20,
                life: 1.2,
                size: 8 * intensity,
                color: '#696969', // Dim gray
                fadeOut: true,
                ay: -15
            });
        }
    }
    
    createGenericMuzzleFlash(x, y, intensity, options = {}) {
        const color = options.color || '#FFD700';
        
        this.createBurst(x, y, 'muzzleFlash', {
            count: Math.floor(8 * intensity),
            color: color,
            intensity: intensity
        });
    }
    
    // Enhanced hit effects with multiple layers
    createEnhancedHitEffect(x, y, damage, weaponType, critical = false, options = {}) {
        const intensity = Math.min(3.0, 1.0 + damage * 0.02);
        
        // Main impact burst
        this.createImpactBurst(x, y, damage, critical, options);
        
        // Weapon-specific hit effects
        this.createWeaponSpecificHit(x, y, weaponType, intensity, options);
        
        // Blood effects for vampire theme
        this.createEnhancedBloodEffect(x, y, damage, intensity, options);
        
        // Sparks and debris
        this.createImpactSparks(x, y, intensity, options);
        
        // Critical hit special effects
        if (critical) {
            this.createCriticalHitRing(x, y, intensity, options);
        }
    }
    
    createImpactBurst(x, y, damage, critical, options = {}) {
        const particleCount = Math.floor(8 + damage * 0.3);
        const color = critical ? '#FFD700' : options.color || '#FFFF00';
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.2;
            const speed = 120 + Math.random() * 80;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.4,
                size: critical ? 5 : 3 + Math.random() * 2,
                color: color,
                glow: true,
                fadeOut: true,
                shrink: true
            });
        }
    }
    
    createWeaponSpecificHit(x, y, weaponType, intensity, options = {}) {
        switch (weaponType) {
            case 'magicMissile':
                this.createMagicImpact(x, y, intensity, options);
                break;
            case 'whip':
                this.createWhipImpact(x, y, intensity, options);
                break;
            case 'throwingKnife':
                this.createBladedImpact(x, y, intensity, options);
                break;
            case 'explosion':
                this.createExplosiveImpact(x, y, intensity, options);
                break;
        }
    }
    
    createMagicImpact(x, y, intensity, options = {}) {
        const color = options.color || '#9B59B6';
        
        // Magical energy dissipation
        for (let i = 0; i < Math.floor(6 * intensity); i++) {
            const angle = Math.random() * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 60,
                vy: Math.sin(angle) * 60 - 30,
                life: 1.0,
                size: 4,
                color: color,
                glow: true,
                fadeOut: true,
                ay: -20
            });
        }
        
        // Arcane sparkles
        for (let i = 0; i < Math.floor(4 * intensity); i++) {
            this.create(x, y, {
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                life: 0.8,
                size: 2,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true,
                sparkle: true
            });
        }
    }
    
    createWhipImpact(x, y, intensity, options = {}) {
        // Dust and debris from whip strike
        for (let i = 0; i < Math.floor(8 * intensity); i++) {
            const angle = Math.random() * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 1.0,
                size: 4 + Math.random() * 3,
                color: '#D2B48C',
                fadeOut: true,
                ay: 60
            });
        }
    }
    
    createBladedImpact(x, y, intensity, options = {}) {
        // Metal on flesh sparks
        for (let i = 0; i < Math.floor(5 * intensity); i++) {
            const angle = Math.random() * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 140,
                vy: Math.sin(angle) * 140,
                life: 0.4,
                size: 2,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createExplosiveImpact(x, y, intensity, options = {}) {
        // Fiery explosion particles
        const colors = ['#FF4500', '#FF6600', '#FFAA00', '#FFD700'];
        
        for (let i = 0; i < Math.floor(15 * intensity); i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 150;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8 + Math.random() * 0.4,
                size: 4 + Math.random() * 3,
                color: color,
                glow: true,
                fadeOut: true,
                ay: 30
            });
        }
    }
    
    createEnhancedBloodEffect(x, y, damage, intensity, options = {}) {
        if (damage < 10) return; // Only for significant hits
        
        const bloodColor = options.bloodColor || '#4B0082';
        const particleCount = Math.floor(Math.min(12, damage * 0.2));
        
        // Blood droplets
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 60;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                life: 1.5,
                size: 3 + Math.random() * 2,
                color: bloodColor,
                fadeOut: true,
                ay: 100,
                bounce: false
            });
        }
        
        // Blood splatter on ground
        this.createBloodSplatter(x, y, Math.min(20, damage * 0.4), bloodColor);
    }
    
    createImpactSparks(x, y, intensity, options = {}) {
        const sparkCount = Math.floor(4 * intensity);
        
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 120;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.2,
                size: 1 + Math.random(),
                color: '#FFFF88',
                glow: true,
                fadeOut: true,
                gravity: 200
            });
        }
    }
    
    createCriticalHitRing(x, y, intensity, options = {}) {
        const ringParticles = Math.floor(12 * intensity);
        const ringColor = options.criticalColor || '#FFD700';
        
        // Expanding ring effect
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            const radius = 20;
            const startX = x + Math.cos(angle) * radius;
            const startY = y + Math.sin(angle) * radius;
            
            this.create(startX, startY, {
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                life: 0.8,
                size: 4,
                color: ringColor,
                glow: true,
                fadeOut: true
            });
        }
        
        // Inner burst
        this.createBurst(x, y, 'critical', {
            count: Math.floor(8 * intensity),
            color: ringColor,
            intensity: intensity
        });
    }
    
    createGodModeAura(player) {
        // Continuous god mode aura effect
        const auraInterval = setInterval(() => {
            if (!player.isAlive()) {
                clearInterval(auraInterval);
                return;
            }
            
            // Create swirling aura particles
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2 + performance.now() * 0.01;
                const distance = 25 + Math.sin(performance.now() * 0.005 + i) * 10;
                const auraX = player.x + Math.cos(angle) * distance;
                const auraY = player.y + Math.sin(angle) * distance;
                
                this.create(auraX, auraY, {
                    vx: Math.cos(angle) * 20,
                    vy: Math.sin(angle) * 20,
                    life: 0.5,
                    size: 6,
                    color: '#FF00FF',
                    glow: true,
                    fadeOut: true
                });
            }
        }, 100);
        
        // Stop aura after 10 seconds
        setTimeout(() => {
            clearInterval(auraInterval);
        }, 10000);
    }
    
    createGothicExplosion(x, y, intensity = 1.0) {
        // Vampire-themed explosion with dark aesthetic
        // Changed from red colors to purple/gold theme to prevent red overlay
        const colors = ['#4B0082', '#7B68EE', '#9370DB', '#FFD700'];
        const particleCount = Math.floor(25 * intensity);
        
        colors.forEach((color, index) => {
            for (let i = 0; i < particleCount / colors.length; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = (80 + Math.random() * 120) * intensity;
                
                this.create(x, y, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.2 + Math.random() * 0.8,
                    size: 4 + Math.random() * 4,
                    color: color,
                    glow: true,
                    fadeOut: true,
                    trail: intensity > 1.5
                });
            }
        });
        
        // Add splatter for gothic theme - using purple instead of red
        this.createBloodSplatter(x, y, 15 * intensity, '#4B0082');
    }
    
    createGoalCompletionEffect(x, y) {
        // Special goal completion celebration
        const colors = ['#00FF88', '#00FFAA', '#44FFAA', '#66FFCC'];
        
        // Multiple rings expanding outward
        colors.forEach((color, index) => {
            const delay = index * 150;
            
            setTimeout(() => {
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const speed = 80 + index * 20;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 1.5,
                        size: 5,
                        color: color,
                        glow: true,
                        fadeOut: true
                    });
                }
            }, delay);
        });
        
        // Central burst
        this.createBurst(x, y, 'celebration', {
            color: '#00FF88',
            count: 20,
            spread: 40
        });
    }
    
    // REWARD PSYCHOLOGY EFFECTS
    
    createNearMissEffect(x, y, type) {
        // Subtle "almost got it" effect
        const colors = {
            critical: '#FF8888',
            loot: '#FFAA88',
            evolution: '#88AAFF'
        };
        
        const color = colors[type] || '#FFAA88';
        
        // Small ring that contracts instead of expands
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startDistance = 40;
            
            this.create(
                x + Math.cos(angle) * startDistance,
                y + Math.sin(angle) * startDistance,
                {
                    vx: Math.cos(angle) * -30,
                    vy: Math.sin(angle) * -30,
                    life: 0.8,
                    size: 3,
                    color: color,
                    fadeOut: true,
                    alpha: 0.6
                }
            );
        }
    }
    
    createGuaranteedRewardEffect(x, y, type) {
        // Exciting "finally got it" effect
        const colors = {
            critical: '#FF0000',
            loot: '#FFD700',
            evolution: '#00AAFF'
        };
        
        const color = colors[type] || '#FFD700';
        
        // Large burst with special pattern
        for (let ring = 0; ring < 3; ring++) {
            const delay = ring * 100;
            
            setTimeout(() => {
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const speed = 120 + ring * 40;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 1.5,
                        size: 6,
                        color: color,
                        glow: true,
                        fadeOut: true,
                        trail: true
                    });
                }
            }, delay);
        }
    }
    
    createMegaBonusEffect(x, y) {
        // Massive celebration for mega bonus
        const colors = ['#FFD700', '#FFAA00', '#FF8800', '#FFFF00'];
        
        // Multiple waves
        colors.forEach((color, wave) => {
            const delay = wave * 200;
            
            setTimeout(() => {
                for (let i = 0; i < 24; i++) {
                    const angle = (i / 24) * Math.PI * 2;
                    const speed = 150 + wave * 50;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 2.0,
                        size: 8,
                        color: color,
                        glow: true,
                        fadeOut: true,
                        trail: true
                    });
                }
                
                // Add shockwave
                this.createShockwave(x, y, 100 + wave * 50, color);
            }, delay);
        });
    }
    
    createJackpotEffect(x, y, amount) {
        // Ultimate jackpot celebration
        const baseColors = ['#FF00FF', '#FFFF00', '#00FFFF', '#FF0080'];
        
        // Massive multi-stage effect
        for (let stage = 0; stage < 5; stage++) {
            const delay = stage * 300;
            
            setTimeout(() => {
                baseColors.forEach((color, colorIndex) => {
                    for (let i = 0; i < 20; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 100 + Math.random() * 200;
                        
                        this.create(x, y, {
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 3.0,
                            size: 10,
                            color: color,
                            glow: true,
                            fadeOut: true,
                            trail: true
                        });
                    }
                });
                
                // Multiple expanding rings
                for (let ring = 0; ring < 3; ring++) {
                    const ringDelay = ring * 100;
                    setTimeout(() => {
                        this.createShockwave(x, y, 150 + ring * 100, baseColors[ring % baseColors.length]);
                    }, ringDelay);
                }
            }, delay);
        }
        
        // Screen-filling effect
        setTimeout(() => {
            this.createShockwave(x, y, 500, '#FFFFFF');
        }, 1000);
    }
    
    createVulnerabilityEffect(x, y) {
        // Effect for enemy weakness
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const distance = 15;
            
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: 0,
                    vy: -20,
                    life: 2.0,
                    size: 4,
                    color: '#FF4444',
                    glow: true,
                    fadeOut: true
                }
            );
        }
    }
    
    createInvincibilityAura(player) {
        // Continuous invincibility effect
        const auraInterval = setInterval(() => {
            if (!player.invulnerable) {
                clearInterval(auraInterval);
                return;
            }
            
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + performance.now() * 0.005;
                const distance = 20 + Math.sin(performance.now() * 0.01 + i) * 5;
                const auraX = player.x + Math.cos(angle) * distance;
                const auraY = player.y + Math.sin(angle) * distance;
                
                this.create(auraX, auraY, {
                    vx: 0,
                    vy: 0,
                    life: 0.5,
                    size: 5,
                    color: '#00AAFF',
                    glow: true,
                    fadeOut: true
                });
            }
        }, 100);
    }
    
    createPowerSurgeEffect(x, y) {
        // Weapon power surge effect
        const surgeColors = ['#FFFF00', '#FFAA00', '#FF6600'];
        
        surgeColors.forEach((color, index) => {
            const delay = index * 150;
            
            setTimeout(() => {
                for (let i = 0; i < 16; i++) {
                    const angle = (i / 16) * Math.PI * 2;
                    const speed = 80 + index * 30;
                    
                    this.create(x, y, {
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 1.5,
                        size: 6,
                        color: color,
                        glow: true,
                        fadeOut: true
                    });
                }
            }, delay);
        });
        
        // Central energy burst
        this.createBurst(x, y, 'powerSurge', {
            color: '#FFFF00',
            count: 25,
            spread: 60
        });
    }
    
    createDamageNumber(x, y, damage, critical = false, color = null) {
        // Validate damage and skip if zero or invalid
        const validDamage = isFinite(damage) ? Math.floor(damage) : 0;
        if (validDamage <= 0) return; // Don't show zero or negative damage
        
        if (this.damageNumbers.length >= this.maxDamageNumbers) return;
        
        let damageNumber;
        if (this.damageNumberPool.length > 0) {
            damageNumber = this.damageNumberPool.pop();
        } else {
            damageNumber = this.createDamageNumberObject();
        }
        
        // Determine color based on damage type
        if (!color) {
            if (critical) {
                color = '#FFD700'; // Gold for critical
            } else if (damage > 50) {
                color = '#FF8800'; // Orange for high damage
            } else {
                color = '#FFFF00'; // Yellow for normal damage
            }
        }
        
        damageNumber.x = x + (Math.random() - 0.5) * 20;
        damageNumber.y = y;
        damageNumber.vx = (Math.random() - 0.5) * 30;
        damageNumber.vy = -80 - Math.random() * 20;
        damageNumber.life = critical ? 2.0 : 1.5;
        damageNumber.maxLife = damageNumber.life;
        damageNumber.text = validDamage.toString();
        damageNumber.color = color;
        damageNumber.alpha = 1;
        damageNumber.size = critical ? 24 : 18;
        damageNumber.scale = critical ? 1.5 : 1;
        damageNumber.critical = critical;
        damageNumber.active = true;
        
        this.damageNumbers.push(damageNumber);
    }
    
    createBloodSplatter(x, y, size = 10, color = '#4B0082') { // Changed from dark red to indigo
        if (this.bloodSplatters.length >= this.maxBloodSplatters) return;
        
        let splatter;
        if (this.bloodSplatterPool.length > 0) {
            splatter = this.bloodSplatterPool.pop();
        } else {
            splatter = this.createBloodSplatterObject();
        }
        
        splatter.x = x + (Math.random() - 0.5) * 30;
        splatter.y = y + (Math.random() - 0.5) * 30;
        splatter.size = size * (0.8 + Math.random() * 0.4);
        splatter.angle = Math.random() * Math.PI * 2;
        splatter.life = 10; // Blood lasts longer
        splatter.maxLife = splatter.life;
        splatter.alpha = 0.8;
        splatter.color = color;
        splatter.active = true;
        splatter.fadeSpeed = 0.1;
        
        this.bloodSplatters.push(splatter);
        
        // Create blood particles too
        this.createBurst(x, y, 'bloodSplash', { color: color, count: 8 });
    }
    
    renderBloodSplatters(renderer) {
        const ctx = renderer.ctx;
        
        this.bloodSplatters = this.bloodSplatters.filter(splatter => {
            ctx.save();
            ctx.globalAlpha = splatter.alpha;
            ctx.translate(splatter.x, splatter.y);
            ctx.rotate(splatter.angle);
            
            // Draw irregular blood splatter shape
            ctx.fillStyle = splatter.color;
            ctx.beginPath();
            
            const points = 8;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const radius = splatter.size * (0.5 + Math.random() * 0.5);
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            
            // Add some splatter drops
            ctx.fillStyle = splatter.color;
            for (let i = 0; i < 3; i++) {
                const dropX = (Math.random() - 0.5) * splatter.size * 2;
                const dropY = (Math.random() - 0.5) * splatter.size * 2;
                const dropSize = splatter.size * 0.2 * Math.random();
                
                ctx.beginPath();
                ctx.arc(dropX, dropY, dropSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
            
            // Update splatter
            splatter.life -= splatter.fadeSpeed * (this.deltaTime || 0.016);
            splatter.alpha = Math.max(0, splatter.life / splatter.maxLife);
            
            return splatter.life > 0;
        });
    }
    
    renderDamageNumbers(renderer) {
        const ctx = renderer.ctx;
        const dt = this.deltaTime || 0.016;
        
        this.damageNumbers = this.damageNumbers.filter(number => {
            // Update physics
            number.x += number.vx * dt;
            number.y += number.vy * dt;
            number.vy += 50 * dt; // Slight gravity
            number.life -= dt;
            
            // Update visual properties
            number.alpha = Math.max(0, number.life / number.maxLife);
            if (number.critical) {
                number.scale = 1.5 + 0.3 * Math.sin((number.maxLife - number.life) * 8);
            }
            
            // Enhanced pulsing for high damage numbers
            if (number.glow) {
                const pulseTime = (number.maxLife - number.life) * number.pulseSpeed;
                const pulseScale = 1.0 + 0.1 * Math.sin(pulseTime);
                number.scale *= pulseScale;
            }
            
            // Render
            ctx.save();
            ctx.globalAlpha = number.alpha;
            ctx.translate(number.x, number.y);
            ctx.scale(number.scale, number.scale);
            
            // Enhanced outline for better visibility
            ctx.font = `bold ${number.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Enhanced glow effect for high damage numbers
            if (number.glow && number.glowIntensity > 0) {
                ctx.shadowBlur = number.glowIntensity;
                ctx.shadowColor = number.color;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Multiple glow layers for intense effect
                for (let i = 0; i < 3; i++) {
                    ctx.fillStyle = number.color;
                    ctx.fillText(number.text, 0, 0);
                }
            }
            
            // Draw thick black outline for maximum contrast
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(3, number.size / 6); // Scale outline with text size
            ctx.strokeText(number.text, 0, 0);
            
            // Draw white inner outline for pop
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = Math.max(1.5, number.size / 12);
            ctx.strokeText(number.text, 0, 0);
            
            // Draw main text with shadow
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#000000';
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = number.color;
            ctx.fillText(number.text, 0, 0);
            
            // Add extra glow for critical hits
            if (number.critical) {
                ctx.shadowBlur = Math.max(8, number.size / 3);
                ctx.shadowColor = number.color;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillText(number.text, 0, 0);
            }
            
            ctx.restore();
            
            return number.life > 0;
        });
    }
    
    renderScreenEffects(renderer) {
        const ctx = renderer.ctx;
        
        // Render screen flash
        if (this.screenFlashColor && this.screenFlashAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = this.screenFlashAlpha;
            ctx.fillStyle = this.screenFlashColor;
            ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
            ctx.restore();
        }
    }
    
    // ===============================
    // ADDICTION MECHANICS - Enhanced Visual Effects
    // ===============================
    
    createComboExplosion(x, y, comboCount, intensity = 1.0) {
        // Escalating celebration effects based on combo milestone
        const baseCount = Math.min(50, 15 + comboCount);
        const colors = [
            '#FFD700', '#FF6600', '#FF0066', '#9B59B6', '#00FFFF'
        ];
        
        // Main explosion
        for (let i = 0; i < baseCount * intensity; i++) {
            const angle = (Math.PI * 2 / baseCount) * i;
            const speed = 150 + Math.random() * 200 * intensity;
            const colorIndex = Math.floor(Math.random() * colors.length);
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.5 + intensity * 0.5,
                size: 4 + intensity * 2,
                color: colors[colorIndex],
                glow: true,
                fadeOut: true,
                pulse: true,
                trail: intensity > 2.0
            });
        }
        
        // Secondary ring for high combos
        if (comboCount >= 25) {
            setTimeout(() => {
                this.createBurst(x, y, 'evolution', {
                    count: Math.floor(comboCount / 5),
                    color: '#FFD700',
                    spread: 100 * intensity
                });
            }, 200);
        }
    }
    
    createComboSparks(x, y, comboCount) {
        // Small frequent feedback for combo maintenance
        const sparkCount = Math.min(8, Math.floor(comboCount / 5) + 3);
        const color = comboCount < 25 ? '#FFAA00' : comboCount < 50 ? '#FF6600' : '#FF0066';
        
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 40;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                life: 0.8,
                size: 2 + Math.random() * 2,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createComboBreakEffect(x, y) {
        // Mild disappointment effect for combo loss
        const smokeCount = 12;
        
        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 20;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 30,
                life: 1.2,
                size: 6 + Math.random() * 4,
                color: '#666666',
                fadeOut: true,
                ay: -20
            });
        }
    }
    
    createPowerUpEffect(x, y, color, intensity = 1.0) {
        // Power-up activation celebration
        const ringCount = Math.floor(15 * intensity);
        
        // Expanding ring effect
        for (let i = 0; i < ringCount; i++) {
            const angle = (Math.PI * 2 / ringCount) * i;
            const speed = 100 + Math.random() * 50;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0 + intensity * 0.3,
                size: 3 + intensity,
                color: color,
                glow: true,
                fadeOut: true,
                pulse: true
            });
        }
        
        // Central burst
        this.createBurst(x, y, 'evolution', {
            count: Math.floor(10 * intensity),
            color: color,
            spread: 60
        });
    }
    
    createHeartbeatEffect(x, y) {
        // Dramatic near-death heartbeat visualization
        const pulseParticles = 6;
        
        for (let i = 0; i < pulseParticles; i++) {
            const angle = (Math.PI * 2 / pulseParticles) * i;
            const distance = 25 + Math.random() * 15;
            
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: 0,
                    vy: -40,
                    life: 1.5,
                    size: 4,
                    color: '#FF0000',
                    glow: true,
                    fadeOut: true,
                    pulse: true,
                    pulseSpeed: 4.0
                }
            );
        }
    }
    
    createLastStandEffect(x, y) {
        // Dramatic 'final stand' activation
        const auraCount = 20;
        
        for (let i = 0; i < auraCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 40;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 2.0,
                size: 5 + Math.random() * 3,
                color: '#FF0000',
                glow: true,
                fadeOut: true,
                trail: true
            });
        }
        
        // Add blood-red mist
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 30;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 20,
                life: 3.0,
                size: 8 + Math.random() * 6,
                color: '#800000',
                fadeOut: true,
                ay: -10
            });
        }
    }
    
    createRecoveryEffect(x, y) {
        // Triumphant recovery from near-death
        const healingCount = 25;
        
        for (let i = 0; i < healingCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 60;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                life: 1.8,
                size: 4 + Math.random() * 3,
                color: '#00FF88',
                glow: true,
                fadeOut: true,
                ay: -50
            });
        }
        
        // Healing sparkles rising up
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                this.create(
                    x + (Math.random() - 0.5) * 60,
                    y + (Math.random() - 0.5) * 20,
                    {
                        vx: (Math.random() - 0.5) * 40,
                        vy: -80 - Math.random() * 40,
                        life: 2.0,
                        size: 3,
                        color: '#FFFFFF',
                        glow: true,
                        fadeOut: true
                    }
                );
            }, i * 100);
        }
    }
    
    createMiraculousSaveEffect(x, y) {
        // Massive celebration for last-second saves (creates powerful psychological relief)
        const divineCount = 40;
        
        // Divine light rays
        for (let i = 0; i < divineCount; i++) {
            const angle = (Math.PI * 2 / divineCount) * i;
            const speed = 200 + Math.random() * 150;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 2.5,
                size: 6 + Math.random() * 4,
                color: '#00FFFF',
                glow: true,
                fadeOut: true,
                trail: true,
                pulse: true
            });
        }
        
        // Secondary golden burst
        setTimeout(() => {
            this.createBurst(x, y, 'evolution', {
                count: 30,
                color: '#FFD700',
                spread: 120
            });
        }, 150);
        
        // Ascending sparkles for divine feeling
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const spreadX = (Math.random() - 0.5) * 80;
                const spreadY = (Math.random() - 0.5) * 40;
                
                this.create(x + spreadX, y + spreadY, {
                    vx: 0,
                    vy: -120 - Math.random() * 60,
                    life: 3.0,
                    size: 5,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true,
                    pulse: true
                });
            }, i * 80);
        }
    }
    
    createStreakCelebration(x, y, streakMinutes) {
        // Celebration for perfect damage-free streaks
        const intensity = Math.min(3.0, 1.0 + streakMinutes * 0.5);
        const celebrationCount = Math.floor(20 * intensity);
        
        for (let i = 0; i < celebrationCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 100 * intensity;
            
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                life: 1.5 + intensity * 0.5,
                size: 4 + intensity,
                color: '#FFD700',
                glow: true,
                fadeOut: true,
                trail: true
            });
        }
    }
    
    createEnhancedDeathEffect(x, y, color, comboLevel = 1.0) {
        // Death effects that scale with combo level for satisfying feedback
        const baseCount = 15;
        const enhancedCount = Math.floor(baseCount * (1.0 + comboLevel * 0.5));
        
        // Main death burst
        this.createBurst(x, y, 'hit', {
            count: enhancedCount,
            color: color,
            spread: 60 + comboLevel * 20,
            intensity: comboLevel
        });
        
        // Additional effects for high combos
        if (comboLevel > 1.5) {
            setTimeout(() => {
                this.createBurst(x, y, 'gemExplosion', {
                    count: Math.floor(comboLevel * 5),
                    color: '#FFD700',
                    spread: 40
                });
            }, 100);
        }
    }
    
    createPowerUpSpawnEffect(x, y, type) {
        // Announce power-up availability
        const colors = {
            health: '#FF4444',
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        
        const color = colors[type] || '#FFFFFF';
        
        this.createBurst(x, y, 'evolution', {
            count: 20,
            color: color,
            spread: 80
        });
    }
    
    // Enhanced precision and manual aiming effects
    createPrecisionRing(x, y, color, accuracyBonus) {
        const ringParticles = Math.floor(8 + accuracyBonus * 4);
        const radius = 15 + accuracyBonus * 5;
        
        for (let i = 0; i < ringParticles; i++) {
            const angle = (i / ringParticles) * Math.PI * 2;
            const startX = x + Math.cos(angle) * radius;
            const startY = y + Math.sin(angle) * radius;
            
            this.create(startX, startY, {
                vx: Math.cos(angle) * -40,
                vy: Math.sin(angle) * -40,
                life: 0.8,
                size: 3,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createSkillShotEffect(x, y, accuracyBonus) {
        const color = '#00FFFF';
        const intensity = Math.min(3.0, accuracyBonus);
        
        // Precision burst
        this.createBurst(x, y, 'critical', {
            count: Math.floor(6 * intensity),
            color: color,
            intensity: intensity
        });
        
        // Accuracy indicator ring
        this.createPrecisionRing(x, y, color, accuracyBonus);
        
        // Skill sparkles
        for (let i = 0; i < Math.floor(8 * intensity); i++) {
            this.create(x, y, {
                vx: (Math.random() - 0.5) * 120,
                vy: (Math.random() - 0.5) * 120 - 30,
                life: 1.0,
                size: 2,
                color: '#FFFFFF',
                glow: true,
                fadeOut: true,
                sparkle: true
            });
        }
    }
    }
    
    // Manual aiming particle effects
    createPerfectAimEffect(x, y) {
        const color = '#00FFFF'; // Cyan for perfect aim
        
        // Perfect aim burst
        this.createBurst(x, y, 'critical', {
            count: 20,
            color: color,
            spread: 360,
            speed: 80
        });
        
        // Concentric rings for perfect aim
        for (let ring = 1; ring <= 3; ring++) {
            const radius = ring * 20;
            const particles = 12;
            
            for (let i = 0; i < particles; i++) {
                const angle = (i / particles) * Math.PI * 2;
                const startX = x + Math.cos(angle) * radius;
                const startY = y + Math.sin(angle) * radius;
                
                this.create(startX, startY, {
                    vx: Math.cos(angle) * 30,
                    vy: Math.sin(angle) * 30,
                    life: 1.2,
                    size: 4,
                    color: color,
                    glow: true,
                    fadeOut: true
                });
            }
        }
        
        // Perfect aim sparkles
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 40;
            
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: Math.cos(angle) * 50,
                    vy: Math.sin(angle) * 50,
                    life: 1.5,
                    size: 3,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true,
                    sparkle: true
                }
            );
        }
    }
    
    createPrecisionStrikeEffect(x, y, accuracyBonus) {
        const color = '#9932CC'; // Purple for precision strike
        const intensity = Math.min(2.0, accuracyBonus);
        
        // Precision strike burst
        this.createBurst(x, y, 'magic', {
            count: Math.floor(12 * intensity),
            color: color,
            spread: 360,
            speed: 100 * intensity
        });
        
        // Focused beam effect
        for (let i = 0; i < Math.floor(8 * intensity); i++) {
            const angle = (Math.random() - 0.2) * 0.4; // Narrow beam
            
            this.create(x, y, {
                vx: Math.cos(angle) * 150 * intensity,
                vy: Math.sin(angle) * 150 * intensity,
                life: 0.8,
                size: 3,
                color: color,
                glow: true,
                fadeOut: true,
                trail: true
            });
        }
        
        // Accuracy indicator
        this.createPrecisionRing(x, y, color, intensity);
    }
    
    // Challenge system effects
    
    // Challenge system effects
    createChallengeStartEffect(x, y, color) {
        // Announcement burst
        this.createBurst(x, y, 'evolution', {
            count: 15,
            color: color,
            spread: 60
        });
        
        // Rising indicator particles
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.create(
                    x + (Math.random() - 0.5) * 40,
                    y + (Math.random() - 0.5) * 20,
                    {
                        vx: 0,
                        vy: -60,
                        life: 2.0,
                        size: 4,
                        color: color,
                        glow: true,
                        fadeOut: true
                    }
                );
            }, i * 100);
        }
    }
    
    createChallengeCompleteEffect(x, y, color) {
        // Success celebration
        this.createBurst(x, y, 'celebration', {
            count: 25,
            color: color,
            spread: 80
        });
        
        // Rising sparkles
        for (let i = 0; i < 12; i++) {
            this.create(
                x + (Math.random() - 0.5) * 60,
                y + (Math.random() - 0.5) * 30,
                {
                    vx: (Math.random() - 0.5) * 40,
                    vy: -80 - Math.random() * 40,
                    life: 2.5,
                    size: 3,
                    color: '#FFFFFF',
                    glow: true,
                    fadeOut: true,
                    sparkle: true
                }
            );
        }
    }
    
    createPowerUpCollectEffect(x, y, type) {
        // Satisfying collection feedback
        const colors = {
            health: '#FF4444',
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        
        const color = colors[type] || '#FFFFFF';
        
        // Implosion effect followed by explosion
        const implodeCount = 15;
        for (let i = 0; i < implodeCount; i++) {
            const angle = (Math.PI * 2 / implodeCount) * i;
            const startDistance = 60;
            
            this.create(
                x + Math.cos(angle) * startDistance,
                y + Math.sin(angle) * startDistance,
                {
                    vx: -Math.cos(angle) * 200,
                    vy: -Math.sin(angle) * 200,
                    life: 0.3,
                    size: 3,
                    color: color,
                    glow: true,
                    fadeOut: true
                }
            );
        }
        
        // Follow with explosion
        setTimeout(() => {
            this.createPowerUpEffect(x, y, color, 1.5);
        }, 200);
    }
    
    // TERRAIN-SPECIFIC PARTICLE EFFECTS
    
    createRuneActivationEffect(x, y) {
        // Mystical rune activation with purple/blue energy
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 80;
            this.create(
                x + Math.cos(angle) * distance,
                y + Math.sin(angle) * distance,
                {
                    vx: Math.cos(angle) * 30,
                    vy: Math.sin(angle) * 30,
                    life: 2.0,
                    size: 4 + Math.random() * 3,
                    color: '#8A2BE2',
                    glow: true,
                    fadeOut: true
                }
            );
        }
        
        // Central energy burst
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                life: 1.5,
                size: 6,
                color: '#9370DB',
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createPowerUpSpawnEffect(x, y, type) {
        // Power-up spawn effect with type-specific colors
        const colors = {
            health: '#FF4444',
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        
        const color = colors[type] || '#FFFFFF';
        
        // Spawn burst
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            this.create(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                size: 3 + Math.random() * 2,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }
    
    createPowerUpCollectEffect(x, y, type) {
        // Power-up collection effect
        const colors = {
            health: '#FF4444',
            invincible: '#FFD700',
            speedBoost: '#00FFFF',
            damageBoost: '#FF6600',
            magnetBoost: '#44FF44',
            fireRate: '#FF44FF'
        };
        
        const color = colors[type] || '#FFFFFF';
        
        // Collection burst
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.create(x, y, {
                vx: Math.cos(angle) * 80,
                vy: Math.sin(angle) * 80,
                life: 0.8,
                size: 4,
                color: color,
                glow: true,
                fadeOut: true
            });
        }
    }
}