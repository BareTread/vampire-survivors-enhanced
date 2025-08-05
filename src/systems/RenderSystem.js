/**
 * Render System - ECS-based Rendering
 * 
 * Professional rendering system that handles all visual output using
 * component-based data and optimized rendering techniques.
 * 
 * @author Game Architecture Specialist
 * @version 1.0.0
 */

import { BaseSystem } from './BaseSystem.js';
import { Config } from '../core/ConfigManager.js';
import { LoggerInstance as Logger, ErrorHandling, ErrorCategory } from '../core/ErrorHandler.js';

/**
 * Render System for handling all game rendering
 */
export class RenderSystem extends BaseSystem {
    constructor(world, name = 'render', config = {}) {
        super(world, name, config);
        
        // Rendering configuration
        this.renderConfig = {
            enableCulling: config.enableCulling !== false,
            cullMargin: config.cullMargin || 100,
            enableZSorting: config.enableZSorting !== false,
            backgroundEnabled: config.backgroundEnabled !== false
        };
        
        // Performance tracking
        this.renderStats = {
            entitiesRendered: 0,
            entitiesCulled: 0,
            drawCalls: 0
        };
    }

    onInit() {
        this.createEntityQuery('renderable', 'transform', 'render');
        Logger.debug('RenderSystem initialized');
    }

    onRender(ctx, camera) {
        // Reset stats
        this.renderStats.entitiesRendered = 0;
        this.renderStats.entitiesCulled = 0;
        this.renderStats.drawCalls = 0;

        // Render background
        if (this.renderConfig.backgroundEnabled) {
            this.renderBackground(ctx, camera);
        }

        // Get renderable entities
        const entities = this.executeQuery('renderable');
        
        // Sort by z-index if enabled
        const sortedEntities = this.renderConfig.enableZSorting 
            ? entities.sort((a, b) => {
                const renderA = a.getComponent('render');
                const renderB = b.getComponent('render');
                return (renderA?.zIndex || 0) - (renderB?.zIndex || 0);
            })
            : entities;

        // Render entities
        for (const entity of sortedEntities) {
            this.renderEntity(ctx, camera, entity);
        }

        this.performanceStats.entityCount = entities.length;
    }

    renderBackground(ctx, camera) {
        const bounds = camera.getWorldBounds();
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
        
        this.renderStats.drawCalls++;
    }

    renderEntity(ctx, camera, entity) {
        const transform = entity.getComponent('transform');
        const render = entity.getComponent('render');
        
        if (!transform || !render || !render.visible) return;

        // Frustum culling
        if (this.renderConfig.enableCulling) {
            if (!this.isInView(transform, render, camera)) {
                this.renderStats.entitiesCulled++;
                return;
            }
        }

        ctx.save();
        
        // Apply transform
        ctx.translate(transform.x, transform.y);
        ctx.rotate(transform.rotation);
        ctx.scale(transform.scaleX, transform.scaleY);
        
        // Apply render properties
        ctx.globalAlpha = render.opacity;
        
        // Render based on type
        switch (render.type) {
            case 'circle':
                this.renderCircle(ctx, render);
                break;
            case 'rectangle':
                this.renderRectangle(ctx, render);
                break;
            default:
                this.renderCircle(ctx, render);
        }
        
        ctx.restore();
        
        this.renderStats.entitiesRendered++;
        this.renderStats.drawCalls++;
    }

    renderCircle(ctx, render) {
        if (render.glow) {
            ctx.shadowColor = render.glowColor || render.color;
            ctx.shadowBlur = render.glowIntensity || 10;
        }
        
        ctx.fillStyle = render.color;
        ctx.beginPath();
        ctx.arc(0, 0, render.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (render.glow) {
            ctx.shadowBlur = 0;
        }
    }

    renderRectangle(ctx, render) {
        if (render.glow) {
            ctx.shadowColor = render.glowColor || render.color;
            ctx.shadowBlur = render.glowIntensity || 10;
        }
        
        ctx.fillStyle = render.color;
        ctx.fillRect(-render.width/2, -render.height/2, render.width, render.height);
        
        if (render.glow) {
            ctx.shadowBlur = 0;
        }
    }

    isInView(transform, render, camera) {
        const bounds = camera.getWorldBounds(this.renderConfig.cullMargin);
        const size = Math.max(render.size || 0, render.width || 0, render.height || 0);
        
        return transform.x + size >= bounds.left &&
               transform.x - size <= bounds.right &&
               transform.y + size >= bounds.top &&
               transform.y - size <= bounds.bottom;
    }

    getDebugInfo() {
        return {
            ...super.getDebugInfo(),
            renderStats: this.renderStats,
            renderConfig: this.renderConfig
        };
    }
}