// Telemetry system for progression curve analysis
export class ProgressionTelemetry {
    constructor(game) {
        this.game = game;
        this.enabled = true;
        
        // Data collection intervals
        this.sampleInterval = 5.0; // Sample every 5 seconds
        this.lastSampleTime = 0;
        
        // Progression data storage
        this.samples = [];
        this.maxSamples = 720; // 1 hour worth of 5-second samples
        
        // Real-time metrics
        this.currentMetrics = {
            gameTime: 0,
            playerLevel: 1,
            playerDPS: 0,
            enemyKillRate: 0,
            experienceRate: 0,
            difficultyMultiplier: 1.0,
            enemySpawnRate: 2.0,
            activeEnemyCount: 0,
            averageEnemyHealth: 20,
            totalDamageDealt: 0,
            totalEnemiesKilled: 0,
            weaponUpgradeCount: 0
        };
        
        // Tracking accumulators (reset each sample)
        this.sampleAccumulators = {
            damageDealt: 0,
            enemiesKilled: 0,
            experienceGained: 0,
            weaponsFired: 0,
            upgradesAcquired: 0
        };
        
        // Performance thresholds for analysis
        this.thresholds = {
            lowDPS: 50,        // Below this DPS = underpowered
            highDPS: 500,      // Above this DPS = overpowered
            lowKillRate: 2,    // Below this kills/sec = struggling
            highKillRate: 10,  // Above this kills/sec = too easy
            stagnantExp: 20    // Below this exp/sec = progression stalled
        };
        
        // Detected issues
        this.detectedIssues = [];
    }
    
    update(dt) {
        if (!this.enabled) return;
        
        this.currentMetrics.gameTime = this.game.gameTime;
        this.lastSampleTime += dt;
        
        // Collect real-time metrics
        this.updateCurrentMetrics();
        
        // Take sample if interval elapsed
        if (this.lastSampleTime >= this.sampleInterval) {
            this.takeSample();
            this.resetAccumulators();
            this.lastSampleTime = 0;
        }
    }
    
    updateCurrentMetrics() {
        const player = this.game.player;
        const enemySystem = this.game.systems.enemy;
        const expSystem = this.game.systems.experience;
        
        if (!player) return;
        
        // Player metrics
        this.currentMetrics.playerLevel = player.level;
        
        // Calculate current DPS based on weapons
        this.currentMetrics.playerDPS = this.calculatePlayerDPS();
        
        // Enemy metrics
        if (enemySystem) {
            this.currentMetrics.difficultyMultiplier = enemySystem.difficultyMultiplier;
            this.currentMetrics.enemySpawnRate = enemySystem.spawnRate;
            this.currentMetrics.activeEnemyCount = enemySystem.activeEnemies.length;
            this.currentMetrics.averageEnemyHealth = this.calculateAverageEnemyHealth();
        }
        
        // Calculate rates (per second)
        if (this.lastSampleTime > 0) {
            this.currentMetrics.enemyKillRate = this.sampleAccumulators.enemiesKilled / this.lastSampleTime;
            this.currentMetrics.experienceRate = this.sampleAccumulators.experienceGained / this.lastSampleTime;
        }
    }
    
    calculatePlayerDPS() {
        const player = this.game.player;
        if (!player || !player.weapons) return 0;
        
        let totalDPS = 0;
        
        for (const weapon of player.weapons.values()) {
            if (!weapon || !weapon.enabled) continue;
            
            const weaponDPS = (weapon.getEffectiveDamage() * (weapon.currentStats.projectiles + 1)) / 
                            weapon.getEffectiveCooldown();
            totalDPS += weaponDPS;
        }
        
        return totalDPS;
    }
    
    calculateAverageEnemyHealth() {
        const enemies = this.game.systems.enemy?.activeEnemies || [];
        if (enemies.length === 0) return 20;
        
        const totalHealth = enemies.reduce((sum, enemy) => sum + enemy.maxHealth, 0);
        return totalHealth / enemies.length;
    }
    
    takeSample() {
        const sample = {
            timestamp: this.currentMetrics.gameTime,
            level: this.currentMetrics.playerLevel,
            dps: this.currentMetrics.playerDPS,
            killRate: this.currentMetrics.enemyKillRate,
            expRate: this.currentMetrics.experienceRate,
            difficulty: this.currentMetrics.difficultyMultiplier,
            spawnRate: this.currentMetrics.enemySpawnRate,
            enemyCount: this.currentMetrics.activeEnemyCount,
            avgEnemyHP: this.currentMetrics.averageEnemyHealth,
            weaponCount: this.game.player?.weapons?.size || 0,
            playerHealth: this.game.player?.health || 0,
            playerMaxHealth: this.game.player?.maxHealth || 100
        };
        
        this.samples.push(sample);
        
        // Trim old samples
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
        
        // Analyze for progression issues
        this.analyzeProgressionIssues(sample);
        
        // Log significant milestones
        if (this.currentMetrics.gameTime % 60 < this.sampleInterval) {
            console.log(`📊 Progression: ${Math.floor(this.currentMetrics.gameTime/60)}min | Level ${sample.level} | DPS ${sample.dps.toFixed(0)} | Kill Rate ${sample.killRate.toFixed(1)}/s | Difficulty ${sample.difficulty.toFixed(1)}x`);
        }
    }
    
    analyzeProgressionIssues(sample) {
        const issues = [];
        
        // Only analyze after first minute to avoid early game noise
        if (sample.timestamp < 60) return;
        
        // Check for power imbalances
        if (sample.dps < this.thresholds.lowDPS) {
            issues.push({
                type: 'underpowered',
                severity: 'medium',
                description: `Player DPS (${sample.dps.toFixed(0)}) is below threshold (${this.thresholds.lowDPS})`,
                timestamp: sample.timestamp
            });
        }
        
        if (sample.dps > this.thresholds.highDPS) {
            issues.push({
                type: 'overpowered',
                severity: 'low',
                description: `Player DPS (${sample.dps.toFixed(0)}) is above threshold (${this.thresholds.highDPS})`,
                timestamp: sample.timestamp
            });
        }
        
        // Check kill rate vs enemy spawn rate
        const killDeficit = sample.spawnRate - sample.killRate;
        if (killDeficit > 3) {
            issues.push({
                type: 'overwhelmed',
                severity: 'high',
                description: `Enemy spawn rate (${sample.spawnRate.toFixed(1)}/s) exceeds kill rate (${sample.killRate.toFixed(1)}/s) by ${killDeficit.toFixed(1)}`,
                timestamp: sample.timestamp
            });
        }
        
        // Check for progression stagnation
        if (sample.expRate < this.thresholds.stagnantExp) {
            issues.push({
                type: 'stagnation',
                severity: 'medium',
                description: `Experience rate (${sample.expRate.toFixed(1)}/s) is below threshold (${this.thresholds.stagnantExp})`,
                timestamp: sample.timestamp
            });
        }
        
        // Add issues to detected list
        this.detectedIssues.push(...issues);
        
        // Keep only recent issues (last 5 minutes)
        this.detectedIssues = this.detectedIssues.filter(
            issue => sample.timestamp - issue.timestamp < 300
        );
    }
    
    resetAccumulators() {
        this.sampleAccumulators.damageDealt = 0;
        this.sampleAccumulators.enemiesKilled = 0;
        this.sampleAccumulators.experienceGained = 0;
        this.sampleAccumulators.weaponsFired = 0;
        this.sampleAccumulators.upgradesAcquired = 0;
    }
    
    // Event tracking methods (called by game systems)
    trackDamageDealt(amount) {
        this.sampleAccumulators.damageDealt += amount;
        this.currentMetrics.totalDamageDealt += amount;
    }
    
    trackEnemyKilled(enemy) {
        this.sampleAccumulators.enemiesKilled++;
        this.currentMetrics.totalEnemiesKilled++;
    }
    
    trackExperienceGained(amount) {
        this.sampleAccumulators.experienceGained += amount;
    }
    
    trackWeaponFired(weapon) {
        this.sampleAccumulators.weaponsFired++;
    }
    
    trackUpgrade(type) {
        this.sampleAccumulators.upgradesAcquired++;
        this.currentMetrics.weaponUpgradeCount++;
    }
    
    // Analysis and reporting
    getProgressionReport() {
        if (this.samples.length < 2) return null;
        
        const recent = this.samples.slice(-12); // Last minute
        const mid = this.samples.slice(-60, -12); // Previous 4 minutes
        const early = this.samples.slice(0, 12); // First minute
        
        return {
            currentMetrics: { ...this.currentMetrics },
            trends: this.calculateTrends(recent, mid),
            issues: this.detectedIssues,
            recommendations: this.generateRecommendations()
        };
    }
    
    calculateTrends(recent, mid) {
        if (recent.length === 0 || mid.length === 0) return {};
        
        const recentAvg = this.averageSamples(recent);
        const midAvg = this.averageSamples(mid);
        
        return {
            dpsChange: ((recentAvg.dps - midAvg.dps) / midAvg.dps * 100).toFixed(1) + '%',
            killRateChange: ((recentAvg.killRate - midAvg.killRate) / midAvg.killRate * 100).toFixed(1) + '%',
            difficultyChange: ((recentAvg.difficulty - midAvg.difficulty) / midAvg.difficulty * 100).toFixed(1) + '%'
        };
    }
    
    averageSamples(samples) {
        const sum = samples.reduce((acc, sample) => ({
            dps: acc.dps + sample.dps,
            killRate: acc.killRate + sample.killRate,
            difficulty: acc.difficulty + sample.difficulty
        }), { dps: 0, killRate: 0, difficulty: 0 });
        
        return {
            dps: sum.dps / samples.length,
            killRate: sum.killRate / samples.length,
            difficulty: sum.difficulty / samples.length
        };
    }
    
    generateRecommendations() {
        const recommendations = [];
        const highSeverityIssues = this.detectedIssues.filter(issue => issue.severity === 'high');
        
        if (highSeverityIssues.some(issue => issue.type === 'overwhelmed')) {
            recommendations.push({
                type: 'difficulty',
                action: 'Reduce enemy spawn rate or increase player damage multipliers after 5+ minutes'
            });
        }
        
        if (highSeverityIssues.some(issue => issue.type === 'underpowered')) {
            recommendations.push({
                type: 'balance',
                action: 'Increase weapon damage scaling or reduce enemy health growth rate'
            });
        }
        
        return recommendations;
    }
    
    render(ctx) {
        if (!this.enabled) return;
        
        // Render real-time stats overlay (bottom-left, dynamic sizing)
        const lineHeight = 16;
        const margin = 12;
        
        // Stats content
        const stats = [
            `Time: ${Math.floor(this.currentMetrics.gameTime / 60)}:${String(Math.floor(this.currentMetrics.gameTime % 60)).padStart(2, '0')}`,
            `Level: ${this.currentMetrics.playerLevel}`,
            `DPS: ${this.currentMetrics.playerDPS.toFixed(0)}`,
            `Kill Rate: ${this.currentMetrics.enemyKillRate.toFixed(1)}/s`,
            `Difficulty: ${this.currentMetrics.difficultyMultiplier.toFixed(1)}x`,
            `Spawn Rate: ${this.currentMetrics.enemySpawnRate.toFixed(1)}/s`,
            `Enemies: ${this.currentMetrics.activeEnemyCount}`,
            `Samples: ${this.samples.length}`
        ];
        
        const width = 300;
        const height = (stats.length + 2) * lineHeight + 20; // title + padding
        const canvasHeight = (ctx && ctx.canvas && ctx.canvas.height) ? ctx.canvas.height : 600;
        const x = margin;
        const y = canvasHeight - height - margin;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x - 5, y - 14, width + 10, height);
        
        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('📊 PROGRESSION TELEMETRY', x, y + lineHeight);
        
        // Stats
        ctx.font = '12px monospace';
        ctx.fillStyle = '#00FF00';
        stats.forEach((stat, index) => {
            ctx.fillText(stat, x, y + (index + 2) * lineHeight);
        });
    }
    
    exportData() {
        return {
            metadata: {
                exportTime: Date.now(),
                gameVersion: this.game.version || 'unknown',
                sampleCount: this.samples.length,
                gameTime: this.currentMetrics.gameTime
            },
            samples: this.samples,
            issues: this.detectedIssues,
            summary: this.getProgressionReport()
        };
    }
}
