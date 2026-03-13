import { Enemy } from '../entities/Enemy.js';
import { globalDamageNumberPool } from '../core/DamageNumberPool.js';
import { managedSetTimeout } from '../core/TimerManager.js';

/**
 * BossSystem — Timed boss encounters with multi-phase fights, telegraphed attacks,
 * health bar HUD, and guaranteed reward drops.
 *
 * Bosses are enhanced Enemy instances (isBoss = true) stored in EnemySystem.activeEnemies
 * so existing collision/damage/rendering code works. The BossSystem drives their AI,
 * attack patterns, telegraphs, and the dramatic HUD.
 *
 * Three boss types on a 5-minute cycle:
 *  - Vampire Lord (5 min): bat swarms, dash attack, blood drain aura, blood nova
 *  - Lich King (10 min): necrotic ground zones, soul bolts, bone walls, death wave
 *  - Alpha Werewolf (15 min): charge, claw swipe, leap slam, howl + minion summon
 *
 * Wire into VampireSurvivorsGame.systems.boss.
 */
export class BossSystem {
    constructor(game) {
        this.game = game;

        // Boss spawn schedule (gameTime in seconds)
        this.spawnTimes = [300, 600, 900, 1200, 1500]; // 5, 10, 15, 20, 25 min
        this.bossTypeOrder = ['vampire_lord', 'lich', 'werewolf'];
        this.nextSpawnIndex = 0;

        // Active boss tracking
        this.activeBoss = null;   // { type, def, phase, attackTimers }
        this.bossEnemy = null;    // Reference to the Enemy instance

        // Warning state
        this.warningActive = false;
        this.warningTimer = 0;
        this.warningDuration = 4; // seconds before spawn
        this.pendingBossType = null;

        // Health bar animation
        this.healthBarShake = 0;
        this.healthBarFlash = 0;
        this.lastBossHealthRatio = 1;

        // Boss attack state
        this.telegraphs = [];     // Active telegraph indicators
        this.activeEffects = [];  // Active boss attack effects (zones, projectiles, etc.)

        // Boss definitions
        this.bossDefinitions = this._createBossDefinitions();
    }

    // ──────────── BOSS DEFINITIONS ────────────────────────

    _createBossDefinitions() {
        return {
            vampire_lord: {
                name: 'Vampire Lord',
                color: '#8B0000',
                glowColor: '#FF0000',
                size: 32,
                maxHealth: 3000,
                damage: 30,
                speed: 45,
                expReward: 200,
                phases: [
                    { threshold: 1.0, attacks: ['bat_swarm', 'dash'] },
                    { threshold: 0.66, attacks: ['bat_swarm', 'dash', 'blood_drain'] },
                    { threshold: 0.33, attacks: ['bat_swarm', 'dash', 'blood_drain', 'blood_nova'] }
                ],
                attacks: {
                    bat_swarm:  { cooldown: 6,  telegraph: 1.0, damage: 15, range: 200 },
                    dash:       { cooldown: 4,  telegraph: 0.8, damage: 40, range: 300 },
                    blood_drain:{ cooldown: 8,  telegraph: 1.5, damage: 5,  range: 150 },
                    blood_nova: { cooldown: 12, telegraph: 2.0, damage: 25, range: 250 }
                }
            },
            lich: {
                name: 'Lich King',
                color: '#2E0854',
                glowColor: '#9B59B6',
                size: 30,
                maxHealth: 2500,
                damage: 25,
                speed: 35,
                expReward: 200,
                phases: [
                    { threshold: 1.0, attacks: ['necrotic_zone', 'soul_bolt'] },
                    { threshold: 0.66, attacks: ['necrotic_zone', 'soul_bolt', 'bone_wall'] },
                    { threshold: 0.33, attacks: ['necrotic_zone', 'soul_bolt', 'bone_wall', 'death_wave'] }
                ],
                attacks: {
                    necrotic_zone: { cooldown: 5,  telegraph: 1.5, damage: 10, range: 120 },
                    soul_bolt:     { cooldown: 3,  telegraph: 0.6, damage: 30, range: 400 },
                    bone_wall:     { cooldown: 10, telegraph: 2.0, damage: 0,  range: 200 },
                    death_wave:    { cooldown: 15, telegraph: 2.5, damage: 35, range: 300 }
                }
            },
            werewolf: {
                name: 'Alpha Werewolf',
                color: '#4A3728',
                glowColor: '#FF8C00',
                size: 34,
                maxHealth: 3500,
                damage: 35,
                speed: 60,
                expReward: 200,
                phases: [
                    { threshold: 1.0, attacks: ['charge', 'claw_swipe'] },
                    { threshold: 0.66, attacks: ['charge', 'claw_swipe', 'leap'] },
                    { threshold: 0.33, attacks: ['charge', 'claw_swipe', 'leap', 'howl'] }
                ],
                attacks: {
                    charge:     { cooldown: 5,   telegraph: 1.2, damage: 45, range: 350 },
                    claw_swipe: { cooldown: 2.5, telegraph: 0.5, damage: 25, range: 80 },
                    leap:       { cooldown: 7,   telegraph: 1.0, damage: 35, range: 250 },
                    howl:       { cooldown: 15,  telegraph: 2.0, damage: 0,  range: 400 }
                }
            }
        };
    }

    // ──────────── UPDATE ────────────────────────────────

    update(dt) {
        if (!this.game.player) return;

        const gameTime = this.game.gameTime || 0;

        // Check for boss spawn trigger
        if (this.nextSpawnIndex < this.spawnTimes.length &&
            !this.activeBoss && !this.warningActive) {
            if (gameTime >= this.spawnTimes[this.nextSpawnIndex]) {
                this._startWarning();
            }
        }

        // Warning countdown
        if (this.warningActive) {
            this.warningTimer -= dt;
            if (this.warningTimer <= 0) {
                this._spawnBoss();
            }
        }

        // Update active boss
        if (this.activeBoss && this.bossEnemy) {
            if (!this.bossEnemy.active || this.bossEnemy.health <= 0) {
                this._onBossDeath();
            } else {
                this._updateBossAI(dt);
                this._updateTelegraphs(dt);
                this._updateEffects(dt);

                // Health bar shake on big damage
                const healthRatio = this.bossEnemy.health / this.bossEnemy.maxHealth;
                if (healthRatio < this.lastBossHealthRatio - 0.05) {
                    this.healthBarShake = 0.3;
                }
                this.lastBossHealthRatio = healthRatio;
                this.healthBarShake = Math.max(0, this.healthBarShake - dt);
                this.healthBarFlash = Math.max(0, this.healthBarFlash - dt * 2);
            }
        }
    }

    // ──────────── SPAWN LIFECYCLE ────────────────────────

    _startWarning() {
        const bossTypeIndex = this.nextSpawnIndex % this.bossTypeOrder.length;
        this.pendingBossType = this.bossTypeOrder[bossTypeIndex];
        this.warningActive = true;
        this.warningTimer = this.warningDuration;

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossWarning', 0.4);
        }

        if (this.game.camera) {
            this.game.camera.shake(5, 2, 'rumble');
        }
    }

    _spawnBoss() {
        this.warningActive = false;
        const def = this.bossDefinitions[this.pendingBossType];
        if (!def) return;

        // Scale boss health with game progression
        const timeScale = 1 + (this.game.gameTime / 600) * 0.5; // +50% per 10 min

        // Spawn at edge of screen, offset from player
        const player = this.game.player;
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = 400;
        const spawnX = player.x + Math.cos(angle) * spawnDist;
        const spawnY = player.y + Math.sin(angle) * spawnDist;

        // Create boss as an Enemy instance
        const boss = new Enemy(this.game, spawnX, spawnY, 'elite');

        // Override with boss-specific stats
        boss.isBoss = true;
        boss.bossType = this.pendingBossType;
        boss.maxHealth = Math.floor(def.maxHealth * timeScale);
        boss.health = boss.maxHealth;
        boss.damage = Math.floor(def.damage * timeScale);
        boss.speed = def.speed;
        boss.size = def.size;
        boss.color = def.color;
        boss.expReward = def.expReward;
        boss.active = true;
        boss.currentSpawnTime = 0; // Skip spawn animation — boss walks in dramatically
        boss.bossGlowPhase = 0;

        // Add to enemy system so collision/damage works automatically
        this.game.systems.enemy.activeEnemies.push(boss);

        // Track in boss system
        this.activeBoss = {
            type: this.pendingBossType,
            def: def,
            phase: 0,
            attackTimers: {},
            baseSpeed: def.speed
        };
        this.bossEnemy = boss;
        this.lastBossHealthRatio = 1;
        this.healthBarFlash = 1.0;

        // Initialize attack cooldowns (half cooldown for first use)
        const currentPhase = def.phases[0];
        for (const attackName of currentPhase.attacks) {
            this.activeBoss.attackTimers[attackName] = def.attacks[attackName].cooldown * 0.5;
        }

        this.nextSpawnIndex++;

        // Dramatic spawn effects
        if (this.game.camera) {
            this.game.camera.flash('#FF0000', 0.5);
            this.game.camera.shake(12, 0.8, 'massive');
        }

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossSpawn', 0.5);
        }

        if (this.game.systems.screenEffects) {
            this.game.systems.screenEffects.triggerSlowMo(0.5, 0.3);
        }
    }

    // ──────────── BOSS AI ────────────────────────────────

    _updateBossAI(dt) {
        const boss = this.bossEnemy;
        const def = this.activeBoss.def;
        const player = this.game.player;
        if (!boss || !player) return;

        // Determine current phase based on health
        const healthRatio = boss.health / boss.maxHealth;
        let newPhase = 0;
        for (let i = def.phases.length - 1; i >= 0; i--) {
            if (healthRatio <= def.phases[i].threshold) {
                newPhase = i;
            }
        }

        if (newPhase > this.activeBoss.phase) {
            this._onPhaseTransition(newPhase);
        }

        // Glow animation
        boss.bossGlowPhase = (boss.bossGlowPhase || 0) + dt * 2;

        // Process attack cooldowns and execute attacks
        const currentPhase = def.phases[this.activeBoss.phase];
        for (const attackName of currentPhase.attacks) {
            if (this.activeBoss.attackTimers[attackName] === undefined) {
                this.activeBoss.attackTimers[attackName] = 0;
            }

            this.activeBoss.attackTimers[attackName] -= dt;

            if (this.activeBoss.attackTimers[attackName] <= 0) {
                const attackDef = def.attacks[attackName];
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Range check (howl has no range limit)
                if (dist <= attackDef.range || attackName === 'howl') {
                    this._startAttack(attackName, attackDef);
                    // Scale cooldown slightly faster in later phases
                    const phaseCdMult = 1 - this.activeBoss.phase * 0.1;
                    this.activeBoss.attackTimers[attackName] = attackDef.cooldown * Math.max(0.6, phaseCdMult);
                }
            }
        }
    }

    _onPhaseTransition(newPhase) {
        this.activeBoss.phase = newPhase;
        this.healthBarFlash = 1.0;

        if (this.game.camera) {
            this.game.camera.flash('#FFFFFF', 0.3);
            this.game.camera.shake(8, 0.4, 'critical');
        }

        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('bossSpawn', 0.4);
        }

        // Particle burst around boss
        const ps = this.game.systems.particle;
        if (ps && this.bossEnemy) {
            const boss = this.bossEnemy;
            const def = this.activeBoss.def;
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                ps.create(boss.x, boss.y, {
                    vx: Math.cos(angle) * 150,
                    vy: Math.sin(angle) * 150,
                    life: 0.6,
                    size: 4 + Math.random() * 3,
                    color: def.glowColor,
                    type: 'circle'
                });
            }
        }

        // Initialize timers for newly-unlocked attacks
        const def = this.activeBoss.def;
        const phaseAttacks = def.phases[newPhase].attacks;
        for (const attackName of phaseAttacks) {
            if (this.activeBoss.attackTimers[attackName] === undefined) {
                this.activeBoss.attackTimers[attackName] = def.attacks[attackName].cooldown * 0.3;
            }
        }

        // Speed boost in final phase for all boss types
        if (newPhase === 2 && this.bossEnemy) {
            this.bossEnemy.speed = this.activeBoss.baseSpeed * 1.3;
        }
    }

    // ──────────── ATTACK EXECUTION ────────────────────────

    _startAttack(attackName, attackDef) {
        const boss = this.bossEnemy;
        const player = this.game.player;
        if (!boss || !player) return;

        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const angle = Math.atan2(dy, dx);

        this.telegraphs.push({
            type: attackName,
            x: boss.x,
            y: boss.y,
            targetX: player.x,
            targetY: player.y,
            angle: angle,
            timer: attackDef.telegraph,
            duration: attackDef.telegraph,
            range: attackDef.range,
            damage: attackDef.damage,
            executed: false
        });
    }

    _updateTelegraphs(dt) {
        for (let i = this.telegraphs.length - 1; i >= 0; i--) {
            const tel = this.telegraphs[i];
            tel.timer -= dt;

            if (tel.timer <= 0 && !tel.executed) {
                tel.executed = true;
                this._executeAttack(tel);
            }

            // Remove finished telegraphs
            if (tel.timer <= -0.3) {
                this.telegraphs.splice(i, 1);
            }
        }
    }

    _executeAttack(telegraph) {
        const boss = this.bossEnemy;
        const player = this.game.player;
        if (!boss || !player || !boss.active) return;

        const bossType = this.activeBoss.type;

        switch (bossType) {
            case 'vampire_lord':
                this._executeVampireLordAttack(telegraph.type, telegraph);
                break;
            case 'lich':
                this._executeLichAttack(telegraph.type, telegraph);
                break;
            case 'werewolf':
                this._executeWerewolfAttack(telegraph.type, telegraph);
                break;
        }
    }

    // ── Vampire Lord Attacks ──

    _executeVampireLordAttack(name, tel) {
        const boss = this.bossEnemy;
        const player = this.game.player;

        switch (name) {
            case 'bat_swarm': {
                const batCount = 8 + this.activeBoss.phase * 4;
                for (let i = 0; i < batCount; i++) {
                    const angle = (i / batCount) * Math.PI * 2;
                    const dist = 60 + Math.random() * 40;
                    this.activeEffects.push({
                        type: 'bat',
                        x: boss.x + Math.cos(angle) * dist,
                        y: boss.y + Math.sin(angle) * dist,
                        speed: 120 + Math.random() * 60,
                        damage: tel.damage,
                        life: 3,
                        size: 5,
                        color: '#4A0000',
                        hit: false
                    });
                }

                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('enemyDeath', 0.5, 1.8);
                }
                break;
            }

            case 'dash': {
                const dx = tel.targetX - boss.x;
                const dy = tel.targetY - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const dashSpeed = 500;
                boss.velocity.x = (dx / dist) * dashSpeed;
                boss.velocity.y = (dy / dist) * dashSpeed;

                this.activeEffects.push({
                    type: 'dash_trail',
                    startX: boss.x,
                    startY: boss.y,
                    endX: tel.targetX,
                    endY: tel.targetY,
                    life: 0.4,
                    color: '#8B0000',
                    damage: tel.damage,
                    width: boss.size * 2,
                    hit: false
                });
                break;
            }

            case 'blood_drain': {
                this.activeEffects.push({
                    type: 'aura',
                    x: boss.x,
                    y: boss.y,
                    followBoss: true,
                    radius: 150,
                    damage: tel.damage,
                    life: 3,
                    maxLife: 3,
                    color: '#8B0000',
                    healBoss: true,
                    _tickTimer: 0
                });
                break;
            }

            case 'blood_nova': {
                this.activeEffects.push({
                    type: 'nova',
                    x: boss.x,
                    y: boss.y,
                    radius: 0,
                    maxRadius: 250,
                    speed: 200,
                    damage: tel.damage,
                    life: 1.5,
                    color: '#8B0000',
                    hit: false
                });

                if (this.game.camera) {
                    this.game.camera.shake(6, 0.3, 'critical');
                }
                break;
            }
        }
    }

    // ── Lich King Attacks ──

    _executeLichAttack(name, tel) {
        const boss = this.bossEnemy;
        const player = this.game.player;

        switch (name) {
            case 'necrotic_zone': {
                this.activeEffects.push({
                    type: 'zone',
                    x: tel.targetX,
                    y: tel.targetY,
                    radius: 80 + this.activeBoss.phase * 20,
                    damage: tel.damage,
                    life: 5,
                    maxLife: 5,
                    tickRate: 0.5,
                    tickTimer: 0,
                    color: '#2E0854'
                });
                break;
            }

            case 'soul_bolt': {
                const dx = tel.targetX - boss.x;
                const dy = tel.targetY - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const speed = 250;

                this.activeEffects.push({
                    type: 'projectile',
                    x: boss.x,
                    y: boss.y,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    damage: tel.damage,
                    life: 2,
                    size: 8,
                    color: '#9B59B6',
                    hit: false
                });

                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('magicMissile', 0.5, 0.6);
                }
                break;
            }

            case 'bone_wall': {
                const angle = Math.atan2(boss.y - player.y, boss.x - player.x);
                const pillarCount = 5 + this.activeBoss.phase;
                for (let i = 0; i < pillarCount; i++) {
                    const spread = ((i / (pillarCount - 1)) - 0.5) * Math.PI * 0.8;
                    const pillarAngle = angle + spread;
                    const pillarDist = 120;
                    this.activeEffects.push({
                        type: 'pillar',
                        x: player.x + Math.cos(pillarAngle) * pillarDist,
                        y: player.y + Math.sin(pillarAngle) * pillarDist,
                        radius: 12,
                        life: 4,
                        maxLife: 4,
                        color: '#D4C5A9'
                    });
                }
                break;
            }

            case 'death_wave': {
                this.activeEffects.push({
                    type: 'nova',
                    x: boss.x,
                    y: boss.y,
                    radius: 0,
                    maxRadius: 300,
                    speed: 180,
                    damage: tel.damage,
                    life: 2,
                    color: '#2E0854',
                    hit: false
                });

                if (this.game.camera) {
                    this.game.camera.shake(8, 0.5, 'massive');
                }
                break;
            }
        }
    }

    // ── Alpha Werewolf Attacks ──

    _executeWerewolfAttack(name, tel) {
        const boss = this.bossEnemy;
        const player = this.game.player;

        switch (name) {
            case 'charge': {
                const dx = tel.targetX - boss.x;
                const dy = tel.targetY - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                boss.velocity.x = (dx / dist) * 600;
                boss.velocity.y = (dy / dist) * 600;

                this.activeEffects.push({
                    type: 'dash_trail',
                    startX: boss.x,
                    startY: boss.y,
                    endX: tel.targetX,
                    endY: tel.targetY,
                    life: 0.5,
                    color: '#4A3728',
                    damage: tel.damage,
                    width: boss.size * 2.5,
                    hit: false
                });

                if (this.game.camera) {
                    this.game.camera.shake(10, 0.3, 'critical');
                }
                break;
            }

            case 'claw_swipe': {
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 80) {
                    player.takeDamage(tel.damage);

                    // Knockback
                    if (dist > 0.001) {
                        player.x += (dx / dist) * 30;
                        player.y += (dy / dist) * 30;
                    }
                }

                // Claw visual
                this.activeEffects.push({
                    type: 'claw',
                    x: boss.x + (dx / (dist || 1)) * boss.size * 1.5,
                    y: boss.y + (dy / (dist || 1)) * boss.size * 1.5,
                    angle: Math.atan2(dy, dx),
                    life: 0.3,
                    size: 40,
                    color: '#FF8C00'
                });

                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('whipCrack', 0.6, 0.7);
                }
                break;
            }

            case 'leap': {
                this.activeEffects.push({
                    type: 'leap',
                    startX: boss.x,
                    startY: boss.y,
                    targetX: tel.targetX,
                    targetY: tel.targetY,
                    progress: 0,
                    duration: 0.5,
                    damage: tel.damage,
                    radius: 80,
                    color: '#4A3728',
                    landed: false
                });
                break;
            }

            case 'howl': {
                // Speed buff
                boss.speed = this.activeBoss.baseSpeed * 1.5;
                const savedSpeed = this.activeBoss.baseSpeed * (this.activeBoss.phase >= 2 ? 1.3 : 1.0);
                managedSetTimeout(() => {
                    if (boss.active) boss.speed = savedSpeed;
                }, 5000);

                // Spawn fast minions around boss
                const minionCount = 4 + this.activeBoss.phase;
                const enemySystem = this.game.systems.enemy;
                for (let i = 0; i < minionCount; i++) {
                    const mAngle = (i / minionCount) * Math.PI * 2;
                    const mDist = 80;
                    const mx = boss.x + Math.cos(mAngle) * mDist;
                    const my = boss.y + Math.sin(mAngle) * mDist;

                    // Spawn minion via pool if possible
                    const minion = enemySystem.getEnemyFromPool
                        ? enemySystem.getEnemyFromPool('fast')
                        : new Enemy(this.game, mx, my, 'fast');
                    if (minion) {
                        if (minion.reset) minion.reset(mx, my, 'fast');
                        else { minion.x = mx; minion.y = my; minion.active = true; }
                        if (!enemySystem.activeEnemies.includes(minion)) {
                            enemySystem.activeEnemies.push(minion);
                        }
                    }
                }

                // Visual howl ring
                this.activeEffects.push({
                    type: 'nova',
                    x: boss.x,
                    y: boss.y,
                    radius: 0,
                    maxRadius: 300,
                    speed: 250,
                    damage: 0,
                    life: 1.0,
                    color: '#FF8C00',
                    hit: true // Purely visual
                });

                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('bossSpawn', 0.4, 1.3);
                }

                if (this.game.camera) {
                    this.game.camera.shake(6, 0.6, 'critical');
                }
                break;
            }
        }
    }

    // ──────────── EFFECT UPDATES ──────────────────────────

    _updateEffects(dt) {
        const player = this.game.player;
        const boss = this.bossEnemy;

        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const eff = this.activeEffects[i];
            eff.life -= dt;

            if (eff.life <= 0) {
                this.activeEffects.splice(i, 1);
                continue;
            }

            switch (eff.type) {
                case 'bat': {
                    if (player && player.isAlive()) {
                        const dx = player.x - eff.x;
                        const dy = player.y - eff.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            eff.x += (dx / dist) * eff.speed * dt;
                            eff.y += (dy / dist) * eff.speed * dt;
                        }
                        if (dist < 15 && !eff.hit) {
                            eff.hit = true;
                            player.takeDamage(eff.damage);
                            eff.life = 0;
                        }
                    }
                    break;
                }

                case 'projectile': {
                    eff.x += eff.vx * dt;
                    eff.y += eff.vy * dt;

                    if (player && !eff.hit && player.isAlive()) {
                        const dx = player.x - eff.x;
                        const dy = player.y - eff.y;
                        if (dx * dx + dy * dy < (eff.size + 12) ** 2) {
                            eff.hit = true;
                            player.takeDamage(eff.damage);
                            eff.life = 0;
                        }
                    }
                    break;
                }

                case 'nova': {
                    eff.radius += eff.speed * dt;

                    if (player && !eff.hit && eff.damage > 0 && player.isAlive()) {
                        const dx = player.x - eff.x;
                        const dy = player.y - eff.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (Math.abs(dist - eff.radius) < 30) {
                            eff.hit = true;
                            player.takeDamage(eff.damage);
                        }
                    }
                    break;
                }

                case 'zone': {
                    eff.tickTimer -= dt;
                    if (eff.tickTimer <= 0 && player && player.isAlive()) {
                        eff.tickTimer = eff.tickRate;
                        const dx = player.x - eff.x;
                        const dy = player.y - eff.y;
                        if (dx * dx + dy * dy < eff.radius * eff.radius) {
                            player.takeDamage(eff.damage);
                        }
                    }
                    break;
                }

                case 'aura': {
                    if (eff.followBoss && boss && boss.active) {
                        eff.x = boss.x;
                        eff.y = boss.y;
                    }

                    eff._tickTimer -= dt;
                    if (eff._tickTimer <= 0 && player && player.isAlive()) {
                        eff._tickTimer = 0.5;
                        const dx = player.x - eff.x;
                        const dy = player.y - eff.y;
                        if (dx * dx + dy * dy < eff.radius * eff.radius) {
                            player.takeDamage(eff.damage);

                            if (eff.healBoss && boss && boss.active) {
                                boss.health = Math.min(boss.maxHealth, boss.health + eff.damage * 2);
                            }
                        }
                    }
                    break;
                }

                case 'dash_trail': {
                    if (!eff.hit && player && eff.life > 0.2 && player.isAlive()) {
                        const dist = this._pointToLineDistance(
                            player.x, player.y,
                            eff.startX, eff.startY,
                            eff.endX, eff.endY
                        );
                        if (dist < eff.width / 2 + 10) {
                            eff.hit = true;
                            player.takeDamage(eff.damage);
                        }
                    }
                    break;
                }

                case 'leap': {
                    eff.progress += dt / eff.duration;

                    if (eff.progress >= 1 && !eff.landed) {
                        eff.landed = true;

                        if (boss && boss.active) {
                            boss.x = eff.targetX;
                            boss.y = eff.targetY;
                        }

                        if (player && player.isAlive()) {
                            const dx = player.x - eff.targetX;
                            const dy = player.y - eff.targetY;
                            if (dx * dx + dy * dy < eff.radius * eff.radius) {
                                player.takeDamage(eff.damage);
                            }
                        }

                        if (this.game.camera) {
                            this.game.camera.shake(8, 0.3, 'critical');
                        }

                        const ps = this.game.systems.particle;
                        if (ps) {
                            for (let j = 0; j < 12; j++) {
                                const angle = (j / 12) * Math.PI * 2;
                                ps.create(eff.targetX, eff.targetY, {
                                    vx: Math.cos(angle) * 100,
                                    vy: Math.sin(angle) * 100,
                                    life: 0.4,
                                    size: 3,
                                    color: '#8B6914',
                                    type: 'circle'
                                });
                            }
                        }
                    }
                    break;
                }

                case 'claw':
                case 'pillar':
                    // Visual only — no update logic
                    break;
            }
        }
    }

    // ──────────── BOSS DEATH ──────────────────────────────

    _onBossDeath() {
        if (!this.activeBoss) return;

        const def = this.activeBoss.def;
        const bossX = this.bossEnemy ? this.bossEnemy.x : 0;
        const bossY = this.bossEnemy ? this.bossEnemy.y : 0;

        // Dramatic camera effects
        if (this.game.camera) {
            this.game.camera.flash('#FFFFFF', 0.8);
            this.game.camera.shake(15, 1.0, 'massive');
        }

        if (this.game.systems.screenEffects) {
            this.game.systems.screenEffects.triggerSlowMo(0.8, 0.15);
        }

        // Big particle explosion
        const ps = this.game.systems.particle;
        if (ps) {
            for (let i = 0; i < 40; i++) {
                const angle = (i / 40) * Math.PI * 2;
                const speed = 100 + Math.random() * 200;
                ps.create(bossX, bossY, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.8 + Math.random() * 0.5,
                    size: 4 + Math.random() * 5,
                    color: def.glowColor,
                    type: 'circle'
                });
            }
        }

        // Gold shower reward
        const goldSys = this.game.systems.gold;
        if (goldSys) {
            const goldCount = 30 + this.activeBoss.phase * 15;
            for (let i = 0; i < goldCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 100;
                goldSys.spawnCoin(
                    bossX + Math.cos(angle) * dist,
                    bossY + Math.sin(angle) * dist,
                    2 + Math.floor(Math.random() * 3)
                );
            }
        }

        // XP gem explosion
        const expSys = this.game.systems.experience;
        if (expSys && expSys.createGemExplosion) {
            expSys.createGemExplosion(bossX, bossY, def.expReward, 12, 20);
        } else if (expSys && expSys.createGem) {
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 80;
                expSys.createGem(
                    bossX + Math.cos(angle) * dist,
                    bossY + Math.sin(angle) * dist,
                    Math.ceil(def.expReward / 15)
                );
            }
        }

        // "BOSS DEFEATED" floating text
        globalDamageNumberPool.get(bossX, bossY - 30, `${def.name} DEFEATED!`, '#FFD700', true);

        // Audio
        if (this.game.audioManager) {
            this.game.audioManager.playVampireSound('levelUp', 0.6, 0.7);
        }

        // Achievement hook
        if (this.game.systems.achievement && this.game.systems.achievement.onBossKilled) {
            this.game.systems.achievement.onBossKilled(this.activeBoss.type);
        }

        // Clear boss state
        this.activeBoss = null;
        this.bossEnemy = null;
        this.telegraphs = [];
        this.activeEffects = [];
    }

    // ──────────── RENDERING (World Space) ────────────────

    renderWorld(ctx) {
        this._renderTelegraphs(ctx);
        this._renderEffects(ctx);
        this._renderBossVisuals(ctx);
    }

    _renderBossVisuals(ctx) {
        if (!this.bossEnemy || !this.bossEnemy.active) return;

        const boss = this.bossEnemy;
        const def = this.activeBoss.def;

        // Pulsing glow aura
        const glowPulse = 0.5 + 0.5 * Math.sin(boss.bossGlowPhase || 0);
        ctx.save();
        ctx.globalAlpha = 0.15 + glowPulse * 0.15;
        ctx.fillStyle = def.glowColor;
        ctx.shadowColor = def.glowColor;
        ctx.shadowBlur = 20 + glowPulse * 10;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.size * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Phase indicator — orbiting runes
        const phaseCount = this.activeBoss.phase + 1;
        const time = performance.now() * 0.001;
        ctx.save();
        ctx.fillStyle = def.glowColor;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < phaseCount; i++) {
            const orbitAngle = time * 1.5 + (i / phaseCount) * Math.PI * 2;
            const orbitDist = boss.size * 2.2;
            const rx = boss.x + Math.cos(orbitAngle) * orbitDist;
            const ry = boss.y + Math.sin(orbitAngle) * orbitDist;
            ctx.beginPath();
            ctx.arc(rx, ry, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Boss name above head
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.8;
        ctx.fillText(def.name, boss.x, boss.y - boss.size - 12);
        ctx.restore();
    }

    _renderTelegraphs(ctx) {
        for (const tel of this.telegraphs) {
            if (tel.timer <= 0) continue;

            const progress = 1 - (tel.timer / tel.duration);
            const alpha = 0.15 + progress * 0.35;

            ctx.save();
            ctx.globalAlpha = alpha;

            switch (tel.type) {
                case 'bat_swarm':
                case 'blood_nova':
                case 'death_wave':
                case 'howl': {
                    // Expanding warning circle
                    ctx.strokeStyle = '#FF0000';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 4]);
                    ctx.beginPath();
                    ctx.arc(tel.x, tel.y, tel.range * progress, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    break;
                }

                case 'dash':
                case 'charge': {
                    // Line telegraph
                    ctx.strokeStyle = '#FF4444';
                    ctx.lineWidth = 4 * progress;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath();
                    ctx.moveTo(tel.x, tel.y);
                    ctx.lineTo(tel.targetX, tel.targetY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    break;
                }

                case 'necrotic_zone': {
                    ctx.fillStyle = '#2E0854';
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.beginPath();
                    ctx.arc(tel.targetX, tel.targetY, 80 * progress, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }

                case 'soul_bolt': {
                    ctx.strokeStyle = '#9B59B6';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(tel.x, tel.y);
                    ctx.lineTo(tel.targetX, tel.targetY);
                    ctx.stroke();
                    break;
                }

                case 'leap': {
                    ctx.strokeStyle = '#FF8C00';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.arc(tel.targetX, tel.targetY, 80, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    break;
                }

                case 'claw_swipe': {
                    const arcAngle = Math.atan2(tel.targetY - tel.y, tel.targetX - tel.x);
                    ctx.strokeStyle = '#FF8C00';
                    ctx.lineWidth = 3 * progress;
                    ctx.beginPath();
                    ctx.arc(tel.x, tel.y, 50, arcAngle - 0.5, arcAngle + 0.5);
                    ctx.stroke();
                    break;
                }

                case 'blood_drain': {
                    ctx.strokeStyle = '#8B0000';
                    ctx.lineWidth = 2;
                    const pulseRadius = 150 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4));
                    ctx.beginPath();
                    ctx.arc(tel.x, tel.y, pulseRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }

                case 'bone_wall': {
                    const wallAngle = Math.atan2(tel.y - tel.targetY, tel.x - tel.targetX);
                    ctx.fillStyle = '#D4C5A9';
                    for (let j = 0; j < 5; j++) {
                        const spread = ((j / 4) - 0.5) * Math.PI * 0.8;
                        const pillarAngle = wallAngle + spread;
                        const px = tel.targetX + Math.cos(pillarAngle) * 120;
                        const py = tel.targetY + Math.sin(pillarAngle) * 120;
                        ctx.beginPath();
                        ctx.arc(px, py, 8 * progress, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }
            }

            ctx.restore();
        }
    }

    _renderEffects(ctx) {
        for (const eff of this.activeEffects) {
            ctx.save();

            switch (eff.type) {
                case 'bat': {
                    const wobble = Math.sin(performance.now() * 0.01 + eff.x) * 3;
                    ctx.fillStyle = eff.color;
                    ctx.beginPath();
                    ctx.moveTo(eff.x, eff.y - eff.size + wobble);
                    ctx.lineTo(eff.x - eff.size * 1.5, eff.y + eff.size / 2);
                    ctx.lineTo(eff.x + eff.size * 1.5, eff.y + eff.size / 2);
                    ctx.closePath();
                    ctx.fill();
                    break;
                }

                case 'projectile': {
                    ctx.fillStyle = eff.color;
                    ctx.shadowColor = eff.color;
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, eff.size, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }

                case 'nova': {
                    const alpha = Math.max(0, eff.life / 2);
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 4;
                    ctx.shadowColor = eff.color;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }

                case 'zone': {
                    const lifeRatio = eff.life / eff.maxLife;
                    ctx.globalAlpha = 0.2 + lifeRatio * 0.15;
                    ctx.fillStyle = eff.color;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
                    ctx.fill();

                    // Pulsing border
                    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(performance.now() * 0.005);
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
                }

                case 'aura': {
                    const lifeRatio = eff.life / eff.maxLife;
                    ctx.globalAlpha = 0.1 + lifeRatio * 0.1;
                    ctx.fillStyle = eff.color;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.globalAlpha = 0.3;
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([10, 5]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    break;
                }

                case 'dash_trail': {
                    ctx.globalAlpha = Math.max(0, eff.life / 0.5) * 0.4;
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = eff.width;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(eff.startX, eff.startY);
                    ctx.lineTo(eff.endX, eff.endY);
                    ctx.stroke();
                    break;
                }

                case 'claw': {
                    ctx.globalAlpha = Math.max(0, eff.life / 0.3);
                    ctx.strokeStyle = eff.color;
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';

                    for (let c = -1; c <= 1; c++) {
                        const offset = c * 8;
                        const perpAngle = eff.angle + Math.PI / 2;
                        const ox = Math.cos(perpAngle) * offset;
                        const oy = Math.sin(perpAngle) * offset;

                        ctx.beginPath();
                        ctx.moveTo(
                            eff.x + ox - Math.cos(eff.angle) * eff.size * 0.5,
                            eff.y + oy - Math.sin(eff.angle) * eff.size * 0.5
                        );
                        ctx.lineTo(
                            eff.x + ox + Math.cos(eff.angle) * eff.size * 0.5,
                            eff.y + oy + Math.sin(eff.angle) * eff.size * 0.5
                        );
                        ctx.stroke();
                    }
                    break;
                }

                case 'pillar': {
                    const lifeRatio = eff.life / eff.maxLife;
                    ctx.globalAlpha = Math.min(1, lifeRatio * 3);
                    ctx.fillStyle = eff.color;
                    ctx.beginPath();
                    ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#A0937E';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
                }

                case 'leap': {
                    if (!eff.landed) {
                        // Shadow at landing
                        ctx.globalAlpha = 0.3 + eff.progress * 0.3;
                        ctx.fillStyle = '#000000';
                        ctx.beginPath();
                        ctx.ellipse(eff.targetX, eff.targetY,
                            eff.radius * 0.5, eff.radius * 0.3, 0, 0, Math.PI * 2);
                        ctx.fill();

                        // Boss in air
                        const t = eff.progress;
                        const arcX = eff.startX + (eff.targetX - eff.startX) * t;
                        const arcY = eff.startY + (eff.targetY - eff.startY) * t
                            - Math.sin(t * Math.PI) * 100;

                        ctx.globalAlpha = 0.6;
                        ctx.fillStyle = eff.color;
                        ctx.beginPath();
                        ctx.arc(arcX, arcY, 20, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }
            }

            ctx.restore();
        }
    }

    // ──────────── RENDERING (Screen Space / HUD) ─────────

    renderHUD(ctx) {
        if (this.warningActive) {
            this._renderWarning(ctx);
        }

        if (this.activeBoss && this.bossEnemy && this.bossEnemy.active) {
            this._renderHealthBar(ctx);
        }
    }

    _renderWarning(ctx) {
        const canvas = this.game.canvas;
        const def = this.bossDefinitions[this.pendingBossType];
        if (!def) return;

        const progress = 1 - (this.warningTimer / this.warningDuration);
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.008);

        ctx.save();

        // Dark overlay
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * progress})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // "WARNING" text
        ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.font = `bold ${24 + progress * 8}px monospace`;
        ctx.fillText('WARNING', canvas.width / 2, canvas.height / 2 - 30);

        // Boss name
        ctx.fillStyle = `rgba(255, 255, 255, ${progress})`;
        ctx.font = `bold ${18 + progress * 6}px monospace`;
        ctx.fillText(def.name + ' approaches...', canvas.width / 2, canvas.height / 2 + 10);

        ctx.restore();
    }

    _renderHealthBar(ctx) {
        const canvas = this.game.canvas;
        const boss = this.bossEnemy;
        const def = this.activeBoss.def;

        const barWidth = Math.min(400, canvas.width * 0.6);
        const barHeight = 16;
        const x = (canvas.width - barWidth) / 2;
        const y = 50;

        const healthRatio = Math.max(0, boss.health / boss.maxHealth);

        // Shake offset
        const shakeX = this.healthBarShake > 0 ? (Math.random() - 0.5) * 6 : 0;
        const shakeY = this.healthBarShake > 0 ? (Math.random() - 0.5) * 4 : 0;

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Background panel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x - 4, y - 4, barWidth + 8, barHeight + 28, 4);
            ctx.fill();
        } else {
            ctx.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 28);
        }

        // Boss name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.name, canvas.width / 2, y + 4);

        // Bar background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x, y + 10, barWidth, barHeight);

        // Bar fill with gradient
        if (healthRatio > 0) {
            const gradient = ctx.createLinearGradient(x, y + 10, x + barWidth * healthRatio, y + 10);
            if (healthRatio > 0.66) {
                gradient.addColorStop(0, '#CC0000');
                gradient.addColorStop(1, '#FF2222');
            } else if (healthRatio > 0.33) {
                gradient.addColorStop(0, '#CC6600');
                gradient.addColorStop(1, '#FF8800');
            } else {
                gradient.addColorStop(0, '#CC0000');
                gradient.addColorStop(1, '#FF0000');
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y + 10, barWidth * healthRatio, barHeight);
        }

        // Flash effect on damage
        if (this.healthBarFlash > 0) {
            ctx.globalAlpha = this.healthBarFlash * 0.5;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, y + 10, barWidth * healthRatio, barHeight);
            ctx.globalAlpha = 1;
        }

        // Phase threshold markers
        const phases = def.phases;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 1; i < phases.length; i++) {
            const markerX = x + barWidth * phases[i].threshold;
            ctx.beginPath();
            ctx.moveTo(markerX, y + 10);
            ctx.lineTo(markerX, y + 10 + barHeight);
            ctx.stroke();
        }

        // Health percentage
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(healthRatio * 100)}%`, canvas.width / 2, y + 10 + barHeight - 3);

        // Border in boss glow color
        ctx.strokeStyle = def.glowColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y + 10, barWidth, barHeight);

        ctx.restore();
    }

    // ──────────── UTILITY ─────────────────────────────────

    _pointToLineDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    hasActiveBoss() {
        return this.activeBoss !== null && this.bossEnemy !== null && this.bossEnemy.active;
    }

    reset() {
        this.nextSpawnIndex = 0;
        this.activeBoss = null;
        this.bossEnemy = null;
        this.warningActive = false;
        this.warningTimer = 0;
        this.pendingBossType = null;
        this.healthBarShake = 0;
        this.healthBarFlash = 0;
        this.lastBossHealthRatio = 1;
        this.telegraphs = [];
        this.activeEffects = [];
    }
}
