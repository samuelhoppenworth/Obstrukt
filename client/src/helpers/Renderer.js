// src/helpers/Renderer.js

export default class Renderer {
    constructor(scene, config) {
        this.scene = scene;
        this.boardSize = config.boardSize || 9;

        const availableSize = Math.min(scene.sys.game.config.width, scene.sys.game.config.height);
        const gapToCellRatio = 0.25;

        const paddingInCellUnits = 1.0;
        const totalUnits = (this.boardSize + paddingInCellUnits) + ((this.boardSize - 1) * gapToCellRatio);

        this.cellSize = availableSize / totalUnits;
        this.gapSize = this.cellSize * gapToCellRatio;

        this.staticBoardGraphics = this.scene.add.graphics();
        this.pawnGroup = this.scene.add.group();
        this.wallGroup = this.scene.add.group();
        this.highlightedCellGroup = this.scene.add.group();
        this.onionSkinPawnGroup = this.scene.add.group();
        this.onionSkinWallGroup = this.scene.add.group();
        this.highlightedWall = this.scene.add.graphics();
        this.historyOverlay = this.scene.add.graphics();

        this.highlightedCellGroup.setDepth(1);
        this.historyOverlay.setDepth(10);
        this.onionSkinPawnGroup.setDepth(15);
        this.onionSkinWallGroup.setDepth(16);

        const gridTotalDimension = this.boardSize * this.cellSize + (this.boardSize - 1) * this.gapSize;
        const canvasWidth = this.scene.sys.game.config.width;
        const canvasHeight = this.scene.sys.game.config.height;

        this.startX = (canvasWidth - gridTotalDimension) / 2;
        this.startY = (canvasHeight - gridTotalDimension) / 2;

        this.perspective = 'p1';

        this.colors = { ...config.colors };
        this.playerColors = config.players.reduce((acc, player) => { acc[player.id] = player.color; return acc; }, {});

        this.historyOverlay.fillStyle(0xffffff, 0.6);
        this.historyOverlay.fillRect(this.startX, this.startY, gridTotalDimension, gridTotalDimension);
        this.historyOverlay.setVisible(false);

        this.drawStaticBoard();
    }

    destroy() {
        this.staticBoardGraphics.destroy();
        this.pawnGroup.destroy(true);
        this.wallGroup.destroy(true);
        this.highlightedCellGroup.destroy(true);
        this.onionSkinPawnGroup.destroy(true);
        this.onionSkinWallGroup.destroy(true);
        this.highlightedWall.destroy();
        this.historyOverlay.destroy();
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
        this.onionSkinPawnGroup.clear(true, true);
        this.onionSkinWallGroup.clear(true, true);

        // --- ONION SKINNING: Main logic switch ---
        if (options.onionSkinStates) {
            this.#drawOnionSkins(options.onionSkinStates);
            // Draw the main pawns and walls for the focused state on top
            this.#drawPawns(gameState.pawnPositions);
            this.#drawWalls(gameState.placedWalls);
        } else {
            // Live game view (no onion skins)
            this.#drawPawns(gameState.pawnPositions);
            this.#drawWalls(gameState.placedWalls);
        }
        
        if (options.shouldShowHighlights && gameState.playerTurn) {
            const highlightColor = this.playerColors[gameState.playerTurn];
            this.highlightLegalMoves(gameState.availablePawnMoves, highlightColor);
        }
    }

    highlightLegalMoves(moves, color) {
        moves.forEach(move => {
            const { x, y } = this.#getCellPixelCoords(move.row, move.col);
            const rect = this.scene.add.rectangle(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize, this.cellSize);
            rect.setStrokeStyle(8, color, 1);
            rect.setFillStyle(color, 0.05);
            rect.setBlendMode(Phaser.BlendModes.ADD);
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

    toggleHistoryOverlay(visible) {
        this.historyOverlay.setVisible(visible);
    }

    #drawPawns(pawnPositions) {
        const pawnRadius = this.cellSize * 0.4;
        for (const playerId in pawnPositions) {
            const pos = pawnPositions[playerId];
            if (pos.row !== -1) {
                const { x, y } = this.#getCellPixelCoords(pos.row, pos.col);
                const color = this.playerColors[playerId];
                const pawn = this.scene.add.circle(x + this.cellSize / 2, y + this.cellSize / 2, pawnRadius, color);
                pawn.setDepth(20);
                this.pawnGroup.add(pawn);
            }
        }
    }

    #drawOnionSkins(states) {
        const pawnRadius = this.cellSize * 0.4;
        const opacity = 0.4; // A single opacity for the one ghost layer

        // We only draw skins for the future states (index 1 onwards)
        states.slice(1).forEach((state) => {
            // Draw ghost pawns for this future state
            for (const playerId in state.pawnPositions) {
                const pos = state.pawnPositions[playerId];
                if (pos.row !== -1) {
                    const { x, y } = this.#getCellPixelCoords(pos.row, pos.col);
                    const color = this.playerColors[playerId];
                    const pawn = this.scene.add.circle(x + this.cellSize / 2, y + this.cellSize / 2, pawnRadius, color);
                    pawn.setAlpha(opacity).setDepth(15);
                    this.onionSkinPawnGroup.add(pawn);
                }
            }

            // Draw ghost walls for this future state
            // Only draw walls that are new in this future state compared to the focused state
            const focusedState = states[0];
            const newWalls = state.placedWalls.filter(wall => 
                !focusedState.placedWalls.some(oldWall => 
                    oldWall.row === wall.row && oldWall.col === wall.col && oldWall.orientation === wall.orientation
                )
            );

            for (const wall of newWalls) {
                const { x, y, width, height } = this.#getWallPixelProps(wall.row, wall.col, wall.orientation);
                const wallRect = this.scene.add.rectangle(x, y, width, height, this.colors.wall)
                    .setOrigin(0, 0)
                    .setAlpha(opacity)
                    .setDepth(16);
                this.onionSkinWallGroup.add(wallRect);
            }
        });
    }

    #drawWalls(placedWalls) {
        const shadowOffset = this.cellSize * 0.1;
        const shadowAlpha = 0.3;
        const shadowColor = 0x000000;
        for (const wall of placedWalls) {
            const { x, y, width, height } = this.#getWallPixelProps(wall.row, wall.col, wall.orientation);
            const shadowRect = this.scene.add.rectangle(x + shadowOffset, y + shadowOffset, width, height, shadowColor, shadowAlpha)
                .setOrigin(0, 0)
                .setDepth(21);
            const wallRect = this.scene.add.rectangle(x, y, width, height, this.colors.wall)
                .setOrigin(0, 0)
                .setDepth(22);
            this.wallGroup.add(shadowRect);
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

    #getWallPixelProps(modelRow, modelCol, modelOrientation) {
        const bS = this.boardSize;
        let viewRow = modelRow;
        let viewCol = modelCol;
        let viewOrientation = modelOrientation;
        switch (this.perspective) {
            case 'p2':
                if (modelOrientation === 'horizontal') {
                    viewRow = (bS - 2) - modelCol;
                    viewCol = modelRow;
                    viewOrientation = 'vertical';
                } else {
                    viewRow = modelCol;
                    viewCol = (bS - 1) - modelRow;
                    viewOrientation = 'horizontal';
                }
                break;
            case 'p3':
                viewRow = (bS - 2) - modelRow;
                viewCol = (bS - 2) - modelCol;
                break;
            case 'p4':
                if (modelOrientation === 'horizontal') {
                    viewRow = modelCol;
                    viewCol = (bS - 1) - modelRow;
                    viewOrientation = 'vertical';
                } else {
                    viewRow = (bS - 2) - modelCol;
                    viewCol = modelRow;
                    viewOrientation = 'horizontal';
                }
                break;
            case 'p1':
            default:
                break;
        }
        const wallLength = this.cellSize * 2 + this.gapSize;
        const block = this.cellSize + this.gapSize;
        if (viewOrientation === 'horizontal') {
            return {
                x: this.startX + viewCol * block,
                y: this.startY + viewRow * block + this.cellSize,
                width: wallLength,
                height: this.gapSize
            };
        } else {
            return {
                x: this.startX + viewCol * block + this.cellSize,
                y: this.startY + viewRow * block,
                width: this.gapSize,
                height: wallLength
            };
        }
    }
}