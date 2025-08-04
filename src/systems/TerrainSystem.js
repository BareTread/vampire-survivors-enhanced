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
        const pushDistance = 100; // Distance from boundary to start pushing back
        const pushForce = 0.7; // How strong the pushback is
        
        // Calculate distances to each boundary
        const distanceToLeft = player.x - worldBounds.left;
        const distanceToRight = worldBounds.right - player.x;
        const distanceToTop = player.y - worldBounds.top;
        const distanceToBottom = worldBounds.bottom - player.y;
        
        // Soft push-back system instead of hard stops
        let pushX = 0;
        let pushY = 0;
        
        // Left boundary
        if (distanceToLeft < pushDistance) {
            const pushStrength = (pushDistance - distanceToLeft) / pushDistance;
            pushX += pushStrength * pushForce * 5;
        }
        
        // Right boundary
        if (distanceToRight < pushDistance) {
            const pushStrength = (pushDistance - distanceToRight) / pushDistance;
            pushX -= pushStrength * pushForce * 5;
        }
        
        // Top boundary
        if (distanceToTop < pushDistance) {
            const pushStrength = (pushDistance - distanceToTop) / pushDistance;
            pushY += pushStrength * pushForce * 5;
        }
        
        // Bottom boundary
        if (distanceToBottom < pushDistance) {
            const pushStrength = (pushDistance - distanceToBottom) / pushDistance;
            pushY -= pushStrength * pushForce * 5;
        }
        
        // Apply gradual pushback instead of hard stops
        if (pushX !== 0 || pushY !== 0) {
            player.x += pushX;
            player.y += pushY;
            
            // Reduce velocity in the direction of boundaries instead of stopping completely
            if (pushX !== 0) {
                player.velocity.x *= 0.5; // Reduce X velocity instead of zeroing
            }
            if (pushY !== 0) {
                player.velocity.y *= 0.5; // Reduce Y velocity instead of zeroing
            }
        }
        
        // Hard boundary enforcement as absolute last resort (but still allow some movement)
        const result = this.terrainRenderer.checkBoundaryCollision(player.x, player.y, player.size);
        if (result.hitBoundary) {
            // DEBUG: Log when boundaries are hit to track invisible obstacle issue
            if (Math.abs(player.x) < 1900 && Math.abs(player.y) < 1900) {
                console.log(`Unexpected boundary hit at (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) - should be safe zone`);
            }
            
            const oldX = player.x;
            const oldY = player.y;
            
            player.x = result.position.x;
            player.y = result.position.y;
            
            // Only reduce velocity in the direction that was corrected
            if (Math.abs(oldX - result.position.x) > 0.1) {
                player.velocity.x *= 0.1; // Hit horizontal boundary
            }
            if (Math.abs(oldY - result.position.y) > 0.1) {
                player.velocity.y *= 0.1; // Hit vertical boundary
            }
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