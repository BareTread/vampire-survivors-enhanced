/**
 * Weapon System - ECS-based Weapon Management
 * 
 * Handles weapon behavior, upgrades, and projectile creation
 * using component-based architecture.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Config } from '../core/ConfigManager.js';
import { Logger } from '../core/ErrorHandler.js';

export class WeaponSystem extends BaseSystem {
    constructor(world, name = 'weapon', config = {}) {
        super(world, name, config);
        
        this.playerWeapons = new Map(); // Map of entity ID to weapons array
    }

    onInit() {
        this.createEntityQuery('weaponBearers', 'transform', 'weapon');
        Logger.debug('WeaponSystem initialized');
    }

    onUpdate(deltaTime) {
        const entities = this.executeQuery('weaponBearers');
        
        for (const entity of entities) {
            this.updateEntityWeapons(entity, deltaTime);
        }
    }

    updateEntityWeapons(entity, deltaTime) {
        const weaponComponent = entity.getComponent('weapon');
        if (!weaponComponent) return;

        // Update weapon cooldown
        weaponComponent.update(deltaTime);

        // Auto-fire if ready
        if (weaponComponent.canFire()) {
            this.fireWeapon(entity, weaponComponent);
        }
    }

    fireWeapon(entity, weaponComponent) {
        const transform = entity.getComponent('transform');
        if (!transform) return;

        // Find target if auto-targeting
        let target = null;
        if (weaponComponent.autoTarget) {
            target = this.findNearestTarget(entity, weaponComponent.targetingRange);
        }

        if (target || !weaponComponent.autoTarget) {
            this.createProjectile(entity, weaponComponent, target);
            weaponComponent.fire();
        }
    }

    findNearestTarget(entity, range) {
        // Simplified target finding - would normally query enemy entities
        return null;
    }

    createProjectile(entity, weaponComponent, target) {
        const transform = entity.getComponent('transform');
        if (!transform) return;

        // Calculate projectile direction
        let direction = { x: 1, y: 0 };
        
        if (target) {
            const targetTransform = target.getComponent('transform');
            if (targetTransform) {
                const dx = targetTransform.x - transform.x;
                const dy = targetTransform.y - transform.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    direction.x = dx / distance;
                    direction.y = dy / distance;
                }
            }
        }

        // Create projectile configuration
        const projectileConfig = {
            x: transform.x,
            y: transform.y,
            vx: direction.x * weaponComponent.projectileSpeed,
            vy: direction.y * weaponComponent.projectileSpeed,
            lifetime: weaponComponent.projectileLifetime,
            layer: 'playerProjectile',
            mask: ['enemy']
        };

        // Create projectile entity (placeholder - would use EntityFactory)
        Logger.debug('Projectile created', projectileConfig);
    }

    givePlayerStartingWeapon(playerEntity) {
        if (!playerEntity) return;

        // Add weapon component to player
        const weaponConfig = {
            weaponType: 'magicMissile',
            damage: Config.get('weapons.magicMissile.damage'),
            cooldown: Config.get('weapons.magicMissile.cooldown'),
            range: Config.get('weapons.magicMissile.range'),
            projectileSpeed: Config.get('weapons.magicMissile.speed')
        };

        // This would normally be handled by adding a weapon component
        // For now, just log the action
        Logger.info('Player given starting weapon', weaponConfig);
    }

    givePlayerWeapon(playerEntity, weaponType) {
        if (!playerEntity) return;

        Logger.info('Player given new weapon', { weaponType });
    }

    upgradeWeapon(playerEntity, weaponId) {
        if (!playerEntity) return;

        Logger.info('Weapon upgraded', { weaponId });
    }

    getPlayerWeapons(playerEntity) {
        if (!playerEntity) return [];

        // Return mock weapons for now
        return [{
            id: 'magicMissile',
            name: 'Magic Missile',
            level: 1,
            type: 'magicMissile',
            canUpgrade: () => true,
            getUpgradeDescription: () => 'Increases damage and projectile speed'
        }];
    }
}