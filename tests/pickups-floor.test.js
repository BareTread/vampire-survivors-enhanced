import { jest } from '@jest/globals';

// Floor workstream tests: health-orb honesty (rule 7), vacuum scope/callout
// (rule 3), rosary cleanse safety (rule 8), guaranteed capacity (rule 9),
// chest reward order (rule 9), and the critical-streak table migration.

let FloorItemSystem;
let Enemy;
let Demon;
let Wraith;
let PassiveItemSystem;
let getProfile;

beforeAll(async () => {
    ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
    ({ Enemy } = await import('../src/entities/Enemy.js'));
    ({ Demon } = await import('../src/entities/enemies/Demon.js'));
    ({ Wraith } = await import('../src/entities/enemies/Wraith.js'));
    ({ PassiveItemSystem } = await import('../src/systems/PassiveItemSystem.js'));
    ({ getProfile } = await import('../src/data/powerUps.js'));
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── Shared fixtures ────────────────────────────────────────────────────────

function makePlayer(overrides = {}) {
    return {
        x: 0,
        y: 0,
        level: 1,
        health: 100,
        maxHealth: 100,
        weapons: new Map(),
        combo: { multiplier: 1, count: 0 },
        streaks: { criticalHits: 0 },
        stats: { damage: 1, luck: 1, speed: 1, area: 1 },
        callout: jest.fn(),
        addKillToCombo: jest.fn(),
        addKillToStreak: jest.fn(),
        addDamageNumber: jest.fn(),
        activatePowerUp: jest.fn(),
        upgradeWeapon: jest.fn(function (id) {
            const w = this.weapons.get(id);
            if (w) w.level++;
        }),
        isAlive: () => true,
        // Mirrors the published Player.heal contract: returns HP actually
        // restored (0 when dead or full).
        heal(amount) {
            if (this.health <= 0) return 0;
            const restored = Math.min(amount, this.maxHealth - this.health);
            this.health += restored;
            return restored;
        },
        takeDamage(amount) {
            this.health = Math.max(0, this.health - amount);
        },
        ...overrides
    };
}

function makeGame(overrides = {}) {
    const player = makePlayer();
    const game = {
        showDebug: false,
        gameTime: 60,
        score: 0,
        spawnPowerUpDrop: jest.fn(),
        player,
        camera: {
            getWorldBounds: () => ({ left: -640, right: 640, top: -360, bottom: 360 }),
            shake: jest.fn(),
            shakeAt: jest.fn(),
            flash: jest.fn(),
            hitStop: jest.fn()
        },
        audioManager: null,
        applyStatUpgrade: jest.fn(),
        systems: {
            enemy: { activeEnemies: [], currentWave: 1 },
            experience: { createGem: jest.fn() },
            particle: null,
            gold: { onEnemyKilled: jest.fn(), spawnCoin: jest.fn(), runGold: 0 },
            achievement: { onEnemyKilled: jest.fn() },
            flowState: { adaptiveDamageMultiplier: 1, onEnemyKilled: jest.fn() },
            microChallenge: { onEnemyKilled: jest.fn() },
            rewards: { onEnemyKilled: jest.fn() },
            killMilestone: { onEnemyKilled: jest.fn() },
            challenge: null,
            passiveItems: null
        },
        ...overrides
    };
    game.systems.floorItems = new FloorItemSystem(game);
    return game;
}

// ── Rule 7: health orb honesty ─────────────────────────────────────────────

describe('health orb is not consumed when healing is impossible', () => {
    test('full HP: orb stays on the floor, no callout, no shake', () => {
        const game = makeGame();
        const floor = game.systems.floorItems;
        floor.spawnItem(10, 0, 'health_orb');
        floor.update(0.016);

        expect(floor.items).toHaveLength(1);
        expect(game.player.health).toBe(100);
        expect(game.player.callout).not.toHaveBeenCalled();
        expect(game.camera.shake).not.toHaveBeenCalled();
        expect(game.camera.flash).not.toHaveBeenCalled();
    });

    test('no_heals modifier: orb stays on the floor', () => {
        const game = makeGame();
        game.systems.challenge = { hasModifier: (id) => id === 'no_heals' };
        game.player.health = 40;
        game.player.heal = () => 0; // real Player.heal refuses under no_heals
        const floor = game.systems.floorItems;
        floor.spawnItem(10, 0, 'health_orb');
        floor.update(0.016);

        expect(floor.items).toHaveLength(1);
        expect(game.player.health).toBe(40);
        expect(game.player.callout).not.toHaveBeenCalled();
    });

    test('partial heal: callout reports only HP actually restored', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99); // heal roll → 25%
        try {
            const game = makeGame();
            game.player.health = 95; // only 5 HP of headroom
            const floor = game.systems.floorItems;
            floor.spawnItem(10, 0, 'health_orb');
            floor.update(0.016);

            expect(floor.items).toHaveLength(0);
            expect(game.player.health).toBe(100);
            expect(game.player.callout).toHaveBeenCalledWith('+5 HP', '#44FF88', 1);
            expect(game.camera.shake).not.toHaveBeenCalled();
        } finally {
            random.mockRestore();
        }
    });

    test('normal heal: orb consumed and full restored amount announced', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0); // heal roll → 15%
        try {
            const game = makeGame();
            game.player.health = 50;
            const floor = game.systems.floorItems;
            floor.spawnItem(10, 0, 'health_orb');
            floor.update(0.016);

            expect(floor.items).toHaveLength(0);
            expect(game.player.health).toBe(65); // 15% of 100
            expect(game.player.callout).toHaveBeenCalledWith('+15 HP', '#44FF88', 1);
        } finally {
            random.mockRestore();
        }
    });
});

// ── Rule 3: vacuum scope and truthful haul callout ─────────────────────────

describe('vacuum claims XP and gold only', () => {
    function vacuumGame({ xp = 0, gold = 0 } = {}) {
        const game = makeGame();
        game.systems.experience = {
            claimAllGems: jest.fn(() => ({ count: xp > 0 ? 1 : 0, xp })),
            activateGlobalMagnet: jest.fn()
        };
        game.systems.gold = {
            claimAllCoins: jest.fn(() => ({ count: gold > 0 ? 1 : 0, gold })),
            onEnemyKilled: jest.fn(),
            spawnCoin: jest.fn(),
            runGold: 0
        };
        return game;
    }

    test('already-claimed resources are not counted twice', () => {
        const game = vacuumGame({ xp: 0, gold: 0 });
        const floor = game.systems.floorItems;
        floor.spawnItem(10, 0, 'vacuum');
        floor.update(0.016);

        // Nothing newly claimed → no misleading haul callout
        expect(game.player.callout).not.toHaveBeenCalled();
    });

    test('tactical pickups are not claimed by vacuum', () => {
        const game = vacuumGame({ xp: 10, gold: 5 });
        const floor = game.systems.floorItems;
        floor.spawnItem(500, 500, 'health_orb'); // far outside collectRange
        floor.spawnItem(500, 520, 'rosary');
        floor.spawnItem(10, 0, 'vacuum');
        floor.update(0.016);

        const remaining = floor.items.map((i) => i.type).sort();
        expect(remaining).toEqual(['health_orb', 'rosary']);
    });
});

// ── Rule 8: safe rosary ────────────────────────────────────────────────────

describe('rosary cleanse suppresses hostile on-death effects', () => {
    function rosaryKill(game, enemy) {
        game.systems.enemy.activeEnemies.push(enemy);
        const floor = game.systems.floorItems;
        floor.spawnItem(10, 0, 'rosary');
        floor.update(0.016);
        return floor;
    }

    test('explosive elite: no blast damage, credit/XP/gold preserved', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'explodeOnDeath';
            elite.shieldHits = 0;
            const xp = elite.expReward;

            rosaryKill(game, elite);

            expect(elite._deathProcessed).toBe(true);
            expect(elite.health).toBe(0);
            expect(elite.deathCause).toBe('rosary');
            expect(game.systems.experience.createGem).toHaveBeenCalledWith(
                expect.any(Number), expect.any(Number), xp);
            expect(game.systems.gold.onEnemyKilled).toHaveBeenCalledWith(elite);
            expect(game.player.addKillToCombo).toHaveBeenCalled();
            expect(game.player.health).toBe(100); // no explosion damage
        } finally {
            random.mockRestore();
        }
    });

    test('shielded elite is cleansed through its shield', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'shield';
            elite.shieldHits = 3;

            rosaryKill(game, elite);

            expect(elite._deathProcessed).toBe(true);
            expect(elite.health).toBe(0);
        } finally {
            random.mockRestore();
        }
    });

    test('boss is immune to rosary', () => {
        const game = makeGame();
        const boss = new Enemy(game, 40, 0, 'elite');
        boss.isBoss = true;
        rosaryKill(game, boss);

        expect(boss._deathProcessed).toBeFalsy();
        expect(boss.health).toBeGreaterThan(0);
    });

    test('off-screen enemies are not cleansed', () => {
        const game = makeGame();
        const far = new Enemy(game, 5000, 0, 'basic');
        rosaryKill(game, far);

        expect(far._deathProcessed).toBeFalsy();
        expect(far.health).toBeGreaterThan(0);
    });

    test('subclass die() wrapper (Demon) forwards the rosary cause', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const demon = new Demon(game, 40, 0);
            rosaryKill(game, demon);

            expect(demon._deathProcessed).toBe(true);
            expect(demon.deathCause).toBe('rosary');
            expect(game.systems.experience.createGem).toHaveBeenCalled();
        } finally {
            random.mockRestore();
        }
    });

    test('deferred death (health zeroed outside takeDamage) honors the cause', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'explodeOnDeath';
            elite.shieldHits = 0;
            game.systems.enemy.activeEnemies.push(elite);

            elite.health = 0;
            elite.deathCause = 'rosary';
            elite.update(0.016); // updateDeath → die()

            expect(elite._deathProcessed).toBe(true);
            expect(game.systems.experience.createGem).toHaveBeenCalled();
            expect(game.player.health).toBe(100);
        } finally {
            random.mockRestore();
        }
    });

    test('normal kill of explosive elite still damages the player', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'explodeOnDeath';
            elite.shieldHits = 0;
            game.systems.enemy.activeEnemies.push(elite);

            elite.takeDamage(999999, null, false);

            expect(elite._deathProcessed).toBe(true);
            expect(elite.deathCause).toBeNull();
            expect(game.player.health).toBeLessThan(100);
        } finally {
            random.mockRestore();
        }
    });

    test('pool reset clears the death cause', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'explodeOnDeath';
            elite.shieldHits = 0;
            rosaryKill(game, elite);
            expect(elite.deathCause).toBe('rosary');

            elite.reset(0, 0, 'basic');
            expect(elite.deathCause).toBeNull();
            expect(elite._deathProcessed).toBe(false);
        } finally {
            random.mockRestore();
        }
    });
});

// ── Rule 9: guaranteed rewards and capacity ────────────────────────────────

describe('guaranteed floor capacity', () => {
    function fillFloor(sys, count = sys.maxItems, guaranteed = false) {
        for (let i = 0; i < count; i++) {
            sys.spawnItem(i * 40, 400, 'health_orb', { guaranteed });
        }
    }

    test('ordinary drops still respect the cap', () => {
        const sys = new FloorItemSystem(makeGame());
        fillFloor(sys);
        sys.spawnItem(0, 0, 'rosary');
        expect(sys.items).toHaveLength(sys.maxItems);
    });

    test('guaranteed spawn evicts the oldest ordinary item', () => {
        const sys = new FloorItemSystem(makeGame());
        fillFloor(sys);
        const oldest = sys.items[0];

        sys.spawnItem(0, 0, 'treasure_chest', { guaranteed: true });

        expect(sys.items).toHaveLength(sys.maxItems);
        expect(sys.items).not.toContain(oldest);
        expect(sys.items.at(-1).type).toBe('treasure_chest');
        expect(sys.items.at(-1).guaranteed).toBe(true);
    });

    test('all-guaranteed floor temporarily exceeds the cap', () => {
        const sys = new FloorItemSystem(makeGame());
        fillFloor(sys, sys.maxItems, true);

        sys.spawnItem(0, 0, 'treasure_chest', { guaranteed: true });

        expect(sys.items).toHaveLength(sys.maxItems + 1);
    });

    test('onBossDeath lands all three guaranteed drops on a full floor', () => {
        const sys = new FloorItemSystem(makeGame());
        fillFloor(sys);
        sys.onBossDeath(0, 0);

        const types = sys.items.map((i) => i.type);
        expect(types).toContain('treasure_chest');
        expect(types).toContain('health_orb');
        expect(types).toContain('vacuum');
        expect(sys.items).toHaveLength(sys.maxItems);
    });

    test('onEnemyDeath drops are ordinary and still capped', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.001);
        try {
            const game = makeGame();
            const sys = game.systems.floorItems;
            fillFloor(sys);
            sys.onEnemyDeath({ type: 'elite', x: 0, y: 0 });
            expect(sys.items).toHaveLength(sys.maxItems);
        } finally {
            random.mockRestore();
        }
    });
});

// ── Rule 9: chest reward order ─────────────────────────────────────────────

describe('boss chest reward order', () => {
    function chestGame({ weapons = [], passives = false, ironWill = false } = {}) {
        const game = makeGame();
        for (const w of weapons) game.player.weapons.set(w.id, w);
        if (passives) game.systems.passiveItems = new PassiveItemSystem(game);
        if (ironWill) game.systems.challenge = { hasModifier: (id) => id === 'iron_will' };
        return game;
    }

    function openChest(game) {
        const floor = game.systems.floorItems;
        floor.spawnItem(10, 0, 'treasure_chest');
        floor.update(0.016);
        return floor;
    }
    test('grants a level to the lowest-level eligible weapon', () => {
        const game = chestGame({
            weapons: [
                { id: 'whip', name: 'Whip', level: 3, maxLevel: 8, evolved: false },
                { id: 'knife', name: 'Knife', level: 1, maxLevel: 8, evolved: false },
                { id: 'maxed', name: 'Maxed', level: 8, maxLevel: 8, evolved: false },
                { id: 'evo', name: 'Evolved', level: 1, maxLevel: 8, evolved: true }
            ]
        });
        openChest(game);

        expect(game.player.upgradeWeapon).toHaveBeenCalledWith('knife');
        expect(game.player.weapons.get('knife').level).toBe(2);
        expect(game.systems.gold.spawnCoin).not.toHaveBeenCalled();
    });

    test('no eligible weapon → grants a passive level', () => {
        const game = chestGame({
            weapons: [{ id: 'whip', name: 'Whip', level: 8, maxLevel: 8, evolved: false }],
            passives: true
        });
        openChest(game);

        expect(game.player.upgradeWeapon).not.toHaveBeenCalled();
        expect(game.systems.passiveItems.items.size).toBe(1);
        const item = game.systems.passiveItems.items.values().next().value;
        expect(item.currentLevel).toBe(1);
        expect(game.systems.gold.spawnCoin).not.toHaveBeenCalled();
    });

    test('owned non-maxed passive is upgraded before a new item', () => {
        const game = chestGame({ passives: true });
        const passives = game.systems.passiveItems;
        passives.addItem('spinach'); // L1 of 5
        openChest(game);

        expect(passives.items.size).toBe(1);
        expect(passives.items.get('spinach').currentLevel).toBe(2);
    });

    test('iron_will blocks passive grant → exact gold fallback', () => {
        const game = chestGame({ passives: true, ironWill: true });
        openChest(game);

        expect(game.systems.passiveItems.items.size).toBe(0);
        const coins = game.systems.gold.spawnCoin.mock.calls.map((c) => c[2]);
        expect(coins.reduce((a, b) => a + b, 0)).toBe(150);
    });

    test('all weapons maxed and all passives maxed → exact gold fallback', () => {
        const game = chestGame({ passives: true });
        const passives = game.systems.passiveItems;
        // Fill every slot with maxed items
        for (const def of passives.itemDefinitions.values()) {
            passives.items.set(def.id, { ...def, currentLevel: def.maxLevel });
        }
        openChest(game);

        const coins = game.systems.gold.spawnCoin.mock.calls.map((c) => c[2]);
        expect(coins.reduce((a, b) => a + b, 0)).toBe(150);
        expect(game.systems.floorItems.banner.line).toBe('+150 gold');
    });
});

// ── Critical streak uses the shared power-up table ─────────────────────────

describe('critical streak profile', () => {
    function killCrit(game) {
        const e = new Enemy(game, 100, 0, 'basic');
        game.systems.enemy.activeEnemies.push(e);
        e.takeDamage(999999, null, true);
    }

    test('five critical kills activate the table profile, not a hardcoded buff', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const p = getProfile('critical');

            for (let i = 0; i < 4; i++) killCrit(game);
            expect(game.player.activatePowerUp).not.toHaveBeenCalled();

            killCrit(game);
            expect(game.player.activatePowerUp).toHaveBeenCalledWith(p.id, p.duration, p.intensity);
            expect(game.player.streaks.criticalHits).toBe(0);
        } finally {
            random.mockRestore();
        }
    });
});
