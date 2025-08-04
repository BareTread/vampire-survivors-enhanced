// Smart Sprite Manager - Combines procedural and sprite-based rendering
export class SpriteManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.sprites = new Map();
        this.spriteSheets = new Map();
        this.proceduralCache = new Map();
        
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
        // Player base sprite
        this.createSprite('player_base', 24, 24, (ctx) => {
            // Main body
            ctx.fillStyle = '#4A90E2';
            ctx.beginPath();
            ctx.arc(12, 12, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = '#6BB6FF';
            ctx.beginPath();
            ctx.arc(10, 10, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Direction indicator
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(12, 12);
            ctx.lineTo(20, 12);
            ctx.stroke();
        });
        
        // Player damaged variant
        this.createSprite('player_damaged', 24, 24, (ctx) => {
            ctx.fillStyle = '#FF6B6B';
            ctx.beginPath();
            ctx.arc(12, 12, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Damage cracks
            ctx.strokeStyle = '#CC0000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 8);
            ctx.lineTo(16, 16);
            ctx.moveTo(16, 8);
            ctx.lineTo(8, 16);
            ctx.stroke();
        });
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