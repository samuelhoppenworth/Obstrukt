// src/helpers/InputHandler.js

export default class InputHandler {
    constructor(scene) {
        this.scene = scene;
        this.lastHoveredWall = null;
        this.perspective = 'p1';
        this.boardSize = 9; // Grid is 9x9 cells
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

    /**
     * --- THIS IS THE NEW, CORRECTED FUNCTION ---
     * Converts view-space WALL coordinates and orientation to model-space.
     * This is the perfect inverse of the renderer's logic.
     */
    #untransformWallCoords(viewRow, viewCol, viewOrientation) {
        const bS = this.boardSize;
        let modelRow = viewRow;
        let modelCol = viewCol;
        let modelOrientation = viewOrientation;

        switch (this.perspective) {
            case 'p2': // Inverse of 90-degree CW rotation is 270-degree CW
                modelRow = viewCol;
                modelCol = (bS - 2) - viewRow;
                modelOrientation = viewOrientation === 'horizontal' ? 'vertical' : 'horizontal';
                break;

            case 'p3': // Inverse of 180-degree rotation is 180-degree
                modelRow = (bS - 2) - viewRow;
                modelCol = (bS - 2) - viewCol;
                // Orientation does not change
                break;

            case 'p4': // Inverse of 270-degree CW rotation is 90-degree CW
                modelRow = (bS - 2) - viewCol;
                modelCol = viewRow;
                modelOrientation = viewOrientation === 'horizontal' ? 'vertical' : 'horizontal';
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