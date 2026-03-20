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

        // Zone/biome system — concentric rings from origin
        this.zones = [
            { name: 'Crypt',      radius: 600,  bgInner: '#2a1a3e', bgMid: '#1e1030', bgOuter: '#140a22', gridColor: 'rgba(100, 60, 140, 0.16)', majorColor: 'rgba(140, 80, 180, 0.14)' },
            { name: 'Catacombs',  radius: 1200, bgInner: '#1e2a3e', bgMid: '#141e2d', bgOuter: '#0e1422', gridColor: 'rgba(60, 80, 120, 0.16)',  majorColor: 'rgba(80, 110, 160, 0.14)' },
            { name: 'Graveyard',  radius: 1800, bgInner: '#1e2e26', bgMid: '#141e1a', bgOuter: '#0e1612', gridColor: 'rgba(50, 90, 60, 0.16)',   majorColor: 'rgba(70, 120, 80, 0.14)' },
            { name: 'Wasteland',  radius: Infinity, bgInner: '#3e2020', bgMid: '#2d1818', bgOuter: '#221010', gridColor: 'rgba(120, 60, 50, 0.16)', majorColor: 'rgba(160, 80, 60, 0.14)' }
        ];

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

        // Get zone at camera position for zone-aware gradient
        const zone = this.getZoneAt(camera.x, camera.y);

        const gradient = ctx.createRadialGradient(camera.x, camera.y, 0, camera.x, camera.y, 800);
        gradient.addColorStop(0, zone.bgInner);
        gradient.addColorStop(0.6, zone.bgMid);
        gradient.addColorStop(1, zone.bgOuter);

        ctx.fillStyle = gradient;
        ctx.fillRect(camera.x - camera.width, camera.y - camera.height, camera.width * 2, camera.height * 2);

        if (this.qualityLevel !== 'low') {
            this.renderFloorDetail(camera);
        }

        // Zone transition rings (visible boundaries between biomes)
        if (this.qualityLevel === 'high') {
            this.renderZoneTransitions(camera);
        }

        ctx.restore();
    }

    renderFloorDetail(camera) {
        const ctx = this.ctx;
        const minorTile = this.tileSize;
        const majorTile = this.tileSize * 4;
        const startX = Math.floor((camera.x - camera.width / 2) / minorTile) * minorTile;
        const endX = startX + camera.width + minorTile * 2;
        const startY = Math.floor((camera.y - camera.height / 2) / minorTile) * minorTile;
        const endY = startY + camera.height + minorTile * 2;

        if (this.qualityLevel === 'high') {
            ctx.strokeStyle = 'rgba(70, 76, 100, 0.16)';
            ctx.lineWidth = 1;

            for (let x = startX; x <= endX; x += minorTile) {
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }

            for (let y = startY; y <= endY; y += minorTile) {
                ctx.beginPath();
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
            }
        }

        // Use zone-specific grid colors for major grid
        const zone = this.getZoneAt(camera.x, camera.y);

        ctx.strokeStyle = zone.majorColor;
        ctx.lineWidth = 1.5;

        const majorStartX = Math.floor(startX / majorTile) * majorTile;
        const majorStartY = Math.floor(startY / majorTile) * majorTile;

        for (let x = majorStartX; x <= endX; x += majorTile) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        for (let y = majorStartY; y <= endY; y += majorTile) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
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
        ctx.strokeRect(-worldHalfWidth, -worldHalfHeight, this.worldWidth, this.worldHeight);

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
            const intensity = 1 - minDistance / warningDistance;
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
     * Render subtle dashed circle outlines at zone boundaries.
     */
    renderZoneTransitions(camera) {
        const ctx = this.ctx;
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 1;

        for (const zone of this.zones) {
            if (!isFinite(zone.radius)) continue;

            // Only render if the circle is within camera view
            const viewRange = Math.max(camera.width, camera.height);
            const distToCamera = Math.sqrt(camera.x * camera.x + camera.y * camera.y);
            if (Math.abs(distToCamera - zone.radius) > viewRange) continue;

            ctx.strokeStyle = zone.majorColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}
