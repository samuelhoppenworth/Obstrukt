// src/scenes/Game.js

import Renderer from "../helpers/Renderer.js";
import GameManager from "../helpers/GameManager.js";
import InputHandler from "../helpers/InputHandler.js";

export default class Game extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
    }

    create() {
        const numPlayers = 2;
        const config = {
            boardSize: 9,
            numPlayers: numPlayers,
            wallsPerPlayer: numPlayers === 4 ? 5 : 10,
            players: [
                {
                    id: 'p1',
                    startPos: { row: 8, col: 4 },
                    goalCondition: (r, c, boardSize) => r === boardSize - 1,
                    color: 0xff00a6, // Magenta
                },
                {
                    id: 'p2',
                    startPos: numPlayers === 4 ? { row: 4, col: 8 } : { row: 0, col: 4 },
                    goalCondition: (r, c, boardSize) => r === 0,
                    color: 0x00fff7, // Cyan
                },
                {
                    id: 'p3',
                    startPos: { row: 0, col: 4 },
                    goalCondition: (r, c, boardSize) => c === boardSize - 1,
                    color: 0xffa500, // Orange
                },
                {
                    id: 'p4',
                    startPos: { row: 4, col: 0 },
                    goalCondition: (r, c, boardSize) => c === 0,
                    color: 0x55ff55, // Light Green
                },
            ],
            colors: {
                wall: 0xffff00,
                board: 0x333333,
                legalMove: 0xdddddd,
                legalWall: 0x00ff00,
                illegalWall: 0xff0000,
            }
        };
        
        this.gameManager = new GameManager(this, config);
        this.renderer = new Renderer(this, config);
        this.inputHandler = new InputHandler(this);

        // Render Game Start
        this.renderer.drawStaticBoard();
        this.renderer.drawGameState(this.gameManager.getGameState());

        // Wire Up Event Listeners
        this.events.on('pawn-move-requested', ({ row, col }) => {
            this.gameManager.movePawn(row, col);
        });

        this.events.on('wall-placement-requested', (wallData) => {
            this.gameManager.placeWall(wallData);
        });

        this.events.on('game-state-updated', (newGameState) => {
            this.renderer.drawGameState(newGameState);
        });

        this.events.on('wall-hover-in', (wallData) => {
            const isLegal = this.gameManager.isWallPlacementLegal(wallData.row, wallData.col, wallData.orientation);
            this.renderer.highlightWallSlot(wallData, isLegal);
        });

        this.events.on('wall-hover-out', () => {
            this.renderer.clearWallHighlight();
        });

        this.inputHandler.setupInputListeners();
    }
}