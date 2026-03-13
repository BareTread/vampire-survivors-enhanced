import { BaseWeapon } from './BaseWeapon.js';

export class LightningChain extends BaseWeapon {
    constructor(game, player, config = {}) {
        const weaponConfig = {
            id: 'lightning_chain',
            name: 'Lightning Chain',
            description: 'Strikes the nearest enemy with lightning that chains to nearby foes',
            type: 'lightning',
            damage: 15,
            cooldown: 1.8,
            range: 300,
            speed: 0, // Not projectile-based
            duration: 0,
            projectiles: 1,
            piercing: 0,
            color: '#FFD700',
            size: 4,
            autoTarget: true,
            targetingRange: 300,
            canEvolve: true,
            maxLevel: 8,
            ...config
        };

        super(game, player, weaponConfig);

        // Lightning-specific properties
        this.chainCount = 2;
        this.chainRange = 150;
        this.chainDamageDecay = 0.8; // 80% damage per hop
        this.chainCritBonus = 0; // Extra crit chance on chains
        this.chainAreaDamage = 0; // Area damage at each chain point (radius)
        this.chainDamageMultiplier = 1.0;

        // Visual state — stores active chain visuals for animated rendering
        this.activeChains = []; // Array of { points: [{x,y}], alpha: 1, timer: 0 }
        this.chainVisualDuration = 0.25; // seconds the bolt stays visible

        // Level progression
        this.levelProgression = {
            1: { damage: 15, cooldown: 1.8, chains: 2, chainRange: 150 },
            2: { damage: 18, cooldown: 1.6, chains: 2, chainRange: 160 },
            3: { damage: 22, cooldown: 1.5, chains: 3, chainRange: 170 },
            4: { damage: 26, cooldown: 1.3, chains: 3, chainRange: 180, chainCritBonus: 0.15 },
            5: { damage: 30, cooldown: 1.2, chains: 4, chainRange: 200 },
            6: { damage: 35, cooldown: 1.0, chains: 4, chainRange: 220, chainAreaDamage: 30 },
            7: { damage: 40, cooldown: 0.8, chains: 5, chainRange: 250 },
            8: { damage: 50, cooldown: 0.6, chains: 6, chainRange: 300, chainDamageMultiplier: 2.0 }
        };
    }

    onFire() {
        const target = this.findTarget();
        if (!target) return;

        // Resolve chain targets
        const chainTargets = this.resolveChainTargets(target);

        // Apply damage along the chain
        this.applyChainDamage(chainTargets);

        // Create visual bolt
        this.createChainVisual(chainTargets);

        // Play lightning strike sound
        this.playLightningSound(chainTargets.length);

        // Particle effects at each hit point
        this.createChainParticles(chainTargets);
    }

    /**
     * Starting from the primary target, find up to `this.chainCount` additional
     * nearby enemies to chain to (no repeats).
     * Returns array of enemies in chain order (first element is primary target).
     */
    resolveChainTargets(primaryTarget) {
        const targets = [primaryTarget];
        const visited = new Set();
        visited.add(primaryTarget);

        let current = primaryTarget;

        for (let i = 0; i < this.chainCount; i++) {
            const nearby = this.game.systems.enemy.getEnemiesInRange(current.x, current.y, this.chainRange);

            let best = null;
            let bestDist = Infinity;

            for (const enemy of nearby) {
                if (visited.has(enemy) || !enemy.active) continue;
                const dx = enemy.x - current.x;
                const dy = enemy.y - current.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = enemy;
                }
            }

            if (!best) break; // No more valid targets

            targets.push(best);
            visited.add(best);
            current = best;
        }

        return targets;
    }

    applyChainDamage(chainTargets) {
        const baseDamageResult = this.calculateDamageWithPsychology();
        let currentDamage = baseDamageResult.damage * this.chainDamageMultiplier;

        for (let i = 0; i < chainTargets.length; i++) {
            const enemy = chainTargets[i];
            if (!enemy.active) continue;

            const damage = Math.round(currentDamage);

            // Roll for additional chain crit
            let isCritical = baseDamageResult.isCritical;
            if (!isCritical && i > 0 && this.chainCritBonus > 0) {
                isCritical = Math.random() < this.chainCritBonus;
            }

            const finalDamage = isCritical && !baseDamageResult.isCritical ? damage * 2.0 : damage;

            // Deal damage to enemy
            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(finalDamage, this.player);
            }

            // Area damage at chain point (level 6+)
            if (this.chainAreaDamage > 0) {
                this.applyAreaDamageAt(enemy.x, enemy.y, this.chainAreaDamage, finalDamage * 0.3, enemy);
            }

            // Enhanced hit feedback (reuse BaseWeapon infra)
            this.onHitEnemy(enemy, finalDamage, isCritical, chainTargets.length);
            // Decay damage for next chain
            currentDamage *= this.chainDamageDecay;
        }

        // Treasure chest damage — chain to chest if within range of any hit enemy
        const chest = this.game.systems.dynamicEvents?.activeChest;
        if (chest && chest.health > 0) {
            for (const target of chainTargets) {
                const cdx = chest.x - target.x;
                const cdy = chest.y - target.y;
                if (Math.sqrt(cdx * cdx + cdy * cdy) <= this.chainRange) {
                    chest.health -= Math.round(baseDamageResult.damage * 0.5);
                    break;
                }
            }
        }
    }

    applyAreaDamageAt(x, y, radius, damage, excludeEnemy) {
        const enemies = this.game.systems.enemy.getEnemiesInRange(x, y, radius);
        for (const enemy of enemies) {
            if (enemy === excludeEnemy || !enemy.active) continue;
            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(Math.round(damage), this.player);
            }
            // Small particle burst for area hit
            if (this.game.systems.particle) {
                this.game.systems.particle.create(enemy.x, enemy.y, {
                    vx: (Math.random() - 0.5) * 80,
                    vy: (Math.random() - 0.5) * 80,
                    life: 0.3,
                    size: 4,
                    color: '#87CEEB',
                    glow: true,
                    fadeOut: true
                });
            }
        }
    }

    // --- Visual rendering ---

    createChainVisual(chainTargets) {
        // Build point array: player -> target0 -> target1 -> ...
        const points = [{ x: this.player.x, y: this.player.y }];
        for (const t of chainTargets) {
            points.push({ x: t.x, y: t.y });
        }

        this.activeChains.push({
            points: points,
            alpha: 1.0,
            timer: this.chainVisualDuration,
            segments: this.generateJaggedSegments(points)
        });
    }

    /**
     * Pre-compute jagged lightning segments between each pair of points.
     * Returns array of segment arrays (one per link in the chain).
     */
    generateJaggedSegments(points) {
        const allSegments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            allSegments.push(this.jaggedLine(from.x, from.y, to.x, to.y));
        }
        return allSegments;
    }

    /**
     * Generate a jagged line (array of {x,y}) between two points,
     * simulating a lightning bolt with random perpendicular offsets.
     */
    jaggedLine(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const segCount = Math.max(4, Math.floor(len / 15));
        const perpX = -dy / len;
        const perpY = dx / len;

        const pts = [{ x: x1, y: y1 }];
        for (let i = 1; i < segCount; i++) {
            const t = i / segCount;
            const jitter = (Math.random() - 0.5) * len * 0.18;
            pts.push({
                x: x1 + dx * t + perpX * jitter,
                y: y1 + dy * t + perpY * jitter
            });
        }
        pts.push({ x: x2, y: y2 });
        return pts;
    }

    update(dt) {
        super.update(dt);

        // Decay active chain visuals
        for (let i = this.activeChains.length - 1; i >= 0; i--) {
            const chain = this.activeChains[i];
            chain.timer -= dt;
            chain.alpha = Math.max(0, chain.timer / this.chainVisualDuration);
            if (chain.timer <= 0) {
                this.activeChains.splice(i, 1);
            }
        }
    }

    render(renderer) {
        const ctx = renderer.ctx;
        if (this.activeChains.length === 0) return;

        ctx.save();

        for (const chain of this.activeChains) {
            const alpha = chain.alpha;
            if (alpha <= 0) continue;

            for (const segmentPts of chain.segments) {
                // Outer glow
                ctx.strokeStyle = `rgba(135, 206, 250, ${alpha * 0.3})`;
                ctx.lineWidth = 6;
                ctx.shadowColor = '#87CEFA';
                ctx.shadowBlur = 12 * alpha;
                ctx.beginPath();
                ctx.moveTo(segmentPts[0].x, segmentPts[0].y);
                for (let k = 1; k < segmentPts.length; k++) {
                    ctx.lineTo(segmentPts[k].x, segmentPts[k].y);
                }
                ctx.stroke();

                // Core bolt
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
                ctx.lineWidth = 2;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8 * alpha;
                ctx.beginPath();
                ctx.moveTo(segmentPts[0].x, segmentPts[0].y);
                for (let k = 1; k < segmentPts.length; k++) {
                    ctx.lineTo(segmentPts[k].x, segmentPts[k].y);
                }
                ctx.stroke();
            }

            // Draw impact circles at each target point (skip player origin)
            for (let p = 1; p < chain.points.length; p++) {
                const pt = chain.points[p];
                const radius = 8 + (1 - alpha) * 15;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.4})`;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 15 * alpha;
                ctx.fill();
            }
        }

        ctx.restore();

        // Charging indicator when almost ready
        if (this.cooldownTimer > 0) {
            this.renderChargingEffect(renderer);
        }
    }

    renderChargingEffect(renderer) {
        const ctx = renderer.ctx;
        const chargeProgress = 1 - this.cooldownTimer / this.getEffectiveCooldown();
        if (chargeProgress < 0.6) return;

        ctx.save();
        const time = performance.now() * 0.008;
        const sparkCount = 3;

        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + time;
            const dist = 18 + Math.sin(time * 4 + i * 2) * 6;
            const sx = this.player.x + Math.cos(angle) * dist;
            const sy = this.player.y + Math.sin(angle) * dist;

            ctx.fillStyle = `rgba(255, 215, 0, ${0.5 * chargeProgress})`;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // --- Audio ---

    playLightningSound(chainLength) {
        if (!this.game.audioManager) return;

        // Primary strike
        this.game.audioManager.playVampireSound('lightningStrike', 0.8, 1.0 + (this.level - 1) * 0.03);

        // Chain zap (slightly delayed, higher pitch for more chains)
        if (chainLength > 1) {
            const chainPitch = 1.1 + Math.min(0.5, chainLength * 0.08);
            setTimeout(() => {
                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('lightningChain', 0.5, chainPitch);
                }
            }, 60);
        }
    }

    // --- Particles ---

    createChainParticles(chainTargets) {
        if (!this.game.systems.particle) return;

        for (const target of chainTargets) {
            // Spark burst at each hit
            const count = 4 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 40 + Math.random() * 80;
                this.game.systems.particle.create(target.x, target.y, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.2 + Math.random() * 0.2,
                    size: 2 + Math.random() * 2,
                    color: Math.random() > 0.5 ? '#FFD700' : '#87CEFA',
                    glow: true,
                    fadeOut: true
                });
            }
        }
    }

    // --- Upgrades ---

    onUpgrade() {
        const levelStats = this.levelProgression[this.level];
        if (levelStats) {
            this.baseStats.damage = levelStats.damage;
            this.baseStats.cooldown = levelStats.cooldown;
            this.chainCount = levelStats.chains;
            this.chainRange = levelStats.chainRange;
            this.updateStats();

            if (levelStats.chainCritBonus !== undefined) {
                this.chainCritBonus = levelStats.chainCritBonus;
            }
            if (levelStats.chainAreaDamage !== undefined) {
                this.chainAreaDamage = levelStats.chainAreaDamage;
            }
            if (levelStats.chainDamageMultiplier !== undefined) {
                this.chainDamageMultiplier = levelStats.chainDamageMultiplier;
            }
        }

        // Upgrade flavor text
        switch (this.level) {
            case 3:
                this.description = 'Chains to 3 enemies';
                break;
            case 4:
                this.description = 'Chains crit +15%';
                break;
            case 6:
                this.description = 'Area damage at chain points';
                break;
            case 8:
                this.description = 'Double chain damage, 6 chains';
                break;
        }
    }

    // --- Overrides ---

    getSoundName() {
        return 'lightningStrike';
    }

    getMuzzleFlashColor() {
        return '#FFD700';
    }

    getSoundPitch() {
        return 1.0 + (this.level - 1) * 0.04;
    }

    getInfo() {
        return {
            name: this.name,
            level: this.level,
            damage: Math.floor(this.currentStats.damage),
            cooldown: this.currentStats.cooldown.toFixed(1),
            chains: this.chainCount,
            chainRange: this.chainRange,
            description: this.description
        };
    }

    static deserialize(game, player, data) {
        const weapon = new LightningChain(game, player);
        weapon.level = data.level || 1;
        weapon.enabled = data.enabled !== false;
        weapon.updateStats();

        for (let i = 2; i <= weapon.level; i++) {
            weapon.level = i;
            weapon.onUpgrade();
        }

        return weapon;
    }
}
