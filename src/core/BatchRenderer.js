/**
 * Batch Rendering System
 * 
 * Optimizes rendering performance by batching similar draw calls together,
 * reducing state changes and improving GPU utilization.
 */

export class RenderBatch {
    constructor(type, material) {
        this.type = type; // 'sprite', 'rect', 'circle', 'text'
        this.material = material; // { color, alpha, etc }
        this.items = [];
        this.vertexCount = 0;
    }

    add(item) {
        this.items.push(item);
        this.vertexCount += this.getVertexCount(item);
    }

    getVertexCount(item) {
        switch (this.type) {
            case 'sprite': return 4;
            case 'rect': return 4;
            case 'circle': return 32; // Approximation for circle
            case 'text': return 4;
            default: return 0;
        }
    }

    clear() {
        this.items.length = 0;
        this.vertexCount = 0;
    }
}

export class BatchRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.batches = new Map();
        this.currentBatch = null;
        this.stats = {
            drawCalls: 0,
            batchedItems: 0,
            stateChanges: 0
        };
        
        // Pre-allocated arrays for batch data
        this.rectBatchData = {
            positions: new Float32Array(1000 * 4), // x, y, width, height
            colors: new Uint32Array(1000),
            count: 0
        };
    }

    /**
     * Begin a new frame
     */
    beginFrame() {
        this.batches.clear();
        this.currentBatch = null;
        this.stats.drawCalls = 0;
        this.stats.batchedItems = 0;
        this.stats.stateChanges = 0;
    }

    /**
     * Add a sprite to the batch
     */
    addSprite(sprite, x, y, width, height, alpha = 1) {
        const key = `sprite_${sprite.src}_${alpha}`;
        let batch = this.batches.get(key);
        
        if (!batch) {
            batch = new RenderBatch('sprite', { sprite, alpha });
            this.batches.set(key, batch);
        }
        
        batch.add({ x, y, width, height });
    }

    /**
     * Add a filled rectangle to the batch
     */
    addRect(x, y, width, height, color, alpha = 1) {
        const key = `rect_${color}_${alpha}`;
        let batch = this.batches.get(key);
        
        if (!batch) {
            batch = new RenderBatch('rect', { color, alpha });
            this.batches.set(key, batch);
        }
        
        batch.add({ x, y, width, height });
    }

    /**
     * Add a circle to the batch
     */
    addCircle(x, y, radius, color, alpha = 1, fill = true) {
        const key = `circle_${color}_${alpha}_${fill}`;
        let batch = this.batches.get(key);
        
        if (!batch) {
            batch = new RenderBatch('circle', { color, alpha, fill });
            this.batches.set(key, batch);
        }
        
        batch.add({ x, y, radius });
    }

    /**
     * Add text to the batch
     */
    addText(text, x, y, font, color, alpha = 1) {
        const key = `text_${font}_${color}_${alpha}`;
        let batch = this.batches.get(key);
        
        if (!batch) {
            batch = new RenderBatch('text', { font, color, alpha });
            this.batches.set(key, batch);
        }
        
        batch.add({ text, x, y });
    }

    /**
     * Flush all batches and render
     */
    flush() {
        const ctx = this.ctx;
        
        // Sort batches by type for optimal state changes
        const sortedBatches = Array.from(this.batches.values())
            .sort((a, b) => a.type.localeCompare(b.type));
        
        for (const batch of sortedBatches) {
            if (batch.items.length === 0) continue;
            
            ctx.save();
            
            // Apply batch material properties
            if (batch.material.alpha !== 1) {
                ctx.globalAlpha = batch.material.alpha;
                this.stats.stateChanges++;
            }
            
            switch (batch.type) {
                case 'rect':
                    this.flushRectBatch(batch);
                    break;
                case 'circle':
                    this.flushCircleBatch(batch);
                    break;
                case 'sprite':
                    this.flushSpriteBatch(batch);
                    break;
                case 'text':
                    this.flushTextBatch(batch);
                    break;
            }
            
            ctx.restore();
            this.stats.drawCalls++;
            this.stats.batchedItems += batch.items.length;
        }
    }

    /**
     * Flush rectangle batch
     */
    flushRectBatch(batch) {
        const ctx = this.ctx;
        ctx.fillStyle = batch.material.color;
        
        // Draw all rectangles in one pass
        for (const rect of batch.items) {
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
    }

    /**
     * Flush circle batch
     */
    flushCircleBatch(batch) {
        const ctx = this.ctx;
        
        if (batch.material.fill) {
            ctx.fillStyle = batch.material.color;
        } else {
            ctx.strokeStyle = batch.material.color;
        }
        
        // Draw all circles
        for (const circle of batch.items) {
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
            
            if (batch.material.fill) {
                ctx.fill();
            } else {
                ctx.stroke();
            }
        }
    }

    /**
     * Flush sprite batch
     */
    flushSpriteBatch(batch) {
        const ctx = this.ctx;
        const sprite = batch.material.sprite;
        
        // Draw all sprites with the same texture
        for (const item of batch.items) {
            ctx.drawImage(sprite, item.x, item.y, item.width, item.height);
        }
    }

    /**
     * Flush text batch
     */
    flushTextBatch(batch) {
        const ctx = this.ctx;
        ctx.font = batch.material.font;
        ctx.fillStyle = batch.material.color;
        
        // Draw all text with the same style
        for (const item of batch.items) {
            ctx.fillText(item.text, item.x, item.y);
        }
    }

    /**
     * Get rendering statistics
     */
    getStats() {
        return {
            ...this.stats,
            batchCount: this.batches.size,
            averageItemsPerBatch: this.stats.batchedItems / Math.max(1, this.batches.size)
        };
    }

    /**
     * Draw immediate (bypass batching for special cases)
     */
    drawImmediate(callback) {
        this.flush(); // Flush any pending batches
        callback(this.ctx);
    }
}

/**
 * Sprite batch helper for even more efficient sprite rendering
 */
export class SpriteBatcher {
    constructor(ctx, maxSprites = 1000) {
        this.ctx = ctx;
        this.maxSprites = maxSprites;
        this.sprites = new Map();
        
        // Pre-allocated arrays for sprite data
        this.positions = new Float32Array(maxSprites * 2); // x, y
        this.sizes = new Float32Array(maxSprites * 2); // width, height
        this.uvs = new Float32Array(maxSprites * 4); // u1, v1, u2, v2
        this.colors = new Uint32Array(maxSprites); // RGBA packed
        this.count = 0;
    }

    /**
     * Add a sprite to the batch
     */
    addSprite(texture, x, y, width, height, color = 0xFFFFFFFF) {
        if (this.count >= this.maxSprites) {
            this.flush();
        }
        
        const index = this.count * 2;
        this.positions[index] = x;
        this.positions[index + 1] = y;
        this.sizes[index] = width;
        this.sizes[index + 1] = height;
        this.colors[this.count] = color;
        
        this.count++;
    }

    /**
     * Flush the sprite batch
     */
    flush() {
        if (this.count === 0) return;
        
        // Render all sprites
        // This would be much more efficient with WebGL
        for (let i = 0; i < this.count; i++) {
            const x = this.positions[i * 2];
            const y = this.positions[i * 2 + 1];
            const width = this.sizes[i * 2];
            const height = this.sizes[i * 2 + 1];
            
            // In a real implementation, this would use a sprite sheet
            // and draw all sprites in one draw call
        }
        
        this.count = 0;
    }
}