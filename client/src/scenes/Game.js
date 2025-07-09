// src/scenes/Game.js

import Renderer from "../helpers/Renderer.js";
import GameManager from "../helpers/GameManager.js";
import InputHandler from "../helpers/InputHandler.js";

export default class Game extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
    }

    create() {
        // --- 1. Create Components ---
        const config = {
            boardSize: 9, 
            p1Start: {row: 0, col: 4}, 
            p2Start: {row: 8, col: 4}, 
            numWalls: 10
        };
        
        // The scene now holds direct references
        this.gameManager = new GameManager(this, config);
        this.renderer = new Renderer(this);
        this.inputHandler = new InputHandler(this);

        // --- 2. Initial Drawing ---
        this.renderer.drawStaticBoard();
        this.renderer.drawGameState(this.gameManager.getGameState());

        // --- 3. Wire Up Event Listeners ---

        // Input -> GameManager
        this.events.on('pawn-move-requested', ({ row, col }) => {
            this.gameManager.movePawn(row, col);
        });

        this.events.on('wall-placement-requested', (wallData) => {
            this.gameManager.placeWall(wallData);
        });

        // GameManager -> Renderer
        this.events.on('game-state-updated', (newGameState) => {
            this.renderer.drawGameState(newGameState);
        });

        // Input -> GameManager -> Renderer (for hover effects)
        this.events.on('wall-hover-in', (wallData) => {
            const isLegal = this.gameManager.isWallPlacementLegal(wallData.row, wallData.col, wallData.orientation);
            this.renderer.highlightWallSlot(wallData, isLegal);
        });

        this.events.on('wall-hover-out', () => {
            this.renderer.clearWallHighlight();
        });

        // --- 4. Start Listening for Input ---
        this.inputHandler.setupInputListeners();
    }
}