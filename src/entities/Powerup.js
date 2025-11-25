import { ITEMS } from '../config.js';

export class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type;
        this.bob = 0;
    }

    draw(ctx) {
        this.bob += 0.05;
        const offsetY = Math.sin(this.bob) * 5;

        const item = ITEMS[this.type];
        if (item) {
            ctx.fillStyle = item.color;
            ctx.fillRect(this.x, this.y + offsetY, this.width, this.height);

            // Glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = item.color;
            ctx.fillRect(this.x + 5, this.y + offsetY + 5, this.width - 10, this.height - 10);
            ctx.shadowBlur = 0;
        }
    }
}
