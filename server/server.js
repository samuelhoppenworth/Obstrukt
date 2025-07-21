// server/server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import GameManager from './gameManager.js';
import { ALL_PLAYERS } from './gameConfig.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const matchmakingQueues = {
    '2': [],
    '4': [],
};
const rooms = {};

const createNewGame = (sockets, numPlayers) => {
    const roomName = `room-${sockets.map(s => s.id.slice(0, 4)).join('-')}`;
    console.log(`Match found. Creating ${numPlayers}-player game in room: ${roomName}`);

    const playersForGame = numPlayers === 2
        ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] // P1 vs P3 for 2-player
        : ALL_PLAYERS.slice(0, 4);        // P1, P2, P3, P4 for 4-player

    const playerMap = {};
    sockets.forEach((socket, i) => {
        socket.join(roomName);
        playerMap[socket.id] = playersForGame[i].id;
    });

    const config = {
        numPlayers: numPlayers,
        players: playersForGame,
        wallsPerPlayer: numPlayers === 2 ? 10 : 5,
        timePerPlayer: 5 * 60 * 1000,
        boardSize: 9,
    };

    const gameSceneEmitter = { events: { emit: (event, data) => io.to(roomName).emit(event, data) }};
    const gameManager = new GameManager(gameSceneEmitter, config);
    
    rooms[roomName] = {
        players: playerMap,
        gameManager: gameManager,
    };

    io.to(roomName).emit('gameStart', {
        room: roomName,
        playerMap: playerMap,
        initialState: gameManager.getGameState(),
        config: config
    });

    gameManager.startServerTimer();
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('findGame', ({ numPlayers }) => {
        const queueName = numPlayers.toString();
        if (!matchmakingQueues[queueName]) {
            return socket.emit('error', 'Invalid game mode requested.');
        }

        console.log(`Player ${socket.id} is looking for a ${queueName}-player game.`);
        socket.emit('waiting', `Waiting for ${numPlayers - 1} more player(s)...`);
        
        const queue = matchmakingQueues[queueName];
        queue.push(socket);

        if (queue.length >= numPlayers) {
            const playersForGame = queue.splice(0, numPlayers);
            createNewGame(playersForGame, numPlayers);
        }
    });

    socket.on('requestMove', (moveData) => {
        const roomName = Array.from(socket.rooms)[1];
        if (!roomName || !rooms[roomName]) return;

        const { gameManager, players } = rooms[roomName];
        const playerRole = players[socket.id];
        
        if (playerRole === gameManager.gameState.playerTurn) {
            gameManager.handleMoveRequest(moveData);
        } else {
            socket.emit('error', 'Not your turn.');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove from any queue they might be in
        for (const queueName in matchmakingQueues) {
            matchmakingQueues[queueName] = matchmakingQueues[queueName].filter(s => s.id !== socket.id);
        }
        
        // Handle disconnect if they are in an active game
        const roomName = Object.keys(rooms).find(r => rooms[r] && Object.keys(rooms[r].players).includes(socket.id));
        if (roomName && rooms[roomName]) {
            const { gameManager, players } = rooms[roomName];
            const playerRole = players[socket.id];

            if (gameManager.gameState.status === 'active') {
                console.log(`Player ${playerRole} disconnected from active game in ${roomName}.`);
                // Use the resign logic to handle their departure
                gameManager.handlePlayerLoss(playerRole, 'disconnection');
            }

            // If the room is empty after disconnect, clean it up
            const remainingPlayers = Object.keys(players).filter(pid => pid !== socket.id);
            if (remainingPlayers.length === 0) {
                console.log(`Room ${roomName} is empty, deleting.`);
                delete rooms[roomName];
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));