// Performance Dashboard - Real-time performance monitoring and optimization
export class PerformanceDashboard {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        
        // Performance history
        this.history = {
            fps: [],
            frameTime: [],
            entityCount: [],
            particleCount: [],
            renderTime: [],
            maxSamples: 120 // 2 seconds at 60fps
        };
        
        // Performance metrics
        this.metrics = {
            avgFPS: 0,
            minFPS: 60,
            maxFPS: 60,
            avgFrameTime: 16.67,
            totalDrawCalls: 0,
            culledDrawCalls: 0,
            memoryUsage: 0
        };
        
        // UI elements
        this.dashboardElement = null;
        this.updateInterval = null;
        
        // Optimization recommendations
        this.recommendations = [];
        
        console.log('📊 PerformanceDashboard initialized');
    }
    
    // Start monitoring
    startMonitoring() {
        if (this.updateInterval) return;
        
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
            this.analyzePerformance();
            if (this.isVisible) {
                this.updateUI();
            }
        }, 100); // Update every 100ms
        
        console.log('📈 Performance monitoring started');
    }
    
    // Stop monitoring
    stopMonitoring() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('📉 Performance monitoring stopped');
    }
    
    // Update performance metrics
    updateMetrics() {
        const fps = this.game.performanceStats?.fps || 0;
        const frameTime = this.game.performanceStats?.frameTime || 16.67;
        
        // Update history
        this.addToHistory('fps', fps);
        this.addToHistory('frameTime', frameTime);
        this.addToHistory('entityCount', this.getEntityCount());
        this.addToHistory('particleCount', this.getParticleCount());
        this.addToHistory('renderTime', this.getRenderTime());
        
        // Calculate metrics
        this.metrics.avgFPS = this.calculateAverage(this.history.fps);
        this.metrics.minFPS = Math.min(...this.history.fps);
        this.metrics.maxFPS = Math.max(...this.history.fps);
        this.metrics.avgFrameTime = this.calculateAverage(this.history.frameTime);
        
        // Get additional metrics
        this.updateSystemMetrics();
    }
    
    addToHistory(metric, value) {
        const history = this.history[metric];
        history.push(value);
        
        if (history.length > this.history.maxSamples) {
            history.shift();
        }
    }
    
    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }
    
    updateSystemMetrics() {
        // Renderer metrics
        if (this.game.renderer) {
            this.metrics.totalDrawCalls = this.game.renderer.drawCallCount || 0;
            this.metrics.culledDrawCalls = this.game.renderer.culledDrawCalls || 0;
        }
        
        // Layered renderer metrics
        if (this.game.layeredRenderer) {
            const layerStats = this.game.layeredRenderer.getPerformanceStats();
            this.metrics.layerEfficiency = layerStats.efficiency;
            this.metrics.layersRedrawn = layerStats.layersRedrawn;
            this.metrics.layersSkipped = layerStats.layersSkipped;
        }
        
        // Memory estimation (rough)
        this.metrics.memoryUsage = this.estimateMemoryUsage();
    }
    
    getEntityCount() {
        let count = 0;
        if (this.game.player) count++;
        if (this.game.systems?.enemy) count += this.game.systems.enemy.getActiveEnemyCount?.() || 0;
        if (this.game.systems?.projectile) count += this.game.systems.projectile.getActiveProjectileCount?.() || 0;
        if (this.game.systems?.experience) count += this.game.systems.experience.getActiveGemCount?.() || 0;
        return count;
    }
    
    getParticleCount() {
        let count = 0;
        if (this.game.systems?.particle) {
            const perfInfo = this.game.systems.particle.getPerformanceInfo?.();
            if (perfInfo) {
                count += perfInfo.effectParticles || 0;
                count += perfInfo.damageNumbers || 0;
                count += perfInfo.bloodSplatters || 0;
            }
        }
        if (this.game.visualEffects) {
            const perfInfo = this.game.visualEffects.getPerformanceInfo?.();
            count += perfInfo?.activeEffects || 0;
        }
        return count;
    }
    
    getRenderTime() {
        return this.game.layeredRenderer?.stats?.frameTime || 
               this.game.renderer?.renderTime || 0;
    }
    
    estimateMemoryUsage() {
        let memory = 0;
        
        // Sprites
        if (this.game.spriteManager) {
            const spriteStats = this.game.spriteManager.getPerformanceStats();
            memory += spriteStats.memoryUsage || 0;
        }
        
        // Entity pools (rough estimate)
        memory += this.getEntityCount() * 2; // 2KB per entity estimate
        memory += this.getParticleCount() * 0.5; // 0.5KB per particle estimate
        
        return memory;
    }
    
    // Performance analysis and recommendations
    analyzePerformance() {
        this.recommendations = [];
        
        const avgFPS = this.metrics.avgFPS;
        const entityCount = this.history.entityCount[this.history.entityCount.length - 1] || 0;
        const particleCount = this.history.particleCount[this.history.particleCount.length - 1] || 0;
        
        // FPS analysis
        if (avgFPS < 45) {
            this.recommendations.push({
                priority: 'high',
                category: 'Performance',
                message: 'FPS below 45 - Consider reducing quality settings',
                action: () => this.game.graphicsUpgrade?.setQuality('medium')
            });
        } else if (avgFPS < 55) {
            this.recommendations.push({
                priority: 'medium',
                category: 'Performance',
                message: 'FPS below 55 - Monitor for stability',
                action: null
            });
        }
        
        // Entity count analysis
        if (entityCount > 300) {
            this.recommendations.push({
                priority: 'medium',
                category: 'Entities',
                message: 'High entity count - May impact performance',
                action: null
            });
        }
        
        // Particle analysis
        if (particleCount > 50) {
            this.recommendations.push({
                priority: 'low',
                category: 'Effects',
                message: 'High particle count - Visual effects may be excessive',
                action: () => this.reduceEffectQuality()
            });
        }
        
        // Memory analysis
        if (this.metrics.memoryUsage > 100) { // 100MB threshold
            this.recommendations.push({
                priority: 'medium',
                category: 'Memory',
                message: 'High memory usage detected',
                action: () => this.optimizeMemory()
            });
        }
        
        // Layered rendering efficiency
        if (this.game.layeredRenderer && this.metrics.layerEfficiency) {
            const efficiency = parseFloat(this.metrics.layerEfficiency);
            if (efficiency < 30) {
                this.recommendations.push({
                    priority: 'low',
                    category: 'Rendering',
                    message: 'Low layer rendering efficiency - Most layers being redrawn',
                    action: null
                });
            }
        }
    }
    
    // Optimization actions
    reduceEffectQuality() {
        if (this.game.visualEffects) {
            this.game.visualEffects.effectQuality *= 0.8;
            console.log('🎨 Reduced effect quality to', this.game.visualEffects.effectQuality);
        }
    }
    
    optimizeMemory() {
        // Clear particle pools
        if (this.game.systems?.particle?.clear) {
            this.game.systems.particle.clear();
        }
        
        // Force garbage collection hint
        if (window.gc) {
            window.gc();
        }
        
        console.log('🧹 Memory optimization performed');
    }
    
    // UI Management
    show() {
        if (this.isVisible) return;
        
        this.createDashboardUI();
        this.isVisible = true;
        this.startMonitoring();
        
        console.log('📊 Performance dashboard shown');
    }
    
    hide() {
        if (!this.isVisible) return;
        
        if (this.dashboardElement) {
            this.dashboardElement.remove();
            this.dashboardElement = null;
        }
        
        this.isVisible = false;
        console.log('📊 Performance dashboard hidden');
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    createDashboardUI() {
        this.dashboardElement = document.createElement('div');
        this.dashboardElement.id = 'performance-dashboard';
        this.dashboardElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 320px;
            background: rgba(0, 0, 0, 0.9);
            color: #00FF00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 8px;
            border: 2px solid #00FF00;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
        `;
        
        document.body.appendChild(this.dashboardElement);
        this.updateUI();
    }
    
    updateUI() {
        if (!this.dashboardElement) return;
        
        const html = `
            <div style="border-bottom: 1px solid #00FF00; margin-bottom: 8px; padding-bottom: 4px;">
                <strong>🎮 PERFORMANCE DASHBOARD</strong>
                <button onclick="window.perfDashboard.hide()" style="float: right; background: #FF4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">✕</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>
                    <div><strong>FPS:</strong> ${this.metrics.avgFPS.toFixed(1)}</div>
                    <div style="font-size: 10px; color: #888;">Min: ${this.metrics.minFPS.toFixed(1)} Max: ${this.metrics.maxFPS.toFixed(1)}</div>
                </div>
                <div>
                    <div><strong>Frame:</strong> ${this.metrics.avgFrameTime.toFixed(1)}ms</div>
                    <div style="font-size: 10px; color: #888;">Target: 16.67ms</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>
                    <div><strong>Entities:</strong> ${this.getEntityCount()}</div>
                </div>
                <div>
                    <div><strong>Effects:</strong> ${this.getParticleCount()}</div>
                </div>
            </div>
            
            ${this.renderSystemStats()}
            ${this.renderRecommendations()}
            ${this.renderControls()}
        `;
        
        this.dashboardElement.innerHTML = html;
    }
    
    renderSystemStats() {
        let html = '<div style="border-top: 1px solid #333; margin-top: 8px; padding-top: 8px; font-size: 11px;">';
        
        // Graphics system stats
        if (this.game.graphicsUpgrade) {
            const status = this.game.graphicsUpgrade.getStatus();
            html += `<div><strong>Graphics:</strong> ${status.qualitySettings?.effects || 'N/A'}</div>`;
            
            if (status.layeredRenderer) {
                html += `<div><strong>Layer Efficiency:</strong> ${status.layeredRenderer.efficiency}</div>`;
            }
            
            if (status.spriteManager) {
                html += `<div><strong>Sprite Hit Rate:</strong> ${status.spriteManager.hitRate}</div>`;
            }
        }
        
        html += `<div><strong>Memory:</strong> ~${this.metrics.memoryUsage.toFixed(1)}MB</div>`;
        html += '</div>';
        
        return html;
    }
    
    renderRecommendations() {
        if (this.recommendations.length === 0) {
            return '<div style="color: #00AA00; font-size: 11px; margin-top: 8px;">✅ Performance optimal</div>';
        }
        
        let html = '<div style="border-top: 1px solid #333; margin-top: 8px; padding-top: 8px; font-size: 11px;">';
        html += '<strong>📋 Recommendations:</strong><br>';
        
        this.recommendations.slice(0, 3).forEach(rec => {
            const color = rec.priority === 'high' ? '#FF4444' : 
                         rec.priority === 'medium' ? '#FFAA00' : '#AAAAAA';
            
            html += `<div style="color: ${color}; margin: 2px 0;">`;
            html += `• ${rec.message}`;
            if (rec.action) {
                html += ` <button onclick="window.perfDashboard.executeRecommendation('${rec.category}')" 
                          style="background: ${color}; color: white; border: none; padding: 1px 4px; 
                          border-radius: 2px; font-size: 9px; cursor: pointer;">Fix</button>`;
            }
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }
    
    renderControls() {
        return `
            <div style="border-top: 1px solid #333; margin-top: 8px; padding-top: 8px; font-size: 10px;">
                <strong>🎛️ Quick Controls:</strong><br>
                <button onclick="window.perfDashboard.optimizePerformance()" 
                        style="background: #00AA00; color: white; border: none; padding: 3px 6px; 
                        border-radius: 3px; margin: 2px; cursor: pointer;">Auto-Optimize</button>
                <button onclick="window.perfDashboard.resetMetrics()" 
                        style="background: #0066AA; color: white; border: none; padding: 3px 6px; 
                        border-radius: 3px; margin: 2px; cursor: pointer;">Reset Stats</button>
            </div>
        `;
    }
    
    // Control methods
    executeRecommendation(category) {
        const rec = this.recommendations.find(r => r.category === category);
        if (rec && rec.action) {
            rec.action();
            console.log(`📋 Executed recommendation: ${rec.message}`);
        }
    }
    
    optimizePerformance() {
        // Execute all high-priority recommendations
        this.recommendations
            .filter(rec => rec.priority === 'high' && rec.action)
            .forEach(rec => rec.action());
        
        console.log('🚀 Auto-optimization completed');
    }
    
    resetMetrics() {
        // Clear history
        Object.keys(this.history).forEach(key => {
            if (Array.isArray(this.history[key])) {
                this.history[key] = [];
            }
        });
        
        // Reset metrics
        this.metrics.minFPS = 60;
        this.metrics.maxFPS = 60;
        
        console.log('📊 Performance metrics reset');
    }
    
    // Export performance data
    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            history: this.history,
            recommendations: this.recommendations,
            systemInfo: {
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `vampire-survivors-performance-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📊 Performance data exported');
    }
    
    // Cleanup
    destroy() {
        this.stopMonitoring();
        this.hide();
        
        // Remove global reference
        if (window.perfDashboard === this) {
            delete window.perfDashboard;
        }
        
        console.log('🧹 PerformanceDashboard cleaned up');
    }
}

// Make globally accessible for UI buttons
if (typeof window !== 'undefined') {
    window.PerformanceDashboard = PerformanceDashboard;
}