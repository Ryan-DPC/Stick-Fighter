import { CONFIG, ITEMS } from './config.js';
import { Player } from './entities/Player.js';
import { Projectile } from './entities/Projectile.js';
import { Powerup } from './entities/Powerup.js';
import { Particle } from './entities/Particle.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.player1 = null;
        this.player2 = null;
        this.projectiles = [];
        this.powerups = [];
        this.platforms = [];
        this.particles = [];

        this.keys = {};
        this.gameActive = false;
        this.roundTime = CONFIG.ROUND_TIME;
        this.scores = { p1: 0, p2: 0 };
        this.isChatting = false;

        this.initMenu();
        this.setupEventListeners();
        this.createMap();
    }

    initMenu() {
        const localBtn = document.getElementById('local-btn');
        const onlineBtn = document.getElementById('online-btn');
        const howToPlayBtn = document.getElementById('how-to-play-btn');
        const backBtn = document.getElementById('back-to-menu');

        localBtn.addEventListener('click', () => this.startLocalGame());
        howToPlayBtn.addEventListener('click', () => this.showHowToPlay());
        backBtn.addEventListener('click', () => this.showMenu());
        onlineBtn.addEventListener('click', () => this.startOnlineGame());
    }

    showMenu() {
        const menuScreen = document.getElementById('menu-screen');
        const gameScreen = document.getElementById('game-screen');
        const howToPlayScreen = document.getElementById('how-to-play-screen');

        // Reset styles
        menuScreen.style.display = '';
        gameScreen.style.display = '';
        howToPlayScreen.style.display = '';

        menuScreen.classList.add('active');
        howToPlayScreen.classList.remove('active');
        gameScreen.classList.remove('active');

        this.gameActive = false;
    }

    showHowToPlay() {
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('how-to-play-screen').classList.add('active');
    }

    startLocalGame() {
        console.log('Starting local game...');
        try {
            const menuScreen = document.getElementById('menu-screen');
            const gameScreen = document.getElementById('game-screen');

            // Force hide menu
            menuScreen.classList.remove('active');
            menuScreen.style.display = 'none';

            // Show game
            gameScreen.classList.add('active');
            gameScreen.style.display = 'flex';

            this.gameMode = 'local';
            // Hide chat in local mode
            document.getElementById('chat-container').style.display = 'none';
            this.initGame();
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error starting game. Check console for details.');
        }
    }

    startOnlineGame() {
        // Initialize Socket.io connection
        if (!window.io) {
            alert('Socket.io not loaded. Please ensure the server is running!');
            return;
        }

        this.socket = io();
        this.gameMode = 'online';

        // Show chat in online mode
        document.getElementById('chat-container').style.display = 'flex';
        this.initChat();

        // Socket event listeners
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            this.socket.emit('stick-arena:join', { userId: this.socket.id });
        });

        this.socket.on('stick-arena:joined', () => {
            console.log('Joined stick arena');
            this.socket.emit('stick-arena:findMatch', { userId: this.socket.id });
        });

        this.socket.on('stick-arena:waiting', (data) => {
            this.showAnnouncement('SEARCHING FOR OPPONENT...');
        });

        this.socket.on('stick-arena:matchFound', (data) => {
            console.log('Match found!', data);
            this.myPlayerId = data.playerId;
            this.opponentId = data.opponentId;
            this.roomId = data.roomId;

            document.getElementById('menu-screen').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            this.initOnlineGame();
        });

        this.socket.on('stick-arena:gameState', (state) => {
            // Sync game state from server
            if (this.gameMode === 'online' && this.gameActive) {
                // Update opponent position
                const opponentData = state.players[this.myPlayerId === 1 ? 2 : 1];
                if (opponentData && this.player2) {
                    this.player2.x = opponentData.x;
                    this.player2.y = opponentData.y;
                    this.player2.vx = opponentData.vx;
                    this.player2.vy = opponentData.vy;
                    this.player2.health = opponentData.health;
                    this.player2.facingRight = opponentData.facingRight;
                }
            }
        });

        this.socket.on('stick-arena:playerMelee', (data) => {
            if (data.playerId !== this.myPlayerId) {
                // Opponent performed melee
                this.player2.meleeActive = true;
                setTimeout(() => this.player2.meleeActive = false, 200);
            }
        });

        this.socket.on('stick-arena:projectileCreated', (projectile) => {
            // Add opponent's projectile
            if (projectile.owner !== this.myPlayerId) {
                this.projectiles.push(new Projectile(
                    projectile.x,
                    projectile.y,
                    projectile.vx > 0 ? 1 : -1,
                    projectile.owner,
                    projectile.type || 'HELLFIRE'
                ));
            }
        });

        this.socket.on('stick-arena:playerDamaged', (data) => {
            if (data.playerId === this.myPlayerId) {
                this.player1.takeDamage(data.damage, this);
            }
        });

        this.socket.on('stick-arena:roundEnd', (data) => {
            if (data.winnerId === this.myPlayerId) {
                this.scores.p1++;
                this.showAnnouncement('YOU WIN!');
            } else {
                this.scores.p2++;
                this.showAnnouncement('YOU LOSE!');
            }
            document.getElementById('score-p1').textContent = this.scores.p1;
            document.getElementById('score-p2').textContent = this.scores.p2;

            setTimeout(() => this.initOnlineGame(), 3000);
        });

        this.socket.on('stick-arena:opponentDisconnected', (data) => {
            this.gameActive = false;
            alert('Opponent disconnected!');
            this.showMenu();
            if (this.socket) {
                this.socket.disconnect();
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    initChat() {
        const chatInput = document.getElementById('chat-input');

        if (chatInput) {
            // Remove old listeners to avoid duplicates if called multiple times
            const newChatInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newChatInput, chatInput);

            newChatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && newChatInput.value.trim() !== '') {
                    this.socket.emit('stick-arena:chat', { message: newChatInput.value.trim() });
                    this.addChatMessage('Me', newChatInput.value.trim());
                    newChatInput.value = '';
                }
                e.stopPropagation();
            });

            newChatInput.addEventListener('focus', () => this.isChatting = true);
            newChatInput.addEventListener('blur', () => {
                this.isChatting = false;
                this.canvas.focus();
            });
        }

        this.socket.off('stick-arena:chat'); // Remove old listener
        this.socket.on('stick-arena:chat', (data) => {
            if (data.senderId !== this.socket.id) {
                this.addChatMessage('Opponent', data.message);
            }
        });
    }

    addChatMessage(sender, message) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const msgElement = document.createElement('div');
            msgElement.className = 'chat-msg';
            msgElement.innerHTML = `<span class="chat-sender">${sender}:</span> ${message}`;
            chatMessages.appendChild(msgElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    initOnlineGame() {
        // Create local player and remote player dummy
        if (this.myPlayerId === 1) {
            this.player1 = new Player(200, 300, '#00ffff', 1);
            this.player2 = new Player(1000, 300, '#ff00ff', 2);
        } else {
            this.player1 = new Player(1000, 300, '#00ffff', 2);
            this.player2 = new Player(200, 300, '#ff00ff', 1);
        }

        this.projectiles = [];
        this.powerups = [];
        this.particles = [];
        this.roundTime = CONFIG.ROUND_TIME;

        this.gameActive = true;
        this.gameLoop();
        this.spawnPowerup();
        this.syncInterval = setInterval(() => this.syncOnlineState(), 50);
    }

    syncOnlineState() {
        if (!this.socket || !this.gameActive || this.gameMode !== 'online') return;

        // Send our player state to server
        this.socket.emit('stick-arena:playerUpdate', {
            playerId: this.myPlayerId,
            state: {
                x: this.player1.x,
                y: this.player1.y,
                vx: this.player1.vx,
                vy: this.player1.vy,
                health: this.player1.health,
                facingRight: this.player1.facingRight
            }
        });
    }

    initGame() {
        // Create players
        this.player1 = new Player(200, 300, '#00ffff', 1);
        this.player2 = new Player(1000, 300, '#ff00ff', 2);

        this.projectiles = [];
        this.powerups = [];
        this.particles = [];
        this.roundTime = CONFIG.ROUND_TIME;

        this.gameActive = true;
        this.gameLoop();
        this.spawnPowerup();
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
            if (this.isChatting) return; // Don't move if chatting

            this.keys[e.key.toLowerCase()] = true;

            // Player 1 controls
            if (e.key === ' ' && this.gameActive) {
                e.preventDefault();
                this.player1.useItem(this); // SPACE uses item
            }
            if (e.key.toLowerCase() === 'q' && this.gameActive) {
                this.player1.switchItemPrev(); // Q = previous item
            }
            if (e.key.toLowerCase() === 'e' && this.gameActive) {
                this.player1.switchItemNext(); // E = next item
            }
            if (e.key === 'Shift' && this.gameActive) {
                e.preventDefault();
                this.player1.dash(this); // SHIFT = dash
            }

            // Player 2 controls
            if (e.key === 'Enter' && this.gameActive) {
                e.preventDefault();
                this.player2.useItem(this); // ENTER uses item
            }
            if (e.key === '/' && this.gameActive) {
                this.player2.switchItemPrev(); // / = previous item
            }
            if (e.key.toLowerCase() === 'rshift' && this.gameActive) {
                this.player2.switchItemNext(); // Right SHIFT = next item
            }
            if (e.key === 'Control' && this.gameActive) {
                this.player2.dash(this); // CTRL = dash
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
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

        // Update players
        this.player1.update(this);
        this.player2.update(this);

        // Update projectiles
        this.projectiles = this.projectiles.filter(p => {
            const target = p.owner === 1 ? this.player2 : this.player1;
            p.update(target);

            // Check collision with players
            if (p.owner !== 1 && this.checkCollision(p, this.player1)) {
                if (!p.hitTargets.has(this.player1.id)) {
                    this.player1.takeDamage(CONFIG.PROJECTILE_DAMAGE, this);
                    this.createHitParticles(p.x, p.y, '#ff0000');
                    p.hitTargets.add(this.player1.id);
                    if (!p.piercing) return false;
                }
            }
            if (p.owner !== 2 && this.checkCollision(p, this.player2)) {
                if (!p.hitTargets.has(this.player2.id)) {
                    this.player2.takeDamage(CONFIG.PROJECTILE_DAMAGE, this);
                    this.createHitParticles(p.x, p.y, '#ff0000');
                    p.hitTargets.add(this.player2.id);
                    if (!p.piercing) return false;
                }
            }

            return p.life > 0 && p.x > 0 && p.x < CONFIG.CANVAS_WIDTH && p.y > 0 && p.y < CONFIG.CANVAS_HEIGHT;
        });

        // Update powerups/items
        this.powerups = this.powerups.filter(p => {
            if (this.checkCollision(p, this.player1)) {
                if (this.player1.pickupItem(p.type)) {
                    this.createHitParticles(p.x, p.y, ITEMS[p.type].color);
                    return false; // Remove item
                }
                return true; // Keep item if inventory full
            }
            if (this.checkCollision(p, this.player2)) {
                if (this.player2.pickupItem(p.type)) {
                    this.createHitParticles(p.x, p.y, ITEMS[p.type].color);
                    return false; // Remove item
                }
                return true; // Keep item if inventory full
            }
            return true;
        });

        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });

        // Check for round end
        if (this.player1.health <= 0 || this.player2.health <= 0) {
            this.endRound();
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

    endRound() {
        this.gameActive = false;

        if (this.player1.health > this.player2.health) {
            this.scores.p1++;
            this.showAnnouncement('PLAYER 1 WINS!');
        } else {
            this.scores.p2++;
            this.showAnnouncement('PLAYER 2 WINS!');
        }

        document.getElementById('score-p1').textContent = this.scores.p1;
        document.getElementById('score-p2').textContent = this.scores.p2;

        setTimeout(() => this.initGame(), 3000);
    }

    showAnnouncement(text) {
        const announcement = document.getElementById('round-announcement');
        announcement.textContent = text;
        announcement.classList.add('show');
        setTimeout(() => announcement.classList.remove('show'), 2000);
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Draw grid background
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < CONFIG.CANVAS_WIDTH; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
            this.ctx.stroke();
        }
        for (let y = 0; y < CONFIG.CANVAS_HEIGHT; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
            this.ctx.stroke();
        }

        // Draw platforms
        this.platforms.forEach(platform => {
            this.ctx.fillStyle = '#0f4c75';
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        });

        // Draw powerups
        this.powerups.forEach(p => p.draw(this.ctx));

        // Draw particles
        this.particles.forEach(p => p.draw(this.ctx));

        // Draw projectiles
        this.projectiles.forEach(p => p.draw(this.ctx));

        // Draw players
        this.player1.draw(this.ctx);
        this.player2.draw(this.ctx);
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}
