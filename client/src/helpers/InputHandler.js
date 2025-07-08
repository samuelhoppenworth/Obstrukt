export default class InputHandler {
    constructor(scene, renderer, gameHandler) {
        this.scene = scene;
        this.renderer = renderer;
        this.gameHandler = gameHandler;

        // Interaction state (e.g., selected pawn, hovered wall, etc.)
        this.selectedPawn = null;
        // ...

        this.registerInputListeners();
    }

    registerInputListeners() {}
    registerPawnClick() {}
    registerCellClick() {}
    registerWallHover() {}
    registerWallClick() {}

    getBoardCoordinates(screenX, screenY) {
        const { CELL_SIZE, WALL_THICKNESS, HORI_BOARD_OFFSET, VERT_BOARD_OFFSET, BOARD_SIZE } = this.renderer;
        const x = Math.floor((screenX - VERT_BOARD_OFFSET) / (CELL_SIZE + WALL_THICKNESS));
        const y = Math.floor((screenY - HORI_BOARD_OFFSET) / (CELL_SIZE + WALL_THICKNESS));

        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            return { x, y };
        }
        return null;
    }
}
