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
    },
    {
        id: 'mortimer',
        name: 'Mortimer',
        title: 'The Pyromancer',
        color: '#FF6B35',
        startingWeapon: 'fire_wand',
        description: 'Master of fire. Larger explosions but sluggish.',
        statModifiers: { area: 1.20, speed: 0.95 },
        unlocked: false,
        unlockCondition: 'longestSurvival >= 600',
        unlockDesc: 'Survive for 10 minutes'
    },
    {
        id: 'sera',
        name: 'Sera',
        title: 'The Guardian',
        color: '#50C878',
        startingWeapon: 'garlic_aura',
        description: 'Resilient defender with natural toughness.',
        statModifiers: { health: 1.15, damage: 0.95 },
        unlocked: false,
        unlockCondition: 'totalKills >= 1000',
        unlockDesc: 'Kill 1,000 enemies across all runs'
    },
    {
        id: 'dante',
        name: 'Dante',
        title: 'The Storm Caller',
        color: '#7DF9FF',
        startingWeapon: 'lightning_chain',
        description: 'Rapid-fire chains. Lower damage, faster cooldowns.',
        statModifiers: { cooldown: 0.85, damage: 0.92 },
        unlocked: false,
        unlockCondition: 'highestCombo >= 50',
        unlockDesc: 'Achieve a 50-hit combo'
    },
    {
        id: 'luna',
        name: 'Luna',
        title: 'The Priestess',
        color: '#C084FC',
        startingWeapon: 'holy_bible',
        description: 'Blessed by the moon. Extra projectile and luck.',
        statModifiers: { projectiles: 1, luck: 1.10 },
        unlocked: false,
        unlockCondition: 'totalRuns >= 10',
        unlockDesc: 'Complete 10 runs'
    }
];
