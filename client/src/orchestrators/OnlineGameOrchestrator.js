// src/orchestrators/OnlineGameOrchestrator.js
import NetworkManager from '../helpers/NetworkManager.js';
import InputHandler from '../helpers/InputHandler.js';
import Renderer from '../helpers/Renderer.js';
import HumanController from '../controllers/HumanController.js';
import RemoteController from '../controllers/RemoteController.js';
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

        // Listen for core network events
        this.scene.events.on('network-waiting', (message) => this.scene.uiManager.showWaitingScreen(message));
        this.scene.events.on('network-game-start', (data) => this.onGameStart(data));
        this.scene.events.on('network-state-received', (state) => this.scene.onStateUpdate(state));
        
        // Listen for actions from the local human controller
        this.scene.events.on('human-action-input', (move) => {
            this.networkManager.requestMove(move);
        });

        // Listen for UI events for instant feedback
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

        // The player objects from the server are missing the goalCondition function due to JSON serialization.
        // Rebuild them by combining the server's data with the complete local data.
        const hydratedPlayers = serverConfig.players.map(serverPlayer => {
            const localPlayerTemplate = ALL_PLAYERS.find(p => p.id === serverPlayer.id);

            // Create a new object that has the server's data (like color)
            // but guarantees it has the necessary functions from the local template.
            return {
                ...localPlayerTemplate, // Contains the goalCondition function
                ...serverPlayer,      // Overwrites with server data (like startPos, color, etc.)
            };
        })

        // Build the final, safe game config for the client
        scene.gameConfig = {
            ...serverConfig,
            players: hydratedPlayers,
            colors: GAME_COLORS,
        };

        scene.localPlayerRole = data.playerMap[this.networkManager.socket.id];

        scene.renderer = new Renderer(scene, scene.gameConfig);
        scene.inputHandler = new InputHandler(scene);
        
        scene.renderer.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setPerspective(scene.localPlayerRole);
        scene.inputHandler.setupInputListeners();
        
        scene.controllers = {};
        scene.gameConfig.players.forEach(player => {
            if (player.id === scene.localPlayerRole) {
                scene.controllers[player.id] = new HumanController(scene);
            } else {
                scene.controllers[player.id] = new RemoteController(scene);
            }
        });

        scene.uiManager.setupGameUI(scene.gameConfig.players, data.initialState.timers, scene.gameConfig);
        scene.onStateUpdate(data.initialState);
    }
    
    onWallHoverIn(wallProps) {
        const gameState = this.scene.latestGameState;
        
        if (!gameState || gameState.status !== 'active' || gameState.playerTurn !== this.scene.localPlayerRole) {
            return;
        }

        const activePlayerIds = Object.keys(gameState.pawnPositions).filter(
            id => gameState.pawnPositions[id].row !== -1
        );
        
        const logicState = { ...gameState, activePlayerIds };
        const isLegal = GameLogic.isWallPlacementLegal(
            wallProps, 
            logicState, 
            this.scene.gameConfig.players, 
            this.scene.gameConfig.boardSize
        );
        this.scene.renderer.highlightWallSlot(wallProps, isLegal);
    }
}