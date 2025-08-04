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
        
        // IMPROVED: Always visible boundary walls with thick, clear lines
        const viewLeft = camera.x - camera.width/2 - 200;
        const viewRight = camera.x + camera.width/2 + 200;
        const viewTop = camera.y - camera.height/2 - 200;
        const viewBottom = camera.y + camera.height/2 + 200;
        
        // Draw thick, clearly visible boundary walls
        ctx.strokeStyle = '#FF6B47'; // Bright orange-red for visibility
        ctx.lineWidth = 8; // Much thicker
        ctx.globalAlpha = 1.0; // Fully opaque
        
        // Left boundary - always draw if in view
        if (viewLeft < -worldHalfWidth + 200) {
            ctx.beginPath();
            ctx.moveTo(-worldHalfWidth, Math.max(viewTop, -worldHalfHeight));
            ctx.lineTo(-worldHalfWidth, Math.min(viewBottom, worldHalfHeight));
            ctx.stroke();
        }
        
        // Right boundary
        if (viewRight > worldHalfWidth - 200) {
            ctx.beginPath();
            ctx.moveTo(worldHalfWidth, Math.max(viewTop, -worldHalfHeight));
            ctx.lineTo(worldHalfWidth, Math.min(viewBottom, worldHalfHeight));
            ctx.stroke();
        }
        
        // Top boundary
        if (viewTop < -worldHalfHeight + 200) {
            ctx.beginPath();
            ctx.moveTo(Math.max(viewLeft, -worldHalfWidth), -worldHalfHeight);
            ctx.lineTo(Math.min(viewRight, worldHalfWidth), -worldHalfHeight);
            ctx.stroke();
        }
        
        // Bottom boundary
        if (viewBottom > worldHalfHeight - 200) {
            ctx.beginPath();
            ctx.moveTo(Math.max(viewLeft, -worldHalfWidth), worldHalfHeight);
            ctx.lineTo(Math.min(viewRight, worldHalfWidth), worldHalfHeight);
            ctx.stroke();
        }
        
        // IMPROVED: Add warning zone with gradient when getting close
        const playerX = camera.x;
        const playerY = camera.y;
        const warningDistance = 150;
        
        const distanceToLeft = playerX + worldHalfWidth;
        const distanceToRight = worldHalfWidth - playerX;
        const distanceToTop = playerY + worldHalfHeight;
        const distanceToBottom = worldHalfHeight - playerY;
        
        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
        
        if (minDistance < warningDistance) {
            // Create warning gradient overlay
            const intensity = 1 - (minDistance / warningDistance);
            const gradient = ctx.createRadialGradient(
                playerX, playerY, 50,
                playerX, playerY, 300
            );
            gradient.addColorStop(0, `rgba(255, 107, 71, 0)`);
            gradient.addColorStop(1, `rgba(255, 107, 71, ${intensity * 0.2})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(
                playerX - 400, playerY - 400,
                800, 800
            );
            
            // Add pulsing boundary glow for extra visibility
            if (minDistance < 50) {
                const pulseIntensity = Math.sin(performance.now() * 0.01) * 0.3 + 0.7;
                ctx.shadowColor = '#FF6B47';
                ctx.shadowBlur = 20 * pulseIntensity;
                
                // Redraw the closest boundary with glow
                ctx.strokeStyle = '#FF6B47';
                ctx.lineWidth = 12;
                
                if (distanceToLeft === minDistance) {
                    ctx.beginPath();
                    ctx.moveTo(-worldHalfWidth, playerY - 100);
                    ctx.lineTo(-worldHalfWidth, playerY + 100);
                    ctx.stroke();
                } else if (distanceToRight === minDistance) {
                    ctx.beginPath();
                    ctx.moveTo(worldHalfWidth, playerY - 100);
                    ctx.lineTo(worldHalfWidth, playerY + 100);
                    ctx.stroke();
                } else if (distanceToTop === minDistance) {
                    ctx.beginPath();
                    ctx.moveTo(playerX - 100, -worldHalfHeight);
                    ctx.lineTo(playerX + 100, -worldHalfHeight);
                    ctx.stroke();
                } else if (distanceToBottom === minDistance) {
                    ctx.beginPath();
                    ctx.moveTo(playerX - 100, worldHalfHeight);
                    ctx.lineTo(playerX + 100, worldHalfHeight);
                    ctx.stroke();
                }
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