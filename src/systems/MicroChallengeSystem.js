/**
 * MicroChallengeSystem — Short In-Run Challenges with Rewards
 * 
 * PURPOSE:
 * Generates short, achievable challenges during gameplay that keep the player
 * engaged and provide small reward bursts. Creates memorable micro-moments
 * within each run.
 * 
 * HOW IT ACTIVATES:
 * 2 callsites already reference `game.systems.microChallenge` with null guards:
 * 
 *   - Enemy.js (L619-620): calls onEnemyKilled(enemy) on every kill
 *   - Player.js (L1678-1679): calls onPerfectAimShot() on precision shots
 * 
 * DESIGN:
 * - 6 challenge templates with randomized parameters
 * - One active challenge at a time
 * - 30s cooldown between challenges, first appears after 20s of gameplay
 * - Rewards: temporary XP boost (1.5x for 5s) via RewardsSystem
 * - Canvas-rendered challenge HUD (displayed below the main HUD)
 * 
 * NEXT AGENT NOTES:
 * - Challenge variety expands as more systems are added (boss kills, item combos)
 * - Could add difficulty scaling: harder challenges later in the run
 * - Sound effects for challenge start/complete use existing AudioManager sounds
 */

export class MicroChallengeSystem {
    constructor(game) {
        this.game = game;

        // Current challenge state
        this.activeChallenge = null;
        this.challengeCooldown = 20.0; // First challenge after 20s
        this.cooldownBetween = 30.0;   // 30s between challenges
        this.gameplayTime = 0;

        // Challenge progress tracking
        this.killsSinceChallenge = 0;
        this.damageTakenSinceChallenge = 0;
        this.perfectShotsSinceChallenge = 0;
        this.eliteKillsSinceChallenge = 0;

        // Notification state
        this.completionFlash = 0; // Timer for completion visual
        this.failFlash = 0;      // Timer for failure visual

        // Challenge templates
        this.templates = [
            {
                id: 'kill_spree',
                generate: () => {
                    const target = 15 + Math.floor(Math.random() * 20); // 15-34
                    const time = 10 + Math.floor(Math.random() * 6);    // 10-15s
                    return {
                        name: `Kill ${target} enemies`,
                        description: `Slay ${target} foes within ${time}s`,
                        type: 'kill_spree',
                        target,
                        timeLimit: time,
                        progress: 0
                    };
                }
            },
            {
                id: 'survive',
                generate: () => {
                    const time = 15 + Math.floor(Math.random() * 16); // 15-30s
                    return {
                        name: `Untouchable (${time}s)`,
                        description: `Survive ${time}s without taking damage`,
                        type: 'survive_nodamage',
                        target: time,
                        timeLimit: time,
                        progress: 0
                    };
                }
            },
            {
                id: 'combo_reach',
                generate: () => {
                    const target = 8 + Math.floor(Math.random() * 13); // 8-20
                    return {
                        name: `Combo ×${target}`,
                        description: `Reach a ${target}-hit combo`,
                        type: 'combo_reach',
                        target,
                        timeLimit: 20,
                        progress: 0
                    };
                }
            },
            {
                id: 'precision',
                generate: () => {
                    const target = 3 + Math.floor(Math.random() * 5); // 3-7
                    return {
                        name: `Sharpshooter`,
                        description: `Land ${target} perfect aim shots`,
                        type: 'precision',
                        target,
                        timeLimit: 25,
                        progress: 0
                    };
                }
            },
            {
                id: 'rapid_kills',
                generate: () => {
                    const target = 30 + Math.floor(Math.random() * 30); // 30-59
                    return {
                        name: `Exterminator`,
                        description: `Kill ${target} enemies (no time limit)`,
                        type: 'total_kills',
                        target,
                        timeLimit: 45,
                        progress: 0
                    };
                }
            },
            {
                id: 'speed_kills',
                generate: () => {
                    const target = 5 + Math.floor(Math.random() * 6); // 5-10
                    return {
                        name: `Blitz`,
                        description: `Kill ${target} enemies in 5 seconds`,
                        type: 'speed_kills',
                        target,
                        timeLimit: 5,
                        progress: 0
                    };
                }
            }
        ];
    }

    // === EVENT HANDLERS (called by existing callsites) ===

    /**
     * Called when an enemy is killed (Enemy.js L620)
     */
    onEnemyKilled(enemy) {
        this.killsSinceChallenge++;

        if (enemy && enemy.isElite) {
            this.eliteKillsSinceChallenge++;
        }

        if (!this.activeChallenge) return;

        const c = this.activeChallenge;
        if (c.type === 'kill_spree' || c.type === 'total_kills' || c.type === 'speed_kills') {
            c.progress++;
            if (c.progress >= c.target) {
                this.completeChallenge();
            }
        }
    }

    /**
     * Called on precision/perfect aim shots (Player.js L1679)
     */
    onPerfectAimShot() {
        this.perfectShotsSinceChallenge++;

        if (!this.activeChallenge) return;

        if (this.activeChallenge.type === 'precision') {
            this.activeChallenge.progress++;
            if (this.activeChallenge.progress >= this.activeChallenge.target) {
                this.completeChallenge();
            }
        }
    }

    // === CORE LOGIC ===

    /**
     * Start a new random challenge
     */
    startChallenge() {
        const template = this.templates[Math.floor(Math.random() * this.templates.length)];
        this.activeChallenge = template.generate();
        this.activeChallenge.timer = this.activeChallenge.timeLimit;
        this.activeChallenge.startTime = this.gameplayTime;

        // Reset counters
        this.killsSinceChallenge = 0;
        this.damageTakenSinceChallenge = 0;
        this.perfectShotsSinceChallenge = 0;
        this.eliteKillsSinceChallenge = 0;

        // Audio cue
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('challengeBell', 0.6);
        }

        // Toast
        if (this.game.showToast) {
            this.game.showToast(`⚔ Challenge: ${this.activeChallenge.name}`, '#FF8C00', 2000);
        }
    }

    /**
     * Complete the active challenge successfully
     */
    completeChallenge() {
        if (!this.activeChallenge) return;

        this.completionFlash = 1.0;

        // Reward: temporary XP boost via RewardsSystem
        if (this.game.systems.rewards && this.game.systems.rewards.applyTempXPBoost) {
            this.game.systems.rewards.applyTempXPBoost(1.5, 5.0);
        }

        // Audio
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('challengeComplete', 0.8);
        }

        // Toast
        if (this.game.showToast) {
            this.game.showToast('✅ Challenge Complete! XP ×1.5!', '#00FF88', 2500);
        }

        this.activeChallenge = null;
        this.challengeCooldown = this.cooldownBetween;
    }

    /**
     * Fail the active challenge (time ran out)
     */
    failChallenge() {
        if (!this.activeChallenge) return;

        this.failFlash = 0.5;

        // Subtle failure feedback - not punishing
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('challengeFail', 0.4);
        }

        this.activeChallenge = null;
        this.challengeCooldown = this.cooldownBetween * 0.5; // Shorter cooldown after failure
    }

    // === UPDATE & RENDER ===

    /**
     * Per-frame update
     */
    update(dt) {
        if (this.game.gameState !== 'playing') return;

        this.gameplayTime += dt;

        // Decay visual effects
        if (this.completionFlash > 0) this.completionFlash = Math.max(0, this.completionFlash - dt * 2);
        if (this.failFlash > 0) this.failFlash = Math.max(0, this.failFlash - dt * 3);

        // Active challenge logic
        if (this.activeChallenge) {
            this.activeChallenge.timer -= dt;

            // Survival challenge: time IS the progress
            if (this.activeChallenge.type === 'survive_nodamage') {
                // Check if player took damage (tracked via damageTakenSinceChallenge)
                const player = this.game.player;
                if (player && player.lastDamageTime !== undefined) {
                    const damageAge = this.gameplayTime - (player.lastDamageTime || 0);
                    if (damageAge < 0.1 && this.activeChallenge.timer < this.activeChallenge.timeLimit - 0.5) {
                        // Player took damage recently, fail
                        this.failChallenge();
                        return;
                    }
                }
                this.activeChallenge.progress = this.activeChallenge.timeLimit - this.activeChallenge.timer;
                if (this.activeChallenge.progress >= this.activeChallenge.target) {
                    this.completeChallenge();
                    return;
                }
            }

            // Combo challenge: read current combo from player
            if (this.activeChallenge.type === 'combo_reach') {
                const player = this.game.player;
                if (player && player.combo && player.combo.count >= this.activeChallenge.target) {
                    this.completeChallenge();
                    return;
                }
            }

            // Time expired = failure
            if (this.activeChallenge.timer <= 0) {
                this.failChallenge();
            }
        } else {
            // Cooldown between challenges
            this.challengeCooldown -= dt;
            if (this.challengeCooldown <= 0) {
                this.startChallenge();
            }
        }
    }

    /**
     * Render active challenge on canvas HUD
     */
    render(ctx, camera) {
        if (!this.activeChallenge && this.completionFlash <= 0) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;

        // Completion flash overlay
        if (this.completionFlash > 0) {
            ctx.globalAlpha = this.completionFlash * 0.15;
            ctx.fillStyle = '#00FF88';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        if (this.activeChallenge) {
            const c = this.activeChallenge;

            // Position: bottom center
            const boxWidth = 280;
            const boxHeight = 50;
            const x = (canvasWidth - boxWidth) / 2;
            const y = canvasHeight - 90;

            ctx.globalAlpha = 0.9;

            // Background
            const isUrgent = c.timer < 5;
            ctx.fillStyle = isUrgent
                ? 'rgba(60, 20, 20, 0.9)'
                : 'rgba(15, 25, 40, 0.9)';
            ctx.strokeStyle = isUrgent
                ? 'rgba(255, 100, 100, 0.8)'
                : 'rgba(255, 140, 0, 0.6)';
            ctx.lineWidth = 1.5;

            // Rounded rect
            const r = 8;
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

            // Progress bar
            const progressRatio = Math.min(1, c.progress / c.target);
            const barY = y + boxHeight - 6;
            const barWidth = boxWidth - 20;
            const barX = x + 10;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(barX, barY, barWidth, 3);

            ctx.fillStyle = progressRatio >= 1 ? '#00FF88' : '#FF8C00';
            ctx.fillRect(barX, barY, barWidth * progressRatio, 3);

            // Challenge name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`⚔ ${c.name}`, x + 12, y + 18);

            // Timer
            ctx.fillStyle = isUrgent ? '#FF6B6B' : '#FFD700';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.ceil(c.timer)}s`, x + boxWidth - 12, y + 18);

            // Progress text
            ctx.fillStyle = '#B0C4DE';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left';
            if (c.type === 'survive_nodamage') {
                ctx.fillText(`${Math.floor(c.progress)}/${c.target}s survived`, x + 12, y + 35);
            } else {
                ctx.fillText(`${c.progress}/${c.target}`, x + 12, y + 35);
            }
        }

        ctx.restore();
    }

    /**
     * Reset for new run
     */
    reset() {
        this.activeChallenge = null;
        this.challengeCooldown = 20.0;
        this.gameplayTime = 0;
        this.killsSinceChallenge = 0;
        this.damageTakenSinceChallenge = 0;
        this.perfectShotsSinceChallenge = 0;
        this.eliteKillsSinceChallenge = 0;
        this.completionFlash = 0;
        this.failFlash = 0;
    }

    getDebugInfo() {
        return {
            active: this.activeChallenge ? this.activeChallenge.name : 'None',
            cooldown: this.challengeCooldown > 0 ? this.challengeCooldown.toFixed(1) : 'Ready',
            progress: this.activeChallenge
                ? `${this.activeChallenge.progress}/${this.activeChallenge.target}`
                : 'N/A',
            timer: this.activeChallenge ? this.activeChallenge.timer.toFixed(1) : 'N/A'
        };
    }
}
