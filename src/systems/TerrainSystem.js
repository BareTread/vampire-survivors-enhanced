import { TerrainRenderer } from '../core/TerrainRenderer.js';

export class TerrainSystem {
    constructor(game) {
        this.game = game;
        this.name = 'TerrainSystem';

        this.terrainRenderer = new TerrainRenderer(game.renderer, game.camera);

        // Simple boundary settings
        this.worldBounds = this.terrainRenderer.getWorldBounds();

        // Environmental obstacles
        this.obstacles = [];
        this.worldSeed = Date.now();
        this.generateObstacles();

        console.log(`🌍 TerrainSystem initialized with ${this.obstacles.length} obstacles`);
    }

    generateObstacles() {
        this.obstacles = [];
        const bounds = this.worldBounds;
        const margin = 200; // Stay away from world edges
        const centerClear = 300; // Keep spawn area clear
        const minSpacing = 60; // Minimum distance between obstacles

        // Seeded pseudo-random for reproducible layouts
        let seed = this.worldSeed;
        const seededRandom = () => {
            seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
            return (seed >>> 0) / 0xFFFFFFFF;
        };

        const obstacleTypes = [
            { type: 'rock', radius: 18, weight: 4 },
            { type: 'tombstone', radius: 12, weight: 3 },
            { type: 'deadTree', radius: 15, weight: 2 },
            { type: 'ruinedWall', radius: 25, weight: 1 }
        ];

        const totalWeight = obstacleTypes.reduce((s, t) => s + t.weight, 0);
        const targetCount = 40;
        let attempts = 0;
        const maxAttempts = 200;

        while (this.obstacles.length < targetCount && attempts < maxAttempts) {
            attempts++;

            const x = bounds.left + margin + seededRandom() * (bounds.right - bounds.left - margin * 2);
            const y = bounds.top + margin + seededRandom() * (bounds.bottom - bounds.top - margin * 2);

            // Skip center spawn area
            if (x * x + y * y < centerClear * centerClear) continue;

            // Pick type by weighted random
            let roll = seededRandom() * totalWeight;
            let chosen = obstacleTypes[0];
            for (const ot of obstacleTypes) {
                roll -= ot.weight;
                if (roll <= 0) { chosen = ot; break; }
            }

            // Check spacing with existing obstacles
            let tooClose = false;
            for (const obs of this.obstacles) {
                const dx = x - obs.x;
                const dy = y - obs.y;
                if (dx * dx + dy * dy < minSpacing * minSpacing) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            this.obstacles.push({
                x, y,
                type: chosen.type,
                radius: chosen.radius,
                seed: seededRandom() // Per-instance visual variation
            });
        }
    }

    update(deltaTime) {
        if (!this.game.player) return;

        // Push player out of obstacles
        this.pushOutOfObstacles(this.game.player);

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

        // Render obstacles on top of terrain, within camera view
        this.renderObstacles(renderer.ctx);
    }

    renderObstacles(ctx) {
        const cam = this.game.camera;
        if (!cam) return;

        // Frustum cull: only render obstacles visible in camera + margin
        const margin = 100;
        const vl = cam.x - cam.width / 2 - margin;
        const vr = cam.x + cam.width / 2 + margin;
        const vt = cam.y - cam.height / 2 - margin;
        const vb = cam.y + cam.height / 2 + margin;

        for (const obs of this.obstacles) {
            if (obs.x < vl || obs.x > vr || obs.y < vt || obs.y > vb) continue;

            switch (obs.type) {
                case 'rock':
                    this.renderRock(ctx, obs);
                    break;
                case 'tombstone':
                    this.renderTombstone(ctx, obs);
                    break;
                case 'deadTree':
                    this.renderDeadTree(ctx, obs);
                    break;
                case 'ruinedWall':
                    this.renderRuinedWall(ctx, obs);
                    break;
            }
        }
    }

    renderRock(ctx, obs) {
        const r = obs.radius;
        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(obs.x + 3, obs.y + 4, r * 1.1, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main rock body — irregular shape
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        const points = 7;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const variation = 0.8 + obs.seed * 0.4 * Math.sin(angle * 3 + obs.seed * 10);
            const px = obs.x + Math.cos(angle) * r * variation;
            const py = obs.y + Math.sin(angle) * r * variation * 0.85;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Lighter highlight on top-left
        ctx.fillStyle = '#777777';
        ctx.beginPath();
        ctx.arc(obs.x - r * 0.2, obs.y - r * 0.2, r * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderTombstone(ctx, obs) {
        const r = obs.radius;
        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(obs.x - r * 0.5 + 2, obs.y - r * 0.3 + 3, r, r * 1.4);

        // Tombstone body
        ctx.fillStyle = '#6B6B6B';
        ctx.fillRect(obs.x - r * 0.5, obs.y - r * 0.3, r, r * 1.3);

        // Rounded top
        ctx.beginPath();
        ctx.arc(obs.x, obs.y - r * 0.3, r * 0.5, Math.PI, 0);
        ctx.fill();

        // Cross engraving
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - r * 0.6);
        ctx.lineTo(obs.x, obs.y + r * 0.3);
        ctx.moveTo(obs.x - r * 0.25, obs.y - r * 0.2);
        ctx.lineTo(obs.x + r * 0.25, obs.y - r * 0.2);
        ctx.stroke();

        ctx.restore();
    }

    renderDeadTree(ctx, obs) {
        const r = obs.radius;
        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(obs.x + 3, obs.y + r * 0.8, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(obs.x - 3, obs.y - r * 0.5, 6, r * 1.3);

        // Branches (bare, no leaves — dead tree)
        ctx.strokeStyle = '#4E342E';
        ctx.lineWidth = 2;
        // Left branch
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - r * 0.3);
        ctx.lineTo(obs.x - r * 0.7, obs.y - r * 0.9);
        ctx.stroke();
        // Right branch
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y - r * 0.5);
        ctx.lineTo(obs.x + r * 0.6, obs.y - r * 1.0);
        ctx.stroke();
        // Small twig
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(obs.x - r * 0.7, obs.y - r * 0.9);
        ctx.lineTo(obs.x - r * 0.5, obs.y - r * 1.1);
        ctx.stroke();

        ctx.restore();
    }

    renderRuinedWall(ctx, obs) {
        const r = obs.radius;
        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(obs.x - r * 0.8 + 3, obs.y - r * 0.2 + 3, r * 1.6, r * 0.7);

        // Stone blocks at varying heights
        const blocks = [
            { ox: -r * 0.7, h: r * 0.9, w: r * 0.5 },
            { ox: -r * 0.15, h: r * 1.2, w: r * 0.4 },
            { ox: r * 0.3, h: r * 0.6, w: r * 0.5 }
        ];

        for (const block of blocks) {
            const bx = obs.x + block.ox;
            const by = obs.y + r * 0.3 - block.h;

            // Main block
            ctx.fillStyle = '#7B7B7B';
            ctx.fillRect(bx, by, block.w, block.h);

            // Mortar lines
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 0.5;
            const rows = Math.floor(block.h / 8);
            for (let i = 1; i < rows; i++) {
                ctx.beginPath();
                ctx.moveTo(bx, by + i * 8);
                ctx.lineTo(bx + block.w, by + i * 8);
                ctx.stroke();
            }

            // Top highlight
            ctx.fillStyle = '#8E8E8E';
            ctx.fillRect(bx, by, block.w, 2);
        }

        ctx.restore();
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
                this.game.camera.shake(5, 0.2);
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
                this.game.camera.shake(12, 0.4);
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

    // Check if position is valid (in bounds and not inside obstacles)
    isPositionValid(x, y, entityRadius = 0) {
        if (!this.terrainRenderer.isInBounds(x, y, 20)) return false;
        for (const obs of this.obstacles) {
            const dx = x - obs.x;
            const dy = y - obs.y;
            if (dx * dx + dy * dy < (obs.radius + entityRadius) ** 2) return false;
        }
        return true;
    }

    // Push entity out of any overlapping obstacles
    pushOutOfObstacles(entity) {
        for (const obs of this.obstacles) {
            const dx = entity.x - obs.x;
            const dy = entity.y - obs.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = obs.radius + (entity.size || 10);
            if (dist < minDist && dist > 0.001) {
                const push = minDist - dist;
                entity.x += (dx / dist) * push;
                entity.y += (dy / dist) * push;
            }
        }
    }

    // Get world boundaries
    getWorldBounds() {
        return this.worldBounds;
    }

    // Reset method for game restart
    reset() {
        this.worldSeed = Date.now();
        this.generateObstacles();
        console.log(`🌍 TerrainSystem reset with ${this.obstacles.length} obstacles`);
    }
}
