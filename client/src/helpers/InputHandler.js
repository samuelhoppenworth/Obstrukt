// src/helpers/InputHandler.js

export default class InputHandler {
    constructor(scene, config) {
        this.scene = scene;
        this.lastHoveredWall = null;
        this.perspective = 'p1';
        this.boardSize = config.boardSize || 9;
    }

    setPerspective(playerId) {
        this.perspective = playerId || 'p1';
    }

    setupInputListeners() {
        this.scene.input.on('pointerdown', this.handlePointerDown, this);
        this.scene.input.on('pointermove', this.handlePointerMove, this);
        this.scene.input.mouse.disableContextMenu();
    }

    handlePointerDown(pointer) {
        if (pointer.rightButtonDown() || this.scene.isGameOver) return;
        
        const location = this.#getBoardLocation(pointer.x, pointer.y);
        if (!location) return;

        this.scene.events.emit('human-action-input', { type: location.type, data: location });
    }

    handlePointerMove(pointer) {
        if (this.scene.isGameOver) {
            if (this.lastHoveredWall !== null) {
                this.scene.events.emit('wall-hover-out');
                this.lastHoveredWall = null;
            }
            return;
        }

        const location = this.#getBoardLocation(pointer.x, pointer.y);

        if (location && location.type === 'wall') {
            const hoverKey = `${location.row}-${location.col}-${location.orientation}`;
            if (this.lastHoveredWall !== hoverKey) {
                this.scene.events.emit('wall-hover-in', { ...location });
                this.lastHoveredWall = hoverKey;
            }
        } else {
            if (this.lastHoveredWall !== null) {
                this.scene.events.emit('wall-hover-out');
                this.lastHoveredWall = null;
            }
        }
    }

    /**
     * Converts view-space CELL coordinates to model-space. Correct for pawns.
     */
    #untransformCellCoords(viewRow, viewCol) {
        const bS = this.boardSize;
        switch (this.perspective) {
            case 'p2': return { row: (bS - 1) - viewCol, col: viewRow };
            case 'p3': return { row: (bS - 1) - viewRow, col: (bS - 1) - viewCol };
            case 'p4': return { row: viewCol, col: (bS - 1) - viewRow };
            case 'p1':
            default:   return { row: viewRow, col: viewCol };
        }
    }

    #untransformWallCoords(viewRow, viewCol, viewOrientation) {
        const bS = this.boardSize;
        let modelRow = viewRow;
        let modelCol = viewCol;
        let modelOrientation = viewOrientation;

        switch (this.perspective) {
            case 'p2': // Rotated 90 degrees clockwise
                if (viewOrientation === 'horizontal') {
                    // A horizontal VIEW wall was originally a VERTICAL MODEL wall.
                    modelOrientation = 'vertical';
                    modelRow = (bS - 1) - viewCol;
                    modelCol = viewRow;
                } else { // viewOrientation is 'vertical'
                    // A vertical VIEW wall was originally a HORIZONTAL MODEL wall.
                    modelOrientation = 'horizontal';
                    modelRow = viewCol;
                    modelCol = (bS - 2) - viewRow;
                }
                break;

            case 'p3': // Rotated 180 degrees
                modelRow = (bS - 2) - viewRow;
                modelCol = (bS - 2) - viewCol;
                break;

            case 'p4': // Rotated 270 degrees clockwise
                // FIX: This section now has the correct inverse calculations.
                if (viewOrientation === 'horizontal') {
                    // A horizontal VIEW wall was originally a VERTICAL MODEL wall.
                    modelOrientation = 'vertical';
                    modelRow = viewCol;
                    modelCol = (bS - 2) - viewRow; // Corrected from (bS - 1)
                } else { // viewOrientation is 'vertical'
                    // A vertical VIEW wall was originally a HORIZONTAL MODEL wall.
                    modelOrientation = 'horizontal';
                    modelRow = (bS - 1) - viewCol; // Corrected from (bS - 2)
                    modelCol = viewRow;
                }
                break;
                
            case 'p1':
            default:
                // No transformation needed
                break;
        }
        return { row: modelRow, col: modelCol, orientation: modelOrientation };
    }

    #getBoardLocation(pixelX, pixelY) {
        const { startX, startY, cellSize, gapSize } = this.scene.renderer;
        const block = cellSize + gapSize;
        const wallGridSize = this.boardSize - 1;

        if (pixelX < startX || pixelY < startY) return null;
        
        const viewCol = Math.floor((pixelX - startX) / block);
        const viewRow = Math.floor((pixelY - startY) / block);

        const xInBlock = (pixelX - startX) % block;
        const yInBlock = (pixelY - startY) % block;
        
        if (viewRow >= this.boardSize || viewCol >= this.boardSize) return null;

        const onCell = xInBlock < cellSize && yInBlock < cellSize;
        const onVerticalGap = xInBlock >= cellSize && viewCol < wallGridSize;
        const onHorizontalGap = yInBlock >= cellSize && viewRow < wallGridSize;

        if (onCell) {
            return { type: 'cell', ...this.#untransformCellCoords(viewRow, viewCol) };
        }

        if (onHorizontalGap) {
            const modelWall = this.#untransformWallCoords(viewRow, viewCol, 'horizontal');
            return { type: 'wall', ...modelWall };
        }
        
        if (onVerticalGap) {
            const modelWall = this.#untransformWallCoords(viewRow, viewCol, 'vertical');
            return { type: 'wall', ...modelWall };
        }
        
        return null;
    }
}