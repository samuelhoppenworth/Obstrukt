// server/GameManager.js
import * as GameLogic from '../common/GameLogic.js';

export default class GameManager {
    constructor(emitter, config) {
        this.emitter = emitter; // The emitter sends events via socket.io
        this.config = config;
        this.players = config.players;
        this.timerInterval = null;
        this.history = [];

        // Create the initial state using the shared game logic
        this.gameState = GameLogic.createInitialState(this.config);
        
        // Calculate initial available moves
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
            this.emitter.emit('timers-updated', this.gameState.timers);

            if (this.gameState.timers[currentPlayerId] <= 0) {
                this.handlePlayerLoss(currentPlayerId, 'timeout');
            }
        }, 1000);
    }
    
    handleMoveRequest(move) {
        if (this.gameState.status !== 'active') return false;
        
        this.gameState.drawOfferFrom = null;

        // Use the shared game logic to apply the move
        const newGameState = GameLogic.applyMove(this.gameState, move, this.players, this.config);

        if (newGameState) {
            this.gameState = newGameState;
            this.#recordHistory();
            this.emitter.emit('game-state-updated', this.getGameState());
            return true;
        }
        
        return false;
    }

    endGameAsDraw(reason) {
        if (this.gameState.status !== 'active') return;
        this.gameState.status = 'ended';
        this.gameState.winner = null;
        this.gameState.reason = reason;
        this.gameState.playerTurn = null;
        this.gameState.drawOfferFrom = null;
        this.#recordHistory();
        this.emitter.emit('game-state-updated', this.getGameState());
    }

    handlePlayerLoss(losingPlayerId, reason) {
        if (this.gameState.status !== 'active') return;

        // Use the shared game logic to handle player loss
        const newGameState = GameLogic.applyPlayerLoss(this.gameState, losingPlayerId, reason);

        if (this.gameState !== newGameState) {
            this.gameState = newGameState;

            // Recalculate legal moves if the game is still active
            if (this.gameState.status === 'active') {
                 this.gameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
                    this.gameState.pawnPositions, this.gameState.placedWalls,
                    this.players, this.gameState.activePlayerIds,
                    this.gameState.playerTurnIndex, this.config.boardSize
                );
            }
            
            this.#recordHistory();
            this.emitter.emit('game-state-updated', this.getGameState());
        }
    }

    getGameState() {
        // Return a clean, serializable version of the state for clients
        return {
            status: this.gameState.status, winner: this.gameState.winner, reason: this.gameState.reason,
            playerTurn: this.gameState.playerTurn, pawnPositions: this.gameState.pawnPositions,
            wallsLeft: this.gameState.wallsLeft, timers: this.gameState.timers,
            placedWalls: this.gameState.placedWalls, availablePawnMoves: this.gameState.availablePawnMoves,
            activePlayerIds: this.gameState.activePlayerIds,
            drawOfferFrom: this.gameState.drawOfferFrom,
        };
    }

    #recordHistory() {
        this.history.push(JSON.parse(JSON.stringify(this.gameState)));
    }
}