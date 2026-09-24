/**
 * Player-facing names for enemy archetypes. Internal type ids stay terse
 * ('basic', 'fast', …); anything shown on screen (death screen, codex)
 * goes through enemyDisplayName so the bestiary reads like one world.
 */
export const ENEMY_NAMES = {
    basic: 'Ghoul',
    fast: 'Blood Bat',
    tank: 'Shield Knight',
    ranged: 'Cultist',
    elite: 'Dreadlord',
    berserker: 'Werebeast',
    summoner: 'Necromancer',
    juggernaut: 'Stone Golem',
    wraith: 'Wraith',
    demon: 'Demon',
    boss_vampire_lord: 'Vampire Lord',
    boss_lich: 'Lich King',
    boss_lich_king: 'Lich King',
    boss_werewolf: 'Alpha Werewolf',
    boss_alpha_werewolf: 'Alpha Werewolf'
};

export function enemyDisplayName(type, variant = null) {
    const base = ENEMY_NAMES[type] ||
        String(type || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return variant ? `${variant} ${base}` : base;
}

/** One-line omen shown in the wave banner when a creature first appears. */
export const ENEMY_ARRIVALS = {
    ranged: 'Cultists join the hunt',
    tank: 'Shield knights march',
    wraith: 'Wraiths drift through the walls',
    elite: 'A dreadlord rises',
    demon: 'Demons break through',
    berserker: 'Werebeasts howl',
    summoner: 'Necromancers gather',
    juggernaut: 'The stone golems wake'
};
