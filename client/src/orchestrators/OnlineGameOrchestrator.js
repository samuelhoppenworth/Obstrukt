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
    }

    initialize() {
        this.networkManager = new NetworkManager(this.scene);
        this.scene.uiManager.showWaitingScreen("Connecting to server...");

        this.scene.events.on('network-waiting', (message) => this.scene.uiManager.showWaitingScreen(message));
        this.scene.events.on('network-game-start', (data) => this.onGameStart(data));
        this.scene.events.on('network-state-received', (state) => this.scene.onStateUpdate(state));
        this.scene.events.on('draw-offer-received', () => this.scene.uiManager.showDrawOffer());
        this.scene.events.on('draw-offer-pending', () => this.scene.uiManager.showDrawPending());
        this.scene.events.on('draw-offer-rescinded', () => this.scene.uiManager.showDefaultActions(this.scene.gameConfig));
        
        this.scene.events.on('human-action-input', (move) => {
            if (this.scene.latestGameState.playerTurn === this.scene.localPlayerRole) {
                this.networkManager.requestMove(move);
            }
        });
        this.scene.events.on('resign-request', () => this.networkManager.sendResignationRequest());
        this.scene.events.on('draw-request', () => this.networkManager.sendDrawRequest());
        this.scene.events.on('accept-draw', () => this.networkManager.sendDrawResponse(true));
        this.scene.events.on('reject-draw', () => this.networkManager.sendDrawResponse(false));

        this.scene.events.on('wall-hover-in', this.onWallHoverIn, this);
        this.scene.events.on('wall-hover-out', () => this.scene.renderer.clearWallHighlight());

        this.networkManager.connect();
        this.networkManager.socket.on('connect', () => {
            this.networkManager.socket.emit('findGame', { numPlayers: this.startupConfig.numPlayers });
        });
    }

    onGameStart(data) {
        const scene = this.scene;
        const serverConfig = data.config;

        const hydratedPlayers = serverConfig.players.map(serverPlayer => {
            const localPlayerTemplate = ALL_PLAYERS.find(p => p.id === serverPlayer.id);
            return { ...localPlayerTemplate, ...serverPlayer };
        })

        scene.gameConfig = { ...serverConfig, gameType: 'online', players: hydratedPlayers, colors: GAME_COLORS };
        scene.localPlayerRole = data.playerMap[this.networkManager.socket.id];
        scene.renderer = new Renderer(scene, scene.gameConfig);
        scene.inputHandler = new InputHandler(scene, scene.gameConfig);
        scene.renderer.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setupInputListeners();

        scene.uiManager.setupGameUI(scene.gameConfig.players, data.initialState.timers, scene.gameConfig);
        scene.onStateUpdate(data.initialState);
    }
    
    onWallHoverIn(wallProps) {
        const gameState = this.scene.latestGameState;
        if (!gameState || gameState.status !== 'active' || gameState.playerTurn !== this.scene.localPlayerRole) return;
        const activePlayerIds = Object.keys(gameState.pawnPositions).filter(id => gameState.pawnPositions[id].row !== -1);
        const logicState = { ...gameState, activePlayerIds };
        const isLegal = GameLogic.isWallPlacementLegal(wallProps, logicState, this.scene.gameConfig.players, this.scene.gameConfig.boardSize);
        this.scene.renderer.highlightWallSlot(wallProps, isLegal);
    }

    destroy() {
        this.scene.events.off('human-action-input');
        this.scene.events.off('resign-request');
        this.scene.events.off('draw-request');
        this.scene.events.off('accept-draw');
        this.scene.events.off('reject-draw');
        this.scene.events.off('wall-hover-in');
        this.scene.events.off('wall-hover-out');
    }
}