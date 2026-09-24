export class Camera {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
        this.baseZoom = Camera.computeBaseZoom(width, height);
        this.zoom = this.baseZoom;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = this.baseZoom;
        this.smoothing = 0.1;
        this.bounds = null;

        // Camera Juice — movement lead + dynamic zoom
        this.leadFactor = 0.3; // How far ahead the camera looks in movement direction
        this.leadX = 0;
        this.leadY = 0;
        this.leadSmoothing = 0.04; // Slower than main smoothing for gentle drift
        this.dynamicZoomEnabled = true;
        this.dynamicZoomTarget = this.baseZoom;
        this.dynamicZoomSmoothing = 0.02; // Very slow zoom transitions
        // Screen shake is trauma-based (0..1): events add trauma, the visible
        // shake is trauma² so small bumps stay subtle and only real impacts
        // read. Motion uses smooth layered noise (not a buzzing sine) and a
        // separate damped spring "kick" pushes the view away from a hit.
        this.trauma = 0;
        this.traumaDecay = 1.5;      // trauma lost per second
        this.maxShakeOffset = 16;    // screen px at full trauma
        this.shakeScale = 1;         // Settings > Screen Shake slider
        this._shakeTime = Math.random() * 100;
        this._kick = { x: 0, y: 0, vx: 0, vy: 0 };
        this.shakeEffect = { intensity: 0, duration: 0, offsetX: 0, offsetY: 0 };

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
        
        // Screen distortion effects
        this.distortionEffect = {
            active: false,
            intensity: 0,
            duration: 0,
            type: 'wave' // wave, spiral, zoom
        };
        
        // Hit-stop freeze-frame state
        this.hitStopFrames = 0;
        this.hitStopIntensity = 0;
        this._hitStopSavedTimeScale = null;
        
        // Zoom punch state
        this._zoomPunchActive = false;
        this._zoomPunchIntensity = 0;
        this._zoomPunchDecay = 0.85;
        
        // Performance management
        this.effectsEnabled = true;
        this.screenShakeEnabled = true; // Wired to Settings > Screen Shake toggle
        this.performanceMode = 'high'; // high, medium, low
    }

    follow(x, y, dt) {
        // Camera Juice: movement lead
        // Compute player velocity from position delta
        const dx = x - (this._lastPlayerX || x);
        const dy = y - (this._lastPlayerY || y);
        this._lastPlayerX = x;
        this._lastPlayerY = y;

        // Lead target: offset camera ahead of movement direction
        const targetLeadX = dx * this.leadFactor * 60; // Scale for ~60fps feel
        const targetLeadY = dy * this.leadFactor * 60;
        this.leadX += (targetLeadX - this.leadX) * this.leadSmoothing;
        this.leadY += (targetLeadY - this.leadY) * this.leadSmoothing;

        this.targetX = x + this.leadX;
        this.targetY = y + this.leadY;

        // Hit-stop: decrement frame counter (uses real frames, not dt, since time is frozen)
        if (this.hitStopFrames > 0) {
            this.hitStopFrames--;
            if (this.hitStopFrames <= 0) {
                // A level-up still owns the pause even when hit-stop ends.
                if (this._game && this._hitStopSavedTimeScale !== null) {
                    if (this._game.gameState !== 'levelUp') {
                        this._game.timeScale = this._hitStopSavedTimeScale;
                    }
                    this._hitStopSavedTimeScale = null;
                }
                this.hitStopIntensity = 0;
                // Brief zoom punch on hit-stop exit
                this._zoomPunchActive = true;
                this._zoomPunchIntensity = 0.02;
            }
            // Skip the rest of follow during hit-stop (world is frozen)
            return;
        }

        // Zoom punch decay
        if (this._zoomPunchActive) {
            this._zoomPunchIntensity *= this._zoomPunchDecay;
            if (this._zoomPunchIntensity < 0.001) {
                this._zoomPunchActive = false;
                this._zoomPunchIntensity = 0;
            }
        }

        // Camera Juice: dynamic zoom-out when many enemies nearby
        if (this.dynamicZoomEnabled && this._game) {
            const enemies = this._game.systems && this._game.systems.enemies;
            if (enemies) {
                const nearbyCount = enemies.getEnemiesInRange
                    ? enemies.getEnemiesInRange(x, y, 350).length : 0;
                if (nearbyCount >= 30) {
                    // Zoom out proportionally, cap at 0.85x of the base framing
                    this.dynamicZoomTarget = this.baseZoom * Math.max(0.85, 1.0 - (nearbyCount - 30) * 0.003);
                } else {
                    this.dynamicZoomTarget = this.baseZoom;
                }
            }
            this.targetZoom += (this.dynamicZoomTarget - this.targetZoom) * this.dynamicZoomSmoothing;
        }

        // Smooth camera movement
        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;
        // Apply zoom punch offset on top of target zoom
        const zoomPunchOffset = this._zoomPunchActive ? this._zoomPunchIntensity : 0;
        this.zoom += (this.targetZoom + zoomPunchOffset - this.zoom) * this.smoothing;
        
        // Apply bounds if set
        if (this.bounds) {
            this.x = Math.max(this.bounds.minX + this.width / 2, 
                     Math.min(this.bounds.maxX - this.width / 2, this.x));
            this.y = Math.max(this.bounds.minY + this.height / 2, 
                     Math.min(this.bounds.maxY - this.height / 2, this.y));
        }
        
        this.updateShake(dt);

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
    
    /** Smooth pseudo-noise in [-1, 1]: three incommensurate sines per axis. */
    static shakeNoise(t, seed) {
        return (Math.sin(t * 1.0 + seed) + Math.sin(t * 2.31 + seed * 1.7) * 0.5 +
                Math.sin(t * 4.13 + seed * 2.9) * 0.25) / 1.75;
    }

    updateShake(dt) {
        const step = Math.min(Math.max(dt || 0, 0), 0.05);
        this.trauma = Math.max(0, this.trauma - this.traumaDecay * step);

        // Kick: stiff, well-damped spring back to rest (one clean jolt, no wobble)
        const k = this._kick;
        k.vx += (-260 * k.x - 30 * k.vx) * step;
        k.vy += (-260 * k.y - 30 * k.vy) * step;
        k.x += k.vx * step;
        k.y += k.vy * step;
        if (Math.abs(k.x) + Math.abs(k.y) + Math.abs(k.vx) + Math.abs(k.vy) < 0.02) {
            k.x = k.y = k.vx = k.vy = 0;
        }

        // Noise speed rises a little with trauma: rumble at low, jolt at high
        this._shakeTime += step * (9 + 9 * this.trauma);
        const amount = this.trauma * this.trauma * this.maxShakeOffset;
        const toWorld = 1 / (this.zoom || 1);
        this.shakeEffect.intensity = amount;
        this.shakeEffect.offsetX = (Camera.shakeNoise(this._shakeTime, 0.0) * amount + k.x) * toWorld;
        this.shakeEffect.offsetY = (Camera.shakeNoise(this._shakeTime, 5.3) * amount + k.y) * toWorld;
    }

    /**
     * Add trauma (0..1). `ceiling` bounds what this source can build up to, so
     * frequent events (getting hit in a swarm) stay readable while rare set
     * pieces (boss, evolution, Death) still get the full range.
     */
    addTrauma(amount, ceiling = 1) {
        if (!this.effectsEnabled || !this.screenShakeEnabled || !(amount > 0)) return;
        if (this.trauma >= ceiling) return;
        const scale = (this.performanceMode === 'low' ? 0.6 : 1) * this.shakeScale;
        this.trauma = Math.min(ceiling, this.trauma + amount * scale);
    }

    /**
     * World-space impact (explosion, slam): trauma falls off with distance
     * from the view centre, so a blast across the screen is felt faintly and
     * one at your feet is felt fully.
     */
    shakeAt(wx, wy, amount, reach = 420, ceiling = 0.6) {
        const d = Math.hypot(wx - this.x, wy - this.y);
        const falloff = 1 - d / reach;
        if (falloff <= 0) return;
        this.addTrauma(amount * falloff * falloff, ceiling);
    }

    /**
     * Directional jolt in screen px, e.g. away from whatever hit the player.
     * (dx, dy) is the direction the view should be shoved.
     */
    kick(dx, dy, strength = 6) {
        if (!this.effectsEnabled || !this.screenShakeEnabled) return;
        const len = Math.hypot(dx, dy);
        if (!len) return;
        const v = Math.min(strength, 14) * 28 * this.shakeScale;
        this._kick.vx += (dx / len) * v;
        this._kick.vy += (dy / len) * v;
    }

    /**
     * Legacy entry point: (intensity ~1-30, duration s). Mapped to trauma so
     * weak or short calls barely register and only big, long events shake.
     */
    shake(intensity, duration = 0.3) {
        const i = Math.max(0, Number(intensity) || 0);
        const d = Math.max(0.05, Number(duration) || 0.3);
        this.addTrauma(Math.min(0.75, (i / 36) * Math.min(1.5, d / 0.45)));
    }

    setScreenShakeEnabled(enabled) {
        this.screenShakeEnabled = enabled;
        if (!enabled) {
            // Immediately stop any active shake
            this.trauma = 0;
            this._kick.x = this._kick.y = this._kick.vx = this._kick.vy = 0;
            this.shakeEffect.intensity = 0;
            this.shakeEffect.offsetX = 0;
            this.shakeEffect.offsetY = 0;
        }
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
        // Baked per viewport + intensity step (1/50) and blitted: the
        // gradient only changes when health crosses a step, not per frame.
        const level = Math.round(Math.min(1, this.effects.vignette) * 50);
        if (level <= 0) return;
        const w = Math.round(this.width);
        const h = Math.round(this.height);
        const v = this._vignette || (this._vignette = { canvas: null, key: '' });
        const key = `${w}|${h}|${level}`;
        if (v.key !== key && typeof document !== 'undefined') {
            const c = v.canvas || document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            const gradient = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${level / 50})`);
            g.fillStyle = gradient;
            g.fillRect(0, 0, w, h);
            v.canvas = c;
            v.key = key;
        }
        ctx.save();
        if (v.canvas && v.key === key) {
            ctx.drawImage(v.canvas, 0, 0);
        } else {
            const gradient = ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${this.effects.vignette})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);
        }
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
        // Keep the visible world area consistent across screen sizes
        const prevBase = this.baseZoom;
        this.baseZoom = Camera.computeBaseZoom(width, height);
        if (prevBase > 0) {
            const k = this.baseZoom / prevBase;
            this.zoom *= k;
            this.targetZoom *= k;
            this.dynamicZoomTarget *= k;
        }
    }

    /**
     * Framing: show roughly 540 world units along the short screen axis so
     * characters read at a consistent size on laptops and big monitors.
     */
    static computeBaseZoom(width, height) {
        const shortSide = Math.min(width || 0, height || 0);
        if (!shortSide) return 1;
        return Math.max(0.9, Math.min(2.0, shortSide / 540));
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
    
    
    onCriticalHit() {
        // Crits are routine; they read through their own spark, not the camera.
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
    
    
    
    shakeWaveStart() {
        // A low rumble as the next wave rolls in; the banner does the talking.
        this.addTrauma(0.3);
    }
    
    /**
     * Freeze the game for a number of frames to sell impact.
     * @param {number} frames — Duration in real frames (e.g. 4 = ~67ms at 60fps)
     * @param {number} intensity — 0-1 visual darkening intensity (unused currently, reserved)
     */
    hitStop(frames, intensity = 0.5) {
        if (!this.effectsEnabled) return;
        if (!this._game) return;
        
        // Performance mode: halve freeze frames on low
        let adjustedFrames = Math.round(frames);
        if (this.performanceMode === 'low') {
            adjustedFrames = Math.max(1, Math.round(adjustedFrames / 2));
        }
        
        // Don't override a longer hit-stop already in progress
        if (this.hitStopFrames >= adjustedFrames) return;
        
        // A hit-stop started by an evolution during selection must resume
        // combat, not restore the level-up's paused timeScale after the pick.
        if (this._hitStopSavedTimeScale === null) {
            this._hitStopSavedTimeScale = this._game.gameState === 'levelUp'
                ? 1 : this._game.timeScale;
        }
        
        this.hitStopFrames = adjustedFrames;
        this.hitStopIntensity = intensity;
        this._game.timeScale = 0;
    }
    
    /**
     * Brief zoom punch for multi-kill feedback.
     * @param {number} intensity — 0-1 scale controlling zoom magnitude
     */
    zoomPunch(intensity = 0.5) {
        if (!this.effectsEnabled) return;
        this._zoomPunchActive = true;
        this._zoomPunchIntensity = Math.max(this._zoomPunchIntensity, intensity * 0.03);
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
        this.hitStopFrames = 0;
        this.hitStopIntensity = 0;
        this._hitStopSavedTimeScale = null;
        this._zoomPunchActive = false;
        this._zoomPunchIntensity = 0;
    }
}