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
        this.text = '0';
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
        // Support both numeric values and arbitrary text labels
        if (typeof value === 'number' && isFinite(value)) {
            this.value = value;
            this.text = Math.round(value).toString();
        } else if (typeof value === 'string') {
            const numericValue = Number(value);
            this.value = isFinite(numericValue) ? numericValue : 0;
            this.text = /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Math.round(numericValue).toString() : value;
        } else {
            this.value = 0;
            this.text = String(value ?? '');
        }
        // Crits always read as molten gold; everything else keeps its
        // caller color (heals green, status ticks tinted, etc.)
        this.color = isCritical ? '#ffd24a' : color;
        const isLabel = !/^-?\d+$/.test(this.text);
        // World-space sizes (camera zoom enlarges them on screen)
        this.fontSize = isCritical ? 15 : isLabel ? 10 : 11;
        this.opacity = 1;
        this.velocityY = isCritical ? -1.6 : -1.2;
        this.velocityX = (Math.random() - 0.5) * 0.9;
        this.lifetime = isCritical ? 0.85 : 0.65;
        this.elapsed = 0;
        this.active = true;
        this.isCritical = isCritical;
        this.scale = 1.7;
    }

    /**
     * Update damage number animation
     */
    update(deltaTime) {
        if (!this.active) return;

        this.elapsed += deltaTime;

        // Drift up and slightly sideways, easing out
        this.y += this.velocityY * 60 * deltaTime;
        this.x += (this.velocityX || 0) * 60 * deltaTime;
        this.velocityY *= 0.95;
        if (this.velocityX) this.velocityX *= 0.92;

        // Pop: overshoot then settle within ~0.12s; fade only in the tail
        const progress = this.elapsed / this.lifetime;
        const pop = Math.min(1, this.elapsed / 0.12);
        const settle = this.isCritical ? 1.15 : 1;
        this.scale = settle + (1.7 - settle) * (1 - pop) * (1 - pop);
        this.opacity = progress < 0.55 ? 1 : Math.max(0, 1 - (progress - 0.55) / 0.45);

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

        // Camera transform is already applied by caller (world-space render).
        // Use world coordinates directly to avoid double-applying camera offset.
        const screenX = this.x;
        const screenY = this.y;

        // Chunky outlined numerals — crisp against any floor, no blur cost
        const size = this.fontSize * this.scale;
        ctx.globalAlpha = this.opacity;
        ctx.font = `900 ${size.toFixed(1)}px "Trebuchet MS", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, size * 0.22);
        ctx.strokeStyle = this.isCritical ? '#3a1204' : 'rgba(10, 5, 12, 0.9)';
        ctx.strokeText(this.text, screenX, screenY);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, screenX, screenY);


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
        this.text = '0';
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

        // One hit, one number: weapon hit feedback and Enemy.takeDamage both
        // report the same blow. Merge a near-identical number spawned at the
        // same spot a moment ago (keeping crit styling) instead of doubling.
        const num = typeof value === 'number' ? value : Number(value);
        if (isFinite(num)) {
            for (let i = this.activeNumbers.length - 1, n = 0; i >= 0 && n < 8; i--, n++) {
                const d = this.activeNumbers[i];
                if (d.elapsed > 0.1 || !/^-?\d+$/.test(d.text)) continue;
                if (Math.abs(d.value - num) <= 1 && Math.abs(d.x - x) < 22 && Math.abs(d.y - y) < 22) {
                    if (isCritical && !d.isCritical) d.init(d.x, d.y, Math.max(d.value, num), color, true);
                    return d;
                }
            }
        }

        if (this.activeNumbers.length >= 30) {
            const oldest = this.activeNumbers.shift();
            if (oldest) {
                oldest.reset();
                this.pool.push(oldest);
            }
        }

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
     * Backward-compatible alias used by multiple systems.
     * Supports both boolean critical flags and legacy label strings.
     */
    spawn(x, y, value, color = '#ffffff', criticalOrTag = false) {
        const isCritical = typeof criticalOrTag === 'boolean' ? criticalOrTag : criticalOrTag === 'CRITICAL';
        return this.get(x, y, value, color, isCritical);
    }

    /**
     * Update all active damage numbers
     */
    update(deltaTime) {
        // Use write-index pattern for performance (avoid expensive splice)
        let writeIndex = 0;
        for (let i = 0; i < this.activeNumbers.length; i++) {
            const damageNumber = this.activeNumbers[i];
            damageNumber.update(deltaTime);

            // Return inactive numbers to pool
            if (!damageNumber.active) {
                damageNumber.reset();
                this.pool.push(damageNumber);
                this.stats.inUse--;
                this.stats.available++;
            } else {
                this.activeNumbers[writeIndex++] = damageNumber;
            }
        }
        this.activeNumbers.length = writeIndex;
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
