export default class Renderer {
    constructor(scene) {
        this.scene = scene;
        this.boardSize = 9;
        this.cellSize = 80;
        this.gapSize = 20;

        // Centralized color theme
        this.colors = {
            p1: 0xff00a6,     // Magenta
            p2: 0x00fff7,     // Cyan
            wall: 0xffff00,   // Bright Yellow
            board: 0x333333,
            legalMove: 0x55ff55,
            legalWall: 0x00ff00,
            illegalWall: 0xff0000,
        };
             
        this.pawnGroup = this.scene.add.group();
        this.wallGroup = this.scene.add.group();
        this.cellGroup = this.scene.add.group();
        this.highlightedCellGroup = this.scene.add.group();
        this.highlightedWall = this.scene.add.graphics();

        this.startX;
        this.startY;
    }

    drawStaticBoard() {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(this.colors.board, 1);

        const gridTotalDimension = this.boardSize * this.cellSize + (this.boardSize - 1) * this.gapSize;
        const canvasWidth = this.scene.sys.game.config.width;
        const canvasHeight = this.scene.sys.game.config.height;

        this.startX = (canvasWidth - gridTotalDimension) / 2;
        this.startY = (canvasHeight - gridTotalDimension) / 2;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const x = this.startX + col * (this.cellSize + this.gapSize);
                const y = this.startY + row * (this.cellSize + this.gapSize);
                graphics.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    /**
     * Clears and redraws all dynamic elements based on the game state.
     * This is the single point of update for the visual display.
     * @param {object} gameState The complete game state object.
     */
    drawGameState(gameState) {
        this.pawnGroup.clear(true, true);
        this.wallGroup.clear(true, true);
        this.highlightedCellGroup.clear(true, true); // Clear old highlights

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
        
        // Draw Player 1's pawn
        const p1 = pawnPositions.p1;
        if (p1.row !== -1) {
            const p1Coords = this.#getCellPixelCoords(p1.row, p1.col);
            const p1Pawn = this.scene.add.circle(p1Coords.x + this.cellSize / 2, p1Coords.y + this.cellSize / 2, pawnRadius, this.colors.p1); // Use Magenta from theme
            this.pawnGroup.add(p1Pawn);
        }

        // Draw Player 2's pawn
        const p2 = pawnPositions.p2;
        if (p2.row !== -1) {
            const p2Coords = this.#getCellPixelCoords(p2.row, p2.col);
            const p2Pawn = this.scene.add.circle(p2Coords.x + this.cellSize / 2, p2Coords.y + this.cellSize / 2, pawnRadius, this.colors.p2); // Use Cyan from theme
            this.pawnGroup.add(p2Pawn);
        }
    }

    #drawWalls(placedWalls) {
        for (const wall of placedWalls) {
            const { x, y, width, height } = this.#getWallPixelProps(wall.row, wall.col, wall.orientation);
            const wallRect = this.scene.add.rectangle(x, y, width, height, this.colors.wall).setOrigin(0, 0); // Use Yellow from theme
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