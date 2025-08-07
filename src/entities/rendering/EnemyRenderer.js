/**
 * EnemyRenderer.js
 * 
 * Handles enemy rendering and visual effects
 * Extracted from Enemy.js for better code organization
 */

export class EnemyRenderer {
    constructor(enemy) {
        this.enemy = enemy;
        this.game = enemy.game;
        
        // Visual properties
        this.flashTime = 0;
        this.flashColor = '#FFFFFF';
        this.glowIntensity = 0;
        this.shadowAlpha = 0.3;
        
        // Elite visual effects
        this.eliteAuraTime = 0;
        this.eliteAuraRadius = 50;
        this.eliteAuraColor = '#FF6B6B';
        
        // Animation
        this.animationFrame = 0;
        this.animationSpeed = 0.1;
        this.spriteOffset = { x: 0, y: 0 };
    }
    
    render(ctx) {
        if (!this.enemy.active) return;
        
        ctx.save();
        
        // Apply flash effect
        if (this.enemy.flashTime > 0) {
            ctx.globalAlpha = 0.8 + Math.sin(this.enemy.flashTime * 20) * 0.2;
        }
        
        // Draw shadow
        this.drawShadow(ctx);
        
        // Draw elite aura if applicable
        if (this.enemy.type === 'elite') {
            this.drawEliteAura(ctx);
        }
        
        // Draw enemy body
        this.drawBody(ctx);
        
        // Draw health bar
        this.drawHealthBar(ctx);
        
        // Draw status effects
        this.drawStatusEffects(ctx);
        
        // Draw debug info if enabled
        if (this.game.showDebug) {
            this.drawDebugInfo(ctx);
        }
        
        ctx.restore();
    }
    
    drawShadow(ctx) {
        ctx.save();
        ctx.globalAlpha = this.shadowAlpha;
        ctx.fillStyle = '#000000';
        
        // Elliptical shadow
        ctx.beginPath();
        ctx.ellipse(
            this.enemy.x, 
            this.enemy.y + this.enemy.size * 0.8,
            this.enemy.size * 0.8,
            this.enemy.size * 0.4,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        ctx.restore();
    }
    
    drawEliteAura(ctx) {
        const time = performance.now() * 0.001;
        const pulseScale = 1 + Math.sin(time * 3) * 0.1;
        
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(time * 2) * 0.1;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(
            this.enemy.x, this.enemy.y, 0,
            this.enemy.x, this.enemy.y, this.eliteAuraRadius * pulseScale
        );
        gradient.addColorStop(0, this.eliteAuraColor + '40');
        gradient.addColorStop(0.5, this.eliteAuraColor + '20');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(
            this.enemy.x, 
            this.enemy.y, 
            this.eliteAuraRadius * pulseScale, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
        
        // Inner ring
        ctx.strokeStyle = this.eliteAuraColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(
            this.enemy.x,
            this.enemy.y,
            this.enemy.size + 5,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawBody(ctx) {
        ctx.save();
        
        // Apply enemy-specific rendering
        switch (this.enemy.type) {
            case 'basic':
                this.drawBasicEnemy(ctx);
                break;
            case 'fast':
                this.drawFastEnemy(ctx);
                break;
            case 'tank':
                this.drawTankEnemy(ctx);
                break;
            case 'ranged':
                this.drawRangedEnemy(ctx);
                break;
            case 'elite':
                this.drawEliteEnemy(ctx);
                break;
            default:
                this.drawBasicEnemy(ctx);
        }
        
        ctx.restore();
    }
    
    drawBasicEnemy(ctx) {
        // Simple circle with gradient
        const gradient = ctx.createRadialGradient(
            this.enemy.x - this.enemy.size * 0.3,
            this.enemy.y - this.enemy.size * 0.3,
            0,
            this.enemy.x,
            this.enemy.y,
            this.enemy.size
        );
        
        const baseColor = this.enemy.flashTime > 0 ? '#FFFFFF' : this.enemy.color;
        gradient.addColorStop(0, this.lightenColor(baseColor, 30));
        gradient.addColorStop(0.7, baseColor);
        gradient.addColorStop(1, this.darkenColor(baseColor, 30));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.enemy.x, this.enemy.y, this.enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = this.darkenColor(baseColor, 50);
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    drawFastEnemy(ctx) {
        // Streamlined triangle shape
        const angle = Math.atan2(this.enemy.velocity.y, this.enemy.velocity.x);
        
        ctx.save();
        ctx.translate(this.enemy.x, this.enemy.y);
        ctx.rotate(angle);
        
        const gradient = ctx.createLinearGradient(
            -this.enemy.size, 0,
            this.enemy.size, 0
        );
        gradient.addColorStop(0, this.enemy.color);
        gradient.addColorStop(1, this.lightenColor(this.enemy.color, 40));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(this.enemy.size, 0);
        ctx.lineTo(-this.enemy.size, -this.enemy.size * 0.7);
        ctx.lineTo(-this.enemy.size * 0.5, 0);
        ctx.lineTo(-this.enemy.size, this.enemy.size * 0.7);
        ctx.closePath();
        ctx.fill();
        
        // Speed lines
        if (Math.abs(this.enemy.velocity.x) + Math.abs(this.enemy.velocity.y) > 50) {
            ctx.strokeStyle = this.enemy.color + '40';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-this.enemy.size - i * 5, -this.enemy.size * 0.3 + i * 3);
                ctx.lineTo(-this.enemy.size * 2 - i * 10, -this.enemy.size * 0.3 + i * 3);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
    
    drawTankEnemy(ctx) {
        // Heavy hexagon shape
        const sides = 6;
        
        // Outer armor
        ctx.fillStyle = this.darkenColor(this.enemy.color, 20);
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
            const x = this.enemy.x + Math.cos(angle) * (this.enemy.size + 3);
            const y = this.enemy.y + Math.sin(angle) * (this.enemy.size + 3);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Inner body
        const gradient = ctx.createRadialGradient(
            this.enemy.x, this.enemy.y, 0,
            this.enemy.x, this.enemy.y, this.enemy.size
        );
        gradient.addColorStop(0, this.lightenColor(this.enemy.color, 20));
        gradient.addColorStop(1, this.enemy.color);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
            const x = this.enemy.x + Math.cos(angle) * this.enemy.size;
            const y = this.enemy.y + Math.sin(angle) * this.enemy.size;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Armor plates
        ctx.strokeStyle = this.darkenColor(this.enemy.color, 40);
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    drawRangedEnemy(ctx) {
        // Diamond shape with energy core
        ctx.save();
        ctx.translate(this.enemy.x, this.enemy.y);
        
        // Outer diamond
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.enemy.size);
        gradient.addColorStop(0, this.lightenColor(this.enemy.color, 40));
        gradient.addColorStop(0.7, this.enemy.color);
        gradient.addColorStop(1, this.darkenColor(this.enemy.color, 20));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -this.enemy.size);
        ctx.lineTo(this.enemy.size, 0);
        ctx.lineTo(0, this.enemy.size);
        ctx.lineTo(-this.enemy.size, 0);
        ctx.closePath();
        ctx.fill();
        
        // Energy core (pulsing)
        const pulseScale = 1 + Math.sin(performance.now() * 0.005) * 0.2;
        ctx.fillStyle = '#FFFF00';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, this.enemy.size * 0.3 * pulseScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawEliteEnemy(ctx) {
        // Spiked circle with rotating spikes
        const time = performance.now() * 0.001;
        const spikeCount = 8;
        
        // Main body
        const gradient = ctx.createRadialGradient(
            this.enemy.x, this.enemy.y, 0,
            this.enemy.x, this.enemy.y, this.enemy.size
        );
        gradient.addColorStop(0, '#FF0000');
        gradient.addColorStop(0.5, this.enemy.color);
        gradient.addColorStop(1, this.darkenColor(this.enemy.color, 30));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.enemy.x, this.enemy.y, this.enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Rotating spikes
        ctx.save();
        ctx.translate(this.enemy.x, this.enemy.y);
        ctx.rotate(time);
        
        ctx.fillStyle = this.darkenColor(this.enemy.color, 40);
        for (let i = 0; i < spikeCount; i++) {
            const angle = (Math.PI * 2 * i) / spikeCount;
            
            ctx.save();
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.moveTo(this.enemy.size, 0);
            ctx.lineTo(this.enemy.size + 10, -3);
            ctx.lineTo(this.enemy.size + 15, 0);
            ctx.lineTo(this.enemy.size + 10, 3);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        ctx.restore();
        
        // Elite symbol
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', this.enemy.x, this.enemy.y);
    }
    
    drawHealthBar(ctx) {
        if (this.enemy.health >= this.enemy.maxHealth) return;
        
        const barWidth = this.enemy.size * 2;
        const barHeight = 4;
        const barY = this.enemy.y - this.enemy.size - 10;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(
            this.enemy.x - barWidth / 2,
            barY,
            barWidth,
            barHeight
        );
        
        // Health fill
        const healthPercent = Math.max(0, this.enemy.health / this.enemy.maxHealth);
        let healthColor;
        
        if (healthPercent > 0.6) {
            healthColor = '#00FF00';
        } else if (healthPercent > 0.3) {
            healthColor = '#FFFF00';
        } else {
            healthColor = '#FF0000';
        }
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(
            this.enemy.x - barWidth / 2,
            barY,
            barWidth * healthPercent,
            barHeight
        );
        
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            this.enemy.x - barWidth / 2,
            barY,
            barWidth,
            barHeight
        );
    }
    
    drawStatusEffects(ctx) {
        let iconOffset = 0;
        
        // Burning effect
        if (this.enemy.statusEffects && this.enemy.statusEffects.burning) {
            ctx.fillStyle = '#FF6600';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🔥', this.enemy.x + iconOffset, this.enemy.y - this.enemy.size - 20);
            iconOffset += 15;
        }
        
        // Frozen effect
        if (this.enemy.statusEffects && this.enemy.statusEffects.frozen) {
            ctx.fillStyle = '#00CCFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('❄️', this.enemy.x + iconOffset, this.enemy.y - this.enemy.size - 20);
            iconOffset += 15;
        }
        
        // Poisoned effect
        if (this.enemy.statusEffects && this.enemy.statusEffects.poisoned) {
            ctx.fillStyle = '#00FF00';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('☠️', this.enemy.x + iconOffset, this.enemy.y - this.enemy.size - 20);
            iconOffset += 15;
        }
    }
    
    drawDebugInfo(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        
        // Type and ID
        ctx.fillText(
            `${this.enemy.type}#${this.enemy.id}`,
            this.enemy.x,
            this.enemy.y + this.enemy.size + 15
        );
        
        // AI state if available
        if (this.enemy.aiState) {
            ctx.fillText(
                this.enemy.aiState,
                this.enemy.x,
                this.enemy.y + this.enemy.size + 25
            );
        }
        
        // Velocity vector
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.enemy.x, this.enemy.y);
        ctx.lineTo(
            this.enemy.x + this.enemy.velocity.x * 0.2,
            this.enemy.y + this.enemy.velocity.y * 0.2
        );
        ctx.stroke();
    }
    
    // Utility methods
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
            (G > 0 ? G : 0) * 0x100 +
            (B > 0 ? B : 0))
            .toString(16).slice(1);
    }
    
    update(deltaTime) {
        // Update flash effect
        if (this.enemy.flashTime > 0) {
            this.enemy.flashTime -= deltaTime;
        }
        
        // Update elite aura animation
        if (this.enemy.type === 'elite') {
            this.eliteAuraTime += deltaTime;
        }
        
        // Update animation frame
        this.animationFrame += this.animationSpeed * deltaTime;
    }
}