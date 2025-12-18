import { CONFIG } from '../config.js';
import { Projectile } from '../entities/Projectile.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.userId = null;
        this.roomId = null;
        this.myPlayerId = null;
        this.opponentId = null;
    }

    connect() {
        if (!window.io) {
            alert('Socket.io not loaded. Please ensure the server is running!');
            return;
        }

        // Get User ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.userId = urlParams.get('userId') || 'Guest_' + Math.floor(Math.random() * 1000);

        console.log(`[Network] Connecting to ${CONFIG.SERVER_URL} as ${this.userId}`);

        this.socket = io(CONFIG.SERVER_URL);
        this.setupSocketListeners();
        this.setupChatListeners();
    }

    setupChatListeners() {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            // Remove old listeners to avoid duplicates if called multiple times
            const newChatInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newChatInput, chatInput);

            newChatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && newChatInput.value.trim() !== '') {
                    this.socket.emit('stick-arena:chat', { message: newChatInput.value.trim() });
                    this.game.menuManager.addChatMessage('Me', newChatInput.value.trim());
                    newChatInput.value = '';
                }
                e.stopPropagation();
            });

            newChatInput.addEventListener('focus', () => this.game.isChatting = true);
            newChatInput.addEventListener('blur', () => {
                this.game.isChatting = false;
                this.game.canvas.focus();
            });
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            this.socket.emit('stick-arena:join', { userId: this.userId });
        });

        this.socket.on('stick-arena:joined', () => {
            console.log('Joined stick arena');
            this.socket.emit('stick-arena:findMatch', { userId: this.socket.id });
        });

        this.socket.on('stick-arena:waiting', (data) => {
            this.game.menuManager.showAnnouncement('SEARCHING FOR OPPONENT...');
        });

        this.socket.on('stick-arena:matchFound', (data) => {
            console.log('Match found!', data);
            this.myPlayerId = data.playerId;
            this.opponentId = data.opponentId;
            this.roomId = data.roomId;
            this.game.onMatchFound(data);
        });

        this.socket.on('stick-arena:opponentMoved', (state) => {
            if (this.game.gameMode === 'online' && this.game.gameActive && state.playerId === this.opponentId && this.game.player2) {
                this.game.player2.x = state.x;
                this.game.player2.y = state.y;
                this.game.player2.vx = state.vx;
                this.game.player2.vy = state.vy;
                this.game.player2.health = state.health;
                this.game.player2.facingRight = state.facingRight;
            }
        });

        this.socket.on('stick-arena:playerMelee', (data) => {
            if (data.playerId !== this.myPlayerId) {
                this.game.player2.meleeActive = true;
                setTimeout(() => this.game.player2.meleeActive = false, 200);
            }
        });

        this.socket.on('stick-arena:projectileCreated', (projectile) => {
            if (projectile.owner !== this.myPlayerId) {
                this.game.projectiles.push(new Projectile(
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
                this.game.player1.takeDamage(data.damage, this.game);
            }
        });

        this.socket.on('stick-arena:roundEnd', (data) => {
            const isWin = data.winnerId === this.myPlayerId;
            this.game.onRoundEnd(isWin);
        });

        this.socket.on('stick-arena:opponentDisconnected', () => {
            this.game.onOpponentDisconnected();
        });

        this.socket.on('stick-arena:chat', (data) => {
            if (data.senderId !== this.socket.id) {
                this.game.menuManager.addChatMessage('Opponent', data.message);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    sendPlayerUpdate(playerState) {
        if (!this.socket) return;
        this.socket.emit('stick-arena:playerUpdate', {
            playerId: this.myPlayerId,
            state: playerState
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
