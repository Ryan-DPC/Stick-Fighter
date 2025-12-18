import { CONFIG, ITEMS } from './config.js';
import { Player } from './entities/Player.js';
import { Projectile } from './entities/Projectile.js';
import { Powerup } from './entities/Powerup.js';
import { Particle } from './entities/Particle.js';
import { MenuManager } from './managers/MenuManager.js';
import { NetworkManager } from './managers/NetworkManager.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        // Managers
        this.menuManager = new MenuManager(this);
        this.networkManager = new NetworkManager(this);

        this.player1 = null;
        this.player2 = null;
        this.projectiles = [];
        this.powerups = [];
        this.platforms = [];
        this.particles = [];

        this.keys = {};
        this.gameActive = false;
        this.gameMode = 'local';
        this.roundTime = CONFIG.ROUND_TIME;
        this.scores = { p1: 0, p2: 0 };
        this.isChatting = false;

        // Visual Effects
        this.shakeTime = 0;
        this.shakeIntensity = 0;

        // Sprite Loading with Chroma Key
        this.spritesLoaded = false;
        const tempImage = new Image();
        tempImage.src = 'assets/sprites.png';
        tempImage.onload = () => {
            // Create offscreen canvas to process image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = tempImage.width;
            canvas.height = tempImage.height;
            ctx.drawImage(tempImage, 0, 0);

            // Get Data
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            // Remove Green (#00FF00) and surrounding shades
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // If Green is bright and dominant
                if (g > 150 && r < 100 && b < 100) {
                    data[i + 3] = 0; // Set Alpha to 0
                }
                // Additional tolerance
                if (g > r + 30 && g > b + 30) {
                    data[i + 3] = 0;
                }
            }

            ctx.putImageData(imgData, 0, 0);

            // Set final sprite sheet
            this.spriteSheet = new Image();
            this.spriteSheet.src = canvas.toDataURL();
            this.spritesLoaded = true;
            console.log('Sprites processed and loaded!');
        };

        this.setupEventListeners();
        this.createMap();

        // Initial State
        this.menuManager.showMenu();
    }

    startLocalGame() {
        console.log('Starting local game...');
        this.gameMode = 'local';
        this.menuManager.startGameUI(false);
        this.initGame();
    }

    startOnlineGame() {
        this.networkManager.connect();
    }

    onMatchFound(data) {
        this.gameMode = 'online';
        this.menuManager.startGameUI(true);
        this.initOnlineGame();
    }

    initGame() {
        // Create players
        this.player1 = new Player(200, 300, '#00ffff', 1);
        this.player2 = new Player(1000, 300, '#ff00ff', 2);

        this.resetRoundState();

        this.gameActive = true;
        this.gameLoop();
        this.spawnPowerup();
    }

    initOnlineGame() {
        // Create local player and remote player dummy
        if (this.networkManager.myPlayerId === 1) {
            this.player1 = new Player(200, 300, '#00ffff', 1);
            this.player2 = new Player(1000, 300, '#ff00ff', 2);
        } else {
            this.player1 = new Player(1000, 300, '#00ffff', 2);
            this.player2 = new Player(200, 300, '#ff00ff', 1);
        }

        this.resetRoundState();

        this.gameActive = true;
        this.gameLoop();
        this.spawnPowerup();
        this.syncInterval = setInterval(() => this.syncOnlineState(), 50);
    }

    resetRoundState() {
        this.projectiles = [];
        this.powerups = [];
        this.particles = [];
        this.roundTime = CONFIG.ROUND_TIME;
    }

    createMap() {
        // Ground
        this.platforms.push({ x: 0, y: 550, width: CONFIG.CANVAS_WIDTH, height: 50 });

        // Platforms
        this.platforms.push({ x: 300, y: 400, width: 200, height: 20 });
        this.platforms.push({ x: 700, y: 400, width: 200, height: 20 });
        this.platforms.push({ x: 500, y: 250, width: 200, height: 20 });
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.isChatting) return;

            this.keys[e.key.toLowerCase()] = true;

            // Player 1 controls
            if (this.gameActive && this.player1) {
                if (e.key === ' ') { e.preventDefault(); this.player1.useItem(this); }
                if (e.key.toLowerCase() === 'e') this.player1.melee(this.player2, this); // Attack P1
                if (e.key.toLowerCase() === 'q') this.player1.switchItemNext(); // Switch Item P1 (Moved from E)
                if (e.key === 'Shift') { e.preventDefault(); this.player1.dash(this); }
            }

            // Player 2 controls (Only in Local Mode)
            if (this.gameMode === 'local' && this.gameActive && this.player2) {
                if (e.key === 'Enter') { e.preventDefault(); this.player2.useItem(this); }
                if (e.key.toLowerCase() === 'l') this.player2.melee(this.player1, this); // Attack P2
                if (e.key.toLowerCase() === 'k') this.player2.switchItemNext(); // Switch Item P2
                if (e.key === 'Control') this.player2.dash(this);
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    syncOnlineState() {
        if (!this.gameActive || this.gameMode !== 'online') return;

        this.networkManager.sendPlayerUpdate({
            x: this.player1.x,
            y: this.player1.y,
            vx: this.player1.vx,
            vy: this.player1.vy,
            health: this.player1.health,
            facingRight: this.player1.facingRight
        });
    }

    spawnPowerup() {
        if (!this.gameActive) return;

        const types = Object.keys(ITEMS);
        const type = types[Math.floor(Math.random() * types.length)];
        const x = 200 + Math.random() * 800;
        const y = 100 + Math.random() * 300;

        this.powerups.push(new Powerup(x, y, type));

        setTimeout(() => this.spawnPowerup(), CONFIG.ITEM_SPAWN_INTERVAL);
    }

    update() {
        if (!this.gameActive) return;

        // Shake Effect
        if (this.shakeTime > 0) {
            this.shakeTime--;
        }

        // Update players
        if (this.player1) this.player1.update(this);
        if (this.player2) this.player2.update(this);

        // Update projectiles
        this.projectiles = this.projectiles.filter(p => {
            const target = p.owner === 1 ? this.player2 : this.player1;
            p.update(target);

            // Check collision with players
            if (p.owner !== 1 && this.checkCollision(p, this.player1)) {
                if (!p.hitTargets.has(this.player1.id)) {
                    this.player1.takeDamage(CONFIG.PROJECTILE_DAMAGE, this);
                    this.createHitParticles(p.x, p.y, '#ff0000');
                    this.screenShake(10, 5); // Shake!
                    p.hitTargets.add(this.player1.id);
                    if (!p.piercing) return false;
                }
            }
            if (p.owner !== 2 && this.checkCollision(p, this.player2)) {
                if (!p.hitTargets.has(this.player2.id)) {
                    this.player2.takeDamage(CONFIG.PROJECTILE_DAMAGE, this);
                    this.createHitParticles(p.x, p.y, '#ff0000');
                    this.screenShake(10, 5); // Shake!
                    p.hitTargets.add(this.player2.id);
                    if (!p.piercing) return false;
                }
            }

            return p.life > 0 && p.x > 0 && p.x < CONFIG.CANVAS_WIDTH && p.y > 0 && p.y < CONFIG.CANVAS_HEIGHT;
        });

        // Update powerups/items
        this.powerups = this.powerups.filter(p => {
            // Logic for p1 and p2 pickup
            if (this.checkCollision(p, this.player1)) {
                if (this.player1.pickupItem(p.type)) {
                    const itemColor = ITEMS[p.type] ? ITEMS[p.type].color : '#ffffff';
                    this.createHitParticles(p.x, p.y, itemColor);
                    return false; // Remove item
                }
                // If player1's inventory is full, the item remains on the map
                return true;
            }
            if (this.checkCollision(p, this.player2)) {
                if (this.player2.pickupItem(p.type)) {
                    const itemColor = ITEMS[p.type] ? ITEMS[p.type].color : '#ffffff';
                    this.createHitParticles(p.x, p.y, itemColor);
                    return false; // Remove item
                }
                // If player2's inventory is full, the item remains on the map
                return true;
            }
            return true; // Keep item if no collision or pickup
        });

        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });

        // Check for round end (Local Only - Online handled by server event)
        if (this.gameMode === 'local') {
            if (this.player1.health <= 0 || this.player2.health <= 0) {
                this.endRound();
            }
        }
    }

    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
            obj1.x + obj1.width > obj2.x &&
            obj1.y < obj2.y + obj2.height &&
            obj1.y + obj1.height > obj2.y;
    }

    createHitParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    screenShake(time, intensity) {
        this.shakeTime = time;
        this.shakeIntensity = intensity;
    }

    // Local Round End
    endRound() {
        this.gameActive = false;

        if (this.player1.health > this.player2.health) {
            this.scores.p1++;
            this.menuManager.showAnnouncement('PLAYER 1 WINS!');
        } else {
            this.scores.p2++;
            this.menuManager.showAnnouncement('PLAYER 2 WINS!');
        }

        this.menuManager.updateScores(this.scores.p1, this.scores.p2);
        setTimeout(() => this.initGame(), 3000);
    }

    // Online Round End
    onRoundEnd(isWin) {
        if (isWin) {
            this.scores.p1++;
            this.menuManager.showAnnouncement('YOU WIN!');
        } else {
            this.scores.p2++;
            this.menuManager.showAnnouncement('YOU LOSE!');
        }

        this.menuManager.updateScores(this.scores.p1, this.scores.p2);

        // Wait for server to restart? Or restart strictly on timeout? 
        // Original code: setTimeout(() => this.initOnlineGame(), 3000);
        setTimeout(() => this.initOnlineGame(), 3000);
    }

    onOpponentDisconnected() {
        this.gameActive = false;
        alert('Opponent disconnected!');
        this.menuManager.showMenu();
        this.networkManager.disconnect();
    }

    draw() {
        // Clear canvas with shake
        this.ctx.save();

        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
        }

        // Medieval Background (Dark Stone)
        this.ctx.fillStyle = '#1a1918'; // Dark metallic/stone
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Draw Castle Pillars/Background details (Simple)
        this.ctx.fillStyle = '#262422';
        for (let i = 0; i < 6; i++) {
            this.ctx.fillRect(100 + i * 200, 50, 40, 500);
        }

        // Draw platforms (Stone/Wood style)
        this.platforms.forEach((platform, index) => {
            // Shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(platform.x + 5, platform.y + 5, platform.width, platform.height);

            // Block
            // Ground is index 0 usually, or y > 500
            if (platform.y > 500) {
                this.ctx.fillStyle = '#3e2723'; // Dirt/Dark Ground
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
                // Top Grass/Stone trim
                this.ctx.fillStyle = '#2e7d32'; // Dark Green Grass
                this.ctx.fillRect(platform.x, platform.y, platform.width, 10);
            } else {
                this.ctx.fillStyle = '#616161'; // Stone Grey
                this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
                // Border/Texture
                this.ctx.strokeStyle = '#424242';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);

                // Bricks pattern
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#424242';
                for (let bx = platform.x; bx < platform.x + platform.width; bx += 20) {
                    this.ctx.moveTo(bx, platform.y);
                    this.ctx.lineTo(bx, platform.y + platform.height);
                }
                this.ctx.stroke();
            }
        });

        // Draw entities
        this.powerups.forEach(p => p.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));

        if (this.player1) this.player1.draw(this.ctx, this);
        if (this.player2) this.player2.draw(this.ctx, this);

        this.ctx.restore();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

