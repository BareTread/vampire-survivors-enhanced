import { jest } from '@jest/globals';

// Economy workstream tests: XP gem conservation, claim semantics, pooling,
// consolidation, Magnetic Field radius, and gold claim/attraction hooks.

const mulberry32 = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let ExperienceSystem;
let ExperienceGem;
let GoldSystem;
let globalTimerManager;

beforeAll(async () => {
    ({ ExperienceSystem } = await import('../src/systems/ExperienceSystem.js'));
    ({ ExperienceGem } = await import('../src/entities/ExperienceGem.js'));
    ({ GoldSystem } = await import('../src/systems/GoldSystem.js'));
    ({ globalTimerManager } = await import('../src/core/TimerManager.js'));
});

const makeGame = (playerX = 0, playerY = 0) => {
    const game = {
        player: {
            x: playerX,
            y: playerY,
            stats: { luck: 1 },
            isAlive: () => true,
            gainExperience: jest.fn()
        },
        camera: { x: playerX, y: playerY, width: 1280, height: 720 },
        audioManager: null,
        systems: { particle: null }
    };
    return game;
};

const makeSystem = (playerX = 0, playerY = 0) => {
    const game = makeGame(playerX, playerY);
    const system = new ExperienceSystem(game);
    game.systems.experience = system;
    return { game, system };
};

const awardedXp = (game) =>
    game.player.gainExperience.mock.calls.reduce((sum, c) => sum + c[0], 0);

const floorValue = (system) =>
    system.activeGems.reduce((sum, g) => sum + (g.active && !g.collected ? g.value : 0), 0);

const unclaimedCount = (system) =>
    system.activeGems.filter((g) => g.active && !g.collected && !g.claimed).length;

describe('conservation property: 500 seeded spawn/cap/collect sequences', () => {
    test('floor value + awarded XP equals dropped XP after every operation', () => {
        const rng = mulberry32(0xC0FFEE);
        const realRandom = Math.random;
        Math.random = rng; // deterministic lucky rolls / explosion scatter
        try {
            for (let seq = 0; seq < 500; seq++) {
                const { game, system } = makeSystem(rng() * 4000 - 2000, rng() * 4000 - 2000);
                let dropped = 0;
                const ops = 5 + Math.floor(rng() * 30);

                for (let op = 0; op < ops; op++) {
                    const roll = rng();
                    if (roll < 0.45) {
                        // spawn 1-6 gems at random positions/values
                        const n = 1 + Math.floor(rng() * 6);
                        for (let k = 0; k < n; k++) {
                            const v = 1 + Math.floor(rng() * 60);
                            system.createGem(rng() * 8000 - 4000, rng() * 8000 - 4000, v);
                            dropped += v;
                        }
                    } else if (roll < 0.6) {
                        // multi-gem reward with remainder
                        const total = 1 + Math.floor(rng() * 200);
                        const count = 1 + Math.floor(rng() * 8);
                        system.createMultipleGems(rng() * 400 - 200, rng() * 400 - 200, count, total);
                        dropped += total;
                    } else if (roll < 0.7) {
                        const total = 1 + Math.floor(rng() * 300);
                        system.createGemExplosion(0, 0, total, 2, 6);
                        dropped += total;
                    } else if (roll < 0.8) {
                        system.update(1 / 60);
                    } else if (roll < 0.87) {
                        system.claimAllGems();
                    } else if (roll < 0.93) {
                        system.consolidateGems(Math.floor(rng() * system.maxActiveGems));
                    } else if (roll < 0.97) {
                        system.cleanup();
                    } else {
                        system.collectAllGems();
                    }

                    // Invariants after EVERY step
                    expect(floorValue(system) + awardedXp(game)).toBe(dropped);
                    expect(system.activeGems.length).toBeLessThanOrEqual(system.maxActiveGems);
                    expect(system.droppedXP).toBe(dropped);
                    expect(system.collectedXP).toBe(awardedXp(game));
                }
            }
        } finally {
            Math.random = realRandom;
        }
    });

    test('consolidateGems postcondition: count <= cap or only claimed remain', () => {
        const rng = mulberry32(1234);
        for (let seq = 0; seq < 100; seq++) {
            const { system } = makeSystem();
            const n = 20 + Math.floor(rng() * 80);
            for (let i = 0; i < n; i++) {
                system.createGem(rng() * 2000 - 1000, rng() * 2000 - 1000, 5);
            }
            if (rng() < 0.5) system.claimAllGems();
            const cap = Math.floor(rng() * system.maxActiveGems);
            system.consolidateGems(cap);
            const total = system.activeGems.length;
            // count <= cap, OR only claimed gems remain (claims may occupy the
            // cap), OR a single lone gem with nothing to merge into
            expect(total <= cap || unclaimedCount(system) === 0 || total === 1).toBe(true);
            expect(system.getTotalGemValue()).toBe(system.droppedXP);
        }
    });
});

describe('cap merge', () => {
    test('overflow merges into the NEAREST gem and recomputes tier', () => {
        const { system } = makeSystem();
        for (let i = 0; i < system.maxActiveGems; i++) {
            system.createGem(i * 100, 0, 5); // spread out; gem at x=0 is nearest to origin
        }
        const nearest = system.activeGems[0]; // at (0,0)
        expect(nearest.value).toBe(5);

        const merged = system.createGem(10, 0, 30); // at cap: merges into gem at (0,0)
        expect(merged).toBe(nearest);
        expect(nearest.value).toBe(35);
        expect(nearest.type).toBe('uncommon'); // tier recomputed (>= 20)
        expect(system.activeGems.length).toBe(system.maxActiveGems);
    });

    test('claimed gems may receive merged value but are never merge victims', () => {
        const { system } = makeSystem();
        for (let i = 0; i < system.maxActiveGems; i++) {
            system.createGem(i * 100, 0, 5);
        }
        const claimed = system.activeGems[0];
        claimed.claim();

        // Cap merge targets nearest regardless of claim state
        system.createGem(5, 0, 10);
        expect(claimed.value).toBe(15);
        expect(claimed.claimed).toBe(true);

        // consolidateGems must not evict the claimed gem even below its index
        system.consolidateGems(1);
        expect(system.activeGems).toContain(claimed);
        expect(unclaimedCount(system)).toBe(0);
    });
});

describe('claim semantics', () => {
    test('claimAllGems is idempotent and reports only the newly claimed haul', () => {
        const { system } = makeSystem();
        system.createGem(100, 0, 10);
        system.createGem(200, 0, 20);
        system.createGem(300, 0, 30);

        const first = system.claimAllGems();
        expect(first).toEqual({ count: 3, xp: 60 });

        const second = system.claimAllGems();
        expect(second).toEqual({ count: 0, xp: 0 });
    });

    test('claimed gem ignores expiry, homes, and pays out', () => {
        const { game, system } = makeSystem();
        const gem = system.createGem(400, 0, 25);
        gem.currentSpawnTime = 0;
        gem.lifetime = 0.005;

        gem.claim();
        system.update(1 / 60);
        expect(gem.active).toBe(true);
        expect(gem.claimed).toBe(true);

        for (let i = 0; i < 300 && awardedXp(game) === 0; i++) {
            system.update(1 / 60);
        }
        expect(game.player.gainExperience).toHaveBeenCalledWith(25);
        expect(system.collectedXP).toBe(25);
    });

    test('claimed gem survives cleanup consolidation while far and expired', () => {
        const { system } = makeSystem();
        const far = system.createGem(5000, 5000, 25);
        far.currentSpawnTime = 0;
        far.lifetime = 0;
        system.createGem(5100, 5000, 10); // neighbour exists

        far.claim();
        system.updateSpatialGrid();
        system.cleanup();

        expect(system.activeGems).toContain(far);
        expect(far.active).toBe(true);
    });

    test('unclaimed far expired gem consolidates into nearest neighbour', () => {
        const { system } = makeSystem();
        const old = system.createGem(5000, 5000, 25);
        old.currentSpawnTime = 0;
        old.lifetime = 0;
        const young = system.createGem(5100, 5000, 10);
        young.currentSpawnTime = 0;

        system.updateSpatialGrid();
        system.cleanup();

        expect(system.activeGems).not.toContain(old);
        expect(young.value).toBe(35); // value conserved in the neighbour
        expect(system.getTotalGemValue()).toBe(35);
    });

    test('consolidation reaches neighbours beyond any fixed radius', () => {
        const { system } = makeSystem();
        // Victim far past the old 4096-cell cutoff; its only neighbour is
        // even farther out. Grid search is bounded by occupied cells, not a
        // hard distance limit.
        const old = system.createGem(20000, 20000, 25);
        old.currentSpawnTime = 0;
        old.lifetime = 0;
        const neighbour = system.createGem(30000, 20000, 10);
        neighbour.currentSpawnTime = 0;

        system.updateSpatialGrid();
        system.cleanup();

        expect(system.activeGems).not.toContain(old);
        expect(neighbour.value).toBe(35);
        expect(system.getTotalGemValue()).toBe(35);
    });

    test('consolidateGems merges farthest victims first via the grid', () => {
        const { system } = makeSystem();
        // 10 gems: 5 near the player, 5 far. Cap to 5 → the 5 far merge away.
        const near = [];
        for (let i = 0; i < 5; i++) near.push(system.createGem(50 + i * 10, 0, 5));
        for (let i = 0; i < 5; i++) system.createGem(5000 + i * 100, 5000, 7);

        const merged = system.consolidateGems(5);
        expect(merged).toBe(5);
        expect(system.activeGems.length).toBe(5);
        for (const g of near) expect(system.activeGems).toContain(g);
        // All value conserved: 5*5 + 5*7 = 60
        expect(system.getTotalGemValue()).toBe(60);
    });

    test('claimed gems may occupy the cap until collected', () => {
        const { game, system } = makeSystem();
        for (let i = 0; i < system.maxActiveGems; i++) {
            system.createGem(1000 + i, 0, 5);
        }
        system.claimAllGems();

        // Cap enforcement cannot evict claims: nothing mergeable, nothing lost
        const merged = system.consolidateGems(10);
        expect(merged).toBe(0);
        expect(system.activeGems.length).toBe(system.maxActiveGems);
        expect(system.getTotalGemValue()).toBe(system.maxActiveGems * 5);

        // Claims still home and pay out
        for (let i = 0; i < 600 && awardedXp(game) < system.maxActiveGems * 5; i++) {
            system.update(1 / 60);
        }
        expect(awardedXp(game)).toBe(system.maxActiveGems * 5);
    });
});

describe('pool safety', () => {
    test('collected gem stays in activeGems until the next update pass', () => {
        const { game, system } = makeSystem();
        const gem = system.createGem(0, 0, 5);
        gem.currentSpawnTime = 0;

        gem.collect();
        expect(gem.active).toBe(false);
        expect(gem.collected).toBe(true);
        expect(system.gemPool).not.toContain(gem); // not pooled mid-iteration

        system.update(1 / 60);
        expect(system.gemPool).toContain(gem);
        expect(system.activeGems).not.toContain(gem);
    });

    test('double return to pool does not duplicate the gem', () => {
        const { system } = makeSystem();
        const gem = system.createGem(0, 0, 5);
        gem.active = false;
        system.returnGemToPool(gem);
        system.returnGemToPool(gem);
        expect(system.gemPool.filter((g) => g === gem)).toHaveLength(1);
    });
    test('non-finite coordinates recover in place; far-world gems are kept', () => {
        const { system } = makeSystem();
        const gem = system.createGem(100, 100, 25);
        gem.currentSpawnTime = 0;

        // Legitimate far-world position must NOT be treated as corruption
        gem.x = 2e6;
        gem.y = -2e6;
        gem.update(1 / 60);
        expect(gem.active).toBe(true);
        expect(isFinite(gem.x)).toBe(true);
        expect(Math.abs(gem.x)).toBeGreaterThan(1e6); // not culled or reset

        // Non-finite coordinates recover to spawn point, value conserved
        gem.x = NaN;
        gem.update(1 / 60);
        expect(gem.active).toBe(true);
        expect(gem.x).toBe(100);
        expect(system.getTotalGemValue()).toBe(25);
    });

    test('pool reuse clears claim state and cancels gem-owned callbacks', async () => {
        const { system } = makeSystem();
        const gem = system.createGem(0, 0, 5);
        gem.claim();

        const stale = jest.fn();
        globalTimerManager.setTimeout(stale, 5, gem);

        gem.active = false;
        system.returnGemToPool(gem);
        const reused = system.getGemFromPool();
        expect(reused).toBe(gem);
        reused.reset(50, 50, 7);

        expect(reused.claimed).toBe(false);
        expect(reused.claimAge).toBe(0);
        expect(reused.value).toBe(7);

        await new Promise((r) => setTimeout(r, 20));
        expect(stale).not.toHaveBeenCalled();
    });

});

describe('exact reward totals', () => {
    test('createMultipleGems preserves total including remainder', () => {
        const { system } = makeSystem();
        system.createMultipleGems(0, 0, 5, 37); // 37 = 7*5 + 2
        expect(system.getTotalGemValue()).toBe(37);
    });

    test('createGemExplosion conserves the advertised total', () => {
        const rng = mulberry32(42);
        const realRandom = Math.random;
        Math.random = rng;
        try {
            for (let i = 0; i < 50; i++) {
                const { system } = makeSystem();
                const total = 1 + Math.floor(rng() * 500);
                system.createGemExplosion(0, 0, total, 3, 8);
                expect(system.getTotalGemValue()).toBe(total);
            }
        } finally {
            Math.random = realRandom;
        }
    });
});

describe('Magnetic Field', () => {
    test('radius is max(3 x effective pickup range, 360) and ignores viewport', () => {
        const { game, system } = makeSystem();
        game.systems.passiveItems = { getStatModifiers: () => ({ pickupRange: 1.25 }) };
        // effective = 80 * 1 * 2.25 = 180 → field = 540
        const { radius } = system.activateMagneticField(12);
        expect(radius).toBe(540);
        expect(system.areaMagnetRadius).toBe(540);
        expect(system.areaMagnetTimer).toBe(12);
    });

    test('radius recomputes while active when pickup range changes', () => {
        const { game, system } = makeSystem();
        let bonus = 0;
        game.systems.passiveItems = { getStatModifiers: () => ({ pickupRange: bonus }) };

        system.activateMagneticField(12);
        expect(system.areaMagnetRadius).toBe(360); // max(3*80, 360)

        bonus = 1.25; // Attractorb picked up mid-field
        system.update(1 / 60);
        expect(system.areaMagnetRadius).toBe(540);
    });

    test('field expiry clears radius and auto flag', () => {
        const { system } = makeSystem();
        system.activateMagneticField(0.01);
        system.update(0.05);
        expect(system.areaMagnetTimer).toBe(0);
        expect(system.areaMagnetRadius).toBe(0);
        expect(system.magneticFieldAuto).toBe(false);
    });
});

describe('reset', () => {
    test('clearAll resets timers, field state, and the XP ledger', () => {
        const { system } = makeSystem();
        system.createGem(0, 0, 25);
        system.activateGlobalMagnet(5);
        system.activateMagneticField(10);
        system.claimAllGems();

        system.clearAll();

        expect(system.activeGems).toHaveLength(0);
        expect(system.globalMagnetTimer).toBe(0);
        expect(system.areaMagnetTimer).toBe(0);
        expect(system.areaMagnetRadius).toBe(0);
        expect(system.magneticFieldAuto).toBe(false);
        expect(system.droppedXP).toBe(0);
        expect(system.collectedXP).toBe(0);
    });
});

describe('gold claim and attraction hooks', () => {
    const makeGoldGame = () => {
        const game = makeGame();
        game.systems.passiveItems = { getStatModifiers: () => ({}) };
        game.systems.challenge = null;
        game.systems.experience = new ExperienceSystem(game);
        game.systems.gold = new GoldSystem(game);
        return game;
    };

    const stillCoin = (gold, x, y, value) => {
        gold.spawnCoin(x, y, value);
        const coin = gold.coins[gold.coins.length - 1];
        coin.x = x;
        coin.y = y;
        coin.vx = 0;
        coin.vy = 0;
        return coin;
    };

    test('claimAllCoins is idempotent and reports post-multiplier gold', () => {
        const game = makeGoldGame();
        const gold = game.systems.gold;
        game.systems.challenge = { getGoldMultiplier: () => 2 };

        stillCoin(gold, 500, 0, 10);
        stillCoin(gold, 600, 0, 7);

        const first = gold.claimAllCoins();
        expect(first).toEqual({ count: 2, gold: 34 }); // floor(10*2)+floor(7*2)
        expect(gold.claimAllCoins()).toEqual({ count: 0, gold: 0 });
    });

    test('claimed coin cannot expire and homes until collected', () => {
        const game = makeGoldGame();
        const gold = game.systems.gold;
        const coin = stillCoin(gold, 800, 0, 25);
        coin.lifetime = 0.01;

        gold.claimAllCoins();
        for (let i = 0; i < 600 && gold.coins.length > 0; i++) {
            gold.update(0.05); // 30s simulated — far past the 15s lifetime
        }
        expect(gold.runGold).toBe(25);
        expect(gold.coins).toHaveLength(0);
        expect(gold.collectedGold).toBe(25);
    });

    test('unclaimed coin still expires', () => {
        const game = makeGoldGame();
        const gold = game.systems.gold;
        const coin = stillCoin(gold, 800, 0, 25);
        coin.lifetime = 0.01;

        gold.update(0.05);
        expect(gold.coins).toHaveLength(0);
        expect(gold.runGold).toBe(0);
    });

    test('global magnet timer attracts all coins; area field attracts within radius', () => {
        const game = makeGoldGame();
        const gold = game.systems.gold;
        const exp = game.systems.experience;

        // Area field: coin inside radius is pulled, coin outside is not
        const inside = stillCoin(gold, 400, 0, 5);
        const outside = stillCoin(gold, 2000, 0, 5);
        exp.areaMagnetRadius = 540;
        exp.areaMagnetTimer = 5;
        gold.update(0.05);
        expect(inside.magnetized).toBe(true);
        expect(inside.x).toBeLessThan(400);
        expect(outside.magnetized).toBe(false);

        // Global magnet: every coin is pulled
        exp.areaMagnetTimer = 0;
        exp.activateGlobalMagnet(3);
        gold.update(0.05);
        expect(outside.magnetized).toBe(true);
        expect(outside.x).toBeLessThan(2000);
    });
});
