// src/scenes/Game.js
import UIManager from "../helpers/UIManager.js";
import LocalGameOrchestrator from '../orchestrators/LocalGameOrchestrator.js';
import OnlineGameOrchestrator from '../orchestrators/OnlineGameOrchestrator.js';
import { ALL_PLAYERS, GAME_COLORS } from '../config/gameConfig.js';
import Renderer from "../helpers/Renderer.js";
import InputHandler from "../helpers/InputHandler.js";

export default class Game extends Phaser.Scene {
    constructor() { super({ key: 'Game' }); }
    init(data) { this.startupConfig = data; }

    async create() {
        this.isGameOver = false;
        this.controllers = {};
        this.localPlayerRole = 'p1';
        this.latestGameState = null;
        this.orchestrator = null;
        this.gameConfig = {};
        
        this.uiManager = new UIManager(this);

        if (this.startupConfig.gameType === 'online') {
            this.orchestrator = new OnlineGameOrchestrator(this, this.startupConfig);
        } else {
            const numPlayers = this.startupConfig.numPlayers;
            const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

            this.gameConfig = {
                ...this.startupConfig,
                // --- FIX: Use boardSize from startup config ---
                boardSize: this.startupConfig.boardSize || 9, 
                timePerPlayer: 5 * 60 * 1000,
                wallsPerPlayer: this.startupConfig.boardSize === 9 ? (numPlayers === 2 ? 10 : 5) : 8, // Example: fewer walls for other sizes
                players: playersForGame, 
                colors: GAME_COLORS,
            };
            
            this.orchestrator = new LocalGameOrchestrator(this, this.gameConfig);
            
            this.renderer = new Renderer(this, this.gameConfig);
            // --- FIX: Pass gameConfig to InputHandler ---
            this.inputHandler = new InputHandler(this, this.gameConfig);
            this.inputHandler.setPerspective('p1');
            this.inputHandler.setupInputListeners();
            
            this.uiManager.setupGameUI(this.gameConfig.players, this.orchestrator.getGameState().timers, this.gameConfig);
        }

        this.orchestrator.initialize();
    }

    onStateUpdate(gameState, isHistoryView = false) {
        this.latestGameState = gameState;

        let showHighlights = false;
        const currentPlayerId = gameState.playerTurn;

        if (this.startupConfig.gameType === 'online') {
            showHighlights = (currentPlayerId === this.localPlayerRole);
        } else {
            if (currentPlayerId && this.gameConfig.playerTypes[currentPlayerId] === 'human') {
                showHighlights = true;
            }
        }

        const perspective = this.startupConfig.gameType === 'online' ? this.localPlayerRole : 'p1';
        this.renderer.drawGameState(gameState, { perspective, shouldShowHighlights: showHighlights });

        this.uiManager.updateTimers(gameState.timers);
        this.uiManager.updatePlayerInfo(gameState);
        
        if (gameState.status === 'ended') {
            if (this.isGameOver) return;
            this.isGameOver = true;
            this.renderer.clearWallHighlight();
            this.uiManager.showEndGameUI(gameState, this.gameConfig.numPlayers);
            Object.values(this.controllers).forEach(c => c.destroy());
            return;
        }
        
        if (!isHistoryView) {
            this.startTurn(gameState);
        }
    }
    
    async startTurn(gameState) {
        const currentPlayerId = gameState.playerTurn;
        if (!currentPlayerId || !this.controllers[currentPlayerId]) return;

        const currentController = this.controllers[currentPlayerId];
        if (currentController.waitingForMove) return;
        const move = await currentController.getMove(gameState);

        if (this.isGameOver || !move) return;

        if (this.orchestrator instanceof LocalGameOrchestrator) {
             this.orchestrator.handleMoveRequest(move);
        }
    }
    
    update(time, delta) {
        if (this.orchestrator instanceof LocalGameOrchestrator) {
            this.orchestrator.update(delta);
        }
    }
}