// src/helpers/Renderer.js

export default class Renderer {
    constructor(scene, config) {
        this.scene = scene;
        this.boardSize = config.boardSize;
        this.cellSize = 80;
        this.gapSize = 20;

        // --- NEW: Get colors from config ---
        this.colors = { ...config.colors }; // Copy board/wall colors
        // Create a map of player IDs to their colors for easy lookup
        this.playerColors = config.players.reduce((acc, player) => {
            acc[player.id] = player.color;
            return acc;
        }, {});
             
        this.pawnGroup = this.scene.add.group();
        this.wallGroup = this.scene.add.group();
        this.cellGroup = this.scene.add.group();
        this.highlightedCellGroup = this.scene.add.group();
        this.highlightedWall = this.scene.add.graphics();

        const gridTotalDimension = this.boardSize * this.cellSize + (this.boardSize - 1) * this.gapSize;
        const canvasWidth = this.scene.sys.game.config.width;
        const canvasHeight = this.scene.sys.game.config.height;

        this.startX = (canvasWidth - gridTotalDimension) / 2;
        this.startY = (canvasHeight - gridTotalDimension) / 2;
    }

    drawStaticBoard() {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(this.colors.board, 1);

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const x = this.startX + col * (this.cellSize + this.gapSize);
                const y = this.startY + row * (this.cellSize + this.gapSize);
                graphics.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    drawGameState(gameState) {
        this.pawnGroup.clear(true, true);
        this.wallGroup.clear(true, true);
        this.highlightedCellGroup.clear(true, true);

        this.#drawPawns(gameState.pawnPositions);
        this.#drawWalls(gameState.placedWalls);

        if (gameState.gameState === 'active') {
            this.highlightLegalMoves(gameState.availablePawnMoves);
        }
    }

    highlightLegalMoves(moves) {
        moves.forEach(move => {
            const { x, y } = this.#getCellPixelCoords(move.row, move.col);
            const rect = this.scene.add.rectangle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize, this.cellSize);
            rect.setStrokeStyle(4, this.colors.legalMove, 0.7);
            this.highlightedCellGroup.add(rect);
        });
    }

    highlightWallSlot(wallProps, isLegal) {
        this.highlightedWall.clear();
        if (!wallProps) return;
        
        const { x, y, width, height } = this.#getWallPixelProps(wallProps.row, wallProps.col, wallProps.orientation);
        const color = isLegal ? this.colors.legalWall : this.colors.illegalWall;
        this.highlightedWall.fillStyle(color, 0.7);
        this.highlightedWall.fillRect(x, y, width, height);
    }

    clearWallHighlight() {
        this.highlightedWall.clear();
    }
    
    #drawPawns(pawnPositions) {
        const pawnRadius = this.cellSize * 0.4;
        
        // --- NEW: Iterate over all players in the state ---
        for (const playerId in pawnPositions) {
            const pos = pawnPositions[playerId];
            if (pos.row !== -1) {
                const coords = this.#getCellPixelCoords(pos.row, pos.col);
                const color = this.playerColors[playerId];
                const pawn = this.scene.add.circle(coords.x + this.cellSize / 2, coords.y + this.cellSize / 2, pawnRadius, color);
                this.pawnGroup.add(pawn);
            }
        }
    }

    #drawWalls(placedWalls) {
        for (const wall of placedWalls) {
            const { x, y, width, height } = this.#getWallPixelProps(wall.row, wall.col, wall.orientation);
            const wallRect = this.scene.add.rectangle(x, y, width, height, this.colors.wall).setOrigin(0, 0);
            this.wallGroup.add(wallRect);
        }
    }

    #getCellPixelCoords(row, col) {
        const x = this.startX + col * (this.cellSize + this.gapSize);
        const y = this.startY + row * (this.cellSize + this.gapSize);
        return { x, y };
    }

    #getWallPixelProps(row, col, orientation) {
        const cellCoords = this.#getCellPixelCoords(row, col);
        const wallLength = this.cellSize * 2 + this.gapSize;
        if (orientation === 'horizontal') {
            return { x: cellCoords.x, y: cellCoords.y + this.cellSize, width: wallLength, height: this.gapSize };
        } else {
            return { x: cellCoords.x + this.cellSize, y: cellCoords.y, width: this.gapSize, height: wallLength };
        }
    }
}