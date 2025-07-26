// server/GameManager.js
import * as GameLogic from '../common/GameLogic.js';

export default class GameManager {
    constructor(scene, config) {
        this.scene = scene; // The scene is an event emitter for socket.io
        this.config = config;
        this.players = config.players;
        this.timerInterval = null;
        this.history = [];

        // --- Initialize Game State ---
        this.gameState = {
            status: 'active', winner: null, reason: null,
            playerTurn: config.players[0].id,
            pawnPositions: config.players.reduce((acc, p) => { acc[p.id] = { ...p.startPos }; return acc; }, {}),
            wallsLeft: config.players.reduce((acc, p) => { acc[p.id] = config.wallsPerPlayer; return acc; }, {}),
            timers: config.players.reduce((acc, p) => { acc[p.id] = config.timePerPlayer; return acc; }, {}),
            placedWalls: [],
            availablePawnMoves: [], // Will be calculated next
            activePlayerIds: config.players.map(p => p.id),
            playerTurnIndex: 0,
        };

        // Calculate initial moves
        this.gameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
            this.gameState.pawnPositions,
            this.gameState.placedWalls,
            this.players,
            this.gameState.activePlayerIds,
            this.gameState.playerTurnIndex,
            this.config.boardSize
        );

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
        if (this.gameState.status !== 'active') return false;

        // Delegate move processing and validation to the centralized GameLogic
        const newGameState = GameLogic.applyMove(this.gameState, move, this.players, this.config);

        if (newGameState) {
            this.gameState = newGameState;
            this.#recordHistory();
            this.scene.events.emit('game-state-updated', this.getGameState());
            return true;
        }
        
        // Move was illegal if newGameState is null
        return false;
    }

    handlePlayerLoss(losingPlayerId, reason) {
        if (this.gameState.status !== 'active') return;

        // Delegate player loss processing to the centralized GameLogic
        const newGameState = GameLogic.applyPlayerLoss(this.gameState, losingPlayerId, reason);

        if (this.gameState !== newGameState) {
            this.gameState = newGameState;

            // If game continues, we must recalculate moves for the new current player
            if (this.gameState.status === 'active') {
                 this.gameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
                    this.gameState.pawnPositions, this.gameState.placedWalls,
                    this.players, this.gameState.activePlayerIds,
                    this.gameState.playerTurnIndex, this.config.boardSize
                );
            }
            
            this.#recordHistory();
            this.scene.events.emit('game-state-updated', this.getGameState());
        }
    }

    // resignGame is just a specific case of handlePlayerLoss, but initiated by the player themselves
    resignGame() {
        this.handleMoveRequest({ type: 'resign' });
    }

    getGameState() {
        // Return a clean, serializable version of the state
        return {
            status: this.gameState.status, winner: this.gameState.winner, reason: this.gameState.reason,
            playerTurn: this.gameState.playerTurn, pawnPositions: this.gameState.pawnPositions,
            wallsLeft: this.gameState.wallsLeft, timers: this.gameState.timers,
            placedWalls: this.gameState.placedWalls, availablePawnMoves: this.gameState.availablePawnMoves,
        };
    }

    #recordHistory() {
        // We only want to store the serializable part of the state in history
        this.history.push(this.getGameState());
    }
}