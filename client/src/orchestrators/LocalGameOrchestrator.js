// src/orchestrators/LocalGameOrchestrator.js
import * as GameLogic from '../../../common/GameLogic.js';
import AIController from '../controllers/AIController.js';
import HumanController from '../controllers/HumanController.js';

export default class LocalGameOrchestrator {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.players = config.players;
        this.history = [];
        this.viewingHistoryIndex = -1;
        this.controllers = {};
        this.isAIThinking = false;
        this.timerInterval = null; // To hold the setInterval reference

        const initialState = this.#createInitialState();
        initialState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
            initialState.pawnPositions, initialState.placedWalls,
            this.players, initialState.activePlayerIds, 0, this.config.boardSize
        );
        this.history.push(initialState);
        this.#recordHistory();
    }

    initialize() {
        for (const player of this.players) {
            const playerType = this.config.playerTypes[player.id];
            if (playerType === 'human') {
                this.controllers[player.id] = new HumanController(this.scene);
            } else if (playerType === 'ai') {
                const difficulty = this.config.playerDifficulties[player.id];
                this.controllers[player.id] = new AIController(this.scene, this, difficulty);
            }
        }
        
        this.scene.events.on('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.on('wall-hover-out', () => this.scene.renderer.clearWallHighlight());
        this.scene.events.on('history-navigate', this.navigateHistory, this);
        this.scene.events.on('resign-request', this.handleResignation, this);
        this.scene.events.on('human-action-input', (move) => this._handleHumanMove(move));
        
        this.scene.onStateUpdate(this.getGameState());
        this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, this.history.length - 1);

        // --- Start the game's background processes ---
        this._startTimers();
        this._requestNextMove();
    }

    onStateUpdated(gameState) {
        // This function is now just an event hook for the UI. The core logic is in `update`.
    }

    // The update loop is now only for potential future uses, not core game logic.
    update(delta) {}

    _handleHumanMove(move) {
        const baseState = this.history[this.viewingHistoryIndex];
        if (baseState.status !== 'active') return;

        // BUG FIX: Only process input if it's actually a human's turn.
        if (this.config.playerTypes[baseState.playerTurn] !== 'human') {
            return;
        }

        if (this.isViewingHistory()) {
            this.history.splice(this.viewingHistoryIndex + 1);
        }

        this._applyAndCommitMove(baseState, move);
        this._requestNextMove(); // After human moves, request the next (likely AI) move.
    }

    _handleAIMove(move) {
        const baseState = this.getCurrentGameState();
        if (baseState.status !== 'active') return;

        this._applyAndCommitMove(baseState, move);
        this._requestNextMove(); // After AI moves, request the next move in the chain.
    }
    
    _requestNextMove() {
        const currentState = this.getCurrentGameState();
        // Don't do anything if the game is over, we are browsing history, or an AI is already thinking.
        if (currentState.status !== 'active' || this.isViewingHistory() || this.isAIThinking) {
            return;
        }

        const currentPlayerId = currentState.playerTurn;
        const currentController = this.controllers[currentPlayerId];

        if (currentController instanceof AIController) {
            this.isAIThinking = true;
            
            currentController.getMove().then(move => {
                this.isAIThinking = false; // Free up the lock first

                // If the state changed while thinking (e.g., user resigned), abort.
                if (this.getCurrentGameState().playerTurn !== currentPlayerId || this.getCurrentGameState().status !== 'active') {
                    return;
                }
                
                if (move && move.type) {
                    this._handleAIMove(move);
                } else {
                    this.handlePlayerLoss(currentPlayerId, 'error');
                }
            });
        }
    }

    _applyAndCommitMove(baseState, move) {
        if (move.type === 'pawn') move.type = 'cell';

        const newGameState = GameLogic.applyMove(baseState, move, this.players, this.config);
        if (newGameState) {
            this.#commitNewGameState(newGameState);
        } else {
            console.warn("Illegal move blocked by orchestrator:", move);
            if (this.controllers[baseState.playerTurn] instanceof AIController) {
                this.handlePlayerLoss(baseState.playerTurn, 'illegal move');
            }
        }
    }

    _startTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            if (this.isViewingHistory() || this.scene.isGameOver) {
                return;
            }

            const currentState = this.getCurrentGameState();
            if (currentState.status !== 'active') return;

            const currentPlayerId = currentState.playerTurn;
            if (!currentPlayerId) return;

            currentState.timers[currentPlayerId] -= 1000;
            this.scene.uiManager.updateTimers(currentState.timers);

            if (currentState.timers[currentPlayerId] <= 0) {
                this.handlePlayerLoss(currentPlayerId, 'timeout');
            }
        }, 1000);
    }

    handleResignation() {
        const currentState = this.getCurrentGameState();
        if (currentState.status !== 'active') return;
        const currentPlayerId = currentState.playerTurn;
        if (this.config.playerTypes[currentPlayerId] === 'human') this.handlePlayerLoss(currentPlayerId, 'resignation');
    }

    handlePlayerLoss(losingPlayerId, reason) {
        const currentState = this.getCurrentGameState();
        if (currentState.status !== 'active') return;

        const newGameState = GameLogic.applyPlayerLoss(currentState, losingPlayerId, reason);
        if (currentState !== newGameState) {
            if (newGameState.status === 'active') {
                 newGameState.availablePawnMoves = GameLogic.calculateLegalPawnMoves(
                    newGameState.pawnPositions, newGameState.placedWalls,
                    this.players, newGameState.activePlayerIds,
                    newGameState.playerTurnIndex, this.config.boardSize
                );
            }
            this.#commitNewGameState(newGameState);
            // After a player is removed, immediately check if the new player is an AI
            this._requestNextMove();
        }
    }
    
    getGameState() { return JSON.parse(JSON.stringify(this.getCurrentGameState())); }

    getCurrentGameState() { return this.history[this.history.length - 1]; }

    onWallHoverIn(wallProps) {
        const currentState = this.getCurrentGameState();
        // BUG FIX: Only process hover if it's a human's turn and not in history view.
        if (this.isViewingHistory() || this.config.playerTypes[currentState.playerTurn] !== 'human') {
            return;
        }
        const isLegal = GameLogic.isWallPlacementLegal(wallProps, this.getCurrentGameState(), this.players, this.config.boardSize);
        this.scene.renderer.highlightWallSlot(wallProps, isLegal);
    }

    isViewingHistory() { return this.viewingHistoryIndex >= 0 && this.viewingHistoryIndex < this.history.length - 1; }

    navigateHistory(direction) {
        if ((direction === 'next' || direction === 'end') && !this.isViewingHistory()) {
            return;
        }
        if ((direction === 'prev' || direction === 'start') && this.viewingHistoryIndex === 0) {
            return;
        }

        const previousViewingIndex = this.viewingHistoryIndex;
        let newIndex = this.viewingHistoryIndex;
        
        switch (direction) {
            case 'start': newIndex = 0; break;
            case 'prev': newIndex = this.viewingHistoryIndex - 1; break;
            case 'next': newIndex = this.viewingHistoryIndex + 1; break;
            case 'end': newIndex = this.history.length - 1; break;
        }

        if (newIndex !== previousViewingIndex) {
            this.viewingHistoryIndex = newIndex;
            
            const isNowViewingHistory = this.isViewingHistory();

            if (!isNowViewingHistory) {
                // If we returned to the present, show the live state and trigger the next move if needed.
                this.scene.onStateUpdate(this.getCurrentGameState(), false);
                this._requestNextMove();
            } else {
                // Otherwise, show the history slice for onion skinning
                const onionSkinDepth = 2;
                const historySlice = this.history.slice(this.viewingHistoryIndex, this.viewingHistoryIndex + onionSkinDepth);
                this.scene.onStateUpdate(historySlice, true);
            }

            this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, this.history.length - 1);
        }
    }

    #createInitialState() {
        return {
            boardSize: this.config.boardSize,
            status: 'active', winner: null, reason: null,
            playerTurn: this.config.players[0].id,
            pawnPositions: this.config.players.reduce((acc, p) => { acc[p.id] = p.startPos(this.config.boardSize); return acc; }, {}),
            wallsLeft: this.config.players.reduce((acc, p) => { acc[p.id] = this.config.wallsPerPlayer; return acc; }, {}),
            timers: this.config.players.reduce((acc, p) => { acc[p.id] = this.config.timePerPlayer; return acc; }, {}),
            placedWalls: [],
            activePlayerIds: this.config.players.map(p => p.id),
            playerTurnIndex: 0,
        };
    }

    #commitNewGameState(newGameState) {
        this.history.push(newGameState);
        this.viewingHistoryIndex = this.history.length - 1;
        this.scene.onStateUpdate(this.getCurrentGameState(), false);
        this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, this.history.length - 1);
    }

    #recordHistory() {
        this.viewingHistoryIndex = this.history.length - 1;
    }

    destroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.scene.events.off('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.off('wall-hover-out');
        this.scene.events.off('history-navigate', this.navigateHistory, this);
        this.scene.events.off('resign-request', this.handleResignation, this);
        this.scene.events.off('human-action-input');
        Object.values(this.controllers).forEach(c => c.destroy());
    }
}