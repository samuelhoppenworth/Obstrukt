// src/scenes/Game.js
import UIManager from "../helpers/UIManager.js";
import LocalGameOrchestrator from '../orchestrators/LocalGameOrchestrator.js';
import { ALL_PLAYERS, GAME_COLORS } from '../config/gameConfig.js';
import Renderer from "../helpers/Renderer.js";
import InputHandler from "../helpers/InputHandler.js";

export default class Game extends Phaser.Scene {
    constructor() { super({ key: 'Game' }); }
    init(data) { this.startupConfig = data; }

    create() {
        this.isGameOver = false;
        this.latestGameState = null;
        this.orchestrator = null;
        this.gameConfig = {};
        
        this.uiManager = new UIManager(this);

        const numPlayers = this.startupConfig.numPlayers;
        const boardSize = this.startupConfig.boardSize || 9;
        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

        let wallsPerPlayer;
        switch (boardSize) {
            case 5: wallsPerPlayer = (numPlayers === 2) ? 4 : 2; break;
            case 7: wallsPerPlayer = (numPlayers === 2) ? 8 : 4; break;
            case 11: wallsPerPlayer = (numPlayers === 2) ? 12 : 6; break;
            case 9: default: wallsPerPlayer = (numPlayers === 2) ? 10 : 5; break;
        }

        this.gameConfig = {
            ...this.startupConfig,
            boardSize: boardSize, 
            timePerPlayer: 5 * 60 * 1000,
            wallsPerPlayer: wallsPerPlayer,
            players: playersForGame, 
            colors: GAME_COLORS,
        };
        
        this.orchestrator = new LocalGameOrchestrator(this, this.gameConfig);
        
        this.renderer = new Renderer(this, this.gameConfig);
        this.inputHandler = new InputHandler(this, this.gameConfig);
        this.inputHandler.setPerspective('p1');
        this.inputHandler.setupInputListeners();
        
        this.uiManager.setupGameUI(this.gameConfig.players, this.orchestrator.getGameState().timers, this.gameConfig);
        
        this.input.keyboard.on('keydown-LEFT', () => this.events.emit('history-navigate', 'prev'));
        this.input.keyboard.on('keydown-RIGHT', () => this.events.emit('history-navigate', 'next'));
        this.input.keyboard.on('keydown-UP', () => this.events.emit('history-navigate', 'end'));
        this.input.keyboard.on('keydown-DOWN', () => this.events.emit('history-navigate', 'start'));

        this.orchestrator.initialize();
    }

    onStateUpdate(gameState, isHistoryView = false) {
        if (isHistoryView && Array.isArray(gameState)) {
            // --- History View with Onion Skinning ---
            const historySlice = gameState;
            const focusedState = historySlice[0];
            this.latestGameState = focusedState;

            const renderOptions = {
                perspective: 'p1',
                shouldShowHighlights: false,
                onionSkinStates: historySlice 
            };
            
            if (this.renderer) {
                this.renderer.drawGameState(focusedState, renderOptions);
                this.renderer.toggleHistoryOverlay(true);
            }
            this.uiManager.updatePlayerInfo(focusedState);
            this.uiManager.updateTimers(focusedState.timers);
            
        } else {
            // --- Live View (Single State) ---
            this.latestGameState = gameState;
            const renderOptions = {
                perspective: 'p1',
                shouldShowHighlights: false,
            };

            const currentPlayerId = gameState.playerTurn;
            if (!isHistoryView && currentPlayerId && this.gameConfig.playerTypes[currentPlayerId] === 'human') {
                renderOptions.shouldShowHighlights = true;
            }

            if (this.renderer) {
                this.renderer.drawGameState(gameState, renderOptions);
                this.renderer.toggleHistoryOverlay(isHistoryView);
            }
            
            this.uiManager.updatePlayerInfo(gameState);
            this.uiManager.updateTimers(gameState.timers);
        }

        // --- Game End Logic (applies to both views) ---
        if (this.latestGameState.status === 'ended') {
            if (this.isGameOver) return;
            this.isGameOver = true;
            this.renderer.clearWallHighlight();
            this.uiManager.showEndGameUI(this.latestGameState);
            return;
        }
        
        if (!isHistoryView) {
            this.orchestrator.onStateUpdated(gameState);
        }
    }
    
    update(time, delta) {
        if (this.orchestrator && this.orchestrator.update) {
            this.orchestrator.update(delta);
        }
    }

    shutdown() {
        if (this.orchestrator) {
            this.orchestrator.destroy();
        }
    }
}