// src/orchestrators/OnlineGameOrchestrator.js
import NetworkManager from '../helpers/NetworkManager.js';
import InputHandler from '../helpers/InputHandler.js';
import Renderer from '../helpers/Renderer.js';
import { GAME_COLORS, ALL_PLAYERS } from '../config/gameConfig.js';
import * as GameLogic from '../../../common/GameLogic.js';

export default class OnlineGameOrchestrator {
    constructor(scene, config) {
        this.scene = scene;
        this.startupConfig = config;
        this.networkManager = null;
        
        this.history = [];
        this.viewingHistoryIndex = -1;
    }

    initialize() {
        this.networkManager = new NetworkManager(this.scene);
        this.scene.uiManager.showWaitingScreen("Connecting to server...");

        // Network listeners
        this.scene.events.on('network-waiting', this.handleWaiting, this);
        this.scene.events.on('network-game-start', this.onGameStart, this);
        this.scene.events.on('network-state-received', this._handleStateReceived, this);
        this.scene.events.on('draw-offer-received', this.scene.uiManager.showDrawOffer, this.scene.uiManager);
        this.scene.events.on('draw-offer-pending', this.scene.uiManager.showDrawPending, this.scene.uiManager);
        this.scene.events.on('draw-offer-rescinded', () => this.scene.uiManager.showDefaultActions(this.scene.gameConfig));
        
        // User action listeners
        this.scene.events.on('human-action-input', this.handleHumanInput, this);
        this.scene.events.on('resign-request', this.networkManager.sendResignationRequest, this.networkManager);
        this.scene.events.on('draw-request', this.networkManager.sendDrawRequest, this.networkManager);
        this.scene.events.on('accept-draw', () => this.networkManager.sendDrawResponse(true));
        this.scene.events.on('reject-draw', () => this.networkManager.sendDrawResponse(false));

        // Visual feedback listeners
        this.scene.events.on('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.on('wall-hover-out', () => this.scene.renderer.clearWallHighlight());

        this.networkManager.connect();
        this.networkManager.socket.on('connect', () => {
            this.networkManager.socket.emit('findGame', { numPlayers: this.startupConfig.numPlayers });
        });
    }

    handleWaiting(message) {
        this.scene.uiManager.showWaitingScreen(message);
    }
    
    handleHumanInput(move) {
        if (this.scene.latestGameState.playerTurn === this.scene.localPlayerRole) {
            this.networkManager.requestMove(move);
        }
    }

    onGameStart(data) {
        this.history = [data.initialState];
        this.viewingHistoryIndex = 0;

        const scene = this.scene;
        const serverConfig = data.config;

        const hydratedPlayers = serverConfig.players.map(serverPlayer => {
            const localPlayerTemplate = ALL_PLAYERS.find(p => p.id === serverPlayer.id);
            return { ...localPlayerTemplate, ...serverPlayer };
        })

        const playerTypes = serverConfig.players.reduce((acc, player) => {
            acc[player.id] = 'human';
            return acc;
        }, {});
        
        scene.gameConfig = { 
            ...serverConfig, 
            gameType: 'online', 
            players: hydratedPlayers, 
            colors: GAME_COLORS,
            playerTypes: playerTypes
        };

        scene.localPlayerRole = data.playerMap[this.networkManager.socket.id];
        
        if (scene.renderer) scene.renderer.destroy();
        if (scene.inputHandler) scene.inputHandler.destroy();

        scene.renderer = new Renderer(scene, scene.gameConfig);
        scene.inputHandler = new InputHandler(scene, scene.gameConfig);
        
        scene.renderer.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setupInputListeners();

        scene.uiManager.setupGameUI(scene.gameConfig.players, data.initialState.timers, scene.gameConfig);
        scene.onStateUpdate(data.initialState);
        this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, this.history.length - 1);
    }

    _handleStateReceived(gameState) {
        const wasViewingLive = !this.isViewingHistory();
        
        this.history.push(gameState);
        
        if (wasViewingLive) {
            this.viewingHistoryIndex = this.history.length - 1;
            this.scene.onStateUpdate(gameState, false);
        }
        
        this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, this.history.length - 1);
    }
    
    navigateHistory(direction) {
        if (this.history.length === 0) return;

        const lastIndex = this.history.length - 1;
        const previousViewingIndex = this.viewingHistoryIndex;
        let newIndex = this.viewingHistoryIndex;

        switch (direction) {
            case 'start': newIndex = 0; break;
            case 'prev': newIndex = Math.max(0, this.viewingHistoryIndex - 1); break;
            case 'next': newIndex = Math.min(lastIndex, this.viewingHistoryIndex + 1); break;
            case 'end': newIndex = lastIndex; break;
        }

        if (newIndex !== previousViewingIndex) {
            this.viewingHistoryIndex = newIndex;
            const isNowViewingHistory = this.isViewingHistory();
            
            if (isNowViewingHistory) {
                const onionSkinDepth = 2; 
                const historySlice = this.history.slice(this.viewingHistoryIndex, this.viewingHistoryIndex + onionSkinDepth);
                this.scene.onStateUpdate(historySlice, true);
            } else {
                const stateToView = this.history[this.viewingHistoryIndex];
                this.scene.onStateUpdate(stateToView, false);
            }
            
            this.scene.uiManager.updateHistoryButtons(this.viewingHistoryIndex, lastIndex);
        }
    }

    isViewingHistory() {
        return this.viewingHistoryIndex < this.history.length - 1;
    }

    onWallHoverIn(wallProps) {
        const gameState = this.scene.latestGameState;
        // Don't show hover highlights if viewing history
        if (!gameState || this.isViewingHistory() || gameState.status !== 'active' || gameState.playerTurn !== this.scene.localPlayerRole) return;
        
        const isLegal = GameLogic.isWallPlacementLegal(wallProps, gameState, this.scene.gameConfig.players, this.scene.gameConfig.boardSize);
        this.scene.renderer.highlightWallSlot(wallProps, isLegal);
    }

    destroy() {
        this.scene.events.off('network-waiting', this.handleWaiting, this);
        this.scene.events.off('network-game-start', this.onGameStart, this);
        this.scene.events.off('network-state-received', this._handleStateReceived, this);
        this.scene.events.off('draw-offer-received');
        this.scene.events.off('draw-offer-pending');
        this.scene.events.off('draw-offer-rescinded');
        
        this.scene.events.off('human-action-input', this.handleHumanInput, this);
        this.scene.events.off('resign-request');
        this.scene.events.off('draw-request');
        this.scene.events.off('accept-draw');
        this.scene.events.off('reject-draw');

        this.scene.events.off('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.off('wall-hover-out');
        
        if (this.networkManager) {
            this.networkManager.destroy();
        }
    }
}