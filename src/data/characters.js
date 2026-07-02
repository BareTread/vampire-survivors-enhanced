import { t } from '../i18n/index.js';

/**
 * Character definitions for the character selection system.
 * Each character has unique starting weapon, stat modifiers, and unlock conditions.
 */
export const CHARACTERS = [
    {
        id: 'antonio',
        name: t('characters.antonio'),
        title: t('characters.antonioTitle'),
        color: '#4A90E2',
        startingWeapon: 'whip',
        description: t('characters.antonioDesc'),
        statModifiers: { damage: 1.10 },
        unlocked: true,
        unlockCondition: null,
        unlockDesc: null
    },
    {
        id: 'imelda',
        name: t('characters.imelda'),
        title: t('characters.imeldaTitle'),
        color: '#B060E0',
        startingWeapon: 'magic_missile',
        description: t('characters.imeldaDesc'),
        statModifiers: { luck: 1.15, health: 0.90 },
        unlocked: false,
        unlockCondition: 'maxLevel >= 15',
        unlockDesc: t('characters.unlockImelda')
    },
    {
        id: 'gennaro',
        name: t('characters.gennaro'),
        title: t('characters.gennaroTitle'),
        color: '#E06040',
        startingWeapon: 'throwing_knife',
        description: t('characters.gennaroDesc'),
        statModifiers: { speed: 1.12, projectiles: 1 },
        unlocked: false,
        unlockCondition: 'highestKillCount >= 500',
        unlockDesc: t('characters.unlockGennaro')
    },
    {
        id: 'mortimer',
        name: t('characters.mortimer'),
        title: t('characters.mortimerTitle'),
        color: '#FF6B35',
        startingWeapon: 'fire_wand',
        description: t('characters.mortimerDesc'),
        statModifiers: { area: 1.20, speed: 0.95 },
        unlocked: false,
        unlockCondition: 'longestSurvival >= 600',
        unlockDesc: t('characters.unlockMortimer')
    },
    {
        id: 'sera',
        name: t('characters.sera'),
        title: t('characters.seraTitle'),
        color: '#50C878',
        startingWeapon: 'garlic_aura',
        description: t('characters.seraDesc'),
        statModifiers: { health: 1.15, damage: 0.95 },
        unlocked: false,
        unlockCondition: 'totalKills >= 1000',
        unlockDesc: t('characters.unlockSera')
    },
    {
        id: 'dante',
        name: t('characters.dante'),
        title: t('characters.danteTitle'),
        color: '#7DF9FF',
        startingWeapon: 'lightning_chain',
        description: t('characters.danteDesc'),
        statModifiers: { cooldown: 0.85, damage: 0.92 },
        unlocked: false,
        unlockCondition: 'highestCombo >= 50',
        unlockDesc: t('characters.unlockDante')
    },
    {
        id: 'luna',
        name: t('characters.luna'),
        title: t('characters.lunaTitle'),
        color: '#C084FC',
        startingWeapon: 'holy_bible',
        description: t('characters.lunaDesc'),
        statModifiers: { projectiles: 1, luck: 1.10 },
        unlocked: false,
        unlockCondition: 'totalRuns >= 10',
        unlockDesc: t('characters.unlockLuna')
    },
    {
        id: 'viktor',
        name: t('characters.viktor'),
        title: t('characters.viktorTitle'),
        color: '#00BFFF',
        startingWeapon: 'ice_shard',
        description: t('characters.viktorDesc'),
        statModifiers: { area: 1.15, speed: 0.90 },
        unlocked: false,
        unlockCondition: 'longestSurvival >= 900',
        unlockDesc: t('characters.unlockViktor')
    },
    {
        id: 'nyx',
        name: t('characters.nyx'),
        title: t('characters.nyxTitle'),
        color: '#7C3AED',
        startingWeapon: 'shadow_dagger',
        description: t('characters.nyxDesc'),
        statModifiers: { damage: 1.15, health: 0.85 },
        unlocked: false,
        unlockCondition: 'highestKillCount >= 1000',
        unlockDesc: t('characters.unlockNyx')
    }
];
