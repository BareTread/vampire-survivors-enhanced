import { t } from '../i18n/index.js';
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
                    evolvedName: t('evolution.soulMissile'),
                    evolvedColor: '#FF00FF',
                    glowColor: 'rgba(255,0,255,0.4)',
                    description: t('evolution.soulMissileDesc'),
                    statMultipliers: {
                        damage: 1.7,
                        cooldown: 0.7, // Still much faster, but no longer doubles the fire rate
                        piercing: 999, // Pierce everything
                        speed: 1.35,
                        projectiles: 1.5
                    },
                    specialAbility: 'homing_pierce'
                }
            ],
            [
                'whip',
                {
                    requiredPassive: 'spinach',
                    evolvedName: t('evolution.bloodyTear'),
                    evolvedColor: '#DC143C',
                    glowColor: 'rgba(220,20,60,0.4)',
                    description: t('evolution.bloodyTearDesc'),
                    statMultipliers: {
                        damage: 1.5,
                        range: 1.6,
                        area: 1.4,
                        duration: 1.2
                    },
                    specialAbility: 'life_steal'
                }
            ],
            [
                'throwing_knife',
                {
                    requiredPassive: 'duplicator',
                    evolvedName: t('evolution.thousandEdge'),
                    evolvedColor: '#00FFFF',
                    glowColor: 'rgba(0,255,255,0.4)',
                    description: t('evolution.thousandEdgeDesc'),
                    statMultipliers: {
                        projectiles: 2,
                        speed: 1.35,
                        damage: 1.15,
                        piercing: 2
                    },
                    specialAbility: 'blade_storm'
                }
            ],
            [
                'lightning_chain',
                {
                    requiredPassive: 'duplicator',
                    evolvedName: t('evolution.thunderLoop'),
                    evolvedColor: '#7DF9FF',
                    glowColor: 'rgba(125,249,255,0.5)',
                    description: t('evolution.thunderLoopDesc'),
                    statMultipliers: {
                        damage: 1.8,
                        range: 1.5,
                        cooldown: 0.75
                    },
                    specialAbility: 'chain_stun',
                    specialStats: { maxChains: 12, stunDuration: 0.5 }
                }
            ],
            [
                'garlic_aura',
                {
                    requiredPassive: 'attractorb',
                    evolvedName: t('evolution.soulEater'),
                    evolvedColor: '#9400D3',
                    glowColor: 'rgba(148,0,211,0.35)',
                    description: t('evolution.soulEaterDesc'),
                    statMultipliers: {
                        damage: 1.9,
                        range: 2.2,
                        area: 1.8
                    },
                    specialAbility: 'enemy_pull'
                }
            ],
            [
                'holy_bible',
                {
                    requiredPassive: 'armor',
                    evolvedName: t('evolution.unholyVespers'),
                    evolvedColor: '#8B0000',
                    glowColor: 'rgba(139,0,0,0.4)',
                    description: t('evolution.unholyVespersDesc'),
                    statMultipliers: {
                        damage: 1.6,
                        area: 1.35,
                        duration: 1.5
                    },
                    specialAbility: 'explosive_orbit',
                    specialStats: { orbiterCount: 6 }
                }
            ],
            [
                'fire_wand',
                {
                    requiredPassive: 'spinach',
                    evolvedName: t('evolution.hellfire'),
                    evolvedColor: '#FF4500',
                    glowColor: 'rgba(255,69,0,0.5)',
                    description: t('evolution.hellfireDesc'),
                    statMultipliers: {
                        damage: 2.2,
                        area: 1.5,
                        duration: 2.0,
                        cooldown: 0.8
                    },
                    specialAbility: 'permanent_burn'
                }
            ],
            [
                'bone_boomerang',
                {
                    requiredPassive: 'wings',
                    evolvedName: t('evolution.deathSpiral'),
                    evolvedColor: '#ADFF2F',
                    glowColor: 'rgba(173,255,47,0.4)',
                    description: t('evolution.deathSpiralDesc'),
                    statMultipliers: {
                        damage: 1.7,
                        projectiles: 2,
                        speed: 1.5,
                        range: 1.3
                    },
                    specialAbility: 'death_spin'
                }
            ],
            [
                'ice_shard',
                {
                    requiredPassive: 'empty_tome',
                    evolvedName: t('evolution.blizzard'),
                    evolvedColor: '#B3E5FF',
                    glowColor: 'rgba(179,229,255,0.5)',
                    description: t('evolution.blizzardDesc'),
                    statMultipliers: {
                        damage:     1.6,
                        cooldown:   0.7,
                        projectiles: 1.5,
                        area:       1.35
                    },
                    specialStats: { freezeDuration: 4.5, aoeRadius: 140 },
                    specialAbility: 'blizzard_storm'
                }
            ],
            [
                'shadow_dagger',
                {
                    requiredPassive: 'wings',
                    evolvedName: t('evolution.phantomAssassin'),
                    evolvedColor: '#4C1D95',
                    glowColor: 'rgba(76,29,149,0.5)',
                    description: t('evolution.phantomAssassinDesc'),
                    statMultipliers: {
                        damage:   1.8,
                        cooldown: 0.75
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
        this.game.systems.codex?.discoverEvolution(recipe.evolvedName);

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
            globalDamageNumberPool.spawn(player.x, player.y - 50, t('evolution.evolved'), '#FFD700');
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

            case 'homing_pierce': {
                // Soul Missile: steer active projectiles toward nearest enemy
                if (!weapon._homingTimer) weapon._homingTimer = 0;
                weapon._homingTimer += dt;
                if (weapon._homingTimer >= 0.5) {
                    weapon._homingTimer = 0;
                    const projectiles = this.game.systems.projectile?.activeProjectiles;
                    if (projectiles) {
                        for (const proj of projectiles) {
                            if (!proj.active || proj.weaponId !== weapon.id) continue;
                            // Find nearest enemy
                            const enemies = this.game.systems.enemy.getEnemiesInRange(proj.x, proj.y, 250);
                            if (enemies.length > 0) {
                                const target = enemies[0];
                                const dx = target.x - proj.x;
                                const dy = target.y - proj.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 5) {
                                    const speed = Math.sqrt(proj.velocity.x ** 2 + proj.velocity.y ** 2) || 200;
                                    proj.velocity.x = (dx / dist) * speed;
                                    proj.velocity.y = (dy / dist) * speed;
                                }
                            }
                            proj.piercing = Math.max(proj.piercing || 0, 3);
                        }
                    }
                }
                break;
            }

            case 'blade_storm': {
                // Thousand Edge: every 3rd attack fires a 5-knife fan burst
                if (weapon._bladeAttackCount === undefined) weapon._bladeAttackCount = 0;
                if (!weapon._bladeStormTimer) weapon._bladeStormTimer = 0;
                weapon._bladeStormTimer += dt;
                if (weapon._bladeStormTimer >= 1.5) {
                    weapon._bladeStormTimer = 0;
                    weapon._bladeAttackCount++;
                    if (weapon._bladeAttackCount % 3 === 0) {
                        // Fire 5 knives in fan pattern
                        const baseAngle = player.direction || 0;
                        const fanSpread = Math.PI * 0.6;
                        for (let i = 0; i < 5; i++) {
                            const angle = baseAngle - fanSpread / 2 + (i / 4) * fanSpread;
                            this.game.systems.projectile?.createProjectile({
                                x: player.x,
                                y: player.y,
                                direction: angle,
                                speed: 350,
                                damage: weapon.currentStats.damage * 0.6,
                                piercing: 2,
                                lifetime: 1.0,
                                type: 'knife',
                                source: 'player',
                                weaponId: weapon.id,
                                color: weapon.evolvedColor || '#00FFFF',
                                size: 4
                            });
                        }
                    }
                }
                break;
            }

            case 'permanent_burn': {
                // Hellfire: create fire patches at death positions of recently killed enemies
                if (!weapon._burnPatchTimer) weapon._burnPatchTimer = 0;
                weapon._burnPatchTimer += dt;
                // Every 2 seconds, create fire patches around player in the area
                if (weapon._burnPatchTimer >= 2.0) {
                    weapon._burnPatchTimer = 0;
                    const enemies = this.game.systems.enemy.getEnemiesInRange(
                        player.x, player.y, 150
                    );
                    for (const enemy of enemies.slice(0, 3)) {
                        if (!enemy.active) continue;
                        // Apply burn status effect
                        if (this.game.systems.statusEffect?.applyStatusEffect) {
                            this.game.systems.statusEffect.applyStatusEffect(enemy, 'burn', {
                                duration: 3.0,
                                damagePerSecond: weapon.currentStats.damage * 0.3,
                                source: weapon
                            });
                        }
                    }
                    // Fire patch visual
                    if (this.game.systems.particle) {
                        for (let i = 0; i < 6; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const dist = 30 + Math.random() * 100;
                            this.game.systems.particle.create(
                                player.x + Math.cos(angle) * dist,
                                player.y + Math.sin(angle) * dist,
                                {
                                    vx: (Math.random() - 0.5) * 20,
                                    vy: -30 - Math.random() * 20,
                                    color: '#FF4500',
                                    size: 3 + Math.random() * 3,
                                    lifetime: 1.5,
                                    fadeOut: true,
                                    glow: true
                                }
                            );
                        }
                    }
                }
                break;
            }

            case 'death_spin': {
                // Death Spiral: constant spinning damage aura around player
                if (!weapon._spinTimer) weapon._spinTimer = 0;
                weapon._spinTimer += dt;
                if (weapon._spinTimer >= 0.4) {
                    weapon._spinTimer = 0;
                    const spinRadius = 100;
                    const enemies = this.game.systems.enemy.getEnemiesInRange(
                        player.x, player.y, spinRadius
                    );
                    for (const enemy of enemies) {
                        if (!enemy.active) continue;
                        const spinDmg = Math.floor(weapon.currentStats.damage * 0.25);
                        if (typeof enemy.takeDamage === 'function') {
                            enemy.takeDamage(spinDmg, player, false);
                        }
                    }
                    // Visual spin particles
                    if (this.game.systems.particle) {
                        const time = this.game.gameTime || 0;
                        for (let i = 0; i < 4; i++) {
                            const angle = time * 6 + (i / 4) * Math.PI * 2;
                            this.game.systems.particle.create(
                                player.x + Math.cos(angle) * spinRadius,
                                player.y + Math.sin(angle) * spinRadius,
                                {
                                    vx: Math.cos(angle + Math.PI / 2) * 60,
                                    vy: Math.sin(angle + Math.PI / 2) * 60,
                                    color: weapon.evolvedColor || '#ADFF2F',
                                    size: 3,
                                    lifetime: 0.3,
                                    fadeOut: true
                                }
                            );
                        }
                    }
                }
                break;
            }

            case 'blizzard_storm': {
                // Blizzard: AoE freeze pulse every 4 seconds
                if (!weapon._blizzardTimer) weapon._blizzardTimer = 0;
                weapon._blizzardTimer += dt;
                if (weapon._blizzardTimer >= 4.0) {
                    weapon._blizzardTimer = 0;
                    const blizzardRadius = weapon.specialStats?.aoeRadius || 140;
                    const enemies = this.game.systems.enemy.getEnemiesInRange(
                        player.x, player.y, blizzardRadius
                    );
                    const freezeDur = weapon.specialStats?.freezeDuration || 4.5;
                    for (const enemy of enemies) {
                        if (!enemy.active) continue;
                        if (this.game.systems.statusEffect?.applyFreezeEffect) {
                            this.game.systems.statusEffect.applyFreezeEffect(enemy, freezeDur, weapon);
                        }
                        // Small freeze damage
                        if (typeof enemy.takeDamage === 'function') {
                            enemy.takeDamage(Math.floor(weapon.currentStats.damage * 0.15), player, false);
                        }
                    }
                    // Visual ice ring
                    if (this.game.systems.particle) {
                        for (let i = 0; i < 16; i++) {
                            const angle = (i / 16) * Math.PI * 2;
                            this.game.systems.particle.create(
                                player.x + Math.cos(angle) * blizzardRadius,
                                player.y + Math.sin(angle) * blizzardRadius,
                                {
                                    vx: Math.cos(angle) * -20,
                                    vy: Math.sin(angle) * -20,
                                    color: '#B3E5FF',
                                    size: 4,
                                    lifetime: 0.8,
                                    fadeOut: true,
                                    glow: true
                                }
                            );
                        }
                    }
                }
                break;
            }

            case 'phantom_chain': {
                // Phantom Assassin: on kill, 40% chance to chain damage to nearest enemy
                // Track enemy count and detect kills
                if (!weapon._phantomLastEnemyCount) {
                    weapon._phantomLastEnemyCount = this.game.systems.enemy.getActiveEnemies?.()?.length || 0;
                }
                const currentCount = this.game.systems.enemy.getActiveEnemies?.()?.length || 0;
                const killsDelta = weapon._phantomLastEnemyCount - currentCount;
                weapon._phantomLastEnemyCount = currentCount;

                if (killsDelta > 0) {
                    for (let k = 0; k < Math.min(killsDelta, 5); k++) {
                        if (Math.random() < 0.4) {
                            // Chain to nearest enemy within 200px of player
                            const nearby = this.game.systems.enemy.getEnemiesInRange(
                                player.x, player.y, 200
                            );
                            if (nearby.length > 0) {
                                const target = nearby[0];
                                if (typeof target.takeDamage === 'function') {
                                    target.takeDamage(weapon.currentStats.damage, player, false);
                                    // Visual chain line
                                    if (this.game.systems.particle) {
                                        for (let s = 0; s < 4; s++) {
                                            const t = s / 3;
                                            this.game.systems.particle.create(
                                                player.x + (target.x - player.x) * t,
                                                player.y + (target.y - player.y) * t,
                                                {
                                                    vx: 0, vy: 0,
                                                    color: weapon.evolvedColor || '#4C1D95',
                                                    size: 3,
                                                    lifetime: 0.2,
                                                    fadeOut: true,
                                                    glow: true
                                                }
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            }
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
