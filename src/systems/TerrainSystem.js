import { TerrainRenderer } from '../core/TerrainRenderer.js';

export class TerrainSystem {
    constructor(game) {
        this.game = game;
        this.name = 'TerrainSystem';
        
        this.terrainRenderer = new TerrainRenderer(game.renderer, game.camera);
        
        // Simple boundary settings
        this.worldBounds = this.terrainRenderer.getWorldBounds();
        
        console.log('🌍 TerrainSystem initialized with simple boundaries');
    }
    
    update(deltaTime) {
        if (!this.game.player) return;
        
        // Simple boundary enforcement - just keep player in bounds
        this.enforceBoundaries();
        
        // Update terrain quality based on performance
        if (this.game.performanceStats && this.game.performanceStats.fps) {
            this.terrainRenderer.adaptQuality(this.game.performanceStats.fps);
        }
    }
    
    render(renderer) {
        // Render the terrain background
        this.terrainRenderer.render(this.game.camera);
    }
    
    enforceBoundaries() {
        const player = this.game.player;
        if (!player) return;
        
        const worldBounds = this.terrainRenderer.getWorldBounds();
        const pushDistance = 150; // Increased push distance for smoother feel
        const pushForce = 0.8; // Stronger pushback
        
        // Calculate distances to each boundary
        const distanceToLeft = player.x - worldBounds.left;
        const distanceToRight = worldBounds.right - player.x;
        const distanceToTop = player.y - worldBounds.top;
        const distanceToBottom = worldBounds.bottom - player.y;
        
        // Soft push-back system instead of hard stops
        let pushX = 0;
        let pushY = 0;
        let hitBoundary = false;
        
        // Left boundary
        if (distanceToLeft < pushDistance) {
            const pushStrength = (pushDistance - distanceToLeft) / pushDistance;
            pushX += pushStrength * pushForce * 8;
            if (distanceToLeft < 50) hitBoundary = true;
        }
        
        // Right boundary
        if (distanceToRight < pushDistance) {
            const pushStrength = (pushDistance - distanceToRight) / pushDistance;
            pushX -= pushStrength * pushForce * 8;
            if (distanceToRight < 50) hitBoundary = true;
        }
        
        // Top boundary
        if (distanceToTop < pushDistance) {
            const pushStrength = (pushDistance - distanceToTop) / pushDistance;
            pushY += pushStrength * pushForce * 8;
            if (distanceToTop < 50) hitBoundary = true;
        }
        
        // Bottom boundary
        if (distanceToBottom < pushDistance) {
            const pushStrength = (pushDistance - distanceToBottom) / pushDistance;
            pushY -= pushStrength * pushForce * 8;
            if (distanceToBottom < 50) hitBoundary = true;
        }
        
        // Apply gradual pushback and add visual feedback
        if (pushX !== 0 || pushY !== 0) {
            player.x += pushX;
            player.y += pushY;
            
            // Reduce velocity in the direction of boundaries instead of stopping completely
            if (pushX !== 0) {
                player.velocity.x *= 0.3; // More noticeable slowdown
            }
            if (pushY !== 0) {
                player.velocity.y *= 0.3; // More noticeable slowdown
            }
            
            // Add screen shake when hitting boundary
            if (hitBoundary && this.game.camera) {
                this.game.camera.addShake(5, 0.2);
            }
            
            // Create particle effect when hitting boundary
            if (hitBoundary && this.game.systems.particles) {
                this.game.systems.particles.createImpactEffect(
                    player.x, player.y, 
                    '#FF6060', 8, 150
                );
            }
        }
        
        // Hard boundary enforcement as absolute last resort
        const result = this.terrainRenderer.checkBoundaryCollision(player.x, player.y, player.size);
        if (result.hitBoundary) {
            const oldX = player.x;
            const oldY = player.y;
            
            player.x = result.position.x;
            player.y = result.position.y;
            
            // Strong camera shake for hard boundary hit
            if (this.game.camera) {
                this.game.camera.addShake(12, 0.4);
            }
            
            // Create bigger particle effect for hard boundary hit
            if (this.game.systems.particles) {
                this.game.systems.particles.createImpactEffect(
                    player.x, player.y, 
                    '#FF3030', 15, 200
                );
            }
            
            // Only reduce velocity in the direction that was corrected
            if (Math.abs(oldX - result.position.x) > 0.1) {
                player.velocity.x = 0; // Stop horizontal movement
            }
            if (Math.abs(oldY - result.position.y) > 0.1) {
                player.velocity.y = 0; // Stop vertical movement
            }
            
            console.log(`🚫 Boundary collision at (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
        }
    }
    
    // Simple method to check if position is valid (no obstacles)
    isPositionValid(x, y) {
        return this.terrainRenderer.isInBounds(x, y, 20);
    }
    
    // Get world boundaries
    getWorldBounds() {
        return this.worldBounds;
    }
    
    // Reset method for game restart
    reset() {
        // Nothing to reset in simple terrain system
        console.log('🌍 TerrainSystem reset');
    }
}