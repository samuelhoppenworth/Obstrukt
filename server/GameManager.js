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
            placedWalls: [],
            availablePawnMoves: [],
            activePlayerIds: config.players.map(p => p.id),
            playerTurnIndex: 0,
            drawOfferFrom: null,
        };

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
        
        this.gameState.drawOfferFrom = null;

        const newGameState = GameLogic.applyMove(this.gameState, move, this.players, this.config);

        if (newGameState) {
            this.gameState = newGameState;
            this.#recordHistory();
            this.scene.events.emit('game-state-updated', this.getGameState());
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
        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    handlePlayerLoss(losingPlayerId, reason) {
        if (this.gameState.status !== 'active') return;

        const newGameState = GameLogic.applyPlayerLoss(this.gameState, losingPlayerId, reason);

        if (this.gameState !== newGameState) {
            this.gameState = newGameState;

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

    getGameState() {
        return {
            status: this.gameState.status, winner: this.gameState.winner, reason: this.gameState.reason,
            playerTurn: this.gameState.playerTurn, pawnPositions: this.gameState.pawnPositions,
            wallsLeft: this.gameState.wallsLeft, timers: this.gameState.timers,
            placedWalls: this.gameState.placedWalls, availablePawnMoves: this.gameState.availablePawnMoves,
            drawOfferFrom: this.gameState.drawOfferFrom,
        };
    }

    #recordHistory() {
        this.history.push(this.getGameState());
    }
}