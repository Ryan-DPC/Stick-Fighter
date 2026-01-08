export class Particle {
    constructor(x, y, color, type = 'normal') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;

        if (type === 'blood') {
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 1) * 4; // Upward spray
            this.gravity = 0.3;
            this.life = 60 + Math.random() * 30;
            this.size = 2 + Math.random() * 3;
            this.drag = 0.98;
        } else if (type === 'spark') {
            this.vx = (Math.random() - 0.5) * 10;
            this.vy = (Math.random() - 0.5) * 10;
            this.gravity = 0.2;
            this.life = 10 + Math.random() * 10;
            this.size = 1 + Math.random() * 2;
            this.drag = 0.9;
        } else {
            // Normal / Dust
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = (Math.random() - 0.5) * 6;
            this.life = 40 + Math.random() * 20;
            this.size = 3 + Math.random() * 3;
            this.gravity = 0.1;
            this.drag = 1;
        }

        this.maxLife = this.life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        if (this.drag) this.vx *= this.drag;

        this.life--;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
