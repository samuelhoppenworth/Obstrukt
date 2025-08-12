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

    create() {
        this.isGameOver = false;
        this.latestGameState = null;
        this.orchestrator = null;
        this.renderer = null;
        this.inputHandler = null;
        this.gameConfig = {};
        
        this.uiManager = new UIManager(this);

        if (this.startupConfig.gameType === 'online') {
            this.orchestrator = new OnlineGameOrchestrator(this, this.startupConfig);
        } else {
            this.initializeLocalGame();
        }

        this.events.on('history-navigate', (direction) => {
            if (this.orchestrator) {
                this.orchestrator.navigateHistory(direction);
            }
        });
        this.input.keyboard.on('keydown-LEFT', () => this.events.emit('history-navigate', 'prev'));
        this.input.keyboard.on('keydown-RIGHT', () => this.events.emit('history-navigate', 'next'));
        this.input.keyboard.on('keydown-UP', () => this.events.emit('history-navigate', 'end'));
        this.input.keyboard.on('keydown-DOWN', () => this.events.emit('history-navigate', 'start'));

        this.events.once('rematch-requested', () => this.handleRematch());
        this.events.once('new-game-requested', () => this.handleNewGame());
        this.sys.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

        this.orchestrator.initialize();
    }
    
    initializeLocalGame() {
        const numPlayers = this.startupConfig.numPlayers;
        const boardSize = this.startupConfig.boardSize;
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
    }

    handleRematch() {
        this.scene.start('Game', this.startupConfig);
    }

    handleNewGame() {
        this.scene.start('Menu');
    }

    onStateUpdate(gameState, isHistoryView = false) {
        if (!this.renderer) {
            return;
        }
        
        const perspective = this.localPlayerRole || 'p1';

        if (isHistoryView && Array.isArray(gameState)) {
            const historySlice = gameState;
            const focusedState = historySlice[0];
            this.latestGameState = focusedState;

            const renderOptions = {
                perspective: perspective,
                shouldShowHighlights: false,
                onionSkinStates: historySlice 
            };
            
            this.renderer.drawGameState(focusedState, renderOptions);
            this.renderer.toggleHistoryOverlay(true);
            this.uiManager.updatePlayerInfo(focusedState);
            this.uiManager.updateTimers(focusedState.timers);
            
        } else {
            this.latestGameState = gameState;
            const renderOptions = {
                perspective: perspective,
                shouldShowHighlights: false,
            };

            const currentPlayerId = gameState.playerTurn;
            const playerConfig = this.gameConfig?.playerTypes;
            
            const isMyTurn = this.startupConfig.gameType === 'online' 
                ? currentPlayerId === this.localPlayerRole 
                : playerConfig && playerConfig[currentPlayerId] === 'human';

            if (!isHistoryView && isMyTurn) {
                renderOptions.shouldShowHighlights = true;
            }

            this.renderer.drawGameState(gameState, renderOptions);
            this.renderer.toggleHistoryOverlay(isHistoryView);
            
            this.uiManager.updatePlayerInfo(gameState);
            this.uiManager.updateTimers(gameState.timers);
        }

        if (this.latestGameState.status === 'ended') {
            if (this.isGameOver) return;
            this.isGameOver = true;
            this.renderer.clearWallHighlight();
            this.uiManager.showEndGameUI(this.latestGameState);
            return;
        }
    }
    
    shutdown() {
        this.events.off('history-navigate');
        this.input.keyboard.off('keydown-LEFT');
        this.input.keyboard.off('keydown-RIGHT');
        this.input.keyboard.off('keydown-UP');
        this.input.keyboard.off('keydown-DOWN');

        if (this.orchestrator) {
            this.orchestrator.destroy();
            this.orchestrator = null;
        }
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }
        if (this.inputHandler) {
            this.inputHandler.destroy();
            this.inputHandler = null;
        }
    }
}