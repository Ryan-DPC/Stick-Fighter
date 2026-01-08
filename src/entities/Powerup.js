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

    draw(ctx, game) {
        this.bob += 0.05;
        const offsetY = Math.sin(this.bob) * 5;

        // Draw Sprite if loaded
        if (game && game.itemSpriteSheet) {
            const item = ITEMS[this.type];
            let spriteIndex = 0;

            // Map Type to Sprite Index
            switch (item.name) {
                case 'HEALTH_POTION': spriteIndex = 0; break;
                case 'CROSSBOW': spriteIndex = 1; break;
                case 'BERSERK_RAGE': spriteIndex = 2; break; // Skull
                case 'FIRE_SPELL': spriteIndex = 3; break;
                case 'HASTE_SCROLL': spriteIndex = 4; break;
                case 'IRON_SHIELD': spriteIndex = 5; break;
            }

            // Sprite Sheet is 6 items horizontal
            // Assuming square sprites. Calculate size based on image width/6
            const spriteSize = game.itemSpriteSheet.width / 6;

            ctx.drawImage(
                game.itemSpriteSheet,
                spriteIndex * spriteSize, 0, spriteSize, spriteSize, // Source (Square)
                this.x - 5, this.y + offsetY - 5, 30, 30 // Dest (Slightly larger than hitbox)
            );
        } else {
            // Fallback to Box
            const item = ITEMS[this.type];
            if (item) {
                ctx.fillStyle = item.color;
                ctx.fillRect(this.x, this.y + offsetY, this.width, this.height);
                ctx.shadowBlur = 10;
                ctx.shadowColor = item.color;
                ctx.fillRect(this.x + 2, this.y + offsetY + 2, this.width - 4, this.height - 4);
                ctx.shadowBlur = 0;
            }
        }
    }
}
