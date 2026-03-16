/**
 * SynergySystem — Weapon + Passive Item Combo Bonuses
 *
 * When a player has specific weapon + passive combinations, bonus effects
 * activate automatically. Synergies are displayed in the HUD and influence
 * gameplay through stat modifiers and special behaviors.
 *
 * 8 synergies defined:
 *   1. Lightning + Empty Tome   → "Storm's Fury"    — chain lightning fires 30% faster
 *   2. Garlic + Attractorb      → "Gravity Well"    — aura also pulls XP gems 40% farther
 *   3. Fire Wand + Spinach      → "Inferno"         — burn zones 50% larger, +25% burn damage
 *   4. Whip + Wings             → "Blitz Lash"      — whip attacks while moving do +40% damage
 *   5. Throwing Knife + Armor   → "Iron Rain"       — knives have +2 piercing
 *   6. Magic Missile + Duplicator→ "Barrage"        — missiles fire in volleys of +2
 *   7. Holy Bible + Empty Tome  → "Sacred Rotation" — orbiters spin 40% faster
 *   8. Bone Boomerang + Armor   → "Iron Return"     — boomerangs do +60% damage on return
 */

export class SynergySystem {
    constructor(game) {
        this.game = game;

        // Active synergies this run
        this.activeSynergies = new Map();

        // Synergy definitions
        this.synergies = [
            {
                id: 'storms_fury',
                name: "Storm's Fury",
                icon: '⚡',
                color: '#7DF9FF',
                weaponId: 'lightning_chain',
                passiveId: 'empty_tome',
                description: 'Chain Lightning fires 30% faster',
                apply: (weapon) => {
                    if (!weapon._synergyApplied_storms_fury) {
                        weapon.currentStats.cooldown *= 0.7;
                        weapon._synergyApplied_storms_fury = true;
                    }
                },
                remove: (weapon) => {
                    if (weapon._synergyApplied_storms_fury) {
                        weapon.currentStats.cooldown /= 0.7;
                        weapon._synergyApplied_storms_fury = false;
                    }
                }
            },
            {
                id: 'gravity_well',
                name: 'Gravity Well',
                icon: '🧲',
                color: '#9400D3',
                weaponId: 'garlic_aura',
                passiveId: 'attractorb',
                description: 'Aura pulls XP gems 40% farther',
                apply: (weapon) => {
                    weapon._synergyGemPull = true;
                },
                remove: (weapon) => {
                    weapon._synergyGemPull = false;
                }
            },
            {
                id: 'inferno',
                name: 'Inferno',
                icon: '🔥',
                color: '#FF4500',
                weaponId: 'fire_wand',
                passiveId: 'spinach',
                description: 'Burn zones 50% larger, +25% burn damage',
                apply: (weapon) => {
                    if (!weapon._synergyApplied_inferno) {
                        weapon.currentStats.area *= 1.5;
                        weapon.currentStats.damage *= 1.25;
                        weapon._synergyApplied_inferno = true;
                    }
                },
                remove: (weapon) => {
                    if (weapon._synergyApplied_inferno) {
                        weapon.currentStats.area /= 1.5;
                        weapon.currentStats.damage /= 1.25;
                        weapon._synergyApplied_inferno = false;
                    }
                }
            },
            {
                id: 'blitz_lash',
                name: 'Blitz Lash',
                icon: '💨',
                color: '#60A5FA',
                weaponId: 'whip',
                passiveId: 'wings',
                description: 'Whip does +40% damage while moving',
                apply: (weapon) => {
                    weapon._synergyMovingBonus = 1.4; // 40% bonus when player is moving
                },
                remove: (weapon) => {
                    weapon._synergyMovingBonus = 1.0;
                }
            },
            {
                id: 'iron_rain',
                name: 'Iron Rain',
                icon: '🗡️',
                color: '#A78BFA',
                weaponId: 'throwing_knife',
                passiveId: 'armor',
                description: 'Knives pierce +2 additional enemies',
                apply: (weapon) => {
                    if (!weapon._synergyApplied_iron_rain) {
                        weapon.currentStats.piercing += 2;
                        weapon._synergyApplied_iron_rain = true;
                    }
                },
                remove: (weapon) => {
                    if (weapon._synergyApplied_iron_rain) {
                        weapon.currentStats.piercing -= 2;
                        weapon._synergyApplied_iron_rain = false;
                    }
                }
            },
            {
                id: 'barrage',
                name: 'Barrage',
                icon: '✨',
                color: '#FBBF24',
                weaponId: 'magic_missile',
                passiveId: 'duplicator',
                description: 'Missiles fire in volleys of +2',
                apply: (weapon) => {
                    if (!weapon._synergyApplied_barrage) {
                        weapon.currentStats.projectiles += 2;
                        weapon._synergyApplied_barrage = true;
                    }
                },
                remove: (weapon) => {
                    if (weapon._synergyApplied_barrage) {
                        weapon.currentStats.projectiles -= 2;
                        weapon._synergyApplied_barrage = false;
                    }
                }
            },
            {
                id: 'sacred_rotation',
                name: 'Sacred Rotation',
                icon: '📿',
                color: '#C084FC',
                weaponId: 'holy_bible',
                passiveId: 'empty_tome',
                description: 'Orbiters spin 40% faster',
                apply: (weapon) => {
                    if (!weapon._synergyApplied_sacred_rotation) {
                        if (weapon.orbitSpeed) weapon.orbitSpeed *= 1.4;
                        weapon.currentStats.speed *= 1.4;
                        weapon._synergyApplied_sacred_rotation = true;
                    }
                },
                remove: (weapon) => {
                    if (weapon._synergyApplied_sacred_rotation) {
                        if (weapon.orbitSpeed) weapon.orbitSpeed /= 1.4;
                        weapon.currentStats.speed /= 1.4;
                        weapon._synergyApplied_sacred_rotation = false;
                    }
                }
            },
            {
                id: 'iron_return',
                name: 'Iron Return',
                icon: '🪃',
                color: '#ADFF2F',
                weaponId: 'bone_boomerang',
                passiveId: 'armor',
                description: 'Boomerangs do +60% damage on return',
                apply: (weapon) => {
                    weapon._synergyReturnBonus = 1.6; // 60% more damage on return
                },
                remove: (weapon) => {
                    weapon._synergyReturnBonus = 1.0;
                }
            },
            {
                id: 'permafrost',
                name: 'Permafrost',
                icon: '❄️',
                color: '#88DDFF',
                weaponId: 'ice_shard',
                passiveId: 'armor',
                description: 'Frozen enemies take +35% damage from all sources',
                apply: (weapon) => {
                    weapon._synergyPermafrost = true;
                },
                remove: (weapon) => {
                    weapon._synergyPermafrost = false;
                }
            },
            {
                id: 'death_mark',
                name: 'Death Mark',
                icon: '🩸',
                color: '#8B5CF6',
                weaponId: 'shadow_dagger',
                passiveId: 'spinach',
                description: 'Shadow Dagger deals +30% damage to bleeding enemies',
                apply: (weapon) => {
                    weapon._synergyDeathMark = true;
                },
                remove: (weapon) => {
                    weapon._synergyDeathMark = false;
                }
            }
        ];

        // HUD notification queue
        this._notifications = [];
        this._notificationTimer = 0;
    }

    // ── PUBLIC API ──────────────────────────────────────────────

    update(dt) {
        const player = this.game.player;
        const passiveItems = this.game.systems.passiveItems;
        if (!player || !passiveItems) return;

        // Check each synergy definition
        for (const synergy of this.synergies) {
            const hasWeapon = player.weapons.has(synergy.weaponId);
            const hasPassive = passiveItems.items.has(synergy.passiveId);
            const isActive = this.activeSynergies.has(synergy.id);

            if (hasWeapon && hasPassive && !isActive) {
                // Activate synergy
                const weapon = player.weapons.get(synergy.weaponId);
                synergy.apply(weapon);
                this.activeSynergies.set(synergy.id, synergy);

                // Show notification
                this._notifications.push({
                    text: `${synergy.icon} ${synergy.name}: ${synergy.description}`,
                    color: synergy.color,
                    timer: 3.0
                });

                // Play a subtle audio cue
                if (this.game.audioManager) {
                    this.game.audioManager.playVampireSound('levelUp', 0.5);
                }
            } else if ((!hasWeapon || !hasPassive) && isActive) {
                // Deactivate synergy (shouldn't normally happen but safety)
                const weapon = player.weapons.get(synergy.weaponId);
                if (weapon) synergy.remove(weapon);
                this.activeSynergies.delete(synergy.id);
            }
        }

        // Update notification timers
        for (let i = this._notifications.length - 1; i >= 0; i--) {
            this._notifications[i].timer -= dt;
            if (this._notifications[i].timer <= 0) {
                this._notifications.splice(i, 1);
            }
        }
    }

    /**
     * Get list of active synergies (for HUD/inventory display).
     */
    getActiveSynergies() {
        return Array.from(this.activeSynergies.values());
    }

    /**
     * Check if a specific weapon+passive combo would create a synergy.
     * Used to highlight compatible items during level-up selection.
     */
    wouldCreateSynergy(weaponId, passiveId) {
        return this.synergies.some(
            (s) =>
                (s.weaponId === weaponId && s.passiveId === passiveId) ||
                (s.weaponId === passiveId && s.passiveId === weaponId)
        );
    }

    /**
     * Get synergy info for a weapon (for level-up tooltip).
     */
    getSynergyForWeapon(weaponId) {
        return this.synergies.find((s) => s.weaponId === weaponId) || null;
    }

    /**
     * Get synergy info for a passive item (for level-up tooltip).
     */
    getSynergyForPassive(passiveId) {
        return this.synergies.filter((s) => s.passiveId === passiveId);
    }

    /**
     * Render synergy notifications and active synergy HUD indicators.
     */
    render(ctx) {
        if (!this.game.player) return;

        // Render floating notifications (screen-space)
        const canvasW = this.game.canvas.width;

        for (let i = 0; i < this._notifications.length; i++) {
            const notif = this._notifications[i];
            const alpha = Math.min(1, notif.timer / 0.5); // Fade out in last 0.5s
            const y = 140 + i * 30;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';

            // Background pill
            const textWidth = ctx.measureText(notif.text).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            const pillX = canvasW / 2 - textWidth / 2 - 12;
            const pillW = textWidth + 24;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(pillX, y - 10, pillW, 24, 6);
            } else {
                const r = 6;
                const x = pillX;
                const y0 = y - 10;
                const w = pillW;
                const h = 24;
                ctx.moveTo(x + r, y0);
                ctx.lineTo(x + w - r, y0);
                ctx.arcTo(x + w, y0, x + w, y0 + r, r);
                ctx.lineTo(x + w, y0 + h - r);
                ctx.arcTo(x + w, y0 + h, x + w - r, y0 + h, r);
                ctx.lineTo(x + r, y0 + h);
                ctx.arcTo(x, y0 + h, x, y0 + h - r, r);
                ctx.lineTo(x, y0 + r);
                ctx.arcTo(x, y0, x + r, y0, r);
                ctx.closePath();
            }
            ctx.fill();

            // Border glow
            ctx.strokeStyle = notif.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Text
            ctx.fillStyle = notif.color;
            ctx.fillText(notif.text, canvasW / 2, y + 5);
            ctx.restore();
        }

        // Render small synergy icons in the bottom-right HUD area
        if (this.activeSynergies.size > 0) {
            const startX = canvasW - 30;
            const startY = 90;
            let idx = 0;

            ctx.save();
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';

            for (const synergy of this.activeSynergies.values()) {
                const y = startY + idx * 22;
                const text = `${synergy.icon} ${synergy.name}`;

                // Background
                const tw = ctx.measureText(text).width;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(startX - tw - 8, y - 8, tw + 12, 18);

                // Text
                ctx.fillStyle = synergy.color;
                ctx.fillText(text, startX, y + 4);

                idx++;
            }

            ctx.restore();
        }
    }

    reset() {
        // Remove all synergy effects from weapons
        if (this.game.player) {
            for (const synergy of this.activeSynergies.values()) {
                const weapon = this.game.player.weapons.get(synergy.weaponId);
                if (weapon) synergy.remove(weapon);
            }
        }
        this.activeSynergies.clear();
        this._notifications = [];
    }
}
