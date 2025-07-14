// src/helpers/InputHandler.js

export default class InputHandler {
    /**
     * @param {Phaser.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        // No longer need to track current wall orientation
        this.lastHoveredWall = null; // Track to avoid spamming events
    }

    setupInputListeners() {
        this.scene.input.on('pointerdown', this.handlePointerDown, this);
        this.scene.input.on('pointermove', this.handlePointerMove, this);

        // The right-click listener for toggling wall orientation has been removed.
        
        this.scene.input.mouse.disableContextMenu();
    }

    handlePointerDown(pointer) {
        if (pointer.rightButtonDown()) return; // Ignore right-clicks for placement

        const location = this.#getBoardLocation(pointer.x, pointer.y);
        if (!location) return;

        if (location.type === 'cell') {
            this.scene.events.emit('pawn-move-requested', { row: location.row, col: location.col });
        } else if (location.type === 'wall') {
            this.scene.events.emit('wall-placement-requested', {
                row: location.row,
                col: location.col,
                orientation: location.orientation
            });
        }
    }

    handlePointerMove(pointer) {
        const location = this.#getBoardLocation(pointer.x, pointer.y);

        if (location && location.type === 'wall') {
            const hoverKey = `${location.row}-${location.col}-${location.orientation}`;
            // Emit only if the hover location changes
            if (this.lastHoveredWall !== hoverKey) {
                this.scene.events.emit('wall-hover-in', { ...location });
                this.lastHoveredWall = hoverKey;
            }
        } else {
            // Emit only if we were previously hovering over a wall
            if (this.lastHoveredWall !== null) {
                this.scene.events.emit('wall-hover-out');
                this.lastHoveredWall = null;
            }
        }
    }

    #getBoardLocation(pixelX, pixelY) {
        const { startX, startY, cellSize, gapSize, boardSize } = this.scene.renderer; // Get renderer props from scene
        const block = cellSize + gapSize;
        
        const relativeX = pixelX - startX;
        const relativeY = pixelY - startY;

        const col = Math.floor(relativeX / block);
        const row = Math.floor(relativeY / block);

        const xInBlock = relativeX % block;
        const yInBlock = relativeY % block;

        const onCell = xInBlock < cellSize && yInBlock < cellSize;
        if (onCell) {
            if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return null;
            return { type: 'cell', row, col };
        }

        const onVerticalGap = xInBlock >= cellSize && yInBlock < cellSize;
        const onHorizontalGap = xInBlock < cellSize && yInBlock >= cellSize;
        
        const wallRow = Math.floor((relativeY - cellSize / 2) / block);
        const wallCol = Math.floor((relativeX - cellSize / 2) / block);

        if (onHorizontalGap || onVerticalGap) {
            if (wallRow < 0 || wallRow >= boardSize - 1 || wallCol < 0 || wallCol >= boardSize - 1) return null;
            
            const orientation = onHorizontalGap ? 'horizontal' : 'vertical';
            return { type: 'wall', row: wallRow, col: wallCol, orientation: orientation };
        }
        
        return null;
    }
}