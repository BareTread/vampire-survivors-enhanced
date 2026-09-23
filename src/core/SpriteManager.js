import { paintHunter, getHunterSprite, rgba } from '../entities/rendering/CharacterArt.js';

// Smart Sprite Manager - Combines procedural and sprite-based rendering
export class SpriteManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.sprites = new Map();
        this.spriteSheets = new Map();
        this.proceduralCache = new Map();

        // Dash afterimage trail buffer + walk-cycle state
        this._dashTrail = [];
        this._playerAnim = null;

        // Canvas-based sprite generation for consistency
        this.spriteCanvas = document.createElement('canvas');
        this.spriteCanvas.width = 512;
        this.spriteCanvas.height = 512;
        this.spriteCtx = this.spriteCanvas.getContext('2d');

        // Performance tracking
        this.cacheHits = 0;
        this.cacheMisses = 0;

        this.initializeSprites();
    }
    
    initializeSprites() {
        // Generate common game sprites programmatically
        this.generatePlayerSprites();
        this.generateEnemySprites();
        this.generateWeaponSprites();
        this.generateEffectSprites();
        this.generateUISprites();
        
        console.log('🎨 Generated', this.sprites.size, 'procedural sprites');
    }
    
    generatePlayerSprites() {
        // Legacy 24px sprites — painted with the same hunter art used by
        // drawPlayer so every player render path shares one identity.
        for (const [name, wounded] of [['player_base', false], ['player_damaged', true]]) {
            this.createSprite(name, 24, 24, (ctx) => {
                ctx.save();
                ctx.translate(12, 22);
                ctx.scale(0.5, 0.5);
                paintHunter(ctx, 12, '#4A90E2', 'antonio', 0, wounded);
                ctx.restore();
            });
        }
    }

    /**
     * Draw the player as an upright, animated vampire hunter:
     *   - stride cycle driven by distance travelled (feet never skate)
     *   - facing flip from horizontal movement, idle breathing
     *   - white hit-flash on damage, invulnerability flicker
     *   - character-colored light pool at the feet + dash afterimages
     *
     * Reads x, y, size, color, characterId, velocity, invulnerable,
     * invulnerabilityTime, levelUpEffect(Time), desperationMode, health,
     * maxHealth and dash. Does NOT draw the health bar or aim indicator.
     */
    drawPlayer(player, ctx) {
        if (!ctx || !player) return;

        const size = player.size || 12;
        const color = player.color || '#4A90E2';
        const charId = player.characterId || 'antonio';
        const now = performance.now() * 0.001;
        const anim = this._stepPlayerAnim(player, size);

        const justHit = player.invulnerable &&
            player.invulnerabilityTime > (player.maxInvulnerabilityTime || 1) - 0.12;
        const wounded = player.health < player.maxHealth * 0.35;
        const variant = justHit ? 'flash' : wounded ? 'wounded' : 'normal';
        const sprite = getHunterSprite(size, color, charId, anim.frame, variant);
        const feetY = player.y + size * 0.9;

        ctx.save();

        // Light pool — the hunter carries a faint lantern glow
        const glowR = size * 3.2;
        const glow = ctx.createRadialGradient(player.x, feetY, 0, player.x, feetY, glowR);
        glow.addColorStop(0, rgba(color, 0.3));
        glow.addColorStop(0.5, rgba(color, 0.1));
        glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(player.x, feetY, glowR, glowR * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hero ring — a thin character-colored sigil so the hunter never
        // gets lost inside a crowd of silhouettes
        const ringPulse = 0.55 + 0.15 * Math.sin(now * 3);
        ctx.strokeStyle = rgba(color, ringPulse);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(player.x, feetY, size * 1.25, size * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Low-health heartbeat: a red ring thumping out from the feet
        if (player.health > 0 && player.health <= player.maxHealth * 0.25) {
            const beat = (now * 1.4) % 1;
            ctx.strokeStyle = `rgba(255, 50, 60, ${0.7 * (1 - beat)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(player.x, feetY, size * (1.2 + beat * 1.6), size * (0.45 + beat * 0.6), 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Ground shadow
        ctx.fillStyle = 'rgba(6, 3, 10, 0.45)';
        ctx.beginPath();
        ctx.ellipse(player.x, feetY, size * (0.8 - anim.hop * 0.01), size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (!sprite) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(player.x, player.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        // Dash afterimage trail — tinted ghosts, decays fast
        const trail = this._dashTrail;
        for (let i = trail.length - 1; i >= 0; i--) {
            const t = trail[i];
            t.alpha -= 0.08;
            if (t.alpha <= 0) {
                trail.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = t.alpha * 0.4;
            ctx.translate(t.x, t.y + size * 0.9);
            ctx.scale(t.facing, 1);
            ctx.drawImage(t.sprite.canvas, -t.sprite.ax, -t.sprite.ay, t.sprite.w, t.sprite.h);
            ctx.restore();
        }
        if (player.dash && player.dash.active) {
            const last = trail[trail.length - 1];
            const dx = player.x - (last ? last.x : Infinity);
            const dy = player.y - (last ? last.y : Infinity);
            if (dx * dx + dy * dy > 64) {
                const ghost = getHunterSprite(size, color, charId, anim.frame, 'flash');
                if (ghost) trail.push({ x: player.x, y: player.y, facing: anim.facing, sprite: ghost, alpha: 1 });
                if (trail.length > 6) trail.shift();
            }
        }

        // Invulnerability flicker (after the white hit-flash frame)
        if (player.invulnerable && !justHit) {
            const flash = Math.sin(player.invulnerabilityTime * 10 * Math.PI * 2);
            if (flash < 0) ctx.globalAlpha = 0.45;
        }

        // Level-up / desperation rim glow
        if (player.levelUpEffect) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 16 * (player.levelUpEffectTime || 0);
        } else if (player.desperationMode && player.desperationMode.active) {
            ctx.shadowColor = '#FF3030';
            ctx.shadowBlur = 8 + Math.sin(now * 8) * 4;
        }

        ctx.translate(player.x, feetY - anim.hop);
        ctx.rotate(anim.lean);
        ctx.scale(anim.facing * anim.sx, anim.sy);
        ctx.drawImage(sprite.canvas, -sprite.ax, -sprite.ay, sprite.w, sprite.h);

        ctx.restore();
    }

    /**
     * Advance the hunter's walk cycle from actual displacement so the
     * stride matches ground speed at any framerate or speed buff.
     */
    _stepPlayerAnim(player, size) {
        const a = this._playerAnim || (this._playerAnim = {
            x: player.x, y: player.y, dist: 0, facing: 1, moving: 0
        });
        const dx = player.x - a.x;
        const dy = player.y - a.y;
        a.x = player.x;
        a.y = player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        // Teleports (new run, revive) should not spin the cycle
        if (d < size * 4) a.dist += d;

        const vx = player.velocity ? player.velocity.x : dx;
        if (vx > 1) a.facing = 1;
        else if (vx < -1) a.facing = -1;

        // Smooth moving factor so starting/stopping eases in
        const target = d > 0.2 ? 1 : 0;
        a.moving += (target - a.moving) * 0.25;

        const stepLen = size * 1.15;
        const phase = (a.dist / stepLen) * Math.PI;
        let frame = 0;
        let hop = 0;
        let sx = 1;
        let sy = 1;
        let lean = 0;

        if (a.moving > 0.3) {
            frame = Math.floor(a.dist / stepLen) % 2 === 0 ? 1 : 2;
            hop = Math.abs(Math.sin(phase)) * size * 0.16 * a.moving;
            const c = Math.cos(phase * 2);
            sx = 1 + c * 0.03;
            sy = 1 - c * 0.03;
            lean = a.facing * 0.06 * a.moving;
        } else {
            const b = Math.sin(performance.now() * 0.0025);
            sx = 1 - b * 0.02;
            sy = 1 + b * 0.025;
        }

        return { frame, hop, sx, sy, lean, facing: a.facing };
    }

    generateEnemySprites() {
        const enemyTypes = {
            basic: { color: '#FF6B6B', size: 16 },
            fast: { color: '#4ECDC4', size: 12 },
            tank: { color: '#45B7D1', size: 28 },
            ranged: { color: '#F39C12', size: 14 },
            elite: { color: '#9B59B6', size: 32 }
        };
        
        Object.entries(enemyTypes).forEach(([type, config]) => {
            this.createSprite(`enemy_${type}`, config.size, config.size, (ctx) => {
                const center = config.size / 2;
                const radius = center * 0.8;
                
                // Main body
                ctx.fillStyle = config.color;
                ctx.beginPath();
                ctx.arc(center, center, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Type-specific details
                switch(type) {
                    case 'fast':
                        // Speed lines
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 1;
                        for (let i = 0; i < 3; i++) {
                            const x = center - radius + i * 2;
                            ctx.beginPath();
                            ctx.moveTo(x, center - 2);
                            ctx.lineTo(x - 4, center - 2);
                            ctx.stroke();
                        }
                        break;
                        
                    case 'tank':
                        // Armor plating
                        ctx.strokeStyle = '#333333';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(center, center, radius * 0.7, 0, Math.PI * 2);
                        ctx.stroke();
                        break;
                        
                    case 'ranged':
                        // Targeting sight
                        ctx.strokeStyle = '#CC0000';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(center - 4, center);
                        ctx.lineTo(center + 4, center);
                        ctx.moveTo(center, center - 4);
                        ctx.lineTo(center, center + 4);
                        ctx.stroke();
                        break;
                        
                    case 'elite':
                        // Crown
                        ctx.fillStyle = '#FFD700';
                        ctx.beginPath();
                        ctx.arc(center, center - radius - 3, 3, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                }
                
                // Health indicator border
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(center, center, radius, 0, Math.PI * 2);
                ctx.stroke();
            });
        });
    }
    
    generateWeaponSprites() {
        // Magic missile trail
        this.createSprite('magic_missile', 12, 12, (ctx) => {
            // Missile body
            ctx.fillStyle = '#9B59B6';
            ctx.beginPath();
            ctx.arc(6, 6, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Glow effect
            ctx.shadowColor = '#9B59B6';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#E6B3FF';
            ctx.beginPath();
            ctx.arc(6, 6, 2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Throwing knife
        this.createSprite('throwing_knife', 16, 8, (ctx) => {
            ctx.fillStyle = '#C0C0C0';
            ctx.beginPath();
            ctx.moveTo(2, 4);
            ctx.lineTo(14, 4);
            ctx.lineTo(16, 2);
            ctx.lineTo(16, 6);
            ctx.lineTo(14, 4);
            ctx.closePath();
            ctx.fill();
            
            // Handle
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(0, 3, 4, 2);
        });
    }
    
    generateEffectSprites() {
        // Hit spark
        this.createSprite('hit_spark', 8, 8, (ctx) => {
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(4, 1);
            ctx.lineTo(4, 7);
            ctx.moveTo(1, 4);
            ctx.lineTo(7, 4);
            ctx.moveTo(2, 2);
            ctx.lineTo(6, 6);
            ctx.moveTo(6, 2);
            ctx.lineTo(2, 6);
            ctx.stroke();
        });
        
        // Experience gem
        this.createSprite('exp_gem', 10, 10, (ctx) => {
            // Gem body
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.moveTo(5, 1);
            ctx.lineTo(8, 3);
            ctx.lineTo(8, 7);
            ctx.lineTo(5, 9);
            ctx.lineTo(2, 7);
            ctx.lineTo(2, 3);
            ctx.closePath();
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(5, 2);
            ctx.lineTo(6, 3);
            ctx.lineTo(6, 4);
            ctx.lineTo(5, 3);
            ctx.closePath();
            ctx.fill();
        });
    }
    
    generateUISprites() {
        // Health orb
        this.createSprite('health_orb', 20, 20, (ctx) => {
            // Outer glow
            const gradient = ctx.createRadialGradient(10, 10, 0, 10, 10, 10);
            gradient.addColorStop(0, '#FF4444');
            gradient.addColorStop(0.7, '#CC0000');
            gradient.addColorStop(1, '#880000');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(10, 10, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner highlight
            ctx.fillStyle = '#FFAAAA';
            ctx.beginPath();
            ctx.arc(8, 8, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Mana orb
        this.createSprite('mana_orb', 20, 20, (ctx) => {
            const gradient = ctx.createRadialGradient(10, 10, 0, 10, 10, 10);
            gradient.addColorStop(0, '#4444FF');
            gradient.addColorStop(0.7, '#0000CC');
            gradient.addColorStop(1, '#000088');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(10, 10, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#AAAAFF';
            ctx.beginPath();
            ctx.arc(8, 8, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    createSprite(name, width, height, drawFunction) {
        // Create individual canvas for this sprite
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Enable anti-aliasing for smooth sprites
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Execute the drawing function
        drawFunction(ctx);
        
        // Store sprite data
        this.sprites.set(name, {
            canvas: canvas,
            width: width,
            height: height,
            image: canvas // For compatibility with renderer.drawImage
        });
        
        return canvas;
    }
    
    // Enhanced sprite drawing with effects
    drawSprite(name, x, y, options = {}) {
        const sprite = this.sprites.get(name);
        if (!sprite) {
            this.cacheMisses++;
            return false;
        }
        
        this.cacheHits++;
        
        const {
            scale = 1,
            rotation = 0,
            alpha = 1,
            flipX = false,
            flipY = false,
            tint = null,
            glow = false,
            glowColor = '#FFFFFF',
            glowIntensity = 5
        } = options;
        
        const ctx = this.renderer.ctx;
        ctx.save();
        
        // Apply transformations
        ctx.translate(x, y);
        if (rotation !== 0) ctx.rotate(rotation);
        if (scale !== 1) ctx.scale(scale, scale);
        if (flipX || flipY) ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        if (alpha !== 1) ctx.globalAlpha = alpha;
        
        // Apply glow effect
        if (glow) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = glowIntensity;
        }
        
        // Apply tint (requires composite operation)
        if (tint) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = tint;
            ctx.fillRect(-sprite.width/2, -sprite.height/2, sprite.width, sprite.height);
            ctx.globalCompositeOperation = 'destination-in';
        }
        
        // Draw the sprite
        ctx.drawImage(
            sprite.canvas,
            -sprite.width / 2,
            -sprite.height / 2,
            sprite.width,
            sprite.height
        );
        
        ctx.restore();
        return true;
    }
    
    // Batch sprite drawing for performance
    drawSpriteInstances(name, instances) {
        const sprite = this.sprites.get(name);
        if (!sprite || instances.length === 0) return;
        
        const ctx = this.renderer.ctx;
        
        // Batch draw all instances
        for (const instance of instances) {
            ctx.save();
            ctx.translate(instance.x, instance.y);
            if (instance.rotation) ctx.rotate(instance.rotation);
            if (instance.scale !== 1) ctx.scale(instance.scale, instance.scale);
            if (instance.alpha !== 1) ctx.globalAlpha = instance.alpha;
            
            ctx.drawImage(
                sprite.canvas,
                -sprite.width / 2,
                -sprite.height / 2
            );
            ctx.restore();
        }
        
        this.cacheHits += instances.length;
    }
    
    // Generate variant sprites on demand
    createVariantSprite(baseName, variantName, modifications) {
        const baseSprite = this.sprites.get(baseName);
        if (!baseSprite) return null;
        
        const cacheKey = `${baseName}_${variantName}`;
        if (this.sprites.has(cacheKey)) {
            return this.sprites.get(cacheKey);
        }
        
        // Create variant canvas
        const canvas = document.createElement('canvas');
        canvas.width = baseSprite.width;
        canvas.height = baseSprite.height;
        const ctx = canvas.getContext('2d');
        
        // Copy base sprite
        ctx.drawImage(baseSprite.canvas, 0, 0);
        
        // Apply modifications
        if (modifications.tint) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = modifications.tint;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(baseSprite.canvas, 0, 0);
        }
        
        if (modifications.overlay) {
            ctx.globalCompositeOperation = 'source-over';
            modifications.overlay(ctx);
        }
        
        // Cache the variant
        this.sprites.set(cacheKey, {
            canvas: canvas,
            width: canvas.width,
            height: canvas.height,
            image: canvas
        });
        
        return this.sprites.get(cacheKey);
    }
    
    // Performance and memory management
    preloadSprites(spriteNames) {
        // Ensure commonly used sprites are loaded
        spriteNames.forEach(name => {
            if (!this.sprites.has(name)) {
                console.warn(`Sprite ${name} not found for preloading`);
            }
        });
    }
    
    getPerformanceStats() {
        const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses) * 100;
        return {
            totalSprites: this.sprites.size,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: hitRate.toFixed(1) + '%',
            memoryUsage: this.sprites.size * 64 // Rough estimate in KB
        };
    }
    
    // Utility methods
    hasSprite(name) {
        return this.sprites.has(name);
    }
    
    getSpriteNames() {
        return Array.from(this.sprites.keys());
    }
    
    clearCache() {
        this.cacheHits = 0;
        this.cacheMisses = 0;
    }
}