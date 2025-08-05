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
        
        // ENHANCED: Super visible boundary walls - always render regardless of camera position
        ctx.strokeStyle = '#FF3030'; // Bright red for maximum visibility
        ctx.lineWidth = 12; // Even thicker
        ctx.globalAlpha = 1.0; // Fully opaque
        ctx.shadowColor = '#FF3030';
        ctx.shadowBlur = 15;
        
        // Draw all four boundaries as continuous walls
        ctx.beginPath();
        
        // Left boundary (vertical line)
        ctx.moveTo(-worldHalfWidth, -worldHalfHeight);
        ctx.lineTo(-worldHalfWidth, worldHalfHeight);
        
        // Top boundary (horizontal line)
        ctx.moveTo(-worldHalfWidth, -worldHalfHeight);
        ctx.lineTo(worldHalfWidth, -worldHalfHeight);
        
        // Right boundary (vertical line)
        ctx.moveTo(worldHalfWidth, -worldHalfHeight);
        ctx.lineTo(worldHalfWidth, worldHalfHeight);
        
        // Bottom boundary (horizontal line)
        ctx.moveTo(-worldHalfWidth, worldHalfHeight);
        ctx.lineTo(worldHalfWidth, worldHalfHeight);
        
        ctx.stroke();
        
        // Add animated warning zones for better UX
        const playerX = camera.x;
        const playerY = camera.y;
        const warningDistance = 200; // Increased warning distance
        
        const distanceToLeft = playerX + worldHalfWidth;
        const distanceToRight = worldHalfWidth - playerX;
        const distanceToTop = playerY + worldHalfHeight;
        const distanceToBottom = worldHalfHeight - playerY;
        
        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
        
        // Enhanced warning system
        if (minDistance < warningDistance) {
            const intensity = 1 - (minDistance / warningDistance);
            const pulseTime = performance.now() * 0.005;
            const pulseAlpha = (Math.sin(pulseTime) * 0.3 + 0.7) * intensity * 0.4;
            
            // Screen edge warning overlay
            ctx.fillStyle = `rgba(255, 48, 48, ${pulseAlpha})`;
            
            // Draw warning zones on screen edges based on which boundary is closest
            if (distanceToLeft === minDistance) {
                // Left edge warning
                const screenLeft = camera.x - camera.width/2;
                ctx.fillRect(screenLeft, camera.y - camera.height/2, 50, camera.height);
            }
            if (distanceToRight === minDistance) {
                // Right edge warning
                const screenRight = camera.x + camera.width/2 - 50;
                ctx.fillRect(screenRight, camera.y - camera.height/2, 50, camera.height);
            }
            if (distanceToTop === minDistance) {
                // Top edge warning
                const screenTop = camera.y - camera.height/2;
                ctx.fillRect(camera.x - camera.width/2, screenTop, camera.width, 50);
            }
            if (distanceToBottom === minDistance) {
                // Bottom edge warning
                const screenBottom = camera.y + camera.height/2 - 50;
                ctx.fillRect(camera.x - camera.width/2, screenBottom, camera.width, 50);
            }
            
            // Enhanced boundary glow when very close
            if (minDistance < 100) {
                const glowIntensity = Math.sin(pulseTime * 2) * 0.5 + 1.0;
                ctx.shadowColor = '#FF6060';
                ctx.shadowBlur = 25 * glowIntensity;
                ctx.strokeStyle = '#FF1010';
                ctx.lineWidth = 16;
                
                // Redraw the closest boundary section with extra emphasis
                ctx.beginPath();
                if (distanceToLeft === minDistance) {
                    ctx.moveTo(-worldHalfWidth, playerY - 200);
                    ctx.lineTo(-worldHalfWidth, playerY + 200);
                } else if (distanceToRight === minDistance) {
                    ctx.moveTo(worldHalfWidth, playerY - 200);
                    ctx.lineTo(worldHalfWidth, playerY + 200);
                } else if (distanceToTop === minDistance) {
                    ctx.moveTo(playerX - 200, -worldHalfHeight);
                    ctx.lineTo(playerX + 200, -worldHalfHeight);
                } else if (distanceToBottom === minDistance) {
                    ctx.moveTo(playerX - 200, worldHalfHeight);
                    ctx.lineTo(playerX + 200, worldHalfHeight);
                }
                ctx.stroke();
            }
        }
        
        // Add corner indicators for better spatial awareness
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FF4040';
        const cornerSize = 30;
        
        // Four corner markers
        ctx.fillRect(-worldHalfWidth - cornerSize/2, -worldHalfHeight - cornerSize/2, cornerSize, cornerSize);
        ctx.fillRect(worldHalfWidth - cornerSize/2, -worldHalfHeight - cornerSize/2, cornerSize, cornerSize);
        ctx.fillRect(-worldHalfWidth - cornerSize/2, worldHalfHeight - cornerSize/2, cornerSize, cornerSize);
        ctx.fillRect(worldHalfWidth - cornerSize/2, worldHalfHeight - cornerSize/2, cornerSize, cornerSize);
        
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