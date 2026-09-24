import { managedSetTimeout, globalTimerManager } from '../core/TimerManager.js';
import { bakeSprite, shade, rgba } from './rendering/CharacterArt.js';

export class ExperienceGem {
    constructor(game, x, y, value = 5) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;

        // Experience value
        this.value = value;

        // Visual properties based on value
        this.initializeVisuals();

        // Physics
        this.velocity = { x: 0, y: 0 };
        this.gravity = 200; // pixels per second squared
        this.bounce = 0.3; // bounce factor
        this.friction = 0.95; // velocity decay
        this.grounded = false;

        // Collection mechanics - IMPROVED MAGNETISM
        this.magnetRange = 80;
        this.magnetStrength = 280;
        this.baseMagnetStrength = this.magnetStrength; // Keep base for pulses
        this.beingMagnetized = false;
        this.forceMagnetTimer = 0; // While > 0, ignore range and pull toward player
        this.collectRange = 25; // Distance at which gem is collected (was 15) - EASIER COLLECTION

        // Debug instrumentation (magnetization)
        this.debugNoMoveFrames = 0;
        this.magnetSource = ''; // '', 'range', 'forced', 'player', 'system'
        this._debugPrevMagnetized = false;

        // Lifetime
        this.maxLifetime = 30.0; // 30 seconds before disappearing
        this.lifetime = this.maxLifetime;
        this.fadeTime = 5.0; // Last 5 seconds fade out

        // Animation
        this.floatOffset = Math.random() * Math.PI * 2; // Random float phase
        this.pulseOffset = Math.random() * Math.PI * 2; // Random pulse phase
        this.rotationSpeed = 2.0; // Rotation speed
        this.rotation = 0;

        // Spawning effect
        this.spawnTime = 0.5;
        this.currentSpawnTime = this.spawnTime;

        // Initial burst
        const angle = Math.random() * Math.PI * 2;
        const force = 50 + Math.random() * 50;
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force - 100; // Slight upward bias

        // Status
        this.active = true;
        this.collected = false;
        // Claimed (vacuum): homes to the player until collected; cannot expire,
        // be culled, or be merged away. May still receive merged incoming value.
        this.claimed = false;
        this.claimAge = 0;
        this.id = Math.random().toString(36).substr(2, 9);
    }

    initializeVisuals() {
        // Different gem types based on value
        if (this.value >= 50) {
            // Rare gem
            this.type = 'rare';
            this.size = 8;
            this.color = '#ff3a5a';
            this.glowColor = '#ff8a9a';
            this.sparkleCount = 4; // Reduced from 8 to 4
        } else if (this.value >= 20) {
            // Uncommon gem
            this.type = 'uncommon';
            this.size = 6;
            this.color = '#3ee08a';
            this.glowColor = '#a8ffd0';
            this.sparkleCount = 2; // Reduced from 4 to 2
        } else {
            // Common gem
            this.type = 'common';
            this.size = 4;
            this.color = '#4aa8ff';
            this.glowColor = '#b8e4ff';
            this.sparkleCount = 1; // Reduced from 2 to 1
        }
    }

    update(dt) {
        if (!this.active || this.collected) return;

        if (this.claimed) this.claimAge += dt;

        // Update spawn animation
        if (this.currentSpawnTime > 0) {
            this.currentSpawnTime -= dt;
            // Allow forced magnetization during spawn (area magnet pulses or global system magnet)
            const player = this.game && this.game.player;
            const systemMagnetActive = !!(
                this.game &&
                this.game.systems &&
                this.game.systems.experience &&
                typeof this.game.systems.experience.isGlobalMagnetActive === 'function' &&
                this.game.systems.experience.isGlobalMagnetActive()
            );
            if (this.claimed || this.forceMagnetTimer > 0 || systemMagnetActive) {
                this.updateMagnetism(dt);
                // Allow collection even during spawn when being pulled
                this.checkCollection();
            }
            return; // Don't update normal physics during spawn
        }

        // Gems never expire: lifetime only drives the fade-out visual and the
        // system's periodic consolidation of old, far, unclaimed gems.
        // Claimed gems are exempt from consolidation and keep homing.
        if (this.lifetime > 0) {
            this.lifetime = Math.max(0, this.lifetime - dt);
        }


        // Update rotation
        this.rotation += this.rotationSpeed * dt;

        // Check for player magnetism
        this.updateMagnetism(dt);

        // Update physics if not being magnetized
        if (!this.beingMagnetized) {
            this.updatePhysics(dt);
        }

        // Check for collection
        this.checkCollection();
    }

    updateMagnetism(dt) {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        const _prevX = this.x,
            _prevY = this.y;
        const _prevBeingMagnetized = this.beingMagnetized;

        // Claimed gems home with ramping speed, independent of magnet timers,
        // until collected. Never expires, never culled.
        if (this.claimed) {
            this.beingMagnetized = true;
            this.grounded = false;
            this.magnetSource = 'claimed';

            if (distanceSquared < 0.01) {
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
            const distance = Math.sqrt(distanceSquared);
            const nx = dx / distance;
            const ny = dy / distance;

            // Ramping speed: starts at base pull, accelerates over ~1.5s, and
            // always fast enough to arrive this frame when close.
            const ramp = Math.min(1, this.claimAge / 1.5);
            const speed = Math.min(
                this.baseMagnetStrength * (1 + ramp * 4),
                distance / Math.max(0.001, dt)
            );
            this.velocity.x = nx * speed;
            this.velocity.y = ny * speed;

            const deltaX = this.velocity.x * dt;
            const deltaY = this.velocity.y * dt;
            if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
                this.x += deltaX;
                this.y += deltaY;
            } else {
                // Far away: close the gap in one step rather than drop the claim
                this.x = player.x;
                this.y = player.y;
                this.velocity = { x: 0, y: 0 };
            }
            return;
        }

        // Enhanced magnet range based on player luck stat
        const effectiveMagnetRange = this.magnetRange * (player.stats.luck || 1);


        // If a forced pulse is active OR the system-level global magnet is active, pull regardless of range
        const systemMagnetActive = !!(
            this.game &&
            this.game.systems &&
            this.game.systems.experience &&
            typeof this.game.systems.experience.isGlobalMagnetActive === 'function' &&
            this.game.systems.experience.isGlobalMagnetActive()
        );
        if (this.forceMagnetTimer > 0 || systemMagnetActive) {
            if (this.forceMagnetTimer > 0) {
                this.forceMagnetTimer = Math.max(0, this.forceMagnetTimer - dt);
            }
            this.beingMagnetized = true;
            this.grounded = false; // ensure no ground friction while being magnetized
            this.magnetSource = systemMagnetActive ? 'system' : 'forced';

            // Prevent division by zero (check squared distance)
            if (distanceSquared < 0.01) {
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }
            const distance = Math.sqrt(distanceSquared);
            const nx = dx / distance;
            const ny = dy / distance;

            // Strong, distance-aware pull during pulse or global magnet
            // Ensure gems reach the player before the magnet boost ends
            let speed;
            if (systemMagnetActive) {
                // Use system timer to ensure arrival before magnet ends
                let cm = 3.0;
                let remaining =
                    this.game && this.game.systems && this.game.systems.experience
                        ? this.game.systems.experience.globalMagnetTimer || 0
                        : 0;
                const minBase = this.baseMagnetStrength * Math.max(2.5, cm + 1.5);
                const timeBudget = Math.max(0.3, Math.min(remaining * 0.9, 3.0)); // arrive before boost ends
                const requiredSpeed = distance / timeBudget;
                // Respect per-frame delta safety clamp (< 500)
                const maxPerFrameDelta = 460;
                const maxSpeed = maxPerFrameDelta / Math.max(0.001, dt);
                speed = Math.min(Math.max(minBase, requiredSpeed), maxSpeed);
            } else {
                // Forced pulse (forceMagnetTimer only)
                speed = this.baseMagnetStrength * 4;
            }
            this.velocity.x = nx * speed;
            this.velocity.y = ny * speed;

            const deltaX = this.velocity.x * dt;
            const deltaY = this.velocity.y * dt;
            if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
                this.x += deltaX;
                this.y += deltaY;
            } else {
                this.velocity = { x: 0, y: 0 };
            }
            // Debug: detect if being magnetized but barely moving
            const movedSquared = (this.x - _prevX) * (this.x - _prevX) + (this.y - _prevY) * (this.y - _prevY);
            if (this.beingMagnetized && movedSquared < 0.25) {
                this.debugNoMoveFrames++;
            } else {
                this.debugNoMoveFrames = 0;
            }
            // Debug output removed for performance
            return; // Skip normal range check while forced
        }

        // Use squared distance for range check (avoid sqrt)
        const effectiveMagnetRangeSquared = effectiveMagnetRange * effectiveMagnetRange;
        if (distanceSquared <= effectiveMagnetRangeSquared) {
            this.beingMagnetized = true;
            this.magnetSource = 'range';

            // Move toward player with increasing speed as we get closer
            // FIXED: Add zero distance check to prevent division by zero
            if (distanceSquared < 0.01) {
                // If exactly on player, just set zero velocity
                this.velocity.x = 0;
                this.velocity.y = 0;
                return;
            }

            const distance = Math.sqrt(distanceSquared);
            const normalizedX = dx / distance;
            const normalizedY = dy / distance;

            // Stronger attraction when closer (reciprocal precomputed)
            const attractionMultiplier = 1 + (1 - distance / effectiveMagnetRange);
            const force = this.magnetStrength * attractionMultiplier;

            this.velocity.x = normalizedX * force;
            this.velocity.y = normalizedY * force;

            // Apply velocity with overflow protection
            const deltaX = this.velocity.x * dt;
            const deltaY = this.velocity.y * dt;
            if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
                this.x += deltaX;
                this.y += deltaY;
            } else {
                this.velocity = { x: 0, y: 0 };
            }

            // Debug: stuck detection for range magnet (use squared distance)
            const moved2Squared = (this.x - _prevX) * (this.x - _prevX) + (this.y - _prevY) * (this.y - _prevY);
            if (this.beingMagnetized && moved2Squared < 0.25) {
                this.debugNoMoveFrames++;
            } else {
                this.debugNoMoveFrames = 0;
            }
            // Debug output removed for performance
        } else {
            this.beingMagnetized = false;
            this.magnetSource = '';
            this.debugNoMoveFrames = 0;
            // Debug output removed for performance
        }
    }

    updatePhysics(dt) {
        // Apply gravity
        this.velocity.y += this.gravity * dt;

        // Apply velocity with overflow protection
        const deltaX = this.velocity.x * dt;
        const deltaY = this.velocity.y * dt;

        if (isFinite(deltaX) && isFinite(deltaY) && Math.abs(deltaX) < 500 && Math.abs(deltaY) < 500) {
            this.x += deltaX;
            this.y += deltaY;
        } else {
            this.velocity = { x: 0, y: 0 };
        }

        // Coordinate overflow protection: recover position instead of
        // destroying the gem — dropped XP must never be lost. Far-world
        // coordinates are legitimate and are NOT treated as corruption.
        if (!isFinite(this.x) || !isFinite(this.y)) {
            this.x = this.startX;
            this.y = this.startY;
            this.velocity = { x: 0, y: 0 };
            return;
        }

        // Ground collision (simple)
        const groundY = this.startY + 50; // Rough ground level
        if (this.y > groundY && this.velocity.y > 0) {
            this.y = groundY;
            this.velocity.y *= -this.bounce;
            this.velocity.x *= this.friction;

            // Stop small bounces
            if (Math.abs(this.velocity.y) < 20) {
                this.velocity.y = 0;
                this.grounded = true;
            }
        }

        // Apply friction when grounded
        if (this.grounded) {
            this.velocity.x *= Math.pow(this.friction, dt * 60); // Frame-rate independent
        }
    }

    checkCollection() {
        const player = this.game.player;
        if (!player || !player.isAlive()) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.collectRange) {
            this.collect();
        }
    }

    /**
     * Mark this gem as claimed by a vacuum-style pickup. Idempotent.
     * Claimed gems home to the player until collected and cannot expire,
     * be culled, or be merged away (they may still receive merged value).
     * @returns {boolean} true if this call newly claimed the gem
     */
    claim() {
        if (this.claimed || this.collected || !this.active) return false;
        this.claimed = true;
        this.claimAge = 0;
        this.beingMagnetized = true;
        this.grounded = false;
        this.magnetSource = 'claimed';
        return true;
    }

    collect() {
        if (this.collected) return;

        this.collected = true;

        // Give experience to player
        this.game.player.gainExperience(this.value);

        // Conservation ledger: base gem XP awarded
        const exp = this.game.systems && this.game.systems.experience;
        if (exp && typeof exp.trackCollectedGem === 'function') {
            exp.trackCollectedGem(this.value);
        }

        // Audio: gem collection chime (throttled by AudioManager)
        if (this.game.audioManager && this.game.audioManager.playExperienceGain) {
            this.game.audioManager.playExperienceGain();
        }

        // Enhanced collection effects
        this.createCollectionEffects();

        // Remove from world
        this.destroy();
    }

    createCollectionEffects() {
        if (!this.game.systems.particle) return;

        // Lucky gems get special effects
        if (this.isLucky) {
            this.createLuckyCollectionEffect();
        } else {
            // Enhanced collection effect based on gem rarity
            switch (this.type) {
                case 'rare':
                    this.createRareCollectionEffect();
                    break;
                case 'uncommon':
                    this.createUncommonCollectionEffect();
                    break;
                default:
                    this.createCommonCollectionEffect();
            }
        }

        // Audio feedback
        this.playCollectionSound();

        // Experience number display
        this.showExperienceGain();
    }

    createLuckyCollectionEffect() {
        // Spectacular effects for lucky gems - reduced for clarity!
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: '#FFD700',
            count: 8, // Reduced from 35
            spread: 80,
            intensity: 2.0
        });

        // Single secondary explosion only. Snapshot position/color now and own
        // the timer on the experience system: this gem may be pooled and reused
        // before the callback fires, so the closure must not read gem state.
        const burstX = this.x;
        const burstY = this.y;
        const particle = this.game.systems.particle;
        managedSetTimeout(
            () => {
                particle.createBurst(burstX, burstY, 'collect', {
                    color: '#FFD700',
                    count: 6, // Reduced from 20
                    spread: 60 // Reduced spread
                });
            },
            100,
            this.game.systems.experience || this
        );

    }

    createRareCollectionEffect() {
        // Moderate burst for rare gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'gemExplosion', {
            color: this.color,
            count: 6, // Reduced from 25
            spread: 60,
            intensity: 1.5
        });

        // Single secondary explosion — snapshot mutable state; timer owned by
        // the experience system so pooled gem reuse can't corrupt the callback.
        const burstX = this.x;
        const burstY = this.y;
        const burstColor = this.glowColor;
        const particle = this.game.systems.particle;
        managedSetTimeout(
            () => {
                particle.createBurst(burstX, burstY, 'collect', {
                    color: burstColor,
                    count: 4, // Reduced from 15
                    spread: 50
                });
            },
            100,
            this.game.systems.experience || this
        );
    }

    createUncommonCollectionEffect() {
        // Medium burst for uncommon gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 4, // Reduced from 15
            spread: 40,
            intensity: 1.2
        });

        // Skip sparkle trail - too many particles
    }

    createCommonCollectionEffect() {
        // Simple burst for common gems - reduced for clarity
        this.game.systems.particle.createBurst(this.x, this.y, 'collect', {
            color: this.color,
            count: 3, // Reduced from 8
            spread: 25,
            intensity: 1.0
        });
    }

    createSparkleTrail() {
        // Create sparkle trail from gem to player
        const player = this.game.player;
        if (!player) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const sparkleCount = Math.floor(distance / 20);

        for (let i = 0; i < sparkleCount; i++) {
            const t = i / sparkleCount;
            const x = this.x + dx * t;
            const y = this.y + dy * t;

            managedSetTimeout(
                () => {
                    this.game.systems.particle.create(x, y, {
                        vx: (Math.random() - 0.5) * 50,
                        vy: (Math.random() - 0.5) * 50,
                        life: 0.8,
                        size: 3,
                        color: this.color,
                        glow: true,
                        fadeOut: true
                    });
                },
                i * 30,
                this
            );
        }
    }

    playCollectionSound() {
        if (!this.game.audioManager || !this.game.audioManager.playVampireSound) return;

        // Lucky gems get special sound treatment
        if (this.isLucky) {
            // Multiple layered sounds for lucky gems
            this.game.audioManager.playVampireSound('experienceGain', 0.45, 1.5);
            managedSetTimeout(
                () => {
                    this.game.audioManager.playVampireSound('levelUp', 0.4, 2.0);
                },
                100,
                this
            );
            managedSetTimeout(
                () => {
                    this.game.audioManager.playVampireSound('criticalHit', 0.3, 1.8);
                },
                200,
                this
            );
            return;
        }

        // Different sounds for different rarities
        let volume = 0.4;
        let pitch = 1.0;

        switch (this.type) {
            case 'rare':
                volume = 0.8;
                pitch = 1.3;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
                // Add bonus sound
                managedSetTimeout(
                    () => {
                        this.game.audioManager.playVampireSound('levelUp', 0.3, 1.8);
                    },
                    100,
                    this
                );
                break;
            case 'uncommon':
                volume = 0.6;
                pitch = 1.1;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
                break;
            default:
                volume = 0.4;
                pitch = 1.0;
                this.game.audioManager.playVampireSound('experienceGain', volume, pitch);
        }
    }

    showExperienceGain() {
        // Show floating experience number
        if (this.game.systems.particle && this.game.systems.particle.createEnhancedDamageNumber) {
            let color, size, intensity;

            if (this.isLucky) {
                color = '#FFD700';
                size = 24;
                intensity = 3.0;
                // Show "LUCKY!" text above the number
                managedSetTimeout(
                    () => {
                        this.game.systems.particle.createEnhancedDamageNumber(
                            this.x,
                            this.y - 20,
                            'LUCKY!',
                            true,
                            '#FFD700',
                            18,
                            2.0
                        );
                    },
                    200,
                    this
                );
            } else if (this.type === 'rare') {
                color = '#E080FF';
                size = 18;
                intensity = 2.0;
            } else {
                // Common/uncommon pickups are communicated by the XP bar and
                // pickup chime — floating text here just buries the hero.
                return;
            }

            this.game.systems.particle.createEnhancedDamageNumber(
                this.x,
                this.y,
                `+${this.value} EXP`,
                false,
                color,
                size,
                intensity
            );
        }
    }

    destroy() {
        this.active = false;
    }

    render(renderer) {
        if (!this.active || this.collected) return;

        const ctx = renderer.ctx;
        ctx.save();

        // Spawn animation
        if (this.currentSpawnTime > 0) {
            const spawnProgress = 1 - this.currentSpawnTime / this.spawnTime;
            ctx.globalAlpha = spawnProgress;
        }
        // Scale-in factor (applied around the gem itself, not the world origin)
        const spawnScale = this.currentSpawnTime > 0
            ? 0.3 + 0.7 * (1 - this.currentSpawnTime / this.spawnTime)
            : 1;

        // Fade out near end of lifetime (floor stays at a dim minimum —
        // expired gems are consolidated by the system, never destroyed)
        if (this.lifetime < this.fadeTime) {
            ctx.globalAlpha *= Math.max(0.35, this.lifetime / this.fadeTime);
        }

        // Floating animation
        const floatY = Math.sin(performance.now() * 0.003 + this.floatOffset) * 2;
        const gemY = this.y + floatY;

        // Pulsing glow (faster for lucky gems)
        const pulseRate = this.pulseRate || 1.0;
        const pulseIntensity = 0.7 + 0.3 * Math.sin(performance.now() * 0.005 * pulseRate + this.pulseOffset);

        // Debug overlay: draw line/arrow to player when magnetized
        if (this.game && this.game.showDebug && (this.beingMagnetized || this.magnetSource)) {
            const player = this.game.player;
            if (player) {
                const dx = player.x - this.x;
                const dy = player.y - gemY;
                const len = Math.hypot(dx, dy) || 1;
                const nx = dx / len;
                const ny = dy / len;

                let color = '#00FF00'; // default green
                switch (this.magnetSource) {
                    case 'system':
                        color = '#44AAFF';
                        break;
                    case 'player':
                        color = '#00FF88';
                        break;
                    case 'forced':
                        color = '#FFEE00';
                        break;
                    case 'range':
                        color = '#AAAAAA';
                        break;
                }

                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = color;
                ctx.fillStyle = color;

                // Line
                ctx.beginPath();
                ctx.moveTo(this.x, gemY);
                ctx.lineTo(player.x, player.y);
                ctx.stroke();

                // Arrow head near gem pointing to player
                const ax = this.x + nx * 14;
                const ay = gemY + ny * 14;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - ny * 4, ay + nx * 4);
                ctx.lineTo(ax + ny * 4, ay - nx * 4);
                ctx.closePath();
                ctx.fill();

                // Stuck indicator
                if (this.debugNoMoveFrames > 20) {
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = '#FF3333';
                    ctx.font = '10px monospace';
                    ctx.fillText('STUCK', this.x + 6, gemY - 6);
                }
                ctx.restore();
            }
        }

        // Magnetized halo polish (additive)
        const systemMagnetActive = !!(
            this.game &&
            this.game.systems &&
            this.game.systems.experience &&
            typeof this.game.systems.experience.isGlobalMagnetActive === 'function' &&
            this.game.systems.experience.isGlobalMagnetActive()
        );
        if (this.beingMagnetized || systemMagnetActive) {
            const haloPulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006 + this.pulseOffset);
            const radius = this.size * (this.type === 'rare' ? 6 : 4.5);
            const grad = ctx.createRadialGradient(this.x, gemY, 0, this.x, gemY, radius);
            grad.addColorStop(0, `rgba(68,255,68,${0.28 * haloPulse})`);
            grad.addColorStop(1, 'rgba(68,255,68,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= 0.9 * pulseIntensity;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, gemY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Soft additive glow (baked) instead of per-gem shadowBlur
        const color = this.isLucky ? '#FFD700' : this.color;
        const sprites = ExperienceGem.sprites(this.type, color);
        if (sprites) {
            const gr = this.size * (this.isLucky ? 4.2 : 3) * (0.85 + 0.15 * pulseIntensity);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= 0.55;
            ctx.drawImage(sprites.glow, this.x - gr, gemY - gr, gr * 2, gr * 2);
            ctx.restore();

            ctx.translate(this.x, gemY);
            ctx.scale(spawnScale, spawnScale);
            const g = sprites.gem;
            ctx.drawImage(g.canvas, -g.ax, -g.ay, g.w, g.h);

            // Periodic glint sweeping across the facet
            const glint = (performance.now() * 0.001 + this.pulseOffset) % 2.6;
            if (glint < 0.25) {
                const a = Math.sin((glint / 0.25) * Math.PI);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha *= a;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(-this.size * 0.25, -this.size * 0.45, this.size * 0.5, this.size * 0.14, -0.6, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.isLucky) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                this.renderLuckySparkles(ctx, pulseIntensity);
            }
            ctx.restore();
            return;
        }

        // Headless fallback: legacy vector gem
        ctx.translate(this.x, gemY);
        ctx.scale(spawnScale, spawnScale);
        ctx.rotate(this.rotation);
        this.renderGem(ctx);
        ctx.restore();
    }

    /**
     * Baked outlined crystal + glow sprite per (type, color). Common =
     * small shard, uncommon = cut diamond, rare = large faceted heart-stone.
     */
    static sprites(type, color) {
        if (typeof document === 'undefined') return null;
        const cache = ExperienceGem._spriteCache || (ExperienceGem._spriteCache = new Map());
        const key = type + '|' + color;
        let entry = cache.get(key);
        if (entry !== undefined) return entry;

        const s = type === 'rare' ? 8 : type === 'uncommon' ? 6 : 4.5;
        const light = shade(color, 0.55);
        const dark = shade(color, -0.45);
        const gem = bakeSprite({ l: -s, r: s, t: -s * 1.4, b: s * 1.1 }, (ctx) => {
            // Crystal silhouette: pointed top, tapered base
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.35);
            ctx.lineTo(s * 0.8, -s * 0.2);
            ctx.lineTo(s * 0.45, s * 1.0);
            ctx.lineTo(-s * 0.45, s * 1.0);
            ctx.lineTo(-s * 0.8, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            // Dark right facet
            ctx.fillStyle = dark;
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.35);
            ctx.lineTo(s * 0.8, -s * 0.2);
            ctx.lineTo(s * 0.45, s * 1.0);
            ctx.lineTo(0, s * 0.25);
            ctx.closePath();
            ctx.fill();
            // Lit left facet
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.35);
            ctx.lineTo(-s * 0.8, -s * 0.2);
            ctx.lineTo(0, s * 0.25);
            ctx.closePath();
            ctx.fill();
            if (type !== 'common') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.moveTo(-s * 0.2, -s * 0.9);
                ctx.lineTo(-s * 0.45, -s * 0.25);
                ctx.lineTo(-s * 0.15, -s * 0.35);
                ctx.closePath();
                ctx.fill();
            }
        }, { outline: type === 'common' ? 0.9 : 1.1 });

        let glow = null;
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext && c.getContext('2d');
        if (g) {
            const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
            grad.addColorStop(0, rgba(color, 0.9));
            grad.addColorStop(0.4, rgba(color, 0.3));
            grad.addColorStop(1, rgba(color, 0));
            g.fillStyle = grad;
            g.fillRect(0, 0, 32, 32);
            glow = c;
        }
        entry = gem && glow ? { gem, glow } : null;
        cache.set(key, entry);
        return entry;
    }

    renderGem(ctx) {
        switch (this.type) {
            case 'rare':
                this.renderRareGem(ctx);
                break;
            case 'uncommon':
                this.renderUncommonGem(ctx);
                break;
            default:
                this.renderCommonGem(ctx);
                break;
        }
    }

    renderCommonGem(ctx) {
        // Simple hexagon
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * this.size;
            const y = Math.sin(angle) * this.size;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, -this.size * 0.3, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    renderUncommonGem(ctx) {
        // Diamond shape with facets
        ctx.fillStyle = this.color;

        // Main diamond
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.7, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();

        // Facets
        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.3, -this.size * 0.3);
        ctx.lineTo(0, 0);
        ctx.lineTo(-this.size * 0.3, -this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.4, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    renderRareGem(ctx) {
        // Complex star gem
        const spikes = 8;
        const outerRadius = this.size;
        const innerRadius = this.size * 0.5;

        ctx.fillStyle = this.color;
        ctx.beginPath();

        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
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

        // Inner core
        ctx.fillStyle = this.glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Bright highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.2, this.size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    renderSparkles(ctx, intensity) {
        const time = performance.now() * 0.01;

        for (let i = 0; i < this.sparkleCount; i++) {
            const angle = (i / this.sparkleCount) * Math.PI * 2 + time;
            const distance = this.size * (1.5 + 0.5 * Math.sin(time * 2 + i));
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = intensity * 0.8;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    renderLuckySparkles(ctx, intensity) {
        const time = performance.now() * 0.01;

        // More sparkles for lucky gems - reduced from 2x to 1.5x
        const luckySparkleCount = Math.ceil(this.sparkleCount * 1.5);

        for (let i = 0; i < luckySparkleCount; i++) {
            const angle = (i / luckySparkleCount) * Math.PI * 2 + time * 2;
            const distance = this.size * (1.8 + 0.7 * Math.sin(time * 3 + i));
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            // Alternating gold and white sparkles
            ctx.fillStyle = i % 2 === 0 ? '#FFD700' : '#FFFFFF';
            ctx.globalAlpha = intensity * 0.9;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Add outer ring of sparkles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time * 0.5;
            const distance = this.size * 2.5;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = intensity * 0.6;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    // Helper methods
    getPosition() {
        return { x: this.x, y: this.y };
    }

    getBounds() {
        return {
            left: this.x - this.size,
            right: this.x + this.size,
            top: this.y - this.size,
            bottom: this.y + this.size
        };
    }

    isActive() {
        return this.active && !this.collected;
    }

    // Reset method for object pooling
    reset(x, y, value = 5) {
        // Cancel any callbacks still owned by this gem before reuse
        globalTimerManager.clearContext(this);

        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.value = value;

        // Reset lucky gem properties
        this.isLucky = false;
        this.glowEffect = false;
        this.pulseRate = 1.0;

        // Reset visuals
        this.initializeVisuals();

        // Reset physics
        this.velocity = { x: 0, y: 0 };
        this.grounded = false;
        this.beingMagnetized = false;
        this.forceMagnetTimer = 0;
        this.magnetSource = '';
        this.debugNoMoveFrames = 0;

        // Reset claim state
        this.claimed = false;
        this.claimAge = 0;

        // Reset state
        this.lifetime = this.maxLifetime;
        this.currentSpawnTime = this.spawnTime;
        this.rotation = 0;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.pulseOffset = Math.random() * Math.PI * 2;

        // Initial burst
        const angle = Math.random() * Math.PI * 2;
        const force = 50 + Math.random() * 50;
        this.velocity.x = Math.cos(angle) * force;
        this.velocity.y = Math.sin(angle) * force - 100;

        this.active = true;
        this.collected = false;
        this._inPool = false;
    }
}
