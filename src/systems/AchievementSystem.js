/**
 * AchievementSystem — In-Game Achievement Tracking with Visual Notifications
 * 
 * PURPOSE:
 * Tracks player milestones and triggers satisfying popup notifications when
 * achievements are unlocked. Persists unlocked achievements to localStorage.
 * 
 * HOW IT ACTIVATES:
 * 7+ callsites already reference `game.systems.achievement` with null guards:
 * 
 *   - BaseWeapon.js (L813-814): calls updateStats('skillfulShots', 1)
 *   - Player.js (L849-850): calls onComboAchieved(count)
 *   - Player.js (L1152-1153): calls onNearDeathSurvival()
 *   - Player.js (L1304-1305): calls onDamageTaken(damage)
 *   - Player.js (L1673-1674): calls updateStats('perfectAimShots', 1)
 *   - Enemy.js (L613-614): calls onEnemyKilled(enemy, wasCritical)
 *   - EnemySystem.js (L651-652): calls onWaveCompleted(wave, wasPerfect)
 * 
 * DESIGN:
 * - 12 achievements covering kills, combos, survival, accuracy, and waves
 * - Canvas-rendered popup notifications with slide-in animation
 * - Persisted to localStorage under key 'vs_achievements'
 * - Stats tracked: totalKills, maxCombo, wavesCompleted, criticalKills,
 *   nearDeathSurvivals, skillfulShots, perfectAimShots, totalDamageTaken
 * 
 * NEXT AGENT NOTES:
 * - Achievement UI can be extended with a full achievement gallery in LEGACY
 * - Add more achievements as new features arrive (boss kills, weapon evolutions)
 * - The notification system uses a queue to avoid overlapping popups
 */

export class AchievementSystem {
    constructor(game) {
        this.game = game;

        // Tracked statistics (incremented by callsites)
        this.stats = {
            totalKills: 0,
            criticalKills: 0,
            maxCombo: 0,
            wavesCompleted: 0,
            perfectWaves: 0,
            nearDeathSurvivals: 0,
            skillfulShots: 0,
            perfectAimShots: 0,
            totalDamageTaken: 0,
            survivalTime: 0 // tracked per frame
        };

        // Achievement definitions
        this.achievements = [
            {
                id: 'first_blood',
                name: '🗡️ 初次击杀',
                description: '击杀第一个敌人',
                condition: (s) => s.totalKills >= 1,
                unlocked: false
            },
            {
                id: 'century_kill',
                name: '💀 百人斩',
                description: '单局击杀100个敌人',
                condition: (s) => s.totalKills >= 100,
                unlocked: false
            },
            {
                id: 'massacre',
                name: '☠️ 大屠杀',
                description: '单局击杀500个敌人',
                condition: (s) => s.totalKills >= 500,
                unlocked: false
            },
            {
                id: 'apocalypse',
                name: '🔥 末日审判',
                description: '单局击杀1000个敌人',
                condition: (s) => s.totalKills >= 1000,
                unlocked: false
            },
            {
                id: 'combo_initiate',
                name: '⚡ 连击入门',
                description: '达成10连击',
                condition: (s) => s.maxCombo >= 10,
                unlocked: false
            },
            {
                id: 'combo_king',
                name: '👑 连击之王',
                description: '达成25连击',
                condition: (s) => s.maxCombo >= 25,
                unlocked: false
            },
            {
                id: 'combo_legend',
                name: '🌟 连击传奇',
                description: '达成50连击',
                condition: (s) => s.maxCombo >= 50,
                unlocked: false
            },
            {
                id: 'wave_survivor_5',
                name: '🌊 波次行者',
                description: '生存5波',
                condition: (s) => s.wavesCompleted >= 5,
                unlocked: false
            },
            {
                id: 'wave_survivor_10',
                name: '🏔️ 波次大师',
                description: '生存10波',
                condition: (s) => s.wavesCompleted >= 10,
                unlocked: false
            },
            {
                id: 'near_death',
                name: '💔 鬼门关',
                description: '在濒死状态下存活',
                condition: (s) => s.nearDeathSurvivals >= 1,
                unlocked: false
            },
            {
                id: 'marksman',
                name: '🎯 神射手',
                description: '完成10次精准射击',
                condition: (s) => s.perfectAimShots >= 10,
                unlocked: false
            },
            {
                id: 'endurance_5',
                name: '⏰ 坚韧不拔',
                description: '生存5分钟',
                condition: (s) => s.survivalTime >= 300,
                unlocked: false
            }
        ];

        // Notification queue (rendered as canvas overlays)
        this.activeNotifications = [];
        this.notificationQueue = [];
        this.maxVisibleNotifications = 2;
        this.notificationDuration = 3.5; // seconds

        // Track which achievements were unlocked in previous sessions
        this.persistedUnlocks = new Set();
        this.loadFromStorage();
    }

    // === EVENT HANDLERS (called by existing callsites) ===

    /**
     * Called when an enemy is killed (Enemy.js L614)
     */
    onEnemyKilled(enemy, wasCritical = false) {
        this.stats.totalKills++;
        if (wasCritical) {
            this.stats.criticalKills++;
        }
        this.checkAchievements();
    }

    /**
     * Called when a combo milestone is reached (Player.js L850)
     */
    onComboAchieved(count) {
        if (count > this.stats.maxCombo) {
            this.stats.maxCombo = count;
        }
        this.checkAchievements();
    }

    /**
     * Called when player survives at very low health (Player.js L1153)
     */
    onNearDeathSurvival() {
        this.stats.nearDeathSurvivals++;
        this.checkAchievements();
    }

    /**
     * Called when player takes damage (Player.js L1305)
     */
    onDamageTaken(damage) {
        this.stats.totalDamageTaken += damage;
    }

    /**
     * Called when a wave is completed (EnemySystem.js L652)
     */
    onWaveCompleted(wave, wasPerfect = false) {
        this.stats.wavesCompleted++;
        if (wasPerfect) {
            this.stats.perfectWaves++;
        }
        this.checkAchievements();
    }

    /**
     * Called to increment a specific stat (BaseWeapon.js L814, Player.js L1674)
     */
    updateStats(statName, value) {
        if (this.stats[statName] !== undefined) {
            this.stats[statName] += value;
            this.checkAchievements();
        }
    }

    // === CORE LOGIC ===

    /**
     * Check all achievements and unlock any newly completed ones
     */
    checkAchievements() {
        for (const achievement of this.achievements) {
            if (!achievement.unlocked && achievement.condition(this.stats)) {
                this.unlockAchievement(achievement);
            }
        }
    }

    /**
     * Unlock an achievement: mark it, queue notification, persist, play sound
     */
    unlockAchievement(achievement) {
        achievement.unlocked = true;
        this.persistedUnlocks.add(achievement.id);
        this.saveToStorage();

        // Queue notification
        this.notificationQueue.push({
            name: achievement.name,
            description: achievement.description,
            timer: 0,
            alpha: 0,
            slideOffset: 50, // pixels to slide in from
            phase: 'entering' // entering, visible, exiting
        });

        // Play achievement sound
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('achievementUnlock', 0.4);
        }

        // Also show toast for redundancy
        if (this.game.showToast) {
            this.game.showToast(`🏆 ${achievement.name}`, '#FFD700', 2500);
        }
    }

    // === UPDATE & RENDER ===

    /**
     * Per-frame update: track survival time and animate notifications
     */
    update(dt) {
        // Track survival time
        if (this.game.gameState === 'playing') {
            this.stats.survivalTime += dt;

            // Check time-based achievements periodically (every second)
            if (Math.floor(this.stats.survivalTime) !== Math.floor(this.stats.survivalTime - dt)) {
                this.checkAchievements();
            }
        }

        // Promote queued notifications
        while (
            this.notificationQueue.length > 0 &&
            this.activeNotifications.length < this.maxVisibleNotifications
        ) {
            this.activeNotifications.push(this.notificationQueue.shift());
        }

        // Animate active notifications
        for (let i = this.activeNotifications.length - 1; i >= 0; i--) {
            const notif = this.activeNotifications[i];
            notif.timer += dt;

            if (notif.phase === 'entering') {
                notif.alpha = Math.min(1, notif.alpha + dt * 4);
                notif.slideOffset = Math.max(0, notif.slideOffset - dt * 200);
                if (notif.alpha >= 1 && notif.slideOffset <= 0) {
                    notif.phase = 'visible';
                }
            } else if (notif.phase === 'visible') {
                if (notif.timer >= this.notificationDuration) {
                    notif.phase = 'exiting';
                }
            } else if (notif.phase === 'exiting') {
                notif.alpha = Math.max(0, notif.alpha - dt * 3);
                notif.slideOffset += dt * 150;
                if (notif.alpha <= 0) {
                    this.activeNotifications.splice(i, 1);
                }
            }
        }
    }

    /**
     * Render achievement notification popups on canvas
     */
    render(ctx, camera) {
        if (this.activeNotifications.length === 0) return;

        ctx.save();
        // Reset transform so we draw in screen space
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const canvasWidth = ctx.canvas.width;

        for (let i = 0; i < this.activeNotifications.length; i++) {
            const notif = this.activeNotifications[i];

            // Position: top-center, stacked vertically
            const boxWidth = 320;
            const boxHeight = 60;
            const x = (canvasWidth - boxWidth) / 2 + notif.slideOffset;
            const y = 80 + i * 75;

            ctx.globalAlpha = notif.alpha;

            // Background
            ctx.fillStyle = 'rgba(15, 15, 35, 0.92)';
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = 2;

            // Rounded rect
            const r = 10;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + boxWidth - r, y);
            ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + r);
            ctx.lineTo(x + boxWidth, y + boxHeight - r);
            ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - r, y + boxHeight);
            ctx.lineTo(x + r, y + boxHeight);
            ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Gold shimmer on border
            ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // "ACHIEVEMENT UNLOCKED" header
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🏆 成就解锁!', x + boxWidth / 2, y + 18);

            // Achievement name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(notif.name, x + boxWidth / 2, y + 36);

            // Description
            ctx.fillStyle = '#B0B0D0';
            ctx.font = '11px Arial';
            ctx.fillText(notif.description, x + boxWidth / 2, y + 52);
        }

        ctx.restore();
    }

    // === PERSISTENCE ===

    saveToStorage() {
        try {
            const data = {
                unlocked: Array.from(this.persistedUnlocks),
                version: 1
            };
            localStorage.setItem('vs_achievements', JSON.stringify(data));
        } catch (e) {
            // localStorage may be unavailable
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('vs_achievements');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.unlocked) {
                    this.persistedUnlocks = new Set(data.unlocked);
                    // Mark previously unlocked achievements
                    for (const achievement of this.achievements) {
                        if (this.persistedUnlocks.has(achievement.id)) {
                            achievement.unlocked = true;
                        }
                    }
                }
            }
        } catch (e) {
            // localStorage may be unavailable or corrupt
        }
    }

    /**
     * Reset run-specific stats (keep persisted unlocks)
     */
    reset() {
        this.stats.totalKills = 0;
        this.stats.criticalKills = 0;
        this.stats.maxCombo = 0;
        this.stats.wavesCompleted = 0;
        this.stats.perfectWaves = 0;
        this.stats.nearDeathSurvivals = 0;
        this.stats.skillfulShots = 0;
        this.stats.perfectAimShots = 0;
        this.stats.totalDamageTaken = 0;
        this.stats.survivalTime = 0;

        // Re-lock run-based achievements (they can be re-earned each run)
        // But keep persisted unlocks marked
        for (const achievement of this.achievements) {
            achievement.unlocked = this.persistedUnlocks.has(achievement.id);
        }

        this.activeNotifications = [];
        this.notificationQueue = [];
    }

    /**
     * Get list of all achievements with status
     */
    getAchievementList() {
        return this.achievements.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            unlocked: a.unlocked
        }));
    }

    getDebugInfo() {
        const unlocked = this.achievements.filter(a => a.unlocked).length;
        return {
            unlocked: `${unlocked}/${this.achievements.length}`,
            stats: { ...this.stats },
            activeNotifications: this.activeNotifications.length,
            queuedNotifications: this.notificationQueue.length
        };
    }
}
