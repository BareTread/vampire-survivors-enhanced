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

        // Zone-specific obstacle palettes
        const zoneObstacles = {
            Crypt:     [
                { type: 'tombstone', radius: 12, weight: 5 },
                { type: 'ruinedWall', radius: 25, weight: 3 },
                { type: 'rock', radius: 18, weight: 2 }
            ],
            Catacombs: [
                { type: 'rock', radius: 18, weight: 4 },
                { type: 'ruinedWall', radius: 25, weight: 4 },
                { type: 'tombstone', radius: 12, weight: 2 }
            ],
            Graveyard: [
                { type: 'tombstone', radius: 12, weight: 5 },
                { type: 'deadTree', radius: 15, weight: 4 },
                { type: 'rock', radius: 18, weight: 1 }
            ],
            Wasteland: [
                { type: 'rock', radius: 18, weight: 5 },
                { type: 'deadTree', radius: 15, weight: 3 },
                { type: 'ruinedWall', radius: 25, weight: 2 }
            ]
        };

        // Zone-specific color tints (body, highlight, shadow alpha)
        const zoneColors = {
            Crypt:     { body: '#6B5B8A', highlight: '#8B7BAA', shadow: 0.25 },
            Catacombs: { body: '#5B6B8A', highlight: '#7B8BAA', shadow: 0.22 },
            Graveyard: { body: '#5B7B5B', highlight: '#7B9B7B', shadow: 0.18 },
            Wasteland: { body: '#8A5B4B', highlight: '#AA7B6B', shadow: 0.28 }
        };

        const targetCount = 40;
        let attempts = 0;
        const maxAttempts = 200;

        while (this.obstacles.length < targetCount && attempts < maxAttempts) {
            attempts++;

            const x = bounds.left + margin + seededRandom() * (bounds.right - bounds.left - margin * 2);
            const y = bounds.top + margin + seededRandom() * (bounds.bottom - bounds.top - margin * 2);

            // Skip center spawn area
            if (x * x + y * y < centerClear * centerClear) continue;

            // Determine zone at this position
            const zone = this.terrainRenderer.getZoneAt(x, y);
            const palette = zoneObstacles[zone.name] || zoneObstacles.Wasteland;
            const colors = zoneColors[zone.name] || zoneColors.Wasteland;

            // Pick type by weighted random from zone palette
            const totalWeight = palette.reduce((s, t) => s + t.weight, 0);
            let roll = seededRandom() * totalWeight;
            let chosen = palette[0];
            for (const ot of palette) {
                roll -= ot.weight;
                if (roll <= 0) { chosen = ot; break; }
            }

            // Check spacing with existing obstacles
            let tooClose = false;
            for (const other of this.obstacles) {
                const dx = x - other.x;
                const dy = y - other.y;
                if (dx * dx + dy * dy < minSpacing * minSpacing) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            const obs = {
                x, y,
                type: chosen.type,
                radius: chosen.radius,
                seed: seededRandom(), // Per-instance visual variation
                zone: zone.name,
                colors
            };
            obs.sprite = this._bakeObstacle(obs);
            this.obstacles.push(obs);
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
        if (!cam || !ctx) return;

        // Frustum cull: only render obstacles visible in camera + margin
        const margin = 100;
        const vl = cam.x - cam.width / 2 - margin;
        const vr = cam.x + cam.width / 2 + margin;
        const vt = cam.y - cam.height / 2 - margin;
        const vb = cam.y + cam.height / 2 + margin;

        for (const obs of this.obstacles) {
            if (obs.x < vl || obs.x > vr || obs.y < vt || obs.y > vb) continue;

            if (obs.sprite) {
                // Baked sprite: one drawImage per visible obstacle
                ctx.drawImage(
                    obs.sprite,
                    obs.x - obs.sprite.width / 2,
                    obs.y - obs.sprite.height / 2
                );
            } else {
                // Headless/fallback path: paint directly
                this._paintObstacle(ctx, obs, obs.x, obs.y);
            }
        }
    }

    /**
     * Bake an obstacle to an offscreen canvas once at generation time so the
     * per-frame cost is a single drawImage. Returns null where no 2d context
     * exists (tests/headless); renderObstacles falls back to _paintObstacle.
     */
    _bakeObstacle(obs) {
        if (typeof document === 'undefined') return null;
        const pad = Math.ceil(obs.radius * 1.3) + 8;
        const size = Math.ceil(obs.radius * 2 + pad * 2);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        this._paintObstacle(ctx, obs, size / 2, size / 2);
        return canvas;
    }

    // Single paint implementation shared by the baked sprite and the live
    // fallback path. Draws centered on (cx, cy); visual footprint stays
    // within ~radius so sprites never lie about the collision circle.
    _paintObstacle(ctx, obs, cx, cy) {
        switch (obs.type) {
            case 'rock':
                this._paintRock(ctx, obs, cx, cy);
                break;
            case 'tombstone':
                this._paintTombstone(ctx, obs, cx, cy);
                break;
            case 'deadTree':
                this._paintDeadTree(ctx, obs, cx, cy);
                break;
            case 'ruinedWall':
                this._paintRuinedWall(ctx, obs, cx, cy);
                break;
        }
    }

    _paintRock(ctx, obs, cx, cy) {
        const r = obs.radius;
        const c = obs.colors || { body: '#555555', highlight: '#777777', shadow: 0.2 };
        ctx.save();

        // Ground shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${c.shadow + 0.08})`;
        ctx.beginPath();
        ctx.ellipse(cx + 3, cy + r * 0.45, r * 1.05, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Irregular boulder silhouette
        ctx.fillStyle = c.body;
        ctx.beginPath();
        const points = 7;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const variation = 0.8 + obs.seed * 0.4 * Math.sin(angle * 3 + obs.seed * 10);
            const px = cx + Math.cos(angle) * r * variation;
            const py = cy + Math.sin(angle) * r * variation * 0.85;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Lit facet on the upper-left face
        ctx.fillStyle = c.highlight;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.55, cy - r * 0.1);
        ctx.lineTo(cx - r * 0.15, cy - r * 0.62);
        ctx.lineTo(cx + r * 0.3, cy - r * 0.35);
        ctx.lineTo(cx + r * 0.05, cy + r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Crack
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.1, cy - r * 0.3);
        ctx.lineTo(cx + r * 0.35, cy + r * 0.1);
        ctx.lineTo(cx + r * 0.2, cy + r * 0.45);
        ctx.stroke();

        ctx.restore();
    }

    _paintTombstone(ctx, obs, cx, cy) {
        const r = obs.radius;
        const c = obs.colors || { body: '#6B6B6B', highlight: '#888888', shadow: 0.2 };
        ctx.save();

        // Ground shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${c.shadow + 0.08})`;
        ctx.beginPath();
        ctx.ellipse(cx + 2, cy + r * 0.55, r * 0.75, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Slight seeded tilt — weathered, not pristine
        ctx.translate(cx, cy + r * 0.5);
        ctx.rotate((obs.seed - 0.5) * 0.22);
        ctx.translate(-cx, -(cy + r * 0.5));

        // Slab body with rounded top
        ctx.fillStyle = c.body;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.5, cy + r * 0.55);
        ctx.lineTo(cx - r * 0.5, cy - r * 0.25);
        ctx.arc(cx, cy - r * 0.25, r * 0.5, Math.PI, 0);
        ctx.lineTo(cx + r * 0.5, cy + r * 0.55);
        ctx.closePath();
        ctx.fill();

        // Edge highlight on the lit side
        ctx.strokeStyle = c.highlight;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.42, cy + r * 0.5);
        ctx.lineTo(cx - r * 0.42, cy - r * 0.22);
        ctx.stroke();

        // Cross engraving
        ctx.strokeStyle = c.highlight;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.5);
        ctx.lineTo(cx, cy + r * 0.25);
        ctx.moveTo(cx - r * 0.22, cy - r * 0.15);
        ctx.lineTo(cx + r * 0.22, cy - r * 0.15);
        ctx.stroke();

        // Moss / grime at the base
        ctx.fillStyle = 'rgba(40, 60, 35, 0.45)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.5, r * 0.45, r * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _paintDeadTree(ctx, obs, cx, cy) {
        const r = obs.radius;
        const c = obs.colors || { body: '#5D4037', highlight: '#4E342E', shadow: 0.15 };
        ctx.save();

        // Ground shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${c.shadow + 0.1})`;
        ctx.beginPath();
        ctx.ellipse(cx + 3, cy + r * 0.7, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gnarled tapered trunk
        ctx.fillStyle = c.body;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + r * 0.7);
        ctx.lineTo(cx - 2.5, cy - r * 0.4);
        ctx.lineTo(cx + 1, cy - r * 0.55);
        ctx.lineTo(cx + 3.5, cy + r * 0.7);
        ctx.closePath();
        ctx.fill();

        // Bare branches
        ctx.strokeStyle = c.highlight;
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - r * 0.2);
        ctx.lineTo(cx - r * 0.75, cy - r * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 1, cy - r * 0.4);
        ctx.lineTo(cx + r * 0.65, cy - r * 1.0);
        ctx.stroke();
        // Twigs
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, cy - r * 0.85);
        ctx.lineTo(cx - r * 0.55, cy - r * 1.1);
        ctx.moveTo(cx - r * 0.75, cy - r * 0.85);
        ctx.lineTo(cx - r * 0.95, cy - r * 1.0);
        ctx.moveTo(cx + r * 0.65, cy - r * 1.0);
        ctx.lineTo(cx + r * 0.45, cy - r * 1.2);
        ctx.stroke();

        ctx.restore();
    }

    _paintRuinedWall(ctx, obs, cx, cy) {
        const r = obs.radius;
        const c = obs.colors || { body: '#7B7B7B', highlight: '#8E8E8E', shadow: 0.2 };
        ctx.save();

        // Ground shadow
        ctx.fillStyle = `rgba(0, 0, 0, ${c.shadow + 0.08})`;
        ctx.beginPath();
        ctx.ellipse(cx + 3, cy + r * 0.35, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Staggered stone blocks at varying heights
        const blocks = [
            { ox: -r * 0.7, h: r * 0.9, w: r * 0.5 },
            { ox: -r * 0.15, h: r * 1.2, w: r * 0.4 },
            { ox: r * 0.3, h: r * 0.6, w: r * 0.5 }
        ];

        for (const block of blocks) {
            const bx = cx + block.ox;
            const by = cy + r * 0.3 - block.h;

            ctx.fillStyle = c.body;
            ctx.fillRect(bx, by, block.w, block.h);

            // Mortar lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.lineWidth = 0.75;
            const rows = Math.floor(block.h / 8);
            for (let i = 1; i < rows; i++) {
                ctx.beginPath();
                ctx.moveTo(bx, by + i * 8);
                ctx.lineTo(bx + block.w, by + i * 8);
                ctx.stroke();
            }

            // Top highlight
            ctx.fillStyle = c.highlight;
            ctx.fillRect(bx, by, block.w, 2);
        }

        // Rubble at the base
        ctx.fillStyle = c.body;
        ctx.beginPath();
        ctx.arc(cx - r * 0.5, cy + r * 0.32, r * 0.14, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.55, cy + r * 0.34, r * 0.11, 0, Math.PI * 2);
        ctx.fill();

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
