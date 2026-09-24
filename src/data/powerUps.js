/**
 * Timed buffs: one table for labels, colours, durations, strengths, and
 * producer profiles. Effective strength is the max unexpired layer.
 * Damage/speed numbers match the pre-measurement tuning.
 * Attack speed is attacks per second: intensity 1 is ×1.3, not cooldown ×0.7.
 */

export const BUFF_LAYER_CAP = 3;
export const LEVEL_UP_GRACE_SECONDS = 0.4;

export const HUD_BUFF_ORDER = ['invincible', 'speedBoost', 'damageBoost', 'fireRate', 'magnetBoost'];

export const POWER_UPS = {
    health: {
        id: 'health',
        label: 'HEALTH',
        name: 'Health',
        color: '#FF4455',
        hudColor: '#FF4455',
        icon: null,
        kind: 'heal',
        hint: 'Heal 50%',
        healFraction: 0.5
    },
    invincible: {
        id: 'invincible',
        label: 'INVINCIBLE',
        name: 'Invincibility',
        color: '#FFD700',
        hudColor: '#E8C96A',
        icon: 'shield',
        kind: 'flag',
        hint: 'Invincible 5s',
        pickup: { duration: 5, intensity: 1 },
        streak: { duration: 5, intensity: 1, minStreak: 100 },
        wave: { duration: 5, intensity: 1 },
        noDamage: { duration: 3, intensity: 1 },
        revive: { duration: 3, intensity: 1 }
    },
    speedBoost: {
        id: 'speedBoost',
        label: 'SPEED',
        name: 'Speed',
        color: '#00FFFF',
        hudColor: '#4AD8E8',
        icon: 'bolt',
        kind: 'multiplier',
        baseMultiplier: 2,
        hint: 'Speed x2 (8s)',
        pickup: { duration: 8, intensity: 1 },
        streak: { duration: 8, intensity: 1.3, minStreak: 25 }
    },
    damageBoost: {
        id: 'damageBoost',
        label: 'DAMAGE',
        name: 'Damage',
        color: '#FF6600',
        hudColor: '#FF6622',
        icon: 'swords',
        kind: 'multiplier',
        baseMultiplier: 3,
        hint: 'Damage x3 (10s)',
        pickup: { duration: 10, intensity: 1 },
        streak: { duration: 10, intensity: (streak) => 1.5 + streak / 100, minStreak: 10 },
        wave: { duration: 15, intensity: 2 },
        critical: { duration: 5, intensity: 1.5 },
        combo: {
            duration: 5,
            intensity: (threshold) => 2 + Math.min(1.5, 0.5 + threshold / 200) * 0.5
        }
    },
    magnetBoost: {
        id: 'magnetBoost',
        label: 'MAGNETIC FIELD',
        name: 'Magnetic Field',
        color: '#44FF44',
        hudColor: '#44FF99',
        icon: 'magnet',
        kind: 'multiplier',
        baseMultiplier: 3,
        hint: 'Attract XP and gold',
        pickup: { duration: 12, intensity: 1 }
    },
    fireRate: {
        id: 'fireRate',
        label: 'ATTACK SPEED',
        name: 'Attack Speed',
        color: '#FF44FF',
        hudColor: '#D878FF',
        icon: 'burst',
        kind: 'attackRate',
        attackRateBonus: 0.3,
        hint: 'Attack speed +30% (15s)',
        pickup: { duration: 15, intensity: 1 },
        // Never weaker than the pickup (intensity 1 => 1.3 attacks/sec).
        streak: { duration: 15, intensity: 1.3, minStreak: 50 }
    }
};

export const KILL_MILESTONES = [
    { threshold: 100, label: '100 KILLS!', reward: 'speedBoost', duration: 5, intensity: 1, gemCount: 8, color: '#44FF44' },
    { threshold: 250, label: '250 KILLS!', reward: 'damageBoost', duration: 6, intensity: 1, gemCount: 12, color: '#44BBFF' },
    { threshold: 500, label: '500 KILLS!', reward: 'fireRate', duration: 8, intensity: 1, gemCount: 16, color: '#BB44FF' },
    { threshold: 1000, label: '1000 KILLS!', reward: 'damageBoost', duration: 10, intensity: 1, gemCount: 24, color: '#FFAA00' },
    { threshold: 2500, label: '2500 KILLS!', reward: 'invincible', duration: 5, intensity: 1, gemCount: 32, color: '#FF4488' },
    { threshold: 5000, label: '5000 KILLS!', reward: 'damageBoost', duration: 12, intensity: 1, gemCount: 48, color: '#FFD700' }
];

export function layerStrength(id, intensity = 1) {
    const def = POWER_UPS[id];
    const i = Number.isFinite(intensity) ? intensity : 1;
    if (!def || def.kind === 'flag' || def.kind === 'heal') return 1;
    if (def.kind === 'attackRate') return 1 + def.attackRateBonus * i;
    return def.baseMultiplier * i;
}

function resolveIntensity(intensity, ctx) {
    return typeof intensity === 'function' ? intensity(ctx) : intensity ?? 1;
}

function materialize(def, spec, ctx) {
    if (!def || !spec) return null;
    const intensity = resolveIntensity(spec.intensity, ctx);
    return {
        id: def.id,
        duration: spec.duration,
        intensity,
        strength: layerStrength(def.id, intensity),
        label: def.label,
        color: def.color,
        hudColor: def.hudColor || def.color,
        name: def.name,
        hint: def.hint
    };
}

export function getProfile(source, key) {
    if (source === 'pickup') {
        const def = POWER_UPS[key];
        if (!def) return null;
        if (def.kind === 'heal') {
            return {
                id: def.id,
                healFraction: def.healFraction,
                label: def.label,
                color: def.color,
                name: def.name,
                hint: def.hint
            };
        }
        return materialize(def, def.pickup);
    }
    if (source === 'critical') return materialize(POWER_UPS.damageBoost, POWER_UPS.damageBoost.critical);
    if (source === 'noDamage') return materialize(POWER_UPS.invincible, POWER_UPS.invincible.noDamage);
    if (source === 'revive') return materialize(POWER_UPS.invincible, POWER_UPS.invincible.revive);
    if (source === 'combo') return materialize(POWER_UPS.damageBoost, POWER_UPS.damageBoost.combo, key);
    const listed = listProfiles(source, key);
    return listed[0] || null;
}

export function listProfiles(source, ctx) {
    if (source === 'streak') {
        return Object.values(POWER_UPS)
            .filter((def) => def.streak && ctx >= (def.streak.minStreak || 0))
            .map((def) => materialize(def, def.streak, ctx));
    }
    if (source === 'wave' && ctx === 'milestone') {
        return Object.values(POWER_UPS)
            .filter((def) => def.wave)
            .map((def) => materialize(def, def.wave));
    }
    if (source === 'combo') {
        const profile = materialize(POWER_UPS.damageBoost, POWER_UPS.damageBoost.combo, ctx);
        return profile ? [profile] : [];
    }
    if (source === 'milestone') {
        const milestone = KILL_MILESTONES.find((entry) => entry.threshold === ctx);
        if (!milestone) return [];
        return [materialize(POWER_UPS[milestone.reward], milestone)];
    }
    return [];
}

export function formatHudStrength(id, strength) {
    const def = POWER_UPS[id];
    if (!def || def.kind === 'flag' || def.kind === 'heal' || !(strength > 0)) return '';
    if (def.kind === 'attackRate') return `+${Math.round((strength - 1) * 100)}%`;
    const rounded = Math.round(strength * 100) / 100;
    return `×${rounded}`;
}

/** Drop expired and dominated layers, then keep at most `cap` strongest. */
export function pruneBuffLayers(layers, now, cap = BUFF_LAYER_CAP) {
    const live = (layers || []).filter((layer) => layer && layer.expiresAt > now);
    live.sort((a, b) => b.strength - a.strength || b.expiresAt - a.expiresAt);
    const kept = [];
    for (const layer of live) {
        const dominated = kept.some((other) => other.strength >= layer.strength && other.expiresAt >= layer.expiresAt);
        if (dominated) continue;
        kept.push(layer);
        if (kept.length >= cap) break;
    }
    return kept;
}
