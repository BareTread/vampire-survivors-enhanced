/**
 * Damage Number Pooling System
 * 
 * Efficient pooling for damage numbers and UI elements to reduce GC pressure
 * during intense gameplay. Reuses damage number objects instead of creating new ones.
 */

export class DamageNumber {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.value = 0;
        this.color = '#ffffff';
        this.fontSize = 16;
        this.opacity = 1;
        this.velocityY = -2;
        this.lifetime = 1.0;
        this.elapsed = 0;
        this.active = false;
        this.isCritical = false;
        this.scale = 1;
    }

    /**
     * Initialize damage number with parameters
     */
    init(x, y, value, color = '#ffffff', isCritical = false) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.color = color;
        this.fontSize = isCritical ? 24 : 16;
        this.opacity = 1;
        this.velocityY = isCritical ? -3 : -2;
        this.lifetime = isCritical ? 1.2 : 1.0;
        this.elapsed = 0;
        this.active = true;
        this.isCritical = isCritical;
        this.scale = isCritical ? 1.5 : 1;
    }

    /**
     * Update damage number animation
     */
    update(deltaTime) {
        if (!this.active) return;

        this.elapsed += deltaTime;
        
        // Move upward
        this.y += this.velocityY * 60 * deltaTime;
        
        // Slow down over time
        this.velocityY *= 0.98;
        
        // Fade out
        const progress = this.elapsed / this.lifetime;
        this.opacity = Math.max(0, 1 - progress);
        
        // Scale animation for critical hits
        if (this.isCritical) {
            this.scale = 1.5 + Math.sin(progress * Math.PI) * 0.3;
        }
        
        // Deactivate when lifetime expires
        if (this.elapsed >= this.lifetime) {
            this.active = false;
        }
    }

    /**
     * Render damage number
     */
    render(ctx, camera) {
        if (!this.active || this.opacity <= 0) return;

        ctx.save();
        
        // Apply camera transform
        const screenX = this.x - camera.x + camera.width / 2;
        const screenY = this.y - camera.y + camera.height / 2;
        
        // Set text properties
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.fontSize * this.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw the damage number
        ctx.fillText(Math.round(this.value), screenX, screenY);
        
        ctx.restore();
    }

    /**
     * Reset damage number for pooling
     */
    reset() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.value = 0;
        this.elapsed = 0;
    }
}

export class DamageNumberPool {
    constructor(initialSize = 100) {
        this.pool = [];
        this.activeNumbers = [];
        
        // Pre-allocate damage numbers
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new DamageNumber());
        }
        
        this.stats = {
            created: initialSize,
            inUse: 0,
            available: initialSize,
            peakUsage: 0
        };
    }

    /**
     * Get a damage number from the pool
     */
    get(x, y, value, color = '#ffffff', isCritical = false) {
        let damageNumber;
        
        if (this.pool.length > 0) {
            damageNumber = this.pool.pop();
        } else {
            // Create new if pool is exhausted
            damageNumber = new DamageNumber();
            this.stats.created++;
        }
        
        damageNumber.init(x, y, value, color, isCritical);
        this.activeNumbers.push(damageNumber);
        
        // Update statistics
        this.stats.inUse = this.activeNumbers.length;
        this.stats.available = this.pool.length;
        this.stats.peakUsage = Math.max(this.stats.peakUsage, this.stats.inUse);
        
        return damageNumber;
    }

    /**
     * Update all active damage numbers
     */
    update(deltaTime) {
        for (let i = this.activeNumbers.length - 1; i >= 0; i--) {
            const damageNumber = this.activeNumbers[i];
            damageNumber.update(deltaTime);
            
            // Return inactive numbers to pool
            if (!damageNumber.active) {
                this.activeNumbers.splice(i, 1);
                damageNumber.reset();
                this.pool.push(damageNumber);
                
                this.stats.inUse--;
                this.stats.available++;
            }
        }
    }

    /**
     * Render all active damage numbers
     */
    render(ctx, camera) {
        // Render in reverse order so newer numbers appear on top
        for (let i = this.activeNumbers.length - 1; i >= 0; i--) {
            this.activeNumbers[i].render(ctx, camera);
        }
    }

    /**
     * Clear all active damage numbers
     */
    clear() {
        while (this.activeNumbers.length > 0) {
            const damageNumber = this.activeNumbers.pop();
            damageNumber.reset();
            this.pool.push(damageNumber);
        }
        
        this.stats.inUse = 0;
        this.stats.available = this.pool.length;
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return { ...this.stats };
    }
}

// Global damage number pool instance
export const globalDamageNumberPool = new DamageNumberPool(100);