/**
 * Character definitions for the character selection system.
 * Each character has unique starting weapon, stat modifiers, and unlock conditions.
 */
export const CHARACTERS = [
    {
        id: 'antonio',
        name: 'Antonio',
        title: 'The Vampire Hunter',
        color: '#4A90E2',
        startingWeapon: 'whip',
        description: 'Balanced fighter with bonus damage.',
        statModifiers: { damage: 1.10 },
        unlocked: true,
        unlockCondition: null,
        unlockDesc: null
    },
    {
        id: 'imelda',
        name: 'Imelda',
        title: 'The Scholar',
        color: '#B060E0',
        startingWeapon: 'magic_missile',
        description: 'Gains experience faster. Fragile but powerful.',
        statModifiers: { luck: 1.15, health: 0.90 },
        unlocked: false,
        unlockCondition: 'maxLevel >= 15',
        unlockDesc: 'Reach level 15 in a single run'
    },
    {
        id: 'gennaro',
        name: 'Gennaro',
        title: 'The Rogue',
        color: '#E06040',
        startingWeapon: 'throwing_knife',
        description: 'Fast and deadly. Extra projectile from the start.',
        statModifiers: { speed: 1.12, projectiles: 1 },
        unlocked: false,
        unlockCondition: 'highestKillCount >= 500',
        unlockDesc: 'Slay 500 enemies in a single run'
    }
];
