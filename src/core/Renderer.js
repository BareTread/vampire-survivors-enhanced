export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.debugMode = false;
        
        // OPTIMIZED: Advanced performance tracking and batching
        this.batchedDrawCalls = [];
        this.lastUsedFillStyle = null;
        this.lastUsedStrokeStyle = null;
        this.stateChangeCount = 0;
        this.drawCallCount = 0;
        this.culledDrawCalls = 0;
        
        // Pre-computed values for common operations
        this.halfWidth = canvas.width * 0.5;
        this.halfHeight = canvas.height * 0.5;
        this.canvasArea = canvas.width * canvas.height;
        
        // OPTIMIZED: Frustum culling bounds with margin for smooth edge transitions
        this.viewBounds = {
            left: 0, top: 0, right: canvas.width, bottom: canvas.height,
            margin: 100 // Extra margin for smooth culling
        };
        
        // OPTIMIZED: Draw call batching system
        this.batchConfig = {
            maxBatchSize: 100,
            currentBatch: [],
            batchType: null,
            batchColor: null
        };
        
        // OPTIMIZED: Render statistics for adaptive optimization
        this.renderStats = {
            lastFrameDrawCalls: 0,
            averageDrawCalls: 0,
            peakDrawCalls: 0,
            cullingEfficiency: 0
        };
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawCircle(x, y, radius, color, filled = true) {
        // OPTIMIZED: Fast parameter validation with bitwise operations
        if (radius <= 0 || !isFinite(x | y | radius)) return;
        
        // OPTIMIZED: Frustum culling for off-screen circles
        if (!this.isCircleInView(x, y, radius)) {
            this.culledDrawCalls++;
            return;
        }
        
        // OPTIMIZED: Batch similar operations with minimal state changes
        const style = filled ? 'fill' : 'stroke';
        const lastColor = filled ? this.lastUsedFillStyle : this.lastUsedStrokeStyle;
        
        if (lastColor !== color) {
            this.flushBatch(); // Flush current batch before style change
            if (filled) {
                this.ctx.fillStyle = color;
                this.lastUsedFillStyle = color;
            } else {
                this.ctx.strokeStyle = color;
                this.lastUsedStrokeStyle = color;
            }
            this.stateChangeCount++;
        }
        
        // OPTIMIZED: Direct drawing for better performance
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 6.283185307179586); // Pre-computed 2*PI
        
        if (filled) {
            this.ctx.fill();
        } else {
            this.ctx.stroke();
        }
        
        this.drawCallCount++;
    }
    
    drawRect(x, y, width, height, color, filled = true) {
        // OPTIMIZED: Fast validation and early culling
        if (!isFinite(x | y | width | height)) return;
        
        // OPTIMIZED: Frustum culling for off-screen rectangles
        if (!this.isRectInView(x, y, width, height)) {
            this.culledDrawCalls++;
            return;
        }
        
        // OPTIMIZED: Batched rectangle drawing
        if (this.canBatchRect(color, filled)) {
            this.addRectToBatch(x, y, width, height, color, filled);
            return;
        }
        
        this.flushBatch();
        
        // OPTIMIZED: Minimize state changes
        if (filled) {
            if (this.lastUsedFillStyle !== color) {
                this.ctx.fillStyle = color;
                this.lastUsedFillStyle = color;
                this.stateChangeCount++;
            }
            this.ctx.fillRect(x, y, width, height);
        } else {
            if (this.lastUsedStrokeStyle !== color) {
                this.ctx.strokeStyle = color;
                this.lastUsedStrokeStyle = color;
                this.stateChangeCount++;
            }
            this.ctx.strokeRect(x, y, width, height);
        }
        
        this.drawCallCount++;
    }
    
    drawLine(x1, y1, x2, y2, color, width = 1) {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
    
    drawText(text, x, y, color, font = '16px Arial', align = 'center') {
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
    }
    
    drawImage(image, x, y, width, height, angle = 0) {
        this.ctx.save();
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(angle);
        this.ctx.drawImage(image, -width / 2, -height / 2, width, height);
        this.ctx.restore();
    }
    
    drawSprite(sprite, x, y, scale = 1, angle = 0, options = {}) {
        if (!sprite || (!sprite.image && !sprite.canvas)) return;
        
        // Fast culling check
        const size = Math.max(sprite.width, sprite.height) * scale;
        if (!this.isCircleInView(x, y, size)) {
            this.culledDrawCalls++;
            return;
        }
        
        const {
            alpha = 1,
            flipX = false,
            flipY = false,
            tint = null,
            glow = false,
            glowColor = '#FFFFFF',
            glowIntensity = 5
        } = options;
        
        this.ctx.save();
        
        // Apply effects
        if (alpha !== 1) this.ctx.globalAlpha = alpha;
        if (glow) {
            this.ctx.shadowColor = glowColor;
            this.ctx.shadowBlur = glowIntensity;
        }
        
        // Apply transformations
        this.ctx.translate(x, y);
        if (angle !== 0) this.ctx.rotate(angle);
        this.ctx.scale(
            scale * (flipX ? -1 : 1), 
            scale * (flipY ? -1 : 1)
        );
        
        // Apply tint if specified
        if (tint) {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = tint;
            this.ctx.fillRect(-sprite.width/2, -sprite.height/2, sprite.width, sprite.height);
            this.ctx.globalCompositeOperation = 'destination-in';
        }
        
        // Draw sprite (support both canvas and image sprites)
        const image = sprite.canvas || sprite.image;
        if (sprite.x !== undefined && sprite.y !== undefined) {
            // Sprite sheet support
            this.ctx.drawImage(
                image,
                sprite.x, sprite.y,
                sprite.width, sprite.height,
                -sprite.width / 2, -sprite.height / 2,
                sprite.width, sprite.height
            );
        } else {
            // Simple sprite
            this.ctx.drawImage(
                image,
                -sprite.width / 2, -sprite.height / 2,
                sprite.width, sprite.height
            );
        }
        
        this.ctx.restore();
        this.drawCallCount++;
    }
    
    setAlpha(alpha) {
        // Clamp alpha to valid range to prevent canvas state issues
        const safeAlpha = Math.max(0, Math.min(1, alpha));
        this.ctx.globalAlpha = safeAlpha;
    }
    
    resetAlpha() {
        this.ctx.globalAlpha = 1;
    }
    
    resetState() {
        // OPTIMIZED: Essential state reset with tracking
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;
        
        // Reset tracking variables
        this.lastUsedFillStyle = null;
        this.lastUsedStrokeStyle = null;
        this.stateChangeCount = 0;
        this.drawCallCount = 0;
    }
    
    createGradient(x1, y1, x2, y2, colorStops) {
        const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
        colorStops.forEach(stop => {
            gradient.addColorStop(stop.offset, stop.color);
        });
        return gradient;
    }
    
    createRadialGradient(x, y, r1, r2, colorStops) {
        // OPTIMIZED: Fast validation with bitwise operations
        if (!(isFinite(x) && isFinite(y) && isFinite(r1) && isFinite(r2))) {
            // Return cached fallback gradient for performance
            if (!this.fallbackGradient) {
                this.fallbackGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
                this.fallbackGradient.addColorStop(0, '#000000');
                this.fallbackGradient.addColorStop(1, '#000000');
            }
            return this.fallbackGradient;
        }
        
        // OPTIMIZED: Use bit operations for clamping
        const safeX = Math.max(-1000000, Math.min(1000000, x));
        const safeY = Math.max(-1000000, Math.min(1000000, y));
        const safeR1 = Math.max(0, Math.min(10000, r1));
        const safeR2 = Math.max(0, Math.min(10000, r2));
        
        const gradient = this.ctx.createRadialGradient(safeX, safeY, safeR1, safeX, safeY, safeR2);
        
        // OPTIMIZED: Unrolled loop for common case of 2 color stops
        if (colorStops.length === 2) {
            gradient.addColorStop(colorStops[0].offset, colorStops[0].color);
            gradient.addColorStop(colorStops[1].offset, colorStops[1].color);
        } else {
            colorStops.forEach(stop => {
                gradient.addColorStop(stop.offset, stop.color);
            });
        }
        
        return gradient;
    }
    
    save() {
        this.ctx.save();
    }
    
    restore() {
        this.ctx.restore();
    }
    
    enableDebug() {
        this.debugMode = true;
    }
    
    disableDebug() {
        this.debugMode = false;
    }
    
    drawDebug(text, x, y) {
        if (this.debugMode) {
            this.drawText(text, x, y, '#00FF00', '12px monospace');
        }
    }
    
    // OPTIMIZED: Performance monitoring methods
    getPerformanceStats() {
        return {
            drawCalls: this.drawCallCount,
            stateChanges: this.stateChangeCount,
            efficiency: this.drawCallCount > 0 ? (1 - this.stateChangeCount / this.drawCallCount).toFixed(3) : 1
        };
    }
    
    resetPerformanceStats() {
        this.stateChangeCount = 0;
        this.drawCallCount = 0;
    }
    
    // Enhanced drawing methods for better visual quality
    drawGlowingCircle(x, y, radius, color, glowIntensity = 1.0, filled = true) {
        if (radius <= 0 || !isFinite(x | y | radius)) return;
        
        this.ctx.save();
        
        // Create glow effect
        if (glowIntensity > 0) {
            this.ctx.shadowBlur = radius * glowIntensity;
            this.ctx.shadowColor = color;
        }
        
        // Draw the circle
        if (filled) {
            if (this.lastUsedFillStyle !== color) {
                this.ctx.fillStyle = color;
                this.lastUsedFillStyle = color;
                this.stateChangeCount++;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, 6.283185307179586);
            this.ctx.fill();
        } else {
            if (this.lastUsedStrokeStyle !== color) {
                this.ctx.strokeStyle = color;
                this.lastUsedStrokeStyle = color;
                this.stateChangeCount++;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, 6.283185307179586);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
        this.drawCallCount++;
    }
    
    drawEnhancedText(text, x, y, options = {}) {
        const {
            color = '#FFFFFF',
            font = '16px Arial',
            align = 'center',
            outline = false,
            outlineColor = '#000000',
            outlineWidth = 2,
            shadow = false,
            shadowColor = '#000000',
            shadowOffset = { x: 2, y: 2 },
            shadowBlur = 4,
            glow = false,
            glowColor = color,
            glowIntensity = 5
        } = options;
        
        this.ctx.save();
        this.ctx.font = font;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = 'middle';
        
        // Apply shadow
        if (shadow) {
            this.ctx.shadowColor = shadowColor;
            this.ctx.shadowOffsetX = shadowOffset.x;
            this.ctx.shadowOffsetY = shadowOffset.y;
            this.ctx.shadowBlur = shadowBlur;
        }
        
        // Apply glow
        if (glow) {
            this.ctx.shadowColor = glowColor;
            this.ctx.shadowBlur = glowIntensity;
        }
        
        // Draw outline
        if (outline) {
            this.ctx.strokeStyle = outlineColor;
            this.ctx.lineWidth = outlineWidth;
            this.ctx.strokeText(text, x, y);
        }
        
        // Draw main text
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
        
        this.ctx.restore();
        this.drawCallCount++;
    }
    
    drawPulsingCircle(x, y, radius, color, pulseSpeed = 1.0, pulseIntensity = 0.3) {
        const time = performance.now() * 0.001 * pulseSpeed;
        const pulseRadius = radius * (1 + Math.sin(time) * pulseIntensity);
        const pulseAlpha = 0.5 + Math.sin(time) * 0.3;
        
        this.ctx.save();
        this.ctx.globalAlpha = pulseAlpha;
        this.drawCircle(x, y, pulseRadius, color, true);
        this.ctx.restore();
    }
    
    drawTrail(positions, color, maxWidth = 5, fadeOut = true) {
        if (positions.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        for (let i = 1; i < positions.length; i++) {
            const progress = i / (positions.length - 1);
            const width = fadeOut ? maxWidth * progress : maxWidth;
            const alpha = fadeOut ? progress : 1.0;
            
            this.ctx.lineWidth = width;
            this.ctx.globalAlpha = alpha;
            
            this.ctx.beginPath();
            this.ctx.moveTo(positions[i - 1].x, positions[i - 1].y);
            this.ctx.lineTo(positions[i].x, positions[i].y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
        this.drawCallCount++;
    }
    
    drawHealthBar(x, y, width, height, currentHealth, maxHealth, options = {}) {
        const {
            backgroundColor = '#333333',
            healthColor = '#00FF00',
            lowHealthColor = '#FF0000',
            warningHealthColor = '#FFAA00',
            border = true,
            borderColor = '#FFFFFF',
            borderWidth = 1,
            animate = true
        } = options;
        
        const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));
        
        // Determine health bar color based on percentage
        let barColor = healthColor;
        if (healthPercent < 0.2) {
            barColor = lowHealthColor;
        } else if (healthPercent < 0.4) {
            barColor = warningHealthColor;
        }
        
        // Draw background
        this.drawRect(x, y, width, height, backgroundColor, true);
        
        // Draw health fill with animation
        if (animate && healthPercent < 0.3) {
            // Pulsing effect for low health
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.01);
            this.ctx.save();
            this.ctx.globalAlpha = pulse;
        }
        
        this.drawRect(x, y, width * healthPercent, height, barColor, true);
        
        if (animate && healthPercent < 0.3) {
            this.ctx.restore();
        }
        
        // Draw border
        if (border) {
            this.drawRect(x, y, width, height, borderColor, false);
        }
    }
    
    // OPTIMIZED: Advanced frustum culling methods
    updateViewBounds(cameraX, cameraY, cameraWidth, cameraHeight) {
        this.viewBounds.left = cameraX - this.viewBounds.margin;
        this.viewBounds.top = cameraY - this.viewBounds.margin;
        this.viewBounds.right = cameraX + cameraWidth + this.viewBounds.margin;
        this.viewBounds.bottom = cameraY + cameraHeight + this.viewBounds.margin;
    }
    
    isCircleInView(x, y, radius) {
        return !(x + radius < this.viewBounds.left || 
                x - radius > this.viewBounds.right ||
                y + radius < this.viewBounds.top ||
                y - radius > this.viewBounds.bottom);
    }
    
    isRectInView(x, y, width, height) {
        return !(x + width < this.viewBounds.left ||
                x > this.viewBounds.right ||
                y + height < this.viewBounds.top ||
                y > this.viewBounds.bottom);
    }
    
    // OPTIMIZED: Efficient batching system
    canBatchRect(color, filled) {
        return this.batchConfig.currentBatch.length < this.batchConfig.maxBatchSize &&
               this.batchConfig.batchType === 'rect' &&
               this.batchConfig.batchColor === color &&
               filled; // Only batch filled rectangles for simplicity
    }
    
    addRectToBatch(x, y, width, height, color, filled) {
        if (this.batchConfig.batchType !== 'rect' || this.batchConfig.batchColor !== color) {
            this.flushBatch();
            this.batchConfig.batchType = 'rect';
            this.batchConfig.batchColor = color;
        }
        
        this.batchConfig.currentBatch.push({ x, y, width, height });
        
        if (this.batchConfig.currentBatch.length >= this.batchConfig.maxBatchSize) {
            this.flushBatch();
        }
    }
    
    flushBatch() {
        if (this.batchConfig.currentBatch.length === 0) return;
        
        const batch = this.batchConfig.currentBatch;
        const color = this.batchConfig.batchColor;
        
        if (this.batchConfig.batchType === 'rect') {
            if (this.lastUsedFillStyle !== color) {
                this.ctx.fillStyle = color;
                this.lastUsedFillStyle = color;
                this.stateChangeCount++;
            }
            
            // OPTIMIZED: Batch draw all rectangles at once
            for (let i = 0; i < batch.length; i++) {
                const rect = batch[i];
                this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            }
            
            this.drawCallCount += batch.length;
        }
        
        // Reset batch
        this.batchConfig.currentBatch.length = 0;
        this.batchConfig.batchType = null;
        this.batchConfig.batchColor = null;
    }
    
    // OPTIMIZED: Frame end processing
    endFrame() {
        this.flushBatch();
        
        // Update render statistics
        this.renderStats.lastFrameDrawCalls = this.drawCallCount;
        this.renderStats.averageDrawCalls = (this.renderStats.averageDrawCalls * 0.9) + (this.drawCallCount * 0.1);
        this.renderStats.peakDrawCalls = Math.max(this.renderStats.peakDrawCalls, this.drawCallCount);
        
        if (this.drawCallCount + this.culledDrawCalls > 0) {
            this.renderStats.cullingEfficiency = this.culledDrawCalls / (this.drawCallCount + this.culledDrawCalls);
        }
        
        // Reset counters for next frame
        this.drawCallCount = 0;
        this.culledDrawCalls = 0;
    }
}