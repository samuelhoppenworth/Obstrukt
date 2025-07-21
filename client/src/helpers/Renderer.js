// src/helpers/Renderer.js

export default class Renderer {
    constructor(scene, config) {
        this.scene = scene;
        this.boardSize = config.boardSize || 9;
        this.cellSize = 80;
        this.gapSize = 20;
        this.colors = { ...config.colors };
        this.playerColors = config.players.reduce((acc, player) => { acc[player.id] = player.color; return acc; }, {});
             
        this.staticBoardGraphics = this.scene.add.graphics();
        this.pawnGroup = this.scene.add.group();
        this.wallGroup = this.scene.add.group();
        this.highlightedCellGroup = this.scene.add.group();
        this.highlightedWall = this.scene.add.graphics();

        const gridTotalDimension = this.boardSize * this.cellSize + (this.boardSize - 1) * this.gapSize;
        const canvasWidth = this.scene.sys.game.config.width;
        const canvasHeight = this.scene.sys.game.config.height;

        this.startX = (canvasWidth - gridTotalDimension) / 2;
        this.startY = (canvasHeight - gridTotalDimension) / 2;
        
        this.perspective = 'p1';
        
        this.drawStaticBoard();
    }

    setPerspective(playerId) {
        this.perspective = playerId || 'p1';
    }

    drawStaticBoard() {
        this.staticBoardGraphics.clear();
        this.staticBoardGraphics.fillStyle(this.colors.board, 1);
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const x = this.startX + col * (this.cellSize + this.gapSize);
                const y = this.startY + row * (this.cellSize + this.gapSize);
                this.staticBoardGraphics.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }

    drawGameState(gameState, options) {
        this.setPerspective(options.perspective);

        this.pawnGroup.clear(true, true);
        this.wallGroup.clear(true, true);
        this.highlightedCellGroup.clear(true, true);

        this.#drawPawns(gameState.pawnPositions);
        this.#drawWalls(gameState.placedWalls);
        
        if (options.shouldShowHighlights) {
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

    clearWallHighlight() { this.highlightedWall.clear(); }
    
    #drawPawns(pawnPositions) {
        const pawnRadius = this.cellSize * 0.4;
        for (const playerId in pawnPositions) {
            const pos = pawnPositions[playerId];
            if (pos.row !== -1) {
                const { x, y } = this.#getCellPixelCoords(pos.row, pos.col);
                const color = this.playerColors[playerId];
                const pawn = this.scene.add.circle(x + this.cellSize / 2, y + this.cellSize / 2, pawnRadius, color);
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

    #transformCellCoords(row, col) {
        const bS = this.boardSize;
        switch (this.perspective) {
            case 'p2': return [col, (bS - 1) - row];
            case 'p3': return [(bS - 1) - row, (bS - 1) - col];
            case 'p4': return [(bS - 1) - col, row];
            case 'p1':
            default: return [row, col];
        }
    }
    
    #getCellPixelCoords(row, col) {
        const [tRow, tCol] = this.#transformCellCoords(row, col);
        const x = this.startX + tCol * (this.cellSize + this.gapSize);
        const y = this.startY + tRow * (this.cellSize + this.gapSize);
        return { x, y };
    }
    
    /**
     * --- THIS IS THE DEFINITIVELY CORRECTED FUNCTION ---
     * Calculates the final pixel properties for a wall after applying the correct perspective transformation.
     */
    #getWallPixelProps(modelRow, modelCol, modelOrientation) {
        const bS = this.boardSize;
        let viewRow = modelRow;
        let viewCol = modelCol;
        let viewOrientation = modelOrientation;

        // Step 1: Calculate the new "view" coordinates and orientation for the wall's anchor.
        // This logic is now distinct and correct for walls.
        switch (this.perspective) {
            case 'p2': // 90-degree clockwise rotation
                if (modelOrientation === 'horizontal') {
                    viewRow = (bS - 2) - modelCol;
                    viewCol = modelRow;
                    viewOrientation = 'vertical';
                } else { // vertical
                    viewRow = modelCol;
                    viewCol = (bS - 1) - modelRow;
                    viewOrientation = 'horizontal';
                }
                break;

            case 'p3': // 180-degree rotation
                if (modelOrientation === 'horizontal') {
                    viewRow = (bS - 2) - modelRow;
                    viewCol = (bS - 2) - modelCol;
                } else { // vertical
                    viewRow = (bS - 2) - modelRow;
                    viewCol = (bS - 2) - modelCol;
                }
                break;

            case 'p4': // 270-degree clockwise rotation
                if (modelOrientation === 'horizontal') {
                    viewRow = modelCol;
                    viewCol = (bS - 1) - modelRow;
                    viewOrientation = 'vertical';
                } else { // vertical
                    viewRow = (bS - 2) - modelCol;
                    viewCol = modelRow;
                    viewOrientation = 'horizontal';
                }
                break;
            
            case 'p1':
            default:
                // No transformation needed
                break;
        }

        // Step 2: Calculate pixel positions based on the final view coordinates and orientation.
        const wallLength = this.cellSize * 2 + this.gapSize;
        const block = this.cellSize + this.gapSize;

        if (viewOrientation === 'horizontal') {
            return {
                x: this.startX + viewCol * block,
                y: this.startY + viewRow * block + this.cellSize,
                width: wallLength,
                height: this.gapSize
            };
        } else { // Vertical
            return {
                x: this.startX + viewCol * block + this.cellSize,
                y: this.startY + viewRow * block,
                width: this.gapSize,
                height: wallLength
            };
        }
    }
}