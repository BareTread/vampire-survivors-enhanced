import { globalDamageNumberPool } from '../core/DamageNumberPool.js';

/**
 * WeaponEvolutionSystem — Max-Level Weapon + Passive Item = Evolved Super Weapon
 *
 * When a weapon reaches max level (8) AND the player owns a specific passive item,
 * the weapon becomes eligible for evolution. Evolution is offered as a special
 * golden level-up option. When chosen, the weapon transforms in-place with:
 *   - A new name and evolved color
 *   - Dramatically boosted stats (2-3x multipliers)
 *   - Special evolved visual effects
 *   - A legendary reveal sequence (slow-mo, white flash, camera shake)
 *
 * Evolution Recipes (8 weapons × 1 recipe each):
 *   Magic Missile  + Empty Tome   → Soul Missile     (homing + piercing + 2x damage)
 *   Whip           + Spinach      → Bloody Tear       (life steal + 2x range)
 *   Throwing Knife + Duplicator   → Thousand Edge     (5x projectiles + penetrate)
 *   Lightning Chain+ Duplicator   → Thunder Loop      (12 chains + area stun)
 *   Garlic Aura    + Attractorb   → Soul Eater        (3x radius + pulls enemies)
 *   Holy Bible     + Armor        → Unholy Vespers    (6 orbiters + explosion trail)
 *   Fire Wand      + Spinach      → Hellfire          (3x damage + permanent burns)
 *   Bone Boomerang + Wings        → Death Spiral      (3x boomerangs + constant spin)
 */

export class WeaponEvolutionSystem {
    constructor(game) {
        this.game = game;

        // Evolution recipes: weaponId → { requiredPassive, evolvedName, evolvedColor, statMultipliers, description }
        this.recipes = new Map([
            [
                'magic_missile',
                {
                    requiredPassive: 'empty_tome',
                    evolvedName: 'Soul Missile',
                    evolvedColor: '#FF00FF',
                    glowColor: 'rgba(255,0,255,0.4)',
                    description: 'Homing missiles that pierce all enemies',
                    statMultipliers: {
                        damage: 2.0,
                        cooldown: 0.5, // Half cooldown
                        piercing: 999, // Pierce everything
                        speed: 1.5,
                        projectiles: 2
                    },
                    specialAbility: 'homing_pierce'
                }
            ],
            [
                'whip',
                {
                    requiredPassive: 'spinach',
                    evolvedName: 'Bloody Tear',
                    evolvedColor: '#DC143C',
                    glowColor: 'rgba(220,20,60,0.4)',
                    description: 'Life-stealing whip with massive range',
                    statMultipliers: {
                        damage: 1.8,
                        range: 2.0,
                        area: 1.8,
                        duration: 1.5
                    },
                    specialAbility: 'life_steal'
                }
            ],
            [
                'throwing_knife',
                {
                    requiredPassive: 'duplicator',
                    evolvedName: 'Thousand Edge',
                    evolvedColor: '#00FFFF',
                    glowColor: 'rgba(0,255,255,0.4)',
                    description: 'A storm of blades that shreds everything',
                    statMultipliers: {
                        projectiles: 5,
                        speed: 1.6,
                        damage: 1.3,
                        piercing: 3
                    },
                    specialAbility: 'blade_storm'
                }
            ],
            [
                'lightning_chain',
                {
                    requiredPassive: 'duplicator',
                    evolvedName: 'Thunder Loop',
                    evolvedColor: '#7DF9FF',
                    glowColor: 'rgba(125,249,255,0.5)',
                    description: 'Chains to 12 enemies with stunning force',
                    statMultipliers: {
                        damage: 2.2,
                        range: 1.8,
                        cooldown: 0.6
                    },
                    specialAbility: 'chain_stun',
                    specialStats: { maxChains: 12, stunDuration: 0.5 }
                }
            ],
            [
                'garlic_aura',
                {
                    requiredPassive: 'attractorb',
                    evolvedName: 'Soul Eater',
                    evolvedColor: '#9400D3',
                    glowColor: 'rgba(148,0,211,0.35)',
                    description: 'Pulls enemies in and devours them',
                    statMultipliers: {
                        damage: 2.5,
                        range: 3.0,
                        area: 2.5
                    },
                    specialAbility: 'enemy_pull'
                }
            ],
            [
                'holy_bible',
                {
                    requiredPassive: 'armor',
                    evolvedName: 'Unholy Vespers',
                    evolvedColor: '#8B0000',
                    glowColor: 'rgba(139,0,0,0.4)',
                    description: '6 orbiters with explosive trails',
                    statMultipliers: {
                        damage: 2.0,
                        area: 1.5,
                        duration: 2.0
                    },
                    specialAbility: 'explosive_orbit',
                    specialStats: { orbiterCount: 6 }
                }
            ],
            [
                'fire_wand',
                {
                    requiredPassive: 'spinach',
                    evolvedName: 'Hellfire',
                    evolvedColor: '#FF4500',
                    glowColor: 'rgba(255,69,0,0.5)',
                    description: 'Cataclysmic fireballs with permanent burns',
                    statMultipliers: {
                        damage: 3.0,
                        area: 2.0,
                        duration: 3.0,
                        cooldown: 0.7
                    },
                    specialAbility: 'permanent_burn'
                }
            ],
            [
                'bone_boomerang',
                {
                    requiredPassive: 'wings',
                    evolvedName: 'Death Spiral',
                    evolvedColor: '#ADFF2F',
                    glowColor: 'rgba(173,255,47,0.4)',
                    description: 'Triple boomerangs in a constant death spin',
                    statMultipliers: {
                        damage: 2.0,
                        projectiles: 3,
                        speed: 1.8,
                        range: 1.5
                    },
                    specialAbility: 'death_spin'
                }
            ],
            [
                'ice_shard',
                {
                    requiredPassive: 'empty_tome',
                    evolvedName: 'Blizzard',
                    evolvedColor: '#B3E5FF',
                    glowColor: 'rgba(179,229,255,0.5)',
                    description: 'Constant ice storm — 50% slow to all nearby enemies',
                    statMultipliers: {
                        damage:     1.8,
                        cooldown:   0.55,
                        projectiles: 2,
                        area:       1.6
                    },
                    specialStats: { freezeDuration: 4.5, aoeRadius: 140 },
                    specialAbility: 'blizzard_storm'
                }
            ],
            [
                'shadow_dagger',
                {
                    requiredPassive: 'wings',
                    evolvedName: 'Phantom Assassin',
                    evolvedColor: '#4C1D95',
                    glowColor: 'rgba(76,29,149,0.5)',
                    description: 'Daggers chain through 5 enemies; each hit spawns a shadow clone',
                    statMultipliers: {
                        damage:   2.2,
                        cooldown: 0.6
                    },
                    specialStats: { chainCount: 4, bleedChance: 0.9 },
                    specialAbility: 'phantom_chain'
                }
            ]
        ]);

        // Track which weapons have been evolved this run
        this.evolvedWeapons = new Set();
    }

    // ── PUBLIC API ──────────────────────────────────────────────

    /**
     * Check which weapons are eligible for evolution.
     * Returns array of { weaponId, recipe } for eligible evolutions.
     */
    getAvailableEvolutions() {
        const player = this.game.player;
        if (!player) return [];

        const passiveItems = this.game.systems.passiveItems;
        if (!passiveItems) return [];

        const available = [];

        for (const weapon of player.weapons.values()) {
            // Skip already-evolved weapons
            if (weapon.evolved || this.evolvedWeapons.has(weapon.id)) continue;

            // Must be at max level
            if (weapon.level < weapon.maxLevel) continue;

            const recipe = this.recipes.get(weapon.id);
            if (!recipe) continue;

            // Check if player has the required passive item
            if (!passiveItems.items.has(recipe.requiredPassive)) continue;

            available.push({ weaponId: weapon.id, recipe });
        }

        return available;
    }

    /**
     * Generate evolution options for the level-up UI.
     * These are offered as special legendary-tier options.
     */
    getEvolutionOptions() {
        const available = this.getAvailableEvolutions();
        return available.map(({ weaponId, recipe }) => ({
            type: 'evolution',
            weaponId,
            name: `⚡ ${recipe.evolvedName}`,
            description: recipe.description,
            rarity: 'legendary',
            recipe
        }));
    }

    /**
     * Evolve a weapon. This is the Big Moment.
     * @param {string} weaponId — The weapon to evolve
     * @returns {boolean} true if evolution succeeded
     */
    evolveWeapon(weaponId) {
        const player = this.game.player;
        if (!player) return false;

        const weapon = player.weapons.get(weaponId);
        if (!weapon) return false;

        const recipe = this.recipes.get(weaponId);
        if (!recipe) return false;

        // ── Apply Evolution ──────────────────────────────────
        weapon.evolved = true;
        weapon.evolvedName = recipe.evolvedName;
        weapon.evolvedColor = recipe.evolvedColor;
        weapon.evolvedGlowColor = recipe.glowColor;
        weapon.specialAbility = recipe.specialAbility;

        // Store original name for reference
        weapon._preEvolveName = weapon.name;
        weapon.name = recipe.evolvedName;
        weapon.color = recipe.evolvedColor;

        // Apply stat multipliers to current stats
        for (const [stat, multiplier] of Object.entries(recipe.statMultipliers)) {
            if (stat === 'cooldown') {
                // Cooldown multiplier < 1 means faster
                weapon.currentStats.cooldown *= multiplier;
                weapon.baseStats.cooldown *= multiplier;
            } else if (stat === 'piercing') {
                weapon.currentStats.piercing = multiplier;
                weapon.baseStats.piercing = multiplier;
            } else if (stat === 'projectiles') {
                weapon.currentStats.projectiles = Math.floor(weapon.currentStats.projectiles * multiplier);
                weapon.baseStats.projectiles = weapon.currentStats.projectiles;
            } else if (weapon.currentStats[stat] !== undefined) {
                weapon.currentStats[stat] *= multiplier;
                weapon.baseStats[stat] *= multiplier;
            }
        }

        // Apply any special stats
        if (recipe.specialStats) {
            for (const [key, value] of Object.entries(recipe.specialStats)) {
                weapon[key] = value;
            }
        }

        // Track evolution
        this.evolvedWeapons.add(weaponId);

        // ── Dramatic Reveal Sequence ─────────────────────────

        // 1. Screen effects: slow-mo + flash + shake
        if (this.game.systems.screenEffects) {
            this.game.systems.screenEffects.triggerEvolutionReveal();
        }

        // 2. Massive particle burst in evolved color
        const particle = this.game.systems.particle;
        if (particle) {
            // Ring explosion
            const px = player.x;
            const py = player.y;
            const color = recipe.evolvedColor;

            // Central starburst
            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2;
                const speed = 150 + Math.random() * 200;
                particle.create(px, py, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    color: color,
                    size: 4 + Math.random() * 4,
                    lifetime: 1.2 + Math.random() * 0.6,
                    fadeOut: true,
                    glow: true,
                    shrink: true
                });
            }

            // Sparkle ring (delayed feel)
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
                const dist = 40 + Math.random() * 30;
                particle.create(px + Math.cos(angle) * dist, py + Math.sin(angle) * dist, {
                    vx: Math.cos(angle) * 50,
                    vy: Math.sin(angle) * 50 - 40,
                    color: '#FFFFFF',
                    size: 2 + Math.random() * 3,
                    lifetime: 0.8 + Math.random() * 0.4,
                    fadeOut: true,
                    glow: true
                });
            }

            // Rising golden sparkles
            for (let i = 0; i < 12; i++) {
                particle.create(px + (Math.random() - 0.5) * 60, py + (Math.random() - 0.5) * 20, {
                    vx: (Math.random() - 0.5) * 30,
                    vy: -80 - Math.random() * 60,
                    color: '#FFD700',
                    size: 2 + Math.random() * 2,
                    lifetime: 1.5 + Math.random() * 0.5,
                    fadeOut: true,
                    glow: true,
                    shrink: true
                });
            }
        }

        // 3. Floating evolution text
        if (globalDamageNumberPool) {
            globalDamageNumberPool.spawn(player.x, player.y - 30, recipe.evolvedName, recipe.evolvedColor);
            globalDamageNumberPool.spawn(player.x, player.y - 50, 'EVOLVED!', '#FFD700');
        }

        // 4. Audio cue
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('weaponEvolution', 0.6);
        }

        // 5. Camera gold flash
        if (this.game.camera) {
            this.game.camera.flash('#FFD700', 0.6);
        }

        if (typeof weapon.updateStats === 'function') {
            weapon.updateStats();
        }

        return true;
    }

    /**
     * Get info about a weapon's evolution recipe (for UI tooltips).
     */
    getRecipeInfo(weaponId) {
        const recipe = this.recipes.get(weaponId);
        if (!recipe) return null;

        const passiveItems = this.game.systems.passiveItems;
        const hasPassive = passiveItems ? passiveItems.items.has(recipe.requiredPassive) : false;

        const player = this.game.player;
        const weapon = player ? player.weapons.get(weaponId) : null;
        const isMaxLevel = weapon ? weapon.level >= weapon.maxLevel : false;

        return {
            evolvedName: recipe.evolvedName,
            requiredPassive: recipe.requiredPassive,
            hasPassive,
            isMaxLevel,
            isEligible: hasPassive && isMaxLevel && !this.evolvedWeapons.has(weaponId),
            description: recipe.description
        };
    }

    update(dt) {
        // Evolution system is event-driven (checked during level-up),
        // but we update evolved weapon visual effects each frame
        if (!this.game.player) return;

        for (const weapon of this.game.player.weapons.values()) {
            if (!weapon.evolved) continue;

            // Apply evolved weapon special abilities during combat
            this._updateEvolvedAbility(weapon, dt);
        }
    }

    /**
     * Apply frame-by-frame effects for evolved weapon special abilities.
     */
    _updateEvolvedAbility(weapon, dt) {
        const player = this.game.player;
        if (!player) return;

        switch (weapon.specialAbility) {
            case 'life_steal': {
                // Bloody Tear: heal 3% of damage dealt
                // This is tracked via a simple counter on the weapon
                if (weapon._lifeStealAccumulator === undefined) {
                    weapon._lifeStealAccumulator = 0;
                }
                // The actual healing happens in the damage dealing code
                // Here we just ensure the flag is active
                weapon._lifeStealActive = true;
                break;
            }

            case 'enemy_pull': {
                // Soul Eater: pull enemies within range toward player
                if (!weapon._pullTimer) weapon._pullTimer = 0;
                weapon._pullTimer += dt;
                if (weapon._pullTimer >= 0.25) {
                    // Pull every 0.25s
                    weapon._pullTimer = 0;
                    const enemies = this.game.systems.enemy.getEnemiesInRange(
                        player.x,
                        player.y,
                        weapon.currentStats.range * 0.8
                    );
                    for (const enemy of enemies) {
                        if (!enemy.active || enemy.isBoss) continue;
                        const dx = player.x - enemy.x;
                        const dy = player.y - enemy.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 10) {
                            const pullStrength = 30 * dt;
                            enemy.x += (dx / dist) * pullStrength;
                            enemy.y += (dy / dist) * pullStrength;
                        }
                    }
                }
                break;
            }

            case 'chain_stun': {
                // Thunder Loop: stun is applied during damage dealing
                // Flag it for the weapon's chain logic
                weapon._chainStunActive = true;
                weapon._chainStunDuration = weapon.stunDuration || 0.5;
                break;
            }

            case 'explosive_orbit': {
                // Unholy Vespers: spawn explosion particles at orbiter positions
                if (!weapon._explosionTimer) weapon._explosionTimer = 0;
                weapon._explosionTimer += dt;
                if (weapon._explosionTimer >= 0.3 && this.game.systems.particle) {
                    weapon._explosionTimer = 0;
                    // Small fire trail particles at each orbiter
                    const orbCount = weapon.orbiterCount || weapon.currentStats?.projectiles || 4;
                    const time = this.game.gameTime || 0;
                    const orbitSpeed = weapon.orbitSpeed || 2.5;
                    const orbitRadius = weapon.orbitRadius || 90;
                    for (let i = 0; i < Math.min(orbCount, 6); i++) {
                        const angle = (i / orbCount) * Math.PI * 2 + time * orbitSpeed;
                        const ox = player.x + Math.cos(angle) * orbitRadius;
                        const oy = player.y + Math.sin(angle) * orbitRadius;
                        this.game.systems.particle.create(ox, oy, {
                            vx: (Math.random() - 0.5) * 20,
                            vy: -20 - Math.random() * 15,
                            color: '#8B0000',
                            size: 2 + Math.random() * 2,
                            lifetime: 0.4,
                            fadeOut: true
                        });
                    }
                }
                break;
            }

            // Other abilities are stat-based (applied during evolveWeapon) and don't need per-frame updates
        }
    }

    /**
     * Render evolved weapon visual enhancements (glow aura around player for each evolved weapon).
     */
    render(ctx) {
        const player = this.game.player;
        if (!player) return;

        for (const weapon of player.weapons.values()) {
            if (!weapon.evolved) continue;

            // Draw a subtle pulsing glow ring in the evolved color
            const time = this.game.gameTime || 0;
            const pulse = 0.3 + 0.15 * Math.sin(time * 4);
            const radius = 25 + 5 * Math.sin(time * 2);

            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = weapon.evolvedGlowColor || weapon.color;
            ctx.lineWidth = 2;
            ctx.shadowColor = weapon.color;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    reset() {
        this.evolvedWeapons.clear();
    }
}
