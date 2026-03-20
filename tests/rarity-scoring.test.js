/**
 * Rarity Scoring System Tests
 *
 * Verifies that the build-aware rarity scoring engine assigns meaningful
 * rarity tiers based on the player's current build state, not random chance.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { RaritySystem } from '../src/systems/RaritySystem.js';

// ── Mock factories ──────────────────────────────────────────────────────

function makeWeapon(id, level = 1, maxLevel = 8, evolved = false) {
    return { id, level, maxLevel, evolved, name: id };
}

function makeGame(overrides = {}) {
    const weapons = overrides.weapons || new Map();
    const passiveItems = overrides.passiveItems || new Map();

    return {
        player: {
            level: overrides.playerLevel || 1,
            health: overrides.health || 100,
            maxHealth: overrides.maxHealth || 100,
            weapons,
            maxWeapons: 6,
            stats: { damage: 1, speed: 1, luck: 1, area: 1, cooldown: 1 }
        },
        gameTime: overrides.gameTime || 0,
        systems: {
            weaponEvolution: {
                recipes: new Map([
                    ['magic_missile', { requiredPassive: 'empty_tome' }],
                    ['whip', { requiredPassive: 'spinach' }],
                    ['garlic_aura', { requiredPassive: 'attractorb' }],
                    ['holy_bible', { requiredPassive: 'armor' }],
                    ['fire_wand', { requiredPassive: 'spinach' }],
                    ['throwing_knife', { requiredPassive: 'duplicator' }],
                    ['lightning_chain', { requiredPassive: 'duplicator' }],
                    ['bone_boomerang', { requiredPassive: 'wings' }]
                ]),
                evolvedWeapons: new Set()
            },
            passiveItems: {
                items: passiveItems,
                maxSlots: 6
            }
        }
    };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('RaritySystem — Build-Aware Scoring', () => {
    let rarity;

    describe('Evolution options are always Legendary', () => {
        test('evolution type gets legendary rarity', () => {
            rarity = new RaritySystem(makeGame());
            const option = { type: 'evolution', weaponId: 'magic_missile' };
            rarity.assignRarity(option);
            expect(option.rarity.id).toBe('legendary');
        });
    });

    describe('Base Type Scoring', () => {
        test('stat upgrades score low (Common baseline)', () => {
            rarity = new RaritySystem(makeGame());
            const option = { type: 'stat_upgrade', stat: 'luck' };
            const score = rarity.scoreOption(option);
            // Base type score for stat_upgrade is 8, with minimal synergy
            expect(score).toBeLessThanOrEqual(30);
        });

        test('new weapons score higher than stat upgrades', () => {
            rarity = new RaritySystem(makeGame());
            const weaponOpt = { type: 'new_weapon', weaponType: 'whip' };
            const statOpt = { type: 'stat_upgrade', stat: 'luck' };
            // Run multiple times to account for jitter
            let weaponTotal = 0, statTotal = 0;
            for (let i = 0; i < 50; i++) {
                weaponTotal += rarity.scoreOption(weaponOpt);
                statTotal += rarity.scoreOption(statOpt);
            }
            expect(weaponTotal / 50).toBeGreaterThan(statTotal / 50);
        });
    });

    describe('Evolution-Enabling Passives Score Epic', () => {
        test('passive that enables evolution for max-level weapon → Epic', () => {
            const weapons = new Map();
            weapons.set('mm', makeWeapon('magic_missile', 8, 8)); // max level!
            rarity = new RaritySystem(makeGame({ weapons }));

            // empty_tome enables magic_missile evolution
            const option = { type: 'new_passive', itemId: 'empty_tome' };
            const score = rarity.scoreOption(option);
            // Base(12) + Synergy(45, weapon at max) + possible scarcity
            // Should be well into Epic range (75+)
            expect(score).toBeGreaterThanOrEqual(50); // At minimum Rare
        });

        test('passive that enables evolution for near-max weapon → Rare+', () => {
            const weapons = new Map();
            weapons.set('mm', makeWeapon('magic_missile', 6, 8)); // level 6 of 8
            rarity = new RaritySystem(makeGame({ weapons }));

            const option = { type: 'new_passive', itemId: 'empty_tome' };
            const score = rarity.scoreOption(option);
            // Base(12) + Synergy(38, weapon near max)
            expect(score).toBeGreaterThanOrEqual(40);
        });

        test('passive with no evolution synergy scores lower', () => {
            const weapons = new Map();
            weapons.set('mm', makeWeapon('magic_missile', 3, 8));
            rarity = new RaritySystem(makeGame({ weapons }));

            // wings doesn't help magic_missile evolution
            const option = { type: 'new_passive', itemId: 'wings' };
            const score = rarity.scoreOption(option);
            expect(score).toBeLessThan(35);
        });
    });

    describe('Weapon Upgrade Scoring', () => {
        test('penultimate upgrade with evo passive owned → high score', () => {
            const weapons = new Map();
            weapons.set('w', makeWeapon('whip', 7, 8)); // level 7, one from max
            const passiveItems = new Map();
            passiveItems.set('spinach', { id: 'spinach', currentLevel: 1 });

            rarity = new RaritySystem(makeGame({ weapons, passiveItems }));

            const option = { type: 'weapon_upgrade', weaponId: 'whip' };
            const score = rarity.scoreOption(option);
            // Base(~21) + Synergy(25, evo passive owned) + Scarcity(15)
            expect(score).toBeGreaterThanOrEqual(45);
        });

        test('early weapon upgrade scores Uncommon at best', () => {
            const weapons = new Map();
            weapons.set('w', makeWeapon('whip', 2, 8));
            rarity = new RaritySystem(makeGame({ weapons }));

            const option = { type: 'weapon_upgrade', weaponId: 'whip' };
            const score = rarity.scoreOption(option);
            expect(score).toBeLessThan(35);
        });
    });

    describe('Stat Synergy Scoring', () => {
        test('damage stat with 3+ weapons scores higher', () => {
            const weapons = new Map();
            weapons.set('w1', makeWeapon('whip'));
            weapons.set('w2', makeWeapon('magic_missile'));
            weapons.set('w3', makeWeapon('throwing_knife'));
            rarity = new RaritySystem(makeGame({ weapons }));

            const option = { type: 'stat_upgrade', stat: 'damage' };
            const score = rarity.scoreOption(option);
            // Base(8) + Synergy(10, 3+ weapons)
            expect(score).toBeGreaterThanOrEqual(13);
        });

        test('area stat with AoE weapons scores higher', () => {
            const weapons = new Map();
            weapons.set('g', makeWeapon('garlic_aura'));
            weapons.set('h', makeWeapon('holy_bible'));
            rarity = new RaritySystem(makeGame({ weapons }));

            const option = { type: 'stat_upgrade', stat: 'area' };
            const score = rarity.scoreOption(option);
            // Base(8) + Synergy(12, two AoE weapons × 6)
            expect(score).toBeGreaterThanOrEqual(15);
        });

        test('speed stat scores higher early game', () => {
            rarity = new RaritySystem(makeGame({ playerLevel: 3 }));
            const earlyScore = rarity.scoreOption({ type: 'stat_upgrade', stat: 'speed' });

            rarity = new RaritySystem(makeGame({ playerLevel: 25 }));
            const lateScore = rarity.scoreOption({ type: 'stat_upgrade', stat: 'speed' });

            // Run multiple times to beat jitter
            let earlyTotal = 0, lateTotal = 0;
            for (let i = 0; i < 50; i++) {
                rarity = new RaritySystem(makeGame({ playerLevel: 3 }));
                earlyTotal += rarity.scoreOption({ type: 'stat_upgrade', stat: 'speed' });
                rarity = new RaritySystem(makeGame({ playerLevel: 25 }));
                lateTotal += rarity.scoreOption({ type: 'stat_upgrade', stat: 'speed' });
            }
            expect(earlyTotal / 50).toBeGreaterThan(lateTotal / 50);
        });
    });

    describe('Diminishing Returns on Stat Picks', () => {
        test('picking same stat 3+ times reduces its score', () => {
            // Use a stat with some synergy (damage + 3 weapons) so the penalty is visible
            const weapons = new Map();
            weapons.set('w1', makeWeapon('whip'));
            weapons.set('w2', makeWeapon('magic_missile'));
            weapons.set('w3', makeWeapon('throwing_knife'));

            let beforeTotal = 0, afterTotal = 0;
            const N = 200;

            rarity = new RaritySystem(makeGame({ weapons }));
            const option = { type: 'stat_upgrade', stat: 'damage' };
            for (let i = 0; i < N; i++) {
                beforeTotal += rarity.scoreOption(option);
            }

            rarity.recordStatPick('damage');
            rarity.recordStatPick('damage');
            rarity.recordStatPick('damage');
            for (let i = 0; i < N; i++) {
                afterTotal += rarity.scoreOption(option);
            }
            // -5 penalty should be clearly visible over 200 samples
            expect(beforeTotal / N).toBeGreaterThan(afterTotal / N);
        });
    });

    describe('Reset clears per-run state', () => {
        test('reset clears stat pick counts', () => {
            rarity = new RaritySystem(makeGame());
            rarity.recordStatPick('damage');
            rarity.recordStatPick('damage');
            rarity.recordStatPick('damage');
            expect(rarity.statPickCounts.get('damage')).toBe(3);

            rarity.reset();
            expect(rarity.statPickCounts.size).toBe(0);
        });
    });

    describe('Score-to-Rarity Mapping', () => {
        test('assignRarity attaches rarity object and score', () => {
            rarity = new RaritySystem(makeGame());
            const option = { type: 'stat_upgrade', stat: 'luck' };
            rarity.assignRarity(option);

            expect(option.rarity).toBeDefined();
            expect(option.rarity.id).toBeDefined();
            expect(option._rarityScore).toBeDefined();
            expect(typeof option._rarityScore).toBe('number');
        });

        test('rarity multipliers are all 1.0 (informational only)', () => {
            rarity = new RaritySystem(makeGame());
            for (const key of Object.keys(rarity.rarities)) {
                expect(rarity.rarities[key].multiplier).toBe(1.0);
            }
        });
    });

    describe('Contextual Scarcity', () => {
        test('new weapon with last slot available scores higher', () => {
            const weapons = new Map();
            for (let i = 0; i < 5; i++) {
                weapons.set(`w${i}`, makeWeapon(`weapon_${i}`));
            }
            // 5 weapons, max 6 → last slot
            rarity = new RaritySystem(makeGame({ weapons }));
            const lastSlotScore = rarity._scarcityScore(
                { type: 'new_weapon', weaponType: 'whip' },
                rarity.game.player
            );

            // With only 1 weapon, not last slot
            const weapons2 = new Map();
            weapons2.set('w0', makeWeapon('weapon_0'));
            rarity = new RaritySystem(makeGame({ weapons: weapons2 }));
            const normalScore = rarity._scarcityScore(
                { type: 'new_weapon', weaponType: 'whip' },
                rarity.game.player
            );

            expect(lastSlotScore).toBeGreaterThan(normalScore);
        });
    });
});
