const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(__dirname));

// Game state
const rooms = new Map();
let waitingPlayer = null;

class GameRoom {
    constructor(player1Socket, player2Socket) {
        this.id = `room_${Date.now()}`;
        this.player1 = { socket: player1Socket, ready: false };
        this.player2 = { socket: player2Socket, ready: false };
        this.gameState = {
            players: {},
            projectiles: [],
            powerups: []
        };
    }

    broadcast(event, data) {
        this.player1.socket.emit(event, data);
        this.player2.socket.emit(event, data);
    }

    updatePlayerState(playerId, state) {
        this.gameState.players[playerId] = state;
        this.broadcast('gameState', this.gameState);
    }
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Matchmaking
    socket.on('findMatch', () => {
        if (waitingPlayer === null) {
            waitingPlayer = socket;
            socket.emit('waiting', { message: 'Waiting for opponent...' });
        } else {
            // Create a new game room
            const room = new GameRoom(waitingPlayer, socket);
            rooms.set(room.id, room);

            // Notify both players
            waitingPlayer.join(room.id);
            socket.join(room.id);

            waitingPlayer.emit('matchFound', {
                roomId: room.id,
                playerId: 1,
                opponentId: socket.id
            });

            socket.emit('matchFound', {
                roomId: room.id,
                playerId: 2,
                opponentId: waitingPlayer.id
            });

            waitingPlayer = null;
        }
    });

    // Player updates
    socket.on('playerUpdate', (data) => {
        const room = findRoomBySocket(socket);
        if (room) {
            room.updatePlayerState(data.playerId, data.state);
        }
    });

    // Player shoots
    socket.on('shoot', (data) => {
        const room = findRoomBySocket(socket);
        if (room) {
            room.gameState.projectiles.push(data.projectile);
            room.broadcast('projectileCreated', data.projectile);
        }
    });

    // Player melee attack
    socket.on('melee', (data) => {
        const room = findRoomBySocket(socket);
        if (room) {
            room.broadcast('playerMelee', data);
        }
    });

    // Damage event
    socket.on('playerDamaged', (data) => {
        const room = findRoomBySocket(socket);
        if (room) {
            room.broadcast('playerDamaged', data);
        }
    });

    // Round end
    socket.on('roundEnd', (data) => {
        const room = findRoomBySocket(socket);
        if (room) {
            room.broadcast('roundEnd', data);
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }

        const room = findRoomBySocket(socket);
        if (room) {
            room.broadcast('opponentDisconnected', {
                message: 'Opponent disconnected'
            });
            rooms.delete(room.id);
        }
    });
});

function findRoomBySocket(socket) {
    for (const room of rooms.values()) {
        if (room.player1.socket === socket || room.player2.socket === socket) {
            return room;
        }
    }
    return null;
}

// Start server
server.listen(PORT, () => {
    console.log(`🎮 Stick Fighting Arena server running on http://localhost:${PORT}`);
    console.log(`Ready for players!`);
});
