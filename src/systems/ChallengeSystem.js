/**
 * ChallengeSystem — Optional run modifiers that increase gold multiplier.
 *
 * Unlocked after a 15-minute run (longestSurvival >= 900 s).
 * Players select 0–3 modifiers before starting. Each modifier stacks an
 * additive gold bonus that multiplies ALL gold earned that run.
 *
 * Active modifiers are read by other systems via:
 *   game.systems.challenge.hasModifier('id')   → boolean
 *   game.systems.challenge.getGoldMultiplier() → number  (e.g. 1.8)
 *   game.systems.challenge.activeModifiers     → Set<string>
 *
 * Modifier application happens in startGame() via applyToRun(player).
 */
export class ChallengeSystem {
    constructor(game) {
        this.game = game;

        /** IDs of modifiers selected for the NEXT run */
        this.pendingModifiers = new Set();

        /** IDs of modifiers ACTIVE in the current run */
        this.activeModifiers = new Set();

        /** Maximum modifiers selectable per run */
        this.maxActive = 3;

        // ── Modifier catalogue ───────────────────────────────────────────
        this.modifiers = [
            {
                id:          'glass_cannon',
                name:        '玻璃大炮',
                icon:        '💀',
                color:       '#FF4444',
                goldBonus:   0.50,  // +50% gold
                description: '玩家生命值减半',
                apply:       (player) => {
                    player.maxHealth = Math.ceil(player.maxHealth * 0.5);
                    player.health    = player.maxHealth;
                }
            },
            {
                id:          'swarm',
                name:        '蜂拥而至',
                icon:        '🐾',
                color:       '#FF8800',
                goldBonus:   0.30,
                description: '敌人生成率×2',
                apply:       () => {
                    if (this.game.systems.enemy)
                        this.game.systems.enemy.spawnRateMultiplier = 2.0;
                }
            },
            {
                id:          'no_heals',
                name:        '禁止治疗',
                icon:        '🚫',
                color:       '#FF6644',
                goldBonus:   0.40,
                description: '升级不再恢复满血',
                apply:       () => { /* read via hasModifier in selectLevelUpOption */ }
            },
            {
                id:          'speed_demon',
                name:        '速度狂魔',
                icon:        '⚡',
                color:       '#FFDD00',
                goldBonus:   0.25,
                description: '所有敌人移速提升30%',
                apply:       () => {
                    if (this.game.systems.enemy)
                        this.game.systems.enemy.enemySpeedMultiplier = 1.30;
                }
            },
            {
                id:          'famine',
                name:        '饥荒',
                icon:        '💀',
                color:       '#AA8833',
                goldBonus:   0.35,
                description: '经验宝石价值减半',
                apply:       () => { /* read via hasModifier in ExperienceSystem */ }
            },
            {
                id:          'iron_will',
                name:        '钢铁意志',
                icon:        '🛡️',
                color:       '#8888AA',
                goldBonus:   0.60,
                description: '无法拾取被动道具',
                apply:       () => { /* read via hasModifier in generateLevelUpOptions */ }
            }
        ];
    }

    // ── Public API ──────────────────────────────────────────────────────

    /** Is this modifier active in the current run? */
    hasModifier(id) {
        return this.activeModifiers.has(id);
    }

    /** Gold multiplier for the current run (1.0 = no bonus). */
    getGoldMultiplier() {
        let bonus = 0;
        for (const id of this.activeModifiers) {
            const mod = this.modifiers.find(m => m.id === id);
            if (mod) bonus += mod.goldBonus;
        }
        return 1 + bonus;
    }

    /** Check whether the challenge screen is unlocked (15-min run). */
    isUnlocked() {
        const r = this.game.systems.persistence?.data?.records;
        return r ? r.longestSurvival >= 900 : false;
    }

    /** Toggle a pending modifier (for the next run). */
    togglePending(id) {
        if (this.pendingModifiers.has(id)) {
            this.pendingModifiers.delete(id);
        } else if (this.pendingModifiers.size < this.maxActive) {
            this.pendingModifiers.add(id);
        }
    }

    /** Called from VampireSurvivorsGame.startGame() — activates pending modifiers. */
    applyToRun(player) {
        this.activeModifiers = new Set(this.pendingModifiers);
        for (const id of this.activeModifiers) {
            const mod = this.modifiers.find(m => m.id === id);
            if (mod && typeof mod.apply === 'function') mod.apply(player);
        }
    }

    /** Called from startGame() reset — clear per-run multipliers set by apply(). */
    resetRunState() {
        // Reset any system-level multipliers injected by apply()
        if (this.game.systems.enemy) {
            this.game.systems.enemy.spawnRateMultiplier  = 1.0;
            this.game.systems.enemy.enemySpeedMultiplier = 1.0;
        }
    }

    reset() {
        this.activeModifiers = new Set();
        this.resetRunState();
    }
}
