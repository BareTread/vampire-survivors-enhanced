export class Camera {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1;
        this.smoothing = 0.1;
        this.bounds = null;
        this.shakeEffect = {
            intensity: 0,
            duration: 0,
            offsetX: 0,
            offsetY: 0,
            frequency: 30, // Enhanced shake frequency
            decay: 0.95
        };
        
        this.flashEffect = {
            color: '#FFFFFF',
            intensity: 0,
            duration: 0,
            maxDuration: 0
        };
        
        // Enhanced visual effects
        this.effects = {
            chromaticAberration: 0,
            blur: 0,
            distortion: 0,
            vignette: 0,
            zoom: 0,
            rotation: 0,
            desaturation: 0
        };
        
        // Enhanced shake system
        this.shakeProfiles = {
            subtle: { intensity: 2, frequency: 20, decay: 0.92 },
            normal: { intensity: 5, frequency: 25, decay: 0.94 },
            heavy: { intensity: 10, frequency: 30, decay: 0.95 },
            massive: { intensity: 20, frequency: 35, decay: 0.96 },
            critical: { intensity: 15, frequency: 40, decay: 0.93 },
            explosion: { intensity: 25, frequency: 20, decay: 0.90 }
        };
        
        // Screen distortion effects
        this.distortionEffect = {
            active: false,
            intensity: 0,
            duration: 0,
            type: 'wave' // wave, spiral, zoom
        };
        
        // Performance management
        this.effectsEnabled = true;
        this.performanceMode = 'high'; // high, medium, low
    }
    
    follow(x, y, dt) {
        this.targetX = x;
        this.targetY = y;
        
        // Smooth camera movement
        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;
        this.zoom += (this.targetZoom - this.zoom) * this.smoothing;
        
        // Apply bounds if set
        if (this.bounds) {
            this.x = Math.max(this.bounds.minX + this.width / 2, 
                     Math.min(this.bounds.maxX - this.width / 2, this.x));
            this.y = Math.max(this.bounds.minY + this.height / 2, 
                     Math.min(this.bounds.maxY - this.height / 2, this.y));
        }
        
        // Update enhanced shake with frequency and decay
        if (this.shakeEffect.duration > 0) {
            this.shakeEffect.duration -= dt;
            const time = performance.now() * 0.001;
            
            // High-frequency shake with smooth decay
            this.shakeEffect.offsetX = Math.sin(time * this.shakeEffect.frequency) * this.shakeEffect.intensity;
            this.shakeEffect.offsetY = Math.cos(time * this.shakeEffect.frequency * 1.3) * this.shakeEffect.intensity;
            
            // Apply decay
            this.shakeEffect.intensity *= this.shakeEffect.decay;
            
            if (this.shakeEffect.duration <= 0 || this.shakeEffect.intensity < 0.1) {
                this.shakeEffect.intensity = 0;
                this.shakeEffect.offsetX = 0;
                this.shakeEffect.offsetY = 0;
                this.shakeEffect.duration = 0;
            }
        }
        
        // Update flash with improved cleanup
        if (this.flashEffect.duration > 0) {
            this.flashEffect.duration = Math.max(0, this.flashEffect.duration - dt);
            
            // Calculate intensity with safety checks
            if (this.flashEffect.maxDuration > 0) {
                this.flashEffect.intensity = Math.max(0, this.flashEffect.duration / this.flashEffect.maxDuration);
            } else {
                this.flashEffect.intensity = 0;
            }
            
            // Clean up when flash is complete
            if (this.flashEffect.duration <= 0) {
                this.flashEffect.intensity = 0;
                this.flashEffect.duration = 0;
                this.flashEffect.color = '#FFFFFF'; // Reset to default
            }
        } else {
            // Ensure flash is completely disabled when not active
            this.flashEffect.intensity = 0;
        }
    }
    
    apply(ctx) {
        ctx.translate(this.width / 2, this.height / 2);
        
        // Apply zoom with subtle breathing effect during low health
        let effectiveZoom = this.zoom;
        if (this.effects.chromaticAberration > 0) {
            const breathe = 1 + Math.sin(performance.now() * 0.005) * 0.01;
            effectiveZoom *= breathe;
        }
        
        ctx.scale(effectiveZoom, effectiveZoom);
        
        // Apply rotation for distortion effects
        if (this.effects.rotation > 0) {
            ctx.rotate(this.effects.rotation * 0.01);
        }
        
        ctx.translate(
            -this.x + this.shakeEffect.offsetX, 
            -this.y + this.shakeEffect.offsetY
        );
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.width / 2) / this.zoom + this.x,
            y: (screenY - this.height / 2) / this.zoom + this.y
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom + this.width / 2,
            y: (worldY - this.y) * this.zoom + this.height / 2
        };
    }
    
    setZoom(zoom) {
        this.targetZoom = Math.max(0.5, Math.min(2, zoom));
    }
    
    setBounds(minX, minY, maxX, maxY) {
        this.bounds = { minX, minY, maxX, maxY };
    }
    
    shake(intensity, duration, profile = 'normal') {
        if (!this.effectsEnabled) return;
        
        // Use predefined shake profiles for consistent feel
        const shakeProfile = this.shakeProfiles[profile] || this.shakeProfiles.normal;
        
        // Reduce intensity based on performance mode
        let adjustedIntensity = Math.min(intensity, shakeProfile.intensity);
        switch (this.performanceMode) {
            case 'low':
                adjustedIntensity *= 0.5;
                break;
            case 'medium':
                adjustedIntensity *= 0.75;
                break;
        }
        
        // Update shake parameters with profile settings
        this.shakeEffect.intensity = Math.max(this.shakeEffect.intensity, adjustedIntensity);
        this.shakeEffect.duration = Math.max(this.shakeEffect.duration, duration);
        this.shakeEffect.frequency = shakeProfile.frequency;
        this.shakeEffect.decay = shakeProfile.decay;
    }
    
    // Enhanced shake methods for different game events
    shakeWeaponFire(weaponType, level = 1) {
        const profiles = {
            'magicMissile': { profile: 'subtle', intensity: 2 + level * 0.5, duration: 0.1 },
            'whip': { profile: 'normal', intensity: 4 + level * 0.8, duration: 0.15 },
            'throwingKnife': { profile: 'subtle', intensity: 1.5 + level * 0.3, duration: 0.08 },
            'firearm': { profile: 'heavy', intensity: 6 + level * 1.0, duration: 0.12 },
            'explosion': { profile: 'explosion', intensity: 15 + level * 2, duration: 0.3 }
        };
        
        const config = profiles[weaponType] || profiles['magicMissile'];
        this.shake(config.intensity, config.duration, config.profile);
    }
    
    shakeHit(damage, critical = false) {
        const baseIntensity = Math.min(15, damage * 0.1);
        const duration = critical ? 0.25 : 0.15;
        const profile = critical ? 'critical' : damage > 50 ? 'heavy' : 'normal';
        
        this.shake(baseIntensity, duration, profile);
    }
    
    shakeExplosion(radius) {
        const intensity = Math.min(30, radius * 0.3);
        const duration = 0.4;
        this.shake(intensity, duration, 'explosion');
    }
    
    shakeLevelUp() {
        this.shake(8, 0.6, 'normal');
    }
    
    shakeGameOver() {
        this.shake(25, 1.0, 'massive');
    }
    
    flash(color, duration) {
        if (!this.effectsEnabled) return;
        
        // Validate input parameters to prevent issues
        if (!color || typeof duration !== 'number' || duration <= 0) {
            console.warn('Invalid flash parameters:', { color, duration });
            return;
        }
        
        // Clear any existing flash completely first
        this.clearFlash();
        
        // Reduce duration and intensity based on performance mode
        let adjustedDuration = Math.max(0.1, duration); // Minimum flash duration
        switch (this.performanceMode) {
            case 'low':
                adjustedDuration *= 0.5;
                break;
            case 'medium':
                adjustedDuration *= 0.75;
                break;
        }
        
        // Reset any existing flash to prevent overlapping effects
        this.flashEffect.color = color;
        this.flashEffect.duration = adjustedDuration;
        this.flashEffect.maxDuration = adjustedDuration;
        this.flashEffect.intensity = 1;
        
        // Force immediate intensity calculation to ensure proper state
        if (this.flashEffect.maxDuration > 0) {
            this.flashEffect.intensity = this.flashEffect.duration / this.flashEffect.maxDuration;
        }
    }
    
    clearFlash() {
        // Completely reset flash effect to prevent any lingering overlays
        this.flashEffect.intensity = 0;
        this.flashEffect.duration = 0;
        this.flashEffect.maxDuration = 0;
        this.flashEffect.color = '#FFFFFF';
    }
    
    setPerformanceMode(mode) {
        this.performanceMode = mode;
        
        // Disable some effects for low performance
        if (mode === 'low') {
            this.effectsEnabled = true; // Keep basic effects
            this.effects.vignette *= 0.5; // Reduce vignette intensity
        } else {
            this.effectsEnabled = true;
        }
    }
    
    renderFlash(ctx) {
        // Early exit if no flash effect is active
        if (this.flashEffect.intensity <= 0 || !this.flashEffect.color) {
            return;
        }
        
        // Validate flash intensity to prevent artifacts
        const safeIntensity = Math.max(0, Math.min(1, this.flashEffect.intensity));
        if (safeIntensity <= 0.001) {
            // Flash is essentially invisible, skip rendering
            return;
        }
        
        // Store original canvas state
        ctx.save();
        
        try {
            // Reset any potentially problematic canvas state
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            
            const color = this.flashEffect.color;
            const opacity = safeIntensity;
            
            // Convert hex to RGB for proper alpha blending
            const rgb = this.hexToRgb(color);
            
            if (rgb) {
                // Use RGBA colors for precise alpha control
                
                // Subtle outer glow - reduced intensity to prevent artifacts
                ctx.globalAlpha = opacity * 0.08;
                ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.08})`;
                ctx.fillRect(0, 0, this.width, this.height);
                
                // Inner flash with radial gradient for smooth falloff
                ctx.globalAlpha = 1; // Let gradient handle alpha
                
                const centerX = this.width / 2;
                const centerY = this.height / 2;
                const maxRadius = Math.max(this.width, this.height) * 0.8;
                
                // Create gradient with validated parameters
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, maxRadius
                );
                
                // Smooth gradient with proper alpha falloff
                gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.15})`);
                gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.08})`);
                gradient.addColorStop(0.7, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.03})`);
                gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, this.width, this.height);
                
            } else {
                // Fallback for non-hex colors - use simpler approach
                ctx.globalAlpha = opacity * 0.1;
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, this.width, this.height);
            }
            
        } catch (error) {
            console.warn('Error rendering flash effect:', error);
        } finally {
            // Always restore canvas state
            ctx.restore();
            
            // Ensure clean state for next render
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    }
    
    // Helper method to convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // Enhanced effect methods
    addChromaticAberration(intensity = 5) {
        this.effects.chromaticAberration = intensity;
    }
    
    addMotionBlur(intensity = 3) {
        this.effects.blur = intensity;
    }
    
    addVignette(intensity = 0.5) {
        this.effects.vignette = intensity;
    }
    
    renderPostEffects(ctx) {
        if (this.effects.vignette > 0) {
            this.renderVignette(ctx);
        }
        
        if (this.effects.chromaticAberration > 0 && this.performanceMode === 'high') {
            this.renderChromaticAberration(ctx);
        }
        
        if (this.distortionEffect.active && this.performanceMode !== 'low') {
            this.renderDistortion(ctx);
        }
        
        if (this.effects.desaturation > 0) {
            this.renderDesaturation(ctx);
        }
    }
    
    renderVignette(ctx) {
        ctx.save();
        const gradient = ctx.createRadialGradient(
            this.width / 2, this.height / 2, 0,
            this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.effects.vignette})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }
    
    renderChromaticAberration(ctx) {
        // Simplified chromatic aberration effect using composite operations
        const aberration = this.effects.chromaticAberration;
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.1;
        
        // Red channel offset
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-aberration, 0, this.width, this.height);
        
        // Blue channel offset
        ctx.fillStyle = '#0000FF';
        ctx.fillRect(aberration, 0, this.width, this.height);
        
        ctx.restore();
    }
    
    renderDistortion(ctx) {
        if (!this.distortionEffect.active) return;
        
        const intensity = this.distortionEffect.intensity;
        const time = performance.now() * 0.001;
        
        ctx.save();
        
        switch (this.distortionEffect.type) {
            case 'wave':
                this.renderWaveDistortion(ctx, intensity, time);
                break;
            case 'spiral':
                this.renderSpiralDistortion(ctx, intensity, time);
                break;
            case 'zoom':
                this.renderZoomDistortion(ctx, intensity);
                break;
        }
        
        ctx.restore();
    }
    
    renderWaveDistortion(ctx, intensity, time) {
        // Create a subtle wave distortion effect
        const waveFreq = 0.02;
        const waveAmp = intensity * 3;
        
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.05;
        
        for (let i = 0; i < 5; i++) {
            const offset = Math.sin(time + i) * waveAmp;
            ctx.fillStyle = i % 2 === 0 ? '#FF00FF' : '#00FFFF';
            ctx.fillRect(offset, 0, this.width, this.height);
        }
    }
    
    renderSpiralDistortion(ctx, intensity, time) {
        // Spiral distortion for dramatic moments
        ctx.translate(this.width / 2, this.height / 2);
        ctx.rotate(intensity * 0.01 * Math.sin(time));
        ctx.scale(1 + intensity * 0.01, 1 + intensity * 0.01);
        ctx.translate(-this.width / 2, -this.height / 2);
    }
    
    renderZoomDistortion(ctx, intensity) {
        // Zoom punch effect
        const zoomFactor = 1 + intensity * 0.02;
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(zoomFactor, zoomFactor);
        ctx.translate(-this.width / 2, -this.height / 2);
    }
    
    renderDesaturation(ctx) {
        // Desaturate screen for dramatic low-health effect
        ctx.save();
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = this.effects.desaturation;
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }
    
    getWorldBounds(margin = 0) {
        return {
            left: this.x - this.width / 2 / this.zoom - margin,
            right: this.x + this.width / 2 / this.zoom + margin,
            top: this.y - this.height / 2 / this.zoom - margin,
            bottom: this.y + this.height / 2 / this.zoom + margin
        };
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
    }
    
    // Enhanced effect methods for different game states
    activateDistortion(type, intensity, duration) {
        if (!this.effectsEnabled || this.performanceMode === 'low') return;
        
        this.distortionEffect.active = true;
        this.distortionEffect.type = type;
        this.distortionEffect.intensity = intensity;
        this.distortionEffect.duration = duration;
        
        // Auto-disable after duration
        setTimeout(() => {
            this.distortionEffect.active = false;
            this.distortionEffect.intensity = 0;
        }, duration * 1000);
    }
    
    // Game state-specific camera effects
    onPlayerLowHealth(healthPercent) {
        // Increase vignette and desaturation as health gets lower
        this.effects.vignette = Math.max(0, (1 - healthPercent) * 0.4);
        this.effects.desaturation = Math.max(0, (1 - healthPercent) * 0.6);
        
        // Add chromatic aberration for critical health
        if (healthPercent < 0.2) {
            this.effects.chromaticAberration = (1 - healthPercent) * 3;
        } else {
            this.effects.chromaticAberration = 0;
        }
    }
    
    onLevelUp() {
        this.flash('#00FFFF', 0.5);
        this.shakeLevelUp();
        this.activateDistortion('zoom', 5, 0.3);
    }
    
    onCriticalHit(damage) {
        const intensity = Math.min(10, damage * 0.1);
        this.flash('#FFD700', 0.2);
        this.shakeHit(damage, true);
        if (damage > 100) {
            this.activateDistortion('wave', intensity, 0.4);
        }
    }
    
    onExplosion(x, y, radius) {
        this.flash('#FF6600', 0.3);
        this.shakeExplosion(radius);
        this.activateDistortion('spiral', radius * 0.2, 0.5);
    }
    
    onBossDefeat() {
        this.flash('#FFD700', 1.0);
        this.shake(30, 1.5, 'massive');
        this.activateDistortion('zoom', 15, 1.0);
        
        // Clear negative effects
        this.effects.vignette = 0;
        this.effects.desaturation = 0;
        this.effects.chromaticAberration = 0;
    }
    
    onGameOver() {
        this.flash('#FF0000', 2.0);
        this.shakeGameOver();
        this.effects.vignette = 0.8;
        this.effects.desaturation = 1.0;
        this.activateDistortion('spiral', 20, 2.0);
    }
    
    onPowerUpCollect(type) {
        const colors = {
            'health': '#FF4444',
            'damage': '#FF6600',
            'speed': '#00FFFF',
            'invincible': '#FFD700'
        };
        
        const color = colors[type] || '#FFFFFF';
        this.flash(color, 0.3);
        this.shake(6, 0.2, 'normal');
    }
    
    // New shake methods for weekend project features
    shakePickupGem() {
        this.shake(1, 0.1, 'subtle');
    }
    
    shakeLuckyGem() {
        this.shake(4, 0.3, 'normal');
        this.flash('#FFD700', 0.2);
    }
    
    shakeKillStreak(streakCount) {
        const intensity = Math.min(10, 2 + streakCount * 0.5);
        const duration = 0.2 + streakCount * 0.05;
        this.shake(intensity, duration, 'normal');
    }
    
    shakeWaveStart() {
        this.shake(6, 0.5, 'heavy');
        this.flash('#FF4444', 0.4);
    }
    
    // Reset all effects (useful for pausing/unpausing)
    resetEffects() {
        this.effects.chromaticAberration = 0;
        this.effects.blur = 0;
        this.effects.distortion = 0;
        this.effects.vignette = 0;
        this.effects.desaturation = 0;
        this.distortionEffect.active = false;
        this.clearFlash();
        this.shakeEffect.intensity = 0;
    }
}