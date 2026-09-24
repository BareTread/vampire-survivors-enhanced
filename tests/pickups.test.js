import { jest } from '@jest/globals';

describe('R1 gem cap deletes XP', () => {
    let ExperienceSystem;

    beforeAll(async () => {
        ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    });

    const createGemGame = () => ({
        player: {
            x: 0,
            y: 0,
            stats: { luck: 1 },
            isAlive: () => true,
            gainExperience: jest.fn()
        },
        audioManager: {
            playVampireSound: jest.fn(),
            playExperienceGain: jest.fn()
        },
        systems: {
            particle: {
                create: jest.fn(),
                createBurst: jest.fn(),
                createEnhancedDamageNumber: jest.fn(),
                createLuckyGemSparkles: jest.fn(),
                createBonusGemEffect: jest.fn()
            }
        }
    });

    test('spawning past the cap conserves every dropped XP point', () => {
        const game = createGemGame();
        const system = new ExperienceSystem(game);

        // Fill the floor to the cap with explicit values (deterministic: no lucky roll).
        let dropped = 0;
        for (let i = 0; i < system.maxActiveGems; i++) {
            system.createGem(i * 10, 0, 5);
            dropped += 5;
        }
        expect(system.getActiveGemCount()).toBe(system.maxActiveGems);

        // The 61st gem currently shift()s the oldest out and pools it, so its
        // value is destroyed. Contract: the cap limits rendered objects, never
        // value — overflow must merge into an existing gem (or be awarded).
        system.createGem(9999, 0, 7);
        dropped += 7;

        const awarded = game.player.gainExperience.mock.calls.reduce(
            (sum, call) => sum + call[0],
            0
        );
        expect(system.getActiveGemCount()).toBeLessThanOrEqual(system.maxActiveGems);
        expect(system.getTotalGemValue() + awarded).toBe(dropped);
    });

    test('repeated overflow keeps total XP conserved', () => {
        const game = createGemGame();
        const system = new ExperienceSystem(game);

        let dropped = 0;
        // Spawn 40 gems beyond the cap; each overflow must not lose value.
        for (let i = 0; i < system.maxActiveGems + 40; i++) {
            const value = 5 + (i % 3) * 10; // 5, 15, 25 cycling
            system.createGem(i * 10, 0, value);
            dropped += value;
        }

        const awarded = game.player.gainExperience.mock.calls.reduce(
            (sum, call) => sum + call[0],
            0
        );
        expect(system.getActiveGemCount()).toBeLessThanOrEqual(system.maxActiveGems);
        expect(system.getTotalGemValue() + awarded).toBe(dropped);
    });
});

describe('R2 origin heuristic culls gems near world origin', () => {
    let ExperienceGem;

    beforeAll(async () => {
        ({ ExperienceGem } = await import('../src/entities/ExperienceGem.js'));
    });

    const makeGame = (playerX, playerY, { globalMagnet = false } = {}) => ({
        camera: { x: playerX, y: playerY, width: 1280, height: 720 },
        player: {
            x: playerX,
            y: playerY,
            stats: { luck: 1 },
            xpAwarded: 0,
            isAlive: () => true,
            gainExperience(v) {
                this.xpAwarded += v;
            }
        },
        systems: {
            experience: {
                isGlobalMagnetActive: () => globalMagnet,
                globalMagnetTimer: globalMagnet ? 10 : 0
            },
            particle: null
        },
        audioManager: { playExperienceGain: () => {} }
    });

    test('legitimate world-space gem near origin survives while player is far away', () => {
        const game = makeGame(5000, 5000);
        const gem = new ExperienceGem(game, 100, 0, 5);
        gem.currentSpawnTime = 0; // past spawn animation

        gem.update(1 / 60);

        expect(gem.isActive()).toBe(true);
    });

    test('global magnet collects a gem near the origin for a far-away player', () => {
        const game = makeGame(5000, 0, { globalMagnet: true });
        const gem = new ExperienceGem(game, 100, 0, 5);

        for (let i = 0; i < 400 && !gem.collected; i++) {
            gem.update(1 / 60);
        }

        expect(gem.collected).toBe(true);
        expect(game.player.xpAwarded).toBe(5);
    });
});

// R3 — Gem expiry deletes XP, including mid-vacuum.
// Bug: ExperienceGem.update() decrements this.lifetime and calls destroy() with
// no exemption for forceMagnetTimer / beingMagnetized / the system global
// magnet (src/entities/ExperienceGem.js ~L136-140). destroy() only sets
// active = false — the XP is never awarded, so a Vacuum pickup can lose gems
// mid-flight. Reproduced on pickups/reliability: a magnetized gem with
// lifetime 0.005 dies on the next ExperienceSystem.update; gainExperience is
// never called and floor value drops to 0.
// Note: collected gems are returned to the pool (returnGemToPool resets
// collected/active), so collection is observed via the gainExperience spy and
// the floor-value invariant, not via gem.collected.
describe('R3 age expiry destroys XP mid-vacuum', () => {
    let ExperienceSystem;

    const makeSystem = () => {
        const game = {
            player: {
                x: 0,
                y: 0,
                stats: { luck: 1 },
                isAlive: () => true,
                gainExperience: jest.fn()
            },
            camera: { x: 0, y: 0, width: 800, height: 600 },
            audioManager: null,
            systems: { particle: null }
        };
        const system = new ExperienceSystem(game);
        game.systems.experience = system;
        return { game, system };
    };

    const awardedXp = (game) =>
        game.player.gainExperience.mock.calls.reduce((sum, c) => sum + c[0], 0);

    const floorValue = (system) =>
        system.activeGems.reduce((sum, g) => sum + g.value, 0);

    beforeAll(async () => {
        ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    });

    test('a gem claimed by vacuum is not destroyed by age expiry and still pays out', () => {
        const { game, system } = makeSystem();

        // Far gem about to age out; the Vacuum pickup path claims it
        // (FloorItemSystem 'vacuum': magnetizeAllGems + activateGlobalMagnet).
        const gem = system.createGem(400, 0, 25);
        gem.currentSpawnTime = 0;
        gem.lifetime = 0.005; // expires on the very next update

        system.magnetizeAllGems();
        system.activateGlobalMagnet(3.0);
        expect(gem.beingMagnetized).toBe(true);

        // This update pushes lifetime <= 0. A claimed gem must ignore expiry:
        // still active and homing, not silently destroyed.
        system.update(1 / 60);
        expect(gem.active).toBe(true);

        // It must keep homing until collected and pay out its XP.
        for (let i = 0; i < 120 && awardedXp(game) === 0; i++) {
            system.update(1 / 60);
        }
        expect(game.player.gainExperience).toHaveBeenCalledWith(25);
        expect(floorValue(system)).toBe(0); // collected gem left the floor
    });

    test('expired gem XP is conserved instead of vanishing', () => {
        const { game, system } = makeSystem();

        // Two far gems; the older one ages out on the next update.
        const oldGem = system.createGem(5000, 5000, 25);
        oldGem.currentSpawnTime = 0;
        oldGem.lifetime = 0.005;
        const youngGem = system.createGem(5100, 5000, 10);
        youngGem.currentSpawnTime = 0;

        system.update(1 / 60); // pushes oldGem past its lifetime

        // Conservation invariant: floor value + awarded XP == XP dropped.
        // (Consolidating the expiring gem into a neighbour, or awarding it,
        // both satisfy this; silently destroying it does not.)
        expect(floorValue(system) + awardedXp(game)).toBe(35);
    });
});

// R4 — Timed Magnet radius is viewport-derived (~144u) and weaker than max Attractorb (180u).
// VampireSurvivorsGame.collectPowerUp magnetBoost uses
// max(player.size * 10, min(camera.width, camera.height) * 0.2)
// (src/core/VampireSurvivorsGame.js ~L2832-2838). Size 12 on 1280×720 stores 144.
// Max Attractorb is ExperienceSystem.magnetRange * (1 + 1.25) = 180
// (src/systems/ExperienceSystem.js ~L146, PassiveItemSystem attractorb L5).
// Desired: radius comes from that effective pickup range, always beats Attractorb
// (at least max(3 × effectiveRange, 360)), and does not change with the viewport.
// Pull is the stored areaMagnetRadius plus the gem the handler pulses.
describe('R4 timed Magnet radius', () => {
    let VampireSurvivorsGame;
    let ExperienceSystem;

    beforeAll(async () => {
        ({ VampireSurvivorsGame } = await import('../src/core/VampireSurvivorsGame.js'));
        ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    });

    // Contract example: the field always beats Attractorb, and scales with it.
    const fieldFloor = (effectiveRange) => Math.max(3 * effectiveRange, 360);

    function activate(width, height, pickupBonus) {
        const player = {
            x: 0,
            y: 0,
            size: 12,
            stats: { luck: 1 },
            isAlive: () => true,
            activatePowerUp: jest.fn()
        };
        const host = Object.create(VampireSurvivorsGame.prototype);
        host.player = player;
        host.camera = { x: 0, y: 0, width, height };
        host.audioManager = { playPowerUpCollect: jest.fn() };
        host.systems = {
            particle: { createPowerUpCollectEffect: jest.fn() },
            passiveItems: {
                getStatModifiers: () => ({
                    damage: 0,
                    speed: 0,
                    cooldown: 0,
                    projectiles: 0,
                    armor: 0,
                    pickupRange: pickupBonus
                })
            }
        };
        const experience = new ExperienceSystem(host);
        host.systems.experience = experience;

        const effective = experience.magnetRange * (1 + pickupBonus) * player.stats.luck;
        // Inside the minimum desired field, outside max Attractorb (180) and outside ~144.
        const gem = {
            active: true,
            collected: false,
            x: fieldFloor(effective) - 1,
            y: 0,
            forceMagnetTimer: 0,
            beingMagnetized: false
        };
        experience.activeGems.push(gem);
        experience.updateSpatialGrid();

        VampireSurvivorsGame.prototype.collectPowerUp.call(host, {
            type: 'magnetBoost',
            x: 0,
            y: 0
        });

        return { experience, effective, gem };
    }

    test('timed Magnet on a 720-tall view outranges max Attractorb and pulls that far', () => {
        const { experience, effective, gem } = activate(1280, 720, 1.25);

        expect(experience.areaMagnetRadius).toBeGreaterThan(effective);
        expect(experience.areaMagnetRadius).toBeGreaterThanOrEqual(fieldFloor(effective));
        expect(gem.forceMagnetTimer).toBeGreaterThan(0);
    });

    test('timed Magnet radius follows pickup range, not the viewport', () => {
        const phone = activate(390, 844, 1.25);
        const desktop = activate(1280, 720, 1.25);
        const wide = activate(2560, 1440, 1.25);
        const bare = activate(1280, 720, 0);

        expect(phone.experience.areaMagnetRadius).toBe(desktop.experience.areaMagnetRadius);
        expect(wide.experience.areaMagnetRadius).toBe(desktop.experience.areaMagnetRadius);
        expect(desktop.experience.areaMagnetRadius).toBeGreaterThan(bare.experience.areaMagnetRadius);
        expect(bare.experience.areaMagnetRadius).toBeGreaterThan(bare.effective);
        expect(bare.experience.areaMagnetRadius).toBeGreaterThanOrEqual(fieldFloor(bare.effective));
    });
});

// R5 — Floor Vacuum ignores gold.
// Contract §3: "Vacuum collects XP and gold only." Current code:
// FloorItemSystem.applyItem('vacuum') only calls experience.magnetizeAllGems()
// and experience.activateGlobalMagnet(3.0) — both XP-gem-only paths.
// GoldSystem has no vacuum/global-magnet hook; coins only pull inside
// magnetRange (100 px × pickupBonus). A distant coin is never collected.
describe('R5 vacuum collects gold', () => {
    let FloorItemSystem;
    let GoldSystem;
    let ExperienceSystem;

    beforeAll(async () => {
        ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
        ({ GoldSystem } = await import('../src/systems/GoldSystem.js'));
        ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    });

    // Real FloorItemSystem + GoldSystem + ExperienceSystem; rendering/audio
    // and unrelated game services stubbed.
    function makeGame() {
        const game = {
            player: {
                x: 0,
                y: 0,
                isAlive: () => true,
                maxHealth: 100,
                health: 100,
                stats: { damage: 1, luck: 1, speed: 1, area: 1 },
                weapons: new Map(),
                addDamageNumber: jest.fn(),
                callout: jest.fn(),
                gainExperience: jest.fn()
            },
            camera: {
                getWorldBounds: (m = 0) => ({ left: -500, right: 500, top: -500, bottom: 500 }),
                shake: jest.fn(),
                flash: jest.fn()
            },
            audioManager: null,
            applyStatUpgrade: jest.fn(),
            systems: {
                enemy: { activeEnemies: [] },
                particle: null,
                passiveItems: { getStatModifiers: () => ({}) },
                persistence: null,
                challenge: null
            }
        };
        game.systems.experience = new ExperienceSystem(game);
        game.systems.gold = new GoldSystem(game);
        game.systems.floorItems = new FloorItemSystem(game);
        return game;
    }

    // Deterministic coin: spawnCoin adds random scatter velocity, so zero it.
    function spawnStillCoin(gold, x, y, value) {
        gold.spawnCoin(x, y, value);
        const coin = gold.coins[gold.coins.length - 1];
        coin.x = x;
        coin.y = y;
        coin.vx = 0;
        coin.vy = 0;
        return coin;
    }

    function step(game, seconds) {
        const dt = 0.05;
        for (let t = 0; t < seconds; t += dt) {
            game.systems.floorItems.update(dt);
            game.systems.experience.update(dt);
            game.systems.gold.update(dt);
        }
    }

    test('vacuum pickup collects a gold coin far beyond magnetRange', () => {
        const game = makeGame();
        const gold = game.systems.gold;
        const floor = game.systems.floorItems;

        // Coin at 800 px — far outside gold.magnetRange (100 px, no Attractorb).
        spawnStillCoin(gold, 800, 0, 25);
        floor.spawnItem(10, 0, 'vacuum'); // inside floor collectRange (32 px)

        step(game, 12); // coin lifetime is 15 s; claimed coins must not expire

        expect(gold.runGold).toBe(25);
        expect(gold.coins).toHaveLength(0);
    });

    test('control: without vacuum the same distant coin is not collected', () => {
        const game = makeGame();
        const gold = game.systems.gold;

        spawnStillCoin(gold, 800, 0, 25);
        step(game, 12);

        expect(gold.runGold).toBe(0);
        expect(gold.coins).toHaveLength(1);
    });
});

describe('R6 weaker duplicate buff does not replace a stronger one', () => {
    let Player;
    let player;

    beforeAll(async () => {
        ({ Player } = await import('../src/entities/Player.js'));
    });

    afterEach(() => {
        player?.destroy();
        player = null;
    });

    function spawn() {
        const game = {
            inputManager: { on: jest.fn(), off: jest.fn() },
            camera: { flash: jest.fn() },
            systems: { particle: { createPowerUpEffect: jest.fn() } }
        };
        player = new Player(game, 0, 0);
        return player;
    }

    // Milestone damageBoost is base 3.0 × intensity 2 = 6× for 15s.
    // Floor pickup is base 3.0 × intensity 1 = 3× for 10s.
    function applyStrongThenWeak(hero) {
        hero.activatePowerUp('damageBoost', 15, 2);
        expect(hero.getEffectiveStats().damage).toBe(6);
        hero.activatePowerUp('damageBoost', 10, 1);
    }

    test('effective strength stays 6x after a 3x duplicate', () => {
        const hero = spawn();
        applyStrongThenWeak(hero);
        expect(hero.getEffectiveStats().damage).toBe(6);
    });

    test('strong duration stays 15s after a 10s duplicate', () => {
        const hero = spawn();
        applyStrongThenWeak(hero);

        hero.updatePowerUps(10);
        expect(hero.getEffectiveStats().damage).toBe(6);

        hero.updatePowerUps(4.9);
        expect(hero.getEffectiveStats().damage).toBe(6);

        hero.updatePowerUps(0.2);
        expect(hero.getEffectiveStats().damage).toBe(1);
    });
});

// R7 — Rosary kill of an explosive elite still applies the hostile death blast.
// Contract §8: cleanse kills must not fire explosion / split / summon-on-death.
// At 1:00, wave 1, level 1, one weapon, player 40px away (inside the 80px blast):
// floor(30 * 1.25^0.5) = 33, under the early HP cap. Desired damage: 0.
// Kill credit, XP, and gold must still land.
describe('R7 rosary kills explosive elite', () => {
    let Enemy;
    let FloorItemSystem;

    beforeAll(async () => {
        ({ Enemy } = await import('../src/entities/Enemy.js'));
        ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    function makeGame() {
        const player = {
            x: 0,
            y: 0,
            level: 1,
            health: 100,
            maxHealth: 100,
            weapons: new Map([['whip', {}]]),
            combo: { multiplier: 1, count: 0 },
            streaks: { criticalHits: 0 },
            callout: jest.fn(),
            addKillToCombo: jest.fn(),
            addKillToStreak: jest.fn(),
            addDamageNumber: jest.fn(),
            activatePowerUp: jest.fn(),
            isAlive: () => true,
            takeDamage(amount) {
                this.health = Math.max(0, this.health - amount);
            }
        };
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
            systems: {
                enemy: { activeEnemies: [], currentWave: 1 },
                experience: { createGem: jest.fn() },
                particle: null,
                gold: { onEnemyKilled: jest.fn() },
                achievement: { onEnemyKilled: jest.fn() },
                flowState: { adaptiveDamageMultiplier: 1, onEnemyKilled: jest.fn() },
                microChallenge: { onEnemyKilled: jest.fn() },
                rewards: { onEnemyKilled: jest.fn() },
                killMilestone: { onEnemyKilled: jest.fn() }
            }
        };
        game.systems.floorItems = new FloorItemSystem(game);
        return game;
    }

    test('rosary kill of a nearby explosive elite does not damage the player', () => {
        const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = makeGame();
            const player = game.player;
            const elite = new Enemy(game, 40, 0, 'elite');
            elite.eliteAbility = 'explodeOnDeath';
            elite.shieldHits = 0;
            game.systems.enemy.activeEnemies.push(elite);

            const xp = elite.expReward;
            const floor = game.systems.floorItems;
            floor.spawnItem(10, 0, 'rosary');
            floor.update(0.016);

            expect(floor.items).toHaveLength(0);
            expect(elite._deathProcessed).toBe(true);
            expect(elite.health).toBe(0);
            expect(game.systems.experience.createGem).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Number),
                xp
            );
            expect(game.systems.gold.onEnemyKilled).toHaveBeenCalledWith(elite);
            expect(100 - player.health).toBe(0);
        } finally {
            random.mockRestore();
        }
    });
});

// R8 — Boss chest is silently dropped when the floor is at maxItems (20).
// Contract rule 9: guaranteed boss/event rewards bypass maxItems; if the floor
// is full the oldest non-guaranteed item is evicted. Currently
// FloorItemSystem.spawnItem() returns early at the cap, so every guaranteed
// drop from onBossDeath() (chest + health orb + vacuum) vanishes silently.

describe('R8 boss chest dropped when floor is full', () => {
    let FloorItemSystem;
    let BossSystem;

    beforeAll(async () => {
        ({ FloorItemSystem } = await import('../src/systems/FloorItemSystem.js'));
        ({ BossSystem } = await import('../src/systems/BossSystem.js'));
    });

    function makeGame(overrides = {}) {
        return {
            player: {
                x: 0,
                y: 0,
                isAlive: () => true,
                maxHealth: 100,
                health: 80,
                weapons: new Map(),
                addDamageNumber: jest.fn(),
                callout: jest.fn(),
                stats: { damage: 1, luck: 1, speed: 1, area: 1 }
            },
            camera: {
                getWorldBounds: (m = 0) => ({ left: -500, right: 500, top: -500, bottom: 500 }),
                shake: jest.fn(),
                flash: jest.fn(),
                hitStop: jest.fn()
            },
            systems: {
                enemy: { activeEnemies: [] },
                experience: {
                    magnetizeAllGems: jest.fn(),
                    activateGlobalMagnet: jest.fn(),
                    createGemExplosion: jest.fn()
                },
                gold: { spawnCoin: jest.fn(), runGold: 0 },
                particle: { create: jest.fn() },
                screenEffects: { triggerSlowMo: jest.fn() },
                achievement: { onBossKilled: jest.fn() },
                floorItems: null
            },
            applyStatUpgrade: jest.fn(),
            ...overrides
        };
    }

    function fillFloor(sys, count = sys.maxItems) {
        for (let i = 0; i < count; i++) {
            sys.spawnItem(i * 40, 400, 'health_orb');
        }
    }

    test('onBossDeath still lands all guaranteed drops on a full floor', () => {
        const sys = new FloorItemSystem(makeGame());
        fillFloor(sys);
        expect(sys.items).toHaveLength(sys.maxItems);

        sys.onBossDeath(0, 0);

        const types = sys.items.map((i) => i.type);
        expect(types).toContain('treasure_chest');
        expect(types).toContain('health_orb');
        expect(types).toContain('vacuum');
    });

    test('BossSystem._onBossDeath reward path delivers the chest on a full floor', () => {
        const game = makeGame();
        const floor = new FloorItemSystem(game);
        game.systems.floorItems = floor;
        fillFloor(floor);

        const boss = new BossSystem(game);
        boss.activeBoss = {
            type: 'vampire_lord',
            def: boss.bossDefinitions.vampire_lord,
            phase: 1
        };
        boss.bossEnemy = { x: 200, y: 100, active: false, health: 0 };
        boss._onBossDeath();

        expect(floor.items.some((i) => i.type === 'treasure_chest')).toBe(true);
    });
});

describe('R9 queued level-ups stay paused between picks', () => {
    let Player;
    let VampireSurvivorsGame;
    let player;

    beforeAll(async () => {
        ({ Player } = await import('../src/entities/Player.js'));
        ({ VampireSurvivorsGame } = await import('../src/core/VampireSurvivorsGame.js'));
    });

    afterEach(() => {
        if (player) {
            player.destroy();
            player = null;
        }
        jest.useRealTimers();
    });

    test('a double XP level-up never resumes gameplay during the 500ms gap', () => {
        jest.useFakeTimers();
        const game = Object.create(VampireSurvivorsGame.prototype);
        game.gameState = 'playing';
        game.timeScale = 1;
        game.levelUpActive = false;
        game.levelUpOptions = [];
        game.canvas = { style: {} };
        game.camera = { clearFlash: jest.fn() };
        game.inputManager = { on: jest.fn(), off: jest.fn() };
        game.audioManager = { playLevelUp: jest.fn() };
        game.weaponClasses = new Map(); // Real option generator still supplies stat upgrades.
        game.showToast = jest.fn();
        game.systems = {
            challenge: { hasModifier: () => false },
            persistence: { getUpgradeModifiers: () => ({ xpGain: 1 }) },
            experience: { magnetizeGemsInRadius: jest.fn() },
            particle: {
                create: jest.fn(),
                createBurst: jest.fn(),
                createEnhancedDamageNumber: jest.fn(),
                createEvolutionEffect: jest.fn(),
                clearScreenEffects: jest.fn()
            }
        };
        player = new Player(game, 100, 100);
        game.player = player;

        player.gainExperience(Player.xpForLevel(1) + Player.xpForLevel(2));
        expect(player.level).toBe(3);
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);
        expect(game.levelUpOptions.some(option => option.type === 'stat_upgrade')).toBe(true);

        game.selectLevelUpOption(game.levelUpOptions.findIndex(option => option.type === 'stat_upgrade'));
        jest.advanceTimersByTime(499);
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);

        jest.advanceTimersByTime(1);
        expect(game.gameState).toBe('levelUp');
        game.selectLevelUpOption(game.levelUpOptions.findIndex(option => option.type === 'stat_upgrade'));
        expect(game.gameState).toBe('playing');
        expect(game.timeScale).toBe(1);
    });
});

describe('R10 fire-rate buff semantics', () => {
    let Player;

    const createGame = () => ({
        inputManager: { on: jest.fn(), off: jest.fn() },
        camera: {
            screenToWorld: (x, y) => ({ x, y }),
            flash: jest.fn(),
            shake: jest.fn(),
            addTrauma: jest.fn(),
            kick: jest.fn()
        },
        audioManager: {
            playVampireSound: jest.fn(),
            playCriticalHit: jest.fn()
        },
        systems: {
            particle: {
                createBurst: jest.fn(),
                createPowerUpEffect: jest.fn(),
                createKillStreakEffect: jest.fn()
            },
            passiveItems: {
                getStatModifiers: () => ({ damage: 0, speed: 0, cooldown: 0, projectiles: 0, armor: 0, pickupRange: 1 })
            },
            persistence: {
                getUpgradeModifiers: () => ({
                    maxHealth: 1, damage: 1, moveSpeed: 1, cooldown: 1,
                    xpGain: 1, armor: 0, revival: 0, goldGain: 1
                })
            }
        },
        updateComboDisplay: jest.fn(),
        showLevelUpUI: jest.fn(),
        gameOver: jest.fn(),
        gameTime: 0
    });

    // stats.cooldown is an attack-rate multiplier (weapons divide base
    // cooldown by it), so effective rate = effectiveCooldown / baseCooldown.
    const attackRateMultiplier = (player) =>
        player.getEffectiveStats().cooldown / player.stats.cooldown;

    beforeAll(async () => {
        ({ Player } = await import('../src/entities/Player.js'));
    });

    test('the "+30% fire rate" pickup grants +30% attack speed, not cooldown x0.7 (~+43%)', () => {
        const player = new Player(createGame(), 0, 0);
        // Same call the floor pickup makes in VampireSurvivorsGame.
        player.activatePowerUp('fireRate', 15.0, 1.0);
        expect(attackRateMultiplier(player)).toBeCloseTo(1.3, 2);
    });

    test('the 50-kill streak fire-rate reward is never weaker than the pickup', () => {
        const player = new Player(createGame(), 0, 0);
        player.gainExperience = jest.fn(); // isolate the buff from the XP grant

        player.activatePowerUp('fireRate', 15.0, 1.0);
        const pickupRate = attackRateMultiplier(player);
        player.deactivatePowerUp('fireRate');

        player.celebrateKillStreakMilestone(50);
        expect(player.powerUps.fireRate.active).toBe(true);
        const streakRate = attackRateMultiplier(player);

        expect(streakRate).toBeGreaterThanOrEqual(pickupRate);
    });
});

describe('R11 HUD magnet pill ignores floor Vacuum/area timers', () => {
    let CanvasHUD;
    beforeAll(async () => {
        ({ CanvasHUD } = await import('../src/systems/CanvasHUD.js'));
    });

    // Recording 2D context: captures every string the HUD draws.
    const makeCtx = () => {
        const texts = [];
        return {
            texts,
            save: jest.fn(), restore: jest.fn(),
            beginPath: jest.fn(), closePath: jest.fn(),
            moveTo: jest.fn(), lineTo: jest.fn(),
            arc: jest.fn(), arcTo: jest.fn(),
            bezierCurveTo: jest.fn(), quadraticCurveTo: jest.fn(),
            roundRect: jest.fn(),
            fill: jest.fn(), stroke: jest.fn(), fillRect: jest.fn(),
            measureText: jest.fn((t) => ({ width: String(t).length * 5 })),
            fillText: jest.fn((t) => { texts.push(String(t)); }),
            strokeText: jest.fn(),
            fillStyle: '', strokeStyle: '', font: '',
            textAlign: 'start', textBaseline: 'alphabetic',
            globalAlpha: 1, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter'
        };
    };

    // Mirrors Player.js powerUps init shape.
    const freshPowerUps = () => ({
        invincible:  { active: false, timer: 0 },
        speedBoost:  { active: false, timer: 0, multiplier: 2.0 },
        damageBoost: { active: false, timer: 0, multiplier: 3.0 },
        magnetBoost: { active: false, timer: 0, multiplier: 3.0 },
        fireRate:    { active: false, timer: 0, multiplier: 0.3 }
    });

    const renderPills = (experience, powerUps) => {
        const hud = new CanvasHUD({ systems: { experience } });
        const ctx = makeCtx();
        hud._renderPowerUpPills(ctx, { powerUps }, 800, 100);
        return ctx.texts;
    };

    test('floor Vacuum (globalMagnetTimer only, no player power-up) renders its remaining time', () => {
        // FloorItemSystem vacuum: activateGlobalMagnet(3.0) — never touches player.powerUps
        const texts = renderPills(
            { globalMagnetTimer: 3.0, areaMagnetTimer: 0 },
            freshPowerUps()
        );
        expect(texts).toContain('3.0s');
    });

    test('area magnet timer alone renders its remaining time', () => {
        const texts = renderPills(
            { globalMagnetTimer: 0, areaMagnetTimer: 9.0 },
            freshPowerUps()
        );
        expect(texts).toContain('9.0s');
    });

    test('rendered timer is the max of player boost, area and global timers', () => {
        const powerUps = freshPowerUps();
        powerUps.magnetBoost = { active: true, timer: 4.0, multiplier: 3.0 };
        const texts = renderPills(
            { globalMagnetTimer: 0, areaMagnetTimer: 9.0 },
            powerUps
        );
        expect(texts).toContain('9.0s');
        expect(texts).not.toContain('4.0s');
    });
});
