export class TerrainRenderer {
    constructor(renderer, camera) {
        this.renderer = renderer;
        this.camera = camera;
        this.ctx = renderer.ctx;
        
        // Simple, efficient settings
        this.tileSize = 64;
        this.worldWidth = 4000;
        this.worldHeight = 4000;
        
        // Performance flags
        this.qualityLevel = 'high';
        this.lastPerformanceCheck = 0;
        
        console.log('🏰 Simple TerrainRenderer initialized');
    }
    
    adaptQuality(fps) {
        const now = performance.now();
        if (now - this.lastPerformanceCheck < 1000) return;
        
        this.lastPerformanceCheck = now;
        
        if (fps < 45) {
            this.qualityLevel = 'low';
        } else if (fps < 55) {
            this.qualityLevel = 'medium';
        } else {
            this.qualityLevel = 'high';
        }
    }
    
    render(camera) {
        this.renderBackground(camera);
        this.renderBoundaries(camera);
    }
    
    renderBackground(camera) {
        const ctx = this.ctx;
        ctx.save();
        
        // Dark stone background
        const gradient = ctx.createRadialGradient(
            camera.x, camera.y, 0,
            camera.x, camera.y, 800
        );
        gradient.addColorStop(0, '#2c2c3e');
        gradient.addColorStop(0.6, '#1e1e2d');
        gradient.addColorStop(1, '#141422');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
            camera.x - camera.width,
            camera.y - camera.height,
            camera.width * 2,
            camera.height * 2
        );
        
        // Simple stone tile grid (if high quality)
        if (this.qualityLevel === 'high') {
            this.renderStoneGrid(camera);
        }
        
        ctx.restore();
    }
    
    renderStoneGrid(camera) {
        const ctx = this.ctx;
        const tileSize = this.tileSize;
        
        // Calculate visible tile range
        const startX = Math.floor((camera.x - camera.width/2) / tileSize) * tileSize;
        const endX = startX + camera.width + tileSize * 2;
        const startY = Math.floor((camera.y - camera.height/2) / tileSize) * tileSize;
        const endY = startY + camera.height + tileSize * 2;
        
        ctx.strokeStyle = '#1a1a2a';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        
        // Vertical lines
        for (let x = startX; x <= endX; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
    }
    
    renderBoundaries(camera) {
        const ctx = this.ctx;
        const worldHalfWidth = this.worldWidth / 2;
        const worldHalfHeight = this.worldHeight / 2;
        
        ctx.save();
        
        // Always draw visible map boundaries
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([20, 10]); // Dashed line for visibility
        
        // Draw the map boundary rectangle
        ctx.strokeRect(
            -worldHalfWidth, 
            -worldHalfHeight, 
            this.worldWidth, 
            this.worldHeight
        );
        
        // Add corner markers for better visibility
        ctx.fillStyle = 'rgba(255, 150, 150, 0.8)';
        const markerSize = 20;
        
        // Top-left corner
        ctx.fillRect(-worldHalfWidth - 5, -worldHalfHeight - 5, markerSize, 5);
        ctx.fillRect(-worldHalfWidth - 5, -worldHalfHeight - 5, 5, markerSize);
        
        // Top-right corner
        ctx.fillRect(worldHalfWidth - markerSize + 5, -worldHalfHeight - 5, markerSize, 5);
        ctx.fillRect(worldHalfWidth, -worldHalfHeight - 5, 5, markerSize);
        
        // Bottom-left corner
        ctx.fillRect(-worldHalfWidth - 5, worldHalfHeight, markerSize, 5);
        ctx.fillRect(-worldHalfWidth - 5, worldHalfHeight - markerSize + 5, 5, markerSize);
        
        // Bottom-right corner
        ctx.fillRect(worldHalfWidth - markerSize + 5, worldHalfHeight, markerSize, 5);
        ctx.fillRect(worldHalfWidth, worldHalfHeight - markerSize + 5, 5, markerSize);
        
        // Calculate player distance to boundaries for warning effect
        const playerX = camera.x;
        const playerY = camera.y;
        const warningDistance = 300; // Increased warning distance
        
        const distanceToLeft = playerX + worldHalfWidth;
        const distanceToRight = worldHalfWidth - playerX;
        const distanceToTop = playerY + worldHalfHeight;
        const distanceToBottom = worldHalfHeight - playerY;
        
        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
        
        // Show stronger warning effect when close to boundary
        if (minDistance < warningDistance) {
            const intensity = 1 - (minDistance / warningDistance);
            const pulseTime = performance.now() * 0.003;
            const pulseAlpha = (Math.sin(pulseTime) * 0.3 + 0.5) * intensity;
            
            ctx.setLineDash([]); // Reset line dash for warning zone
            
            // Draw warning zones on edges player is approaching
            ctx.fillStyle = `rgba(255, 50, 50, ${pulseAlpha * 0.3})`;
            ctx.strokeStyle = `rgba(255, 100, 100, ${pulseAlpha})`;
            ctx.lineWidth = 2;
            
            const edgeThickness = 50;
            
            if (distanceToLeft === minDistance) {
                ctx.fillRect(-worldHalfWidth, -worldHalfHeight, edgeThickness, this.worldHeight);
                ctx.strokeRect(-worldHalfWidth, -worldHalfHeight, edgeThickness, this.worldHeight);
            }
            if (distanceToRight === minDistance) {
                ctx.fillRect(worldHalfWidth - edgeThickness, -worldHalfHeight, edgeThickness, this.worldHeight);
                ctx.strokeRect(worldHalfWidth - edgeThickness, -worldHalfHeight, edgeThickness, this.worldHeight);
            }
            if (distanceToTop === minDistance) {
                ctx.fillRect(-worldHalfWidth, -worldHalfHeight, this.worldWidth, edgeThickness);
                ctx.strokeRect(-worldHalfWidth, -worldHalfHeight, this.worldWidth, edgeThickness);
            }
            if (distanceToBottom === minDistance) {
                ctx.fillRect(-worldHalfWidth, worldHalfHeight - edgeThickness, this.worldWidth, edgeThickness);
                ctx.strokeRect(-worldHalfWidth, worldHalfHeight - edgeThickness, this.worldWidth, edgeThickness);
            }
        }
        
        ctx.restore();
    }
    
    // Boundary collision check
    checkBoundaryCollision(x, y, radius = 20) {
        const worldHalfWidth = this.worldWidth / 2;
        const worldHalfHeight = this.worldHeight / 2;
        
        const correctedPos = { x: x, y: y };
        let hitBoundary = false;
        
        if (x - radius < -worldHalfWidth) {
            correctedPos.x = -worldHalfWidth + radius;
            hitBoundary = true;
        } else if (x + radius > worldHalfWidth) {
            correctedPos.x = worldHalfWidth - radius;
            hitBoundary = true;
        }
        
        if (y - radius < -worldHalfHeight) {
            correctedPos.y = -worldHalfHeight + radius;
            hitBoundary = true;
        } else if (y + radius > worldHalfHeight) {
            correctedPos.y = worldHalfHeight - radius;
            hitBoundary = true;
        }
        
        return { position: correctedPos, hitBoundary };
    }
    
    isInBounds(x, y, margin = 0) {
        const worldHalfWidth = this.worldWidth / 2;
        const worldHalfHeight = this.worldHeight / 2;
        
        return x >= -worldHalfWidth + margin && 
               x <= worldHalfWidth - margin &&
               y >= -worldHalfHeight + margin && 
               y <= worldHalfHeight - margin;
    }
    
    getWorldBounds() {
        return {
            left: -this.worldWidth / 2,
            right: this.worldWidth / 2,
            top: -this.worldHeight / 2,
            bottom: this.worldHeight / 2
        };
    }
}