// server/GameManager.js
import * as GameLogic from '../common/GameLogic.js';

export default class GameManager {
    constructor(scene, config) {
        this.scene = scene; // The scene is an event emitter for socket.io
        this.config = config;
        this.players = config.players;
        this.timerInterval = null;
        this.history = [];

        this.gameState = {
            status: 'active', winner: null, reason: null,
            playerTurn: config.players[0].id,
            pawnPositions: config.players.reduce((acc, p) => { acc[p.id] = { ...p.startPos }; return acc; }, {}),
            wallsLeft: config.players.reduce((acc, p) => { acc[p.id] = config.wallsPerPlayer; return acc; }, {}),
            timers: config.players.reduce((acc, p) => { acc[p.id] = config.timePerPlayer; return acc; }, {}),
            placedWalls: [], availablePawnMoves: [],
            activePlayerIds: config.players.map(p => p.id),
            playerTurnIndex: 0,
        };

        this.#recalculateMoves();
        this.#recordHistory();
    }

    startServerTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.gameState.status !== 'active') {
                clearInterval(this.timerInterval);
                return;
            }

            const currentPlayerId = this.gameState.playerTurn;
            this.gameState.timers[currentPlayerId] -= 1000;
            this.scene.events.emit('timers-updated', this.gameState.timers);

            if (this.gameState.timers[currentPlayerId] <= 0) {
                this.handlePlayerLoss(currentPlayerId, 'timeout');
            }
        }, 1000);
    }
    
    handleMoveRequest(move) {
        if (!move || !move.type || this.gameState.status !== 'active') return false;

        let isLegal = false;
        switch (move.type) {
            case 'cell':
                isLegal = GameLogic.isPawnMoveLegal(move.data, this.gameState.availablePawnMoves);
                if (isLegal) this.#movePawn(move.data);
                break;
            case 'wall':
                isLegal = GameLogic.isWallPlacementLegal(move.data, this.gameState, this.players, this.config.boardSize);
                if(isLegal) this.#placeWall(move.data);
                break;
            case 'resign':
                this.resignGame();
                isLegal = true;
                break;
        }

        if (isLegal) {
            this.#recordHistory();
            this.scene.events.emit('game-state-updated', this.getGameState());
        }
        return isLegal;
    }

    #movePawn({ row, col }) {
        const currentPlayerId = this.gameState.playerTurn;
        this.gameState.pawnPositions[currentPlayerId] = { row, col };
        
        const currentPlayer = this.players.find(p => p.id === currentPlayerId);
        if (currentPlayer.goalCondition(row, col, this.config.boardSize)) {
            this.gameState.status = 'ended';
            this.gameState.winner = currentPlayerId;
            this.gameState.reason = 'goal';
        } else {
            this.#switchTurn();
        }
    }

    #placeWall(wallData) {
        const currentPlayerId = this.gameState.playerTurn;
        this.gameState.placedWalls.push(wallData);
        this.gameState.wallsLeft[currentPlayerId]--;
        this.#switchTurn();
    }

    handlePlayerLoss(losingPlayerId, reason) {
        if (this.gameState.status !== 'active') return;

        const loserIndex = this.gameState.activePlayerIds.indexOf(losingPlayerId);
        if (loserIndex > -1) {
            this.gameState.activePlayerIds.splice(loserIndex, 1);
            this.gameState.pawnPositions[losingPlayerId] = { row: -1, col: -1 };
        }
        
        if (this.gameState.activePlayerIds.length <= 1) {
            const winnerId = this.gameState.activePlayerIds[0] || null;
            this.gameState.status = 'ended';
            this.gameState.winner = winnerId;
            this.gameState.reason = winnerId ? reason : 'draw';
            this.gameState.playerTurn = null;
        } else {
            if (this.gameState.playerTurnIndex >= loserIndex) {
                 this.gameState.playerTurnIndex %= this.gameState.activePlayerIds.length;
            }
            this.gameState.playerTurn = this.gameState.activePlayerIds[this.gameState.playerTurnIndex];
            this.#recalculateMoves();
        }

        // We emit the full state change here
        this.#recordHistory();
        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    resignGame() {
        this.handlePlayerLoss(this.gameState.playerTurn, 'resignation');
    }

    #switchTurn() {
        this.gameState.playerTurnIndex = (this.gameState.playerTurnIndex + 1) % this.gameState.activePlayerIds.length;
        this.gameState.playerTurn = this.gameState.activePlayerIds[this.gameState.playerTurnIndex];
        this.#recalculateMoves();
    }

    #recalculateMoves() {
        this.gameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
            this.gameState.pawnPositions,
            this.gameState.placedWalls,
            this.players,
            this.gameState.activePlayerIds,
            this.gameState.playerTurnIndex,
            this.config.boardSize
        );
    }
    
    getGameState() {
        console.log({
            status: this.gameState.status, winner: this.gameState.winner, reason: this.gameState.reason,
            playerTurn: this.gameState.playerTurn, pawnPositions: this.gameState.pawnPositions,
            wallsLeft: this.gameState.wallsLeft, timers: this.gameState.timers,
            placedWalls: this.gameState.placedWalls, availablePawnMoves: this.gameState.availablePawnMoves,
        });
        return {
            status: this.gameState.status, winner: this.gameState.winner, reason: this.gameState.reason,
            playerTurn: this.gameState.playerTurn, pawnPositions: this.gameState.pawnPositions,
            wallsLeft: this.gameState.wallsLeft, timers: this.gameState.timers,
            placedWalls: this.gameState.placedWalls, availablePawnMoves: this.gameState.availablePawnMoves,
        };
    }

    #recordHistory() {
        this.history.push(this.getGameState());
    }
}