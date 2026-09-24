import { jest } from '@jest/globals';
import { Player } from '../src/entities/Player.js';
import { BaseWeapon } from '../src/entities/weapons/BaseWeapon.js';
import { GarlicAura } from '../src/entities/weapons/GarlicAura.js';

function gameForPlayer() {
    return {
        gameState: 'playing', timeScale: 1, levelUpActive: false, gameTime: 0,
        showLevelUpUI() {
            this.levelUpActive = true;
            this.gameState = 'levelUp';
            this.timeScale = 0;
        },
        inputManager: { on: jest.fn(), off: jest.fn() },
        camera: { flash: jest.fn() },
        systems: { particle: null, challenge: { hasModifier: () => false } },
        updateComboDisplay: jest.fn()
    };
}

describe('adversarial buff and level-up transitions', () => {
    test('a weapon loses the expired strong damage and fire-rate layers while weaker tails remain', () => {
        const game = gameForPlayer();
        const player = new Player(game, 0, 0);
        const weapon = new BaseWeapon(game, player, { id: 'transition_probe', damage: 10, cooldown: 1 });
        player.weapons.set(weapon.id, weapon);

        player.activatePowerUp('damageBoost', 2, 2); // ×6 for 2 seconds
        player.activatePowerUp('damageBoost', 8, 1); // ×3 tail
        player.activatePowerUp('fireRate', 2, 2); // ×1.6 attacks/sec for 2 seconds
        player.activatePowerUp('fireRate', 8, 1); // ×1.3 tail
        expect(weapon.currentStats.damage).toBeCloseTo(60);
        expect(weapon.getEffectiveCooldown()).toBeCloseTo(1 / 1.6);

        player.updatePowerUps(2.1);
        expect(player.getEffectiveStats().damage).toBeCloseTo(3);
        expect(player.getEffectiveStats().cooldown).toBeCloseTo(1.3);
        // Actual shot damage and cooldown, not only the player's HUD/snapshot.
        expect(weapon.currentStats.damage).toBeCloseTo(30);
        expect(weapon.getEffectiveCooldown()).toBeCloseTo(1 / 1.3);
        player.destroy();
    });

    test('attack-speed pickup accelerates the actual garlic aura tick cadence', () => {
        const game = gameForPlayer();
        const player = new Player(game, 0, 0);
        const garlic = new GarlicAura(game, player);
        player.weapons.set(garlic.id, garlic);
        const baseTick = garlic.getEffectiveCooldown();

        player.activatePowerUp('fireRate', 15, 1);
        expect(player.getEffectiveStats().cooldown).toBeCloseTo(1.3);
        expect(garlic.getEffectiveCooldown()).toBeCloseTo(baseTick / 1.3);
        player.destroy();
    });

    test('a level-up opened by near-death recovery during player.update stops later weapon ticks in that frame', () => {
        const game = gameForPlayer();
        const player = new Player(game, 0, 0);
        player.createLevelUpEffects = jest.fn();
        player.nearDeath.bonusActive = true;
        player.health = 50; // recovery from the <=20% threshold
        player.experience = player.experienceToNext - 10;
        const weapon = { update: jest.fn() };
        player.weapons.set('probe', weapon);
        player.updateManualAiming = jest.fn();

        player.update(0.016);
        expect(game.gameState).toBe('levelUp');
        expect(game.timeScale).toBe(0);
        expect(weapon.update).not.toHaveBeenCalled();
        player.destroy();
    });
    test('a weapon kill that opens level-up stops later weapons in the same frame', () => {
        const game = gameForPlayer();
        const player = new Player(game, 0, 0);
        player.createLevelUpEffects = jest.fn();
        player.experience = player.experienceToNext - 5;
        const first = {
            update: jest.fn(() => player.gainExperience(10))
        };
        const next = { update: jest.fn() };
        player.weapons.set('first', first);
        player.weapons.set('next', next);
        player.updateManualAiming = jest.fn();

        player.update(0.016);
        expect(first.update).toHaveBeenCalledTimes(1);
        expect(game.gameState).toBe('levelUp');
        expect(next.update).not.toHaveBeenCalled();
        player.destroy();
    });
});
