const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8080;

app.use(express.static(__dirname));

// Store connected players and basic matchmaking
const players = new Map(); // socket.id -> { id, userId, socket, roomId }
const rooms = new Map();
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join
    socket.on('stick-arena:join', (data) => {
        players.set(socket.id, {
            id: socket.id,
            userId: data.userId,
            socket: socket,
            roomId: null
        });
        socket.emit('stick-arena:joined');
        console.log(`[Socket] User ${data.userId} joined with ID ${socket.id}`);
    });

    // Matchmaking
    socket.on('stick-arena:findMatch', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Match found
            const roomId = `room_${Date.now()}`;
            const room = {
                id: roomId,
                p1: waitingPlayer,
                p2: socket
            };
            rooms.set(roomId, room);

            // Update players
            const p1Data = players.get(waitingPlayer.id);
            const p2Data = players.get(socket.id);
            if (p1Data) p1Data.roomId = roomId;
            if (p2Data) p2Data.roomId = roomId;

            // Join socket rooms
            waitingPlayer.join(roomId);
            socket.join(roomId);

            // Notify P1
            waitingPlayer.emit('stick-arena:matchFound', {
                roomId,
                playerId: 1,
                opponentId: 2
            });

            // Notify P2
            socket.emit('stick-arena:matchFound', {
                roomId,
                playerId: 2,
                opponentId: 1
            });

            waitingPlayer = null;
            console.log(`[Matchmaking] Match started in ${roomId}`);
        } else {
            waitingPlayer = socket;
            socket.emit('stick-arena:waiting', { message: 'Waiting for opponent...' });
            console.log(`[Matchmaking] ${socket.id} waiting for match`);
        }
    });

    // Movement/Physics Update
    socket.on('stick-arena:playerUpdate', (data) => {
        // Relay to opponent
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('stick-arena:opponentMoved', {
                ...data.state,
                playerId: data.playerId
            });
        }
    });

    // Attacks
    socket.on('stick-arena:playerMelee', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('stick-arena:playerMelee', data);
        }
    });

    socket.on('stick-arena:shoot', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('stick-arena:projectileCreated', data.projectile);
        }
    });

    // Damage
    socket.on('stick-arena:playerDamaged', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('stick-arena:playerDamaged', data);
        }
    });

    // Round Logic
    socket.on('stick-arena:roundEnd', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            io.to(roomId).emit('stick-arena:roundEnd', data);
        }
    });

    // Chat
    socket.on('stick-arena:chat', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            io.to(roomId).emit('stick-arena:chat', {
                senderId: socket.id,
                message: data.message
            });
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }

        const roomId = getRoomId(socket);
        if (roomId) {
            io.to(roomId).emit('stick-arena:opponentDisconnected');
            rooms.delete(roomId);
        }
        players.delete(socket.id);
    });
});

function getRoomId(socket) {
    const p = players.get(socket.id);
    return p ? p.roomId : null;
}

server.listen(PORT, () => {
    console.log(`🎮 Stick Fighting Arena server running on http://localhost:${PORT}`);
    console.log(`Ready for players!`);
});
