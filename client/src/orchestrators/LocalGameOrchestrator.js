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

        // --- Initialize Game State ---
        this.gameState = {
            status: 'active', winner: null, reason: null,
            playerTurn: config.players[0].id,
            pawnPositions: config.players.reduce((acc, p) => { acc[p.id] = p.startPos(config.boardSize); return acc; }, {}),
            wallsLeft: config.players.reduce((acc, p) => { acc[p.id] = config.wallsPerPlayer; return acc; }, {}),
            timers: config.players.reduce((acc, p) => { acc[p.id] = config.timePerPlayer; return acc; }, {}),
            placedWalls: [],
            availablePawnMoves: [],
            activePlayerIds: config.players.map(p => p.id),
            playerTurnIndex: 0,
        };

        // Calculate initial moves using the centralized logic
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

    initialize() {
        this.scene.controllers = {};
        for (const player of this.players) {
            const playerType = this.config.playerTypes[player.id];
            if (playerType === 'human') {
                this.scene.controllers[player.id] = new HumanController(this.scene);
            } else if (playerType === 'ai') {
                this.scene.controllers[player.id] = new AIController(this.scene, new SimpleHeuristicAI(), this);
            }
        }
        
        this.scene.events.on('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.on('wall-hover-out', () => this.scene.renderer.clearWallHighlight());
        this.scene.events.on('history-navigate', this.navigateHistory, this);
        this.scene.events.on('human-action-input', this.handleMoveRequest, this);

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
        if (this.isViewingHistory() || this.gameState.status !== 'active') return;
        
        // Delegate move processing and validation to the centralized GameLogic
        const newGameState = GameLogic.applyMove(this.getGameState(), move, this.players, this.config);

        if (newGameState) {
            this.gameState = newGameState;
            this.#recordHistory();
            this.scene.onStateUpdate(this.getGameState());
        } else {
             // If move was illegal, re-prompt human player
             const currentPlayerId = this.gameState.playerTurn;
             const currentController = this.scene.controllers[currentPlayerId];
             if (currentController instanceof HumanController) {
                 this.scene.startTurn(this.getGameState());
             }
        }
    }

    handlePlayerLoss(losingPlayerId, reason) {
        if (this.gameState.status !== 'active') return;

        // Delegate player loss processing to the centralized GameLogic
        const newGameState = GameLogic.applyPlayerLoss(this.getGameState(), losingPlayerId, reason);

        if (this.gameState !== newGameState) {
            this.gameState = newGameState;
            
            // If game continues, we must recalculate moves
            if (this.gameState.status === 'active') {
                 this.gameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
                    this.gameState.pawnPositions, this.gameState.placedWalls,
                    this.players, this.gameState.activePlayerIds,
                    this.gameState.playerTurnIndex, this.config.boardSize
                );
            }
            
            this.#recordHistory();
            this.scene.onStateUpdate(this.getGameState());
        }
    }
    
    getGameState() { 
        return JSON.parse(JSON.stringify(this.gameState)); 
    }

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
            this.scene.onStateUpdate(historicState, true);
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