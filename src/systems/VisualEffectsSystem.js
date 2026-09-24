// Enhanced Visual Effects System - High impact, low particle count
export class VisualEffectsSystem {
    constructor(game) {
        this.game = game;

        // Effect pools for common effects
        this.activeEffects = [];
        this.effectPool = [];
        this.maxActiveEffects = 15; // Much lower limit for clarity

        // Quality scaling
        this.effectQuality = 1.0;
        this.framesSinceUpdate = 0;

        // Visual effect templates
        this.effectTemplates = this.initializeTemplates();

        console.log('✨ VisualEffectsSystem initialized - Quality over quantity');
    }

    initializeTemplates() {
        return {
            // Critical hit: a four-point star flash that spins open, plus a
            // thin shockwave ring. Additive, no shadow blur, ~0.35s.
            criticalHit: {
                duration: 0.35,
                particles: 1,
                render: (effect, ctx) => {
                    const p = 1 - effect.life / effect.duration;
                    const e = 1 - Math.pow(1 - p, 3);
                    const alpha = 1 - p;
                    const len = 6 + e * 18;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = alpha;
                    ctx.translate(effect.x, effect.y);
                    ctx.rotate(p * 0.8);
                    ctx.fillStyle = '#fff2c0';
                    for (let i = 0; i < 4; i++) {
                        ctx.rotate(Math.PI / 2);
                        ctx.beginPath();
                        ctx.moveTo(0, -len);
                        ctx.lineTo(2.2, 0);
                        ctx.lineTo(0, len * 0.18);
                        ctx.lineTo(-2.2, 0);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(0, 0, 3 * (1 - p), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.rotate(-p * 0.8);
                    ctx.strokeStyle = effect.color && effect.color !== '#FF0000' ? effect.color : '#ffc040';
                    ctx.lineWidth = 2 * (1 - p);
                    ctx.beginPath();
                    ctx.arc(0, 0, 6 + e * 26, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            },

            // Level up: golden ring + rising light column
            levelUp: {
                duration: 1.4,
                particles: 1,
                render: (effect, ctx) => {
                    const p = 1 - effect.life / effect.duration;
                    const ringAlpha = Math.sin(p * Math.PI) * 0.85;
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = ringAlpha;
                    ctx.strokeStyle = '#FFD24A';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.ellipse(effect.x, effect.y + 10, p * 70, p * 26, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    const h = 40 + p * 140;
                    const col = ctx.createLinearGradient(0, effect.y - h, 0, effect.y + 10);
                    col.addColorStop(0, 'rgba(255, 220, 120, 0)');
                    col.addColorStop(1, 'rgba(255, 220, 120, 0.45)');
                    ctx.fillStyle = col;
                    ctx.fillRect(effect.x - 12, effect.y - h, 24, h + 10);
                    ctx.restore();
                }
            },

            // Enemy death: a small soul wisp escapes upward and a thin ring
            // in the creature's color flares out. Short and light.
            enemyDeath: {
                duration: 0.5,
                particles: 1,
                render: (effect, ctx) => {
                    const p = 1 - effect.life / effect.duration;
                    const e = 1 - Math.pow(1 - p, 2);
                    const alpha = 1 - p;
                    const color = effect.color || '#FF4444';
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = alpha * 0.9;
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.ellipse(effect.x, effect.y + 4, 4 + e * 16, 2 + e * 6, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    // Wisp
                    const wy = effect.y - e * 26;
                    const r = 4 * (1 - p * 0.6);
                    const g = ctx.createRadialGradient(effect.x, wy, 0, effect.x, wy, r * 2.5);
                    g.addColorStop(0, 'rgba(235, 240, 255, 0.9)');
                    g.addColorStop(1, 'rgba(160, 180, 255, 0)');
                    ctx.fillStyle = g;
                    ctx.beginPath();
                    ctx.ellipse(effect.x + Math.sin(p * 9) * 2, wy, r * 1.6, r * 2.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            },

            // Clean damage indicator
            damageNumber: {
                duration: 1.5,
                particles: 1,
                render: (effect, ctx) => {
                    const progress = 1 - effect.life / effect.duration;
                    const yOffset = progress * -30; // Float upward
                    const alpha = Math.max(0, 1 - progress * 1.5);
                    const scale = effect.isCritical ? 1.2 + Math.sin(progress * Math.PI * 4) * 0.1 : 1.0;

                    ctx.save();
                    ctx.globalAlpha = alpha;

                    // Text shadow for readability
                    const fontSize = Math.floor((effect.isCritical ? 20 : 16) * scale);
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // Shadow
                    ctx.fillStyle = '#000000';
                    ctx.fillText(effect.text, effect.x + 1, effect.y + yOffset + 1);

                    // Main text
                    ctx.fillStyle = effect.color || '#FFFFFF';
                    if (effect.isCritical) {
                        ctx.shadowColor = effect.color;
                        ctx.shadowBlur = 8;
                    }
                    ctx.fillText(effect.text, effect.x, effect.y + yOffset);

                    ctx.restore();
                }
            },

            // Weapon fire effect
            weaponFire: {
                duration: 0.4,
                particles: 1,
                render: (effect, ctx) => {
                    const progress = 1 - effect.life / effect.duration;
                    const alpha = 1 - progress * progress;
                    const size = 6 - progress * 3;

                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.shadowColor = effect.color || '#FFAA00';
                    ctx.shadowBlur = size * 2;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            },

            // Screen-space UI effects
            screenFlash: {
                duration: 0.3,
                particles: 1,
                render: (effect, ctx) => {
                    const progress = 1 - effect.life / effect.duration;
                    const alpha = (1 - progress) * (effect.intensity || 0.3);

                    if (alpha > 0.01) {
                        ctx.save();
                        ctx.globalAlpha = alpha;
                        ctx.fillStyle = effect.color || '#FFFFFF';
                        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                        ctx.restore();
                    }
                }
            }
        };
    }

    // High-level effect creation methods
    createCriticalHitEffect(x, y, color = '#FF0000') {
        this.createEffect('criticalHit', { x, y, color });

    }

    createLevelUpEffect(x, y) {
        this.createEffect('levelUp', { x, y });

        // Screen flash for dramatic effect
        this.createScreenFlash('#FFD700', 0.4);

    }

    createEnemyDeathEffect(x, y, color = '#FF4444') {
        this.createEffect('enemyDeath', { x, y, color });
    }

    createDamageNumber(x, y, damage, isCritical = false, color = '#FFFFFF') {
        this.createEffect('damageNumber', {
            x: x + (Math.random() - 0.5) * 10,
            y: y - 5,
            text: damage.toString(),
            isCritical,
            color
        });
    }

    createWeaponFireEffect(x, y, color = '#FFAA00') {
        // Only create if not too many active
        if (this.activeEffects.length < this.maxActiveEffects * 0.5) {
            this.createEffect('weaponFire', { x, y, color });
        }
    }

    createScreenFlash(color = '#FFFFFF', intensity = 0.3) {
        // Remove any existing screen flash
        this.activeEffects = this.activeEffects.filter((e) => e.type !== 'screenFlash');

        this.createEffect('screenFlash', {
            x: 0,
            y: 0, // Not used for screen effects
            color,
            intensity
        });
    }

    // Core effect management
    createEffect(type, properties) {
        if (this.activeEffects.length >= this.maxActiveEffects) {
            // Remove oldest non-critical effect
            const oldestIndex = this.findOldestRemovableEffect();
            if (oldestIndex >= 0) {
                this.returnEffectToPool(this.activeEffects[oldestIndex]);
                this.activeEffects.splice(oldestIndex, 1);
            } else {
                return; // Can't create new effect
            }
        }

        const template = this.effectTemplates[type];
        if (!template) {
            console.warn(`Unknown effect type: ${type}`);
            return;
        }

        const effect = this.getEffectFromPool();
        effect.type = type;
        effect.life = template.duration * this.effectQuality;
        effect.duration = template.duration * this.effectQuality;

        // Copy properties
        Object.assign(effect, properties);

        this.activeEffects.push(effect);
        return effect;
    }

    findOldestRemovableEffect() {
        // Don't remove critical effects like screen flashes or level ups
        const removable = ['weaponFire', 'enemyDeath'];

        for (let i = 0; i < this.activeEffects.length; i++) {
            if (removable.includes(this.activeEffects[i].type)) {
                return i;
            }
        }

        return -1;
    }

    update(dt) {
        this.framesSinceUpdate++;

        // Update all effects
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.life -= dt;

            if (effect.life <= 0) {
                this.returnEffectToPool(effect);
                this.activeEffects.splice(i, 1);
            }
        }

        // Adaptive quality every 60 frames
        if (this.framesSinceUpdate > 60) {
            this.adaptQuality();
            this.framesSinceUpdate = 0;
        }
    }

    render(renderer) {
        const ctx = renderer.ctx;

        // Render all active effects
        for (const effect of this.activeEffects) {
            const template = this.effectTemplates[effect.type];
            if (template && template.render) {
                template.render(effect, ctx);
            }
        }
    }

    adaptQuality() {
        const fps = this.game.performanceStats?.fps || 60;

        if (fps < 45) {
            this.effectQuality = Math.max(0.5, this.effectQuality * 0.9);
            this.maxActiveEffects = Math.max(8, Math.floor(this.maxActiveEffects * 0.8));
            if (this.game.showDebug) {
                console.log('🎨 Reduced visual effect quality for performance');
            }
        } else if (fps > 55 && this.effectQuality < 1.0) {
            this.effectQuality = Math.min(1.0, this.effectQuality * 1.1);
            this.maxActiveEffects = Math.min(15, Math.floor(this.maxActiveEffects * 1.1));
        }
    }

    // Object pooling
    getEffectFromPool() {
        if (this.effectPool.length > 0) {
            return this.effectPool.pop();
        }

        return {
            type: null,
            x: 0,
            y: 0,
            life: 0,
            duration: 0,
            color: '#FFFFFF'
            // Additional properties added dynamically
        };
    }

    returnEffectToPool(effect) {
        // Reset effect
        effect.type = null;
        effect.life = 0;

        if (this.effectPool.length < 50) {
            this.effectPool.push(effect);
        }
    }

    // Compatibility methods for existing particle system calls
    createHitEffect(x, y, intensity = 1.0) {
        if (intensity > 1.5) {
            this.createCriticalHitEffect(x, y);
        } else {
            this.createWeaponFireEffect(x, y, '#FFFF00');
        }
    }

    createDeathEffect(x, y, color = '#FF4444') {
        this.createEnemyDeathEffect(x, y, color);
    }

    showDamage(x, y, damage, isCritical = false) {
        this.createDamageNumber(x, y, damage, isCritical, isCritical ? '#FF69B4' : '#FFFF00');
    }

    // Performance info
    getPerformanceInfo() {
        return {
            activeEffects: this.activeEffects.length,
            maxActiveEffects: this.maxActiveEffects,
            effectQuality: this.effectQuality.toFixed(2),
            poolSize: this.effectPool.length,
            effectTypes: [...new Set(this.activeEffects.map((e) => e.type))]
        };
    }

    // Clear all effects (for game reset)
    clear() {
        for (const effect of this.activeEffects) {
            this.returnEffectToPool(effect);
        }
        this.activeEffects.length = 0;
    }
}
