import { CONFIG } from '../config.js';

export class Projectile {
    constructor(x, y, dir, owner, type) {
        this.x = x;
        this.y = y;
        this.width = type === 'HELLFIRE' ? 20 : 8;
        this.height = type === 'HELLFIRE' ? 10 : 4;
        this.vx = dir * CONFIG.PROJECTILE_SPEED;
        this.vy = 0; // For homing
        this.owner = owner;
        this.type = type;
        this.piercing = type === 'HELLFIRE';
        this.life = 100; // Frames
        this.hitTargets = new Set(); // Track who has been hit
    }

    update(target) {
        this.life--;

        if (this.type === 'BAT_SWARM' && target) {
            // Homing logic
            const targetY = target.y + target.height / 2;
            const dy = targetY - this.y;

            // Only home in if moving towards target generally
            if ((this.vx > 0 && target.x > this.x) || (this.vx < 0 && target.x < this.x)) {
                this.vy += dy * 0.02;
                this.vy = Math.max(-3, Math.min(3, this.vy)); // Cap vertical speed
            }
            this.y += this.vy;
        }

        this.x += this.vx;
    }

    draw(ctx) {
        ctx.fillStyle = '#ffff00';
        // Change color based on type
        if (this.type === 'HELLFIRE') {
            ctx.fillStyle = '#ff5722';
            // Hellfire glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff5722';
        }
        if (this.type === 'BAT_SWARM') {
            ctx.fillStyle = '#4a0e4e';
            // Bat shape (simple)
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Trail effect
        ctx.globalAlpha = 0.3;
        ctx.fillRect(this.x - this.vx, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }
}
