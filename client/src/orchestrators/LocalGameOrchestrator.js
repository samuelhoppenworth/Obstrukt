// src/orchestrators/LocalGameOrchestrator.js
import * as GameLogic from '../../../common/GameLogic.js';
import SimpleHeuristicAI from '../ai/SimpleHeuristicAI.js';
import AIController from '../controllers/AIController.js';
import HumanController from '../controllers/HumanController.js';

export default class LocalGameOrchestrator {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.players = config.players;
        this.history = [];
        this.viewingHistoryIndex = -1;

        this.gameState = {
            status: 'active', winner: null, reason: null,
            playerTurn: config.players[0].id,
            // --- FIX: Call the startPos function to get dynamic positions ---
            pawnPositions: config.players.reduce((acc, p) => { acc[p.id] = p.startPos(config.boardSize); return acc; }, {}),
            wallsLeft: config.players.reduce((acc, p) => { acc[p.id] = config.wallsPerPlayer; return acc; }, {}),
            timers: config.players.reduce((acc, p) => { acc[p.id] = config.timePerPlayer; return acc; }, {}),
            placedWalls: [], availablePawnMoves: [],
            activePlayerIds: config.players.map(p => p.id),
            playerTurnIndex: 0,
        };

        this.#recalculateMoves();
        this.#recordHistory();
    }

    initialize() {
        // Instantiate controllers based on player types from menu
        this.scene.controllers = {};
        for (const player of this.players) {
            if (this.config.playerTypes[player.id] === 'human') {
                this.scene.controllers[player.id] = new HumanController(this.scene);
            } else if (this.config.playerTypes[player.id] === 'ai') {
                this.scene.controllers[player.id] = new AIController(this.scene, new SimpleHeuristicAI(), this);
            }
        }
        
        // Setup local event listeners
        this.scene.events.on('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.on('wall-hover-out', () => this.scene.renderer.clearWallHighlight());
        this.scene.events.on('history-navigate', this.navigateHistory, this);
        this.scene.events.on('human-action-input', this.handleMoveRequest, this);

        // Emit the first state update to the scene
        this.scene.onStateUpdate(this.getGameState());
    }

    update(delta) {
        if (this.gameState.status !== 'active') return;

        const currentPlayerId = this.gameState.playerTurn;
        this.gameState.timers[currentPlayerId] -= delta;
        this.scene.uiManager.updateTimers(this.gameState.timers);

        if (this.gameState.timers[currentPlayerId] <= 0) {
            this.handlePlayerLoss(currentPlayerId, 'timeout');
        }
    }

    handleMoveRequest(move) {
        if (this.isViewingHistory() || !move || !move.type || this.gameState.status !== 'active') return;
        
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
            this.scene.onStateUpdate(this.getGameState());
        } else {
             // If the move was illegal, and it's a human's turn, immediately re-prompt for a move.
             const currentPlayerId = this.gameState.playerTurn;
             const currentController = this.scene.controllers[currentPlayerId];
             if (currentController instanceof HumanController) {
                 this.scene.startTurn(this.getGameState());
             }
        }
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
    
    getGameState() { return JSON.parse(JSON.stringify(this.gameState)); }

    onWallHoverIn(wallProps) {
        const isLegal = GameLogic.isWallPlacementLegal(wallProps, this.gameState, this.players, this.config.boardSize);
        this.scene.renderer.highlightWallSlot(wallProps, isLegal);
    }

    isViewingHistory() {
        return this.viewingHistoryIndex >= 0 && this.viewingHistoryIndex < this.history.length - 1;
    }

    navigateHistory(direction) {
        let newIndex = this.viewingHistoryIndex;
        switch (direction) {
            case 'start': newIndex = 0; break;
            case 'prev': if (this.viewingHistoryIndex > 0) newIndex--; break;
            case 'next': if (this.viewingHistoryIndex < this.history.length - 1) newIndex++; break;
            case 'end': newIndex = this.history.length - 1; break;
        }

        if (newIndex !== this.viewingHistoryIndex) {
            this.viewingHistoryIndex = newIndex;
            const historicState = this.history[this.viewingHistoryIndex];
            this.scene.onStateUpdate(historicState, true); // Pass flag to indicate this is a history view
        }
    }

    #recordHistory() {
        if (this.isViewingHistory()) {
            this.history.splice(this.viewingHistoryIndex + 1);
        }
        this.history.push(this.getGameState());
        this.viewingHistoryIndex = this.history.length - 1;
    }
}