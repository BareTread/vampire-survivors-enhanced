// Debug overlay for projectile behavior visualization
export class ProjectileDebugger {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.showBounds = true;
        this.showPaths = true;
        this.showLifetime = true;
        this.showStats = true;
        
        // Track projectile history for analysis
        this.projectileHistory = [];
        this.maxHistorySize = 100;
        
        // Performance counters
        this.counters = {
            totalCreated: 0,
            totalDestroyed: 0,
            invalidMovement: 0,
            coordinateOverflow: 0,
            boundaryExits: 0
        };
    }
    
    toggle() {
        this.enabled = !this.enabled;
        console.log(`🐛 Projectile Debug: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    trackProjectileCreation(projectile) {
        if (!this.enabled) return;
        
        this.counters.totalCreated++;
        this.projectileHistory.push({
            id: projectile.id,
            startX: projectile.x,
            startY: projectile.y,
            startTime: performance.now(),
            source: projectile.source,
            type: projectile.type,
            damage: projectile.damage,
            speed: projectile.speed,
            lifetime: projectile.maxLifetime,
            status: 'created'
        });
        
        // Trim history
        if (this.projectileHistory.length > this.maxHistorySize) {
            this.projectileHistory.shift();
        }
    }
    
    trackProjectileDestruction(projectile, reason = 'unknown') {
        if (!this.enabled) return;
        
        this.counters.totalDestroyed++;
        
        // Find in history and update
        const historyEntry = this.projectileHistory.find(h => h.id === projectile.id);
        if (historyEntry) {
            historyEntry.endX = projectile.x;
            historyEntry.endY = projectile.y;
            historyEntry.endTime = performance.now();
            historyEntry.destroyReason = reason;
            historyEntry.status = 'destroyed';
            historyEntry.actualLifetime = (historyEntry.endTime - historyEntry.startTime) / 1000;
        }
        
        // Track specific destruction reasons
        switch (reason) {
            case 'invalidMovement':
                this.counters.invalidMovement++;
                break;
            case 'coordinateOverflow':
                this.counters.coordinateOverflow++;
                break;
            case 'boundaryExit':
                this.counters.boundaryExits++;
                break;
        }
    }
    
    render(renderer) {
        if (!this.enabled) return;
        
        const ctx = renderer.ctx;
        const camera = this.game.camera;
        
        // Get active projectiles
        const projectiles = this.game.systems.projectile.activeProjectiles;
        
        // Render debug info for each projectile
        for (const projectile of projectiles) {
            if (!projectile.active) continue;
            
            const screenX = projectile.x - camera.x;
            const screenY = projectile.y - camera.y;
            
            // Show bounding boxes
            if (this.showBounds) {
                ctx.strokeStyle = projectile.source === 'player' ? '#00FF00' : '#FF0000';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    screenX - projectile.size,
                    screenY - projectile.size,
                    projectile.size * 2,
                    projectile.size * 2
                );
            }
            
            // Show velocity vectors
            if (this.showPaths) {
                ctx.strokeStyle = projectile.source === 'player' ? '#00FFFF' : '#FFFF00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                const endX = screenX + projectile.velocity.x * 0.1;
                const endY = screenY + projectile.velocity.y * 0.1;
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Arrow head
                const angle = Math.atan2(projectile.velocity.y, projectile.velocity.x);
                const arrowLength = 8;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle - Math.PI / 6),
                    endY - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle + Math.PI / 6),
                    endY - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
            }
            
            // Show lifetime remaining
            if (this.showLifetime) {
                const lifetimePercent = projectile.lifetime / projectile.maxLifetime;
                const color = lifetimePercent > 0.5 ? '#00FF00' : 
                             lifetimePercent > 0.25 ? '#FFFF00' : '#FF0000';
                
                ctx.fillStyle = color;
                ctx.font = '10px monospace';
                ctx.fillText(
                    `${projectile.lifetime.toFixed(1)}s`,
                    screenX + projectile.size + 5,
                    screenY - projectile.size
                );
            }
        }
        
        // Render stats overlay
        if (this.showStats) {
            this.renderStatsOverlay(ctx);
        }
    }
    
    renderStatsOverlay(ctx) {
        const x = 10;
        const y = 100;
        const lineHeight = 16;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - 5, y - 20, 300, 160);
        
        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('🐛 PROJECTILE DEBUG', x, y);
        
        // Stats
        ctx.font = '12px monospace';
        ctx.fillStyle = '#00FF00';
        
        const activeCount = this.game.systems.projectile.activeProjectiles.length;
        const poolSize = this.game.systems.projectile.projectilePool.length;
        
        const lines = [
            `Active: ${activeCount}`,
            `Pool: ${poolSize}`,
            `Created: ${this.counters.totalCreated}`,
            `Destroyed: ${this.counters.totalDestroyed}`,
            `Invalid Movement: ${this.counters.invalidMovement}`,
            `Coord Overflow: ${this.counters.coordinateOverflow}`,
            `Boundary Exits: ${this.counters.boundaryExits}`,
            `History: ${this.projectileHistory.length}`
        ];
        
        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + (index + 2) * lineHeight);
        });
        
        // Recent issues
        const recentIssues = this.projectileHistory
            .filter(h => h.destroyReason && h.destroyReason !== 'lifetime')
            .slice(-3);
            
        if (recentIssues.length > 0) {
            ctx.fillStyle = '#FF0000';
            ctx.fillText('Recent Issues:', x, y + (lines.length + 3) * lineHeight);
            
            recentIssues.forEach((issue, index) => {
                ctx.fillText(
                    `${issue.destroyReason} (${issue.source})`,
                    x,
                    y + (lines.length + 4 + index) * lineHeight
                );
            });
        }
    }
    
    getReport() {
        return {
            counters: { ...this.counters },
            activeProjectiles: this.game.systems.projectile.activeProjectiles.length,
            poolUtilization: `${((this.game.systems.projectile.activeProjectiles.length / this.game.systems.projectile.maxActiveProjectiles) * 100).toFixed(1)}%`,
            recentIssues: this.projectileHistory
                .filter(h => h.destroyReason && h.destroyReason !== 'lifetime')
                .slice(-5)
        };
    }
}
