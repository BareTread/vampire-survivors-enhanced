import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

/**
 * KillMilestoneSystem — tracks total kills per run and triggers celebrations
 * at milestone thresholds: 100, 250, 500, 1000, 2500, 5000.
 *
 * Celebrations include: screen flash, bonus gem shower, floating milestone text,
 * temporary power-up, and an audio cue.
 *
 * Wire into VampireSurvivorsGame.systems.killMilestone.
 * Hook: Enemy.die() → game.systems.killMilestone.onEnemyKilled()
 */
export class KillMilestoneSystem {
    constructor(game) {
        this.game = game;
        this.totalKills = 0;
        this.nextMilestoneIndex = 0;

        this.milestones = [
            {
                threshold: 100,
                label: '击杀100！',
                reward: 'speedBoost',
                rewardDuration: 5,
                gemCount: 8,
                color: '#44FF44'
            },
            {
                threshold: 250,
                label: '击杀250！',
                reward: 'damageBoost',
                rewardDuration: 6,
                gemCount: 12,
                color: '#44BBFF'
            },
            {
                threshold: 500,
                label: '击杀500！',
                reward: 'fireRateBoost',
                rewardDuration: 8,
                gemCount: 16,
                color: '#BB44FF'
            },
            {
                threshold: 1000,
                label: '击杀1000！',
                reward: 'damageBoost',
                rewardDuration: 10,
                gemCount: 24,
                color: '#FFAA00'
            },
            {
                threshold: 2500,
                label: '击杀2500！',
                reward: 'invincible',
                rewardDuration: 5,
                gemCount: 32,
                color: '#FF4488'
            },
            {
                threshold: 5000,
                label: '击杀5000！',
                reward: 'damageBoost',
                rewardDuration: 12,
                gemCount: 48,
                color: '#FFD700'
            }
        ];

        // Active celebration display
        this.activeCelebration = null;
        this.celebrationTimer = 0;
        this.celebrationDuration = 3.0; // seconds to show milestone text
    }

    onEnemyKilled() {
        this.totalKills++;

        if (this.nextMilestoneIndex >= this.milestones.length) return;

        const milestone = this.milestones[this.nextMilestoneIndex];
        if (this.totalKills >= milestone.threshold) {
            this.triggerCelebration(milestone);
            this.nextMilestoneIndex++;
        }
    }

    triggerCelebration(milestone) {
        const player = this.game.player;
        if (!player) return;

        // 1. Screen flash
        if (this.game.camera) {
            this.game.camera.flash(milestone.color, 0.6);
        }

        // 2. Bonus gem shower around the player
        if (this.game.systems.experience) {
            for (let i = 0; i < milestone.gemCount; i++) {
                const angle = (i / milestone.gemCount) * Math.PI * 2;
                const dist = 80 + Math.random() * 120;
                const gx = player.x + Math.cos(angle) * dist;
                const gy = player.y + Math.sin(angle) * dist;
                this.game.systems.experience.createGem(gx, gy, 5 + Math.floor(Math.random() * 10));
            }
        }

        // 3. Floating milestone text
        if (globalDamageNumberPool) {
            globalDamageNumberPool.spawn(player.x, player.y - 40, milestone.label, milestone.color, 'MILESTONE');
        }

        // 4. Temporary power-up reward
        if (player.activatePowerUp) {
            player.activatePowerUp(milestone.reward, milestone.rewardDuration);
        }

        // 5. Audio cue
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('achievementUnlock', 0.45);
        }

        // 6. Particle burst
        if (this.game.systems.particle) {
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 60 + Math.random() * 120;
                this.game.systems.particle.create({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color: milestone.color,
                    size: 3 + Math.random() * 4,
                    lifetime: 1.0 + Math.random() * 0.5,
                    decay: 0.97,
                    type: 'circle'
                });
            }
        }

        // 7. Camera shake for dramatic effect
        if (this.game.camera) {
            this.game.camera.shake(12, 0.4, 'heavy');
        }

        // Set active celebration for HUD rendering
        this.activeCelebration = milestone;
        this.celebrationTimer = this.celebrationDuration;
    }

    update(dt) {
        if (this.celebrationTimer > 0) {
            this.celebrationTimer -= dt;
            if (this.celebrationTimer <= 0) {
                this.activeCelebration = null;
                this.celebrationTimer = 0;
            }
        }
    }

    render(ctx) {
        if (!this.activeCelebration || this.celebrationTimer <= 0) return;

        const alpha = Math.min(1, this.celebrationTimer / 0.5); // Fade out in last 0.5s
        const milestone = this.activeCelebration;
        const canvas = this.game.canvas;

        ctx.save();

        // Large centered milestone text
        const progress = 1 - this.celebrationTimer / this.celebrationDuration;
        const scale = 1 + Math.sin(progress * Math.PI) * 0.15; // Subtle pulse
        const y = canvas.height * 0.3 - progress * 20; // Drift upward

        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow
        ctx.shadowColor = milestone.color;
        ctx.shadowBlur = 20;

        // Main text
        ctx.font = `bold ${Math.floor(48 * scale)}px monospace`;
        ctx.fillStyle = milestone.color;
        ctx.fillText(milestone.label, canvas.width / 2, y);

        // Sub-text with kill count
        ctx.font = `${Math.floor(20 * scale)}px monospace`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 10;
        ctx.fillText(`Total Kills: ${this.totalKills}`, canvas.width / 2, y + 45);

        ctx.restore();
    }

    reset() {
        this.totalKills = 0;
        this.nextMilestoneIndex = 0;
        this.activeCelebration = null;
        this.celebrationTimer = 0;
    }
}
