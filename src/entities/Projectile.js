import { CONFIG } from '../config.js';

export class Projectile {
    constructor(x, y, dir, owner, type) {
        this.x = x;
        this.y = y;
        this.vx = dir * CONFIG.PROJECTILE_SPEED;
        this.vy = 0;
        this.owner = owner;
        this.type = type;

        // Define properties based on type
        if (type === 'FIRE_SPELL') {
            this.width = 25;
            this.height = 15;
            this.piercing = true;
            this.life = 120;
            this.color = '#ff4500';
            this.glow = '#ff8c00';
        } else if (type === 'CROSSBOW') {
            this.width = 15;
            this.height = 3;
            this.piercing = false;
            this.life = 100;
            this.color = '#8b4513';
            this.vx *= 1.5; // Faster bolt
        } else {
            // Default
            this.width = 8;
            this.height = 4;
            this.piercing = false;
            this.life = 80;
            this.color = '#ffff00';
        }

        this.hitTargets = new Set();
        this.trail = [];
    }

    update(target) {
        this.life--;

        // Update Trail
        this.trail.push({ x: this.x, y: this.y, age: 10 });
        this.trail.forEach(t => t.age--);
        this.trail = this.trail.filter(t => t.age > 0);

        // Homing Logic for specific spells if needed (omitted for now to keep skill based)
        // Basic element physics for Fireball? (Gravity?) No, usually straight line.

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        // Draw Trail
        this.trail.forEach(t => {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = t.age / 20;
            ctx.beginPath();
            ctx.arc(t.x + this.width / 2, t.y + this.height / 2, this.height / 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        if (this.type === 'FIRE_SPELL') {
            // Fancy Fireball
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.glow;

            const gradient = ctx.createRadialGradient(
                this.x + this.width / 2, this.y + this.height / 2, 2,
                this.x + this.width / 2, this.y + this.height / 2, this.width
            );
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(0.5, '#ff4500');
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            return;
        }

        if (this.type === 'CROSSBOW') {
            // Bolt
            ctx.fillStyle = '#5d4037'; // Wood
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Steel tip
            ctx.fillStyle = '#b0bec5';
            ctx.fillRect(this.vx > 0 ? this.x + this.width - 4 : this.x, this.y, 4, this.height);
            return;
        }

        // Default
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
