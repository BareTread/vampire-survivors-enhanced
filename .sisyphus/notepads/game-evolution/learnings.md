# Learnings

## Codebase Patterns

- Weapons extend `BaseWeapon` from `src/entities/weapons/BaseWeapon.js`
- Register in `VampireSurvivorsGame.weaponClasses` Map (line ~152)
- Add to `availableWeapons` array in `generateLevelUpOptions()` (line ~938)
- Import at top of VampireSurvivorsGame.js
- Direct-damage weapons (GarlicAura, LightningChain, HolyBible) skip ProjectileSystem, use `EnemySystem.getEnemiesInRange()`
- Projectile weapons (MagicMissile, ThrowingKnife) use ProjectileSystem
- 8-level weapon progression is the standard
- Camera.js has lerp-based follow with smoothing=0.1, bounds, shake profiles, flash effect, zoom
- ExperienceSystem uses magnetRange \* player.stats.luck for effective pickup range
- Player.getEffectiveStats() applies passive item modifiers
- PassiveItemSystem stores items and provides getLevelUpOptions()
- Level-up options include: weapon_upgrade, new_weapon, stat_upgrade, new_passive, passive_upgrade

## Integration Points

- VampireSurvivorsGame.js imports at lines 1-33
- Systems init at lines 64-79
- weaponClasses Map at lines 152-159
- generateLevelUpOptions at line 921
- selectLevelUpOption at line 1027
- AudioManager has synthesizeVampireSound() with multi-oscillator engine

## Dead/Unwired

- Attractorb sets pickupRange modifier but ExperienceSystem doesn't read it (confirmed)
