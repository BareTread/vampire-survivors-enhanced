// TerrainRenderer — gothic stone world rendering.
//
// Ground is drawn from cached per-zone pattern tiles (one fillRect per frame,
// world-anchored) instead of per-frame grid strokes. Sparse baked landmarks
// give spatial orientation without reading as threats. All procedural art is
// generated once and reused; nothing allocates per frame.
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

        // Zone/biome system — concentric rings from origin.
        // Shared charcoal/slate stone base; each zone keeps a restrained tint
        // so the four biomes stay distinguishable without neon.
        this.zones = [
            {
                name: 'Crypt', radius: 600,
                bgInner: '#1a1622', bgMid: '#141019', bgOuter: '#0d0a12',
                stone: ['#232030', '#1e1b28', '#282434'], mortar: '#100d16',
                accent: 'rgba(150, 120, 190, 0.10)', accentSolid: '#6b5b8a',
                ring: 'rgba(150, 120, 190, 0.22)'
            },
            {
                name: 'Catacombs', radius: 1200,
                bgInner: '#161b24', bgMid: '#11151d', bgOuter: '#0b0e14',
                stone: ['#1f2530', '#1a1f29', '#242a36'], mortar: '#0d1016',
                accent: 'rgba(110, 140, 180, 0.09)', accentSolid: '#5b6b8a',
                ring: 'rgba(110, 140, 180, 0.20)'
            },
            {
                name: 'Graveyard', radius: 1800,
                bgInner: '#171d19', bgMid: '#121713', bgOuter: '#0c100d',
                stone: ['#20271f', '#1b211b', '#252c23'], mortar: '#0e120e',
                accent: 'rgba(110, 150, 110, 0.09)', accentSolid: '#5b7b5b',
                ring: 'rgba(110, 150, 110, 0.20)'
            },
            {
                name: 'Wasteland', radius: Infinity,
                bgInner: '#211714', bgMid: '#181110', bgOuter: '#100b0a',
                stone: ['#2a211d', '#241c19', '#2f2620'], mortar: '#130d0b',
                accent: 'rgba(190, 110, 80, 0.10)', accentSolid: '#8a5b4b',
                ring: 'rgba(190, 110, 80, 0.22)'
            }
        ];

        // Lazily-built cached art (patterns + landmark sprites). Deferred so
        // construction stays safe in headless/test environments where a real
        // 2d context may not exist.
        this._assetsReady = false;
        this._patterns = new Map();   // zone.name -> CanvasPattern
        this._landmarks = [];         // {x, y, canvas, w, h}
        this._landmarkSprites = new Map();

        console.log('🏰 TerrainRenderer initialized (stone world)');
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
        // Resolve the context per call so a swapped renderer ctx still works.
        const ctx = this.renderer.ctx || this.ctx;
        if (!ctx) return;
        this.ctx = ctx;

        this._ensureAssets();
        this.renderBackground(camera);
        this.renderBoundaries(camera);
    }

    renderBackground(camera) {
        const ctx = this.ctx;
        ctx.save();

        const zone = this.getZoneAt(camera.x, camera.y);
        const view = this._viewBounds(camera, 64);

        // Flat zone base — only visible if the stone tiles failed to bake
        // (the flagstone tile is fully opaque, so a gradient here would be a
        // full-screen fill nobody ever sees).
        if (!this._patterns.has(zone.name)) {
            ctx.fillStyle = zone.bgMid;
            ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
        }

        // The flagstone floor is always drawn; only landmarks drop under load.
        this.renderFloorDetail(camera, view);

        if (this.qualityLevel === 'high') {
            this.renderZoneTransitions(camera);
        }

        ctx.restore();
    }

    /**
     * Stone floor: one world-anchored pattern fill plus sparse baked
     * landmarks. Replaces the old stroked grid — cheaper and reads as
     * flagstone rather than graph paper.
     */
    renderFloorDetail(camera, view) {
        const ctx = this.ctx;
        const zone = this.getZoneAt(camera.x, camera.y);
        const pattern = this._patterns.get(zone.name);

        if (pattern && !this._blitFloor(ctx, zone)) {
            ctx.fillStyle = pattern;
            ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
        }

        // Landmarks: baked sprites, frustum-culled, deliberately muted so
        // they orient the player without competing with enemies/XP.
        if (this.qualityLevel === 'low') return;
        for (const lm of this._landmarks) {
            if (lm.x < view.left - lm.w || lm.x > view.right + lm.w ||
                lm.y < view.top - lm.h || lm.y > view.bottom + lm.h) continue;
            ctx.drawImage(lm.canvas, lm.x - lm.w / 2, lm.y - lm.h / 2);
        }
    }

    /**
     * Fast floor path. A zoomed, repeating pattern fill resamples every
     * screen pixel through the camera transform (~8ms/frame on software
     * canvases). Instead the floor is pre-tiled once, at the current zoom,
     * into a screen-sized buffer and blitted 1:1 — the same pixels for a
     * fraction of the cost. While the zoom is animating (punches, dynamic
     * zoom) the buffer is drawn slightly scaled and rebuilt once it settles.
     * Returns false when it can't help (rotation, no DOM) so the caller
     * falls back to the pattern fill.
     */
    _blitFloor(ctx, zone) {
        const tile = this._tiles && this._tiles.get(zone.name);
        if (!tile || typeof ctx.getTransform !== 'function') return false;
        const m = ctx.getTransform();
        if (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || m.a <= 0) return false;
        const zoom = m.a;
        const cw = ctx.canvas ? ctx.canvas.width : 0;
        const ch = ctx.canvas ? ctx.canvas.height : 0;
        if (!cw || !ch) return false;

        const f = this._floor || (this._floor = { canvas: null, zone: null, zoom: 0, tile: 0, w: 0, h: 0, lastZoom: 0, still: 0 });
        f.still = Math.abs(zoom - f.lastZoom) < 1e-4 ? f.still + 1 : 0;
        f.lastZoom = zoom;

        const needs = !f.canvas || f.zone !== zone.name || f.w !== cw || f.h !== ch;
        const drift = f.zoom ? zoom / f.zoom : 0;
        if (needs || (Math.abs(drift - 1) > 1e-3 && f.still >= 6) || drift < 0.87 || drift > 1.15) {
            if (!this._buildFloorBuffer(f, tile, zone.name, zoom, cw, ch)) return false;
        }

        const s = zoom / f.zoom;              // ~1 except mid-zoom-animation
        const period = f.tile * s;            // on-screen tile period
        const ox = ((m.e % period) + period) % period - period;
        const oy = ((m.f % period) + period) % period - period;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (Math.abs(s - 1) < 1e-3) {
            ctx.drawImage(f.canvas, Math.round(ox), Math.round(oy));
        } else {
            ctx.drawImage(f.canvas, ox, oy, f.canvas.width * s, f.canvas.height * s);
        }
        ctx.restore();
        return true;
    }

    _buildFloorBuffer(f, tile, zoneName, zoom, cw, ch) {
        if (typeof document === 'undefined') return false;
        const period = tile.width * zoom;
        // Margin covers one tile of scroll plus ~15% of zoom-out while the
        // buffer is being drawn scaled during a zoom animation.
        const bw = Math.ceil(cw * 1.15 + period * 2);
        const bh = Math.ceil(ch * 1.15 + period * 2);
        if (!f.canvas) f.canvas = document.createElement('canvas');
        if (f.canvas.width !== bw || f.canvas.height !== bh) {
            f.canvas.width = bw;
            f.canvas.height = bh;
        }
        const g = f.canvas.getContext('2d', { alpha: false });
        if (!g) return false;
        const pattern = g.createPattern(tile, 'repeat');
        if (!pattern) return false;
        // Same pattern fill the camera used to do every frame — done once,
        // so the texels (including seam wrapping) are identical.
        g.setTransform(zoom, 0, 0, zoom, 0, 0);
        g.fillStyle = pattern;
        g.fillRect(0, 0, bw / zoom, bh / zoom);
        g.setTransform(1, 0, 0, 1, 0, 0);
        f.zone = zoneName;
        f.zoom = zoom;
        f.tile = period;
        f.w = cw;
        f.h = ch;
        return true;
    }

    renderBoundaries(camera) {
        const ctx = this.ctx;
        const worldHalfWidth = this.worldWidth / 2;
        const worldHalfHeight = this.worldHeight / 2;
        const view = this._viewBounds(camera, 64);

        ctx.save();

        // The world edge reads as a wall of gloom: a dark band just inside
        // the bounds with a faint ember seam on the boundary line itself.
        const band = 46;
        ctx.fillStyle = 'rgba(6, 4, 8, 0.55)';

        // Left / right / top / bottom inner bands (only where visible)
        if (view.left < -worldHalfWidth + band) {
            ctx.fillRect(-worldHalfWidth, -worldHalfHeight, band, this.worldHeight);
        }
        if (view.right > worldHalfWidth - band) {
            ctx.fillRect(worldHalfWidth - band, -worldHalfHeight, band, this.worldHeight);
        }
        if (view.top < -worldHalfHeight + band) {
            ctx.fillRect(-worldHalfWidth, -worldHalfHeight, this.worldWidth, band);
        }
        if (view.bottom > worldHalfHeight - band) {
            ctx.fillRect(-worldHalfWidth, worldHalfHeight - band, this.worldWidth, band);
        }

        // Ember seam on the boundary line — blood-red is reserved for danger
        ctx.strokeStyle = 'rgba(160, 60, 45, 0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-worldHalfWidth, -worldHalfHeight, this.worldWidth, this.worldHeight);

        // Corner cairn markers
        ctx.fillStyle = 'rgba(190, 150, 120, 0.5)';
        const markerSize = 18;
        ctx.fillRect(-worldHalfWidth - 4, -worldHalfHeight - 4, markerSize, 4);
        ctx.fillRect(-worldHalfWidth - 4, -worldHalfHeight - 4, 4, markerSize);
        ctx.fillRect(worldHalfWidth - markerSize + 4, -worldHalfHeight - 4, markerSize, 4);
        ctx.fillRect(worldHalfWidth, -worldHalfHeight - 4, 4, markerSize);
        ctx.fillRect(-worldHalfWidth - 4, worldHalfHeight, markerSize, 4);
        ctx.fillRect(-worldHalfWidth - 4, worldHalfHeight - markerSize + 4, 4, markerSize);
        ctx.fillRect(worldHalfWidth - markerSize + 4, worldHalfHeight, markerSize, 4);
        ctx.fillRect(worldHalfWidth, worldHalfHeight - markerSize + 4, 4, markerSize);

        // Proximity warning — same semantics as before: pulsing red wash on
        // the edge the player is approaching.
        const playerX = camera.x;
        const playerY = camera.y;
        const warningDistance = 300;

        const distanceToLeft = playerX + worldHalfWidth;
        const distanceToRight = worldHalfWidth - playerX;
        const distanceToTop = playerY + worldHalfHeight;
        const distanceToBottom = worldHalfHeight - playerY;

        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

        if (minDistance < warningDistance) {
            const intensity = 1 - minDistance / warningDistance;
            const pulseTime = performance.now() * 0.003;
            const pulseAlpha = (Math.sin(pulseTime) * 0.3 + 0.5) * intensity;

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

        return (
            x >= -worldHalfWidth + margin &&
            x <= worldHalfWidth - margin &&
            y >= -worldHalfHeight + margin &&
            y <= worldHalfHeight - margin
        );
    }

    getWorldBounds() {
        return {
            left: -this.worldWidth / 2,
            right: this.worldWidth / 2,
            top: -this.worldHeight / 2,
            bottom: this.worldHeight / 2
        };
    }

    /**
     * Returns the zone definition at the given world coordinates.
     * Zones are concentric rings centered at origin.
     */
    getZoneAt(x, y) {
        const dist = Math.sqrt(x * x + y * y);
        for (const zone of this.zones) {
            if (dist <= zone.radius) return zone;
        }
        return this.zones[this.zones.length - 1];
    }

    /**
     * Render a soft ring at each zone boundary — a worn ritual circle rather
     * than a dashed UI line.
     */
    renderZoneTransitions(camera) {
        const ctx = this.ctx;
        ctx.save();
        ctx.lineWidth = 2;

        for (const zone of this.zones) {
            if (!isFinite(zone.radius)) continue;

            // Only render if the circle is within camera view
            const viewRange = Math.max(camera.width, camera.height);
            const distToCamera = Math.sqrt(camera.x * camera.x + camera.y * camera.y);
            if (Math.abs(distToCamera - zone.radius) > viewRange) continue;

            // Outer soft band
            ctx.strokeStyle = zone.ring;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
            ctx.stroke();

            // Inner hairline for a carved-in-stone feel
            ctx.globalAlpha = 0.18;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, zone.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 2;
        }

        ctx.restore();
    }

    // ------------------------------------------------------------------
    // Cached art generation
    // ------------------------------------------------------------------

    _viewBounds(camera, margin = 0) {
        if (typeof camera.getWorldBounds === 'function') {
            return camera.getWorldBounds(margin);
        }
        const halfW = camera.width / 2 + margin;
        const halfH = camera.height / 2 + margin;
        return {
            left: camera.x - halfW,
            right: camera.x + halfW,
            top: camera.y - halfH,
            bottom: camera.y + halfH
        };
    }

    _ensureAssets() {
        if (this._assetsReady) return;
        if (!this.ctx || typeof document === 'undefined') return;

        for (const zone of this.zones) {
            const tile = this._buildStoneTile(zone);
            if (tile) {
                (this._tiles || (this._tiles = new Map())).set(zone.name, tile);
                const pattern = this.ctx.createPattern(tile, 'repeat');
                if (pattern) this._patterns.set(zone.name, pattern);
            }
        }

        this._buildLandmarks();
        this._assetsReady = true;
    }

    /**
     * Bake one 256px seamless flagstone tile for a zone: mortar base,
     * staggered ashlar stones, hairline cracks, faint stains and
     * zone-accent debris.
     */
    _buildStoneTile(zone) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const rand = this._seededRandom(this._hash(zone.name));

        // Mortar bed
        ctx.fillStyle = zone.mortar;
        ctx.fillRect(0, 0, size, size);

        // Flagstones: 4x4 ashlar layout — odd rows offset by half a cell so
        // the floor reads as masonry, not graph paper. Stones inset slightly
        // so the mortar shows through as natural gaps; the extra gx=-1 column
        // wraps the offset rows for seamless tiling.
        const cell = size / 4;
        for (let gy = 0; gy < 4; gy++) {
            const rowOffset = (gy % 2) * cell * 0.5;
            for (let gx = -1; gx < 4; gx++) {
                const shade = zone.stone[Math.floor(rand() * zone.stone.length)];
                const jx = (rand() - 0.5) * 4;
                const jy = (rand() - 0.5) * 4;
                const inset = 1 + rand() * 1.5;
                const sx = gx * cell + rowOffset + jx + inset;
                const sy = gy * cell + jy + inset;
                const sw = cell - inset * 2;
                const sh = cell - inset * 2;

                ctx.fillStyle = shade;
                ctx.fillRect(sx, sy, sw, sh);

                // Worn top-left edge highlight — gives the stone a lit face
                ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
                ctx.fillRect(sx, sy, sw, 1.5);
                ctx.fillRect(sx, sy, 1.5, sh);
            }
        }

        // Hairline cracks
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        const cracks = 5;
        for (let i = 0; i < cracks; i++) {
            let cx = rand() * size;
            let cy = rand() * size;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const segments = 2 + Math.floor(rand() * 3);
            for (let s = 0; s < segments; s++) {
                cx += (rand() - 0.5) * 40;
                cy += (rand() - 0.5) * 40;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        // Faint stains / weathering blotches
        for (let i = 0; i < 4; i++) {
            const sx = rand() * size;
            const sy = rand() * size;
            const sr = 12 + rand() * 26;
            const stain = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            stain.addColorStop(0, 'rgba(0, 0, 0, 0.16)');
            stain.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = stain;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Zone-accent debris specks (moss, bone dust, embers — very sparse)
        ctx.fillStyle = zone.accent;
        for (let i = 0; i < 10; i++) {
            const dx = rand() * size;
            const dy = rand() * size;
            ctx.fillRect(dx, dy, 2, 2);
        }

        return canvas;
    }


    /**
     * Deterministic landmark placement + baked sprites. Landmarks are
     * decorative only — collision lives in TerrainSystem obstacles.
     */
    _buildLandmarks() {
        const rand = this._seededRandom(0x9e3779b9);
        const kinds = ['pillar', 'slab', 'bonePile', 'fence', 'spike'];
        const zoneKinds = {
            Crypt: ['pillar', 'slab', 'bonePile'],
            Catacombs: ['pillar', 'bonePile', 'spike'],
            Graveyard: ['slab', 'fence', 'bonePile'],
            Wasteland: ['spike', 'slab', 'bonePile']
        };

        const target = 42;
        const margin = 160;
        const halfW = this.worldWidth / 2 - margin;
        const halfH = this.worldHeight / 2 - margin;

        for (let i = 0; i < target; i++) {
            const x = -halfW + rand() * halfW * 2;
            const y = -halfH + rand() * halfH * 2;

            // Keep the spawn clearing readable
            if (x * x + y * y < 260 * 260) continue;

            const zone = this.getZoneAt(x, y);
            const pool = zoneKinds[zone.name] || kinds;
            const kind = pool[Math.floor(rand() * pool.length)];
            const sprite = this._landmarkSprite(kind, zone, rand);

            this._landmarks.push({
                x, y,
                canvas: sprite.canvas,
                w: sprite.w,
                h: sprite.h
            });
        }
    }

    _landmarkSprite(kind, zone, rand) {
        const key = `${kind}_${zone.name}`;
        let sprite = this._landmarkSprites.get(key);
        if (sprite) return sprite;

        const w = 56;
        const h = 56;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const cx = w / 2;
        const cy = h / 2;
        const stone = zone.accentSolid;

        ctx.save();
        ctx.globalAlpha = 0.85;

        switch (kind) {
            case 'pillar': {
                // Broken column stump
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.ellipse(cx + 2, cy + 12, 14, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this._shade(stone, -30);
                ctx.fillRect(cx - 8, cy - 14, 16, 26);
                ctx.fillStyle = stone;
                ctx.fillRect(cx - 8, cy - 14, 16, 4);
                ctx.fillRect(cx - 10, cy + 8, 20, 4);
                // Broken top edge
                ctx.fillStyle = zone.mortar;
                ctx.beginPath();
                ctx.moveTo(cx - 8, cy - 14);
                ctx.lineTo(cx - 2, cy - 20);
                ctx.lineTo(cx + 4, cy - 14);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'slab': {
                // Fallen grave slab
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.ellipse(cx + 2, cy + 4, 18, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this._shade(stone, -20);
                ctx.beginPath();
                ctx.moveTo(cx - 16, cy + 6);
                ctx.lineTo(cx - 12, cy - 8);
                ctx.lineTo(cx + 14, cy - 5);
                ctx.lineTo(cx + 16, cy + 8);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx - 8, cy - 2);
                ctx.lineTo(cx + 8, cy);
                ctx.stroke();
                break;
            }
            case 'bonePile': {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(cx, cy + 6, 14, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#b8ad96';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                for (let i = 0; i < 4; i++) {
                    const a = rand() * Math.PI;
                    const len = 8 + rand() * 8;
                    const bx = cx + (rand() - 0.5) * 10;
                    const by = cy + (rand() - 0.5) * 6;
                    ctx.beginPath();
                    ctx.moveTo(bx - Math.cos(a) * len / 2, by - Math.sin(a) * len / 2);
                    ctx.lineTo(bx + Math.cos(a) * len / 2, by + Math.sin(a) * len / 2);
                    ctx.stroke();
                }
                ctx.fillStyle = '#c9bfa8';
                ctx.beginPath();
                ctx.arc(cx + 4, cy - 3, 3.5, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'fence': {
                // Rotting graveyard fence segment
                ctx.strokeStyle = this._shade(stone, -40);
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx - 16, cy + 4);
                ctx.lineTo(cx + 16, cy - 2);
                ctx.stroke();
                ctx.lineWidth = 2;
                for (let i = -1; i <= 1; i++) {
                    const px = cx + i * 10;
                    ctx.beginPath();
                    ctx.moveTo(px, cy + 8);
                    ctx.lineTo(px + i * 2, cy - 10);
                    ctx.stroke();
                }
                break;
            }
            case 'spike': {
                // Jagged rock / bone spike
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                ctx.beginPath();
                ctx.ellipse(cx + 2, cy + 10, 12, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this._shade(stone, -25);
                ctx.beginPath();
                ctx.moveTo(cx - 9, cy + 10);
                ctx.lineTo(cx - 2, cy - 16);
                ctx.lineTo(cx + 3, cy + 10);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = this._shade(stone, -45);
                ctx.beginPath();
                ctx.moveTo(cx + 2, cy + 10);
                ctx.lineTo(cx + 8, cy - 8);
                ctx.lineTo(cx + 11, cy + 10);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }

        ctx.restore();

        sprite = { canvas, w, h };
        this._landmarkSprites.set(key, sprite);
        return sprite;
    }

    _seededRandom(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 0xFFFFFFFF;
        };
    }

    _hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    _shade(hex, amt) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amt));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
        const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
        return `rgb(${r}, ${g}, ${b})`;
    }
}
