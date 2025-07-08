export default class Renderer {
    constructor(scene) {
        this.scene = scene;
        this.boardSize = 9; // TODO: add custom grid size functionality
        this.cellSize = 80;
        this.gapSize = 20;
        
        this.pawnGroup = this.scene.add.group();
        this.wallGroup = this.scene.add.group();
        this.cellGroup = this.scene.add.group();
        this.highlightedCellGroup = this.scene.add.group();
        this.highlightedWall = this.scene.add.graphics();
    }

    drawStaticBoard() {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x333333, 1); // A dark grey color similar to the screenshot

        // Calculate the total width and height of the grid, including gaps
        const totalCellSize = this.boardSize * this.cellSize;
        const totalGapSize = (this.boardSize - 1) * this.gapSize;
        const gridTotalDimension = totalCellSize + totalGapSize;

        // Get the canvas dimensions from the game config to calculate the center
        const canvasWidth = this.scene.sys.game.config.width;
        const canvasHeight = this.scene.sys.game.config.height;

        // Calculate the starting x and y position to center the board
        const startX = (canvasWidth - gridTotalDimension) / 2;
        const startY = (canvasHeight - gridTotalDimension) / 2;

        // Loop through and draw each cell of the grid
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const x = startX + col * (this.cellSize + this.gapSize);
                const y = startY + row * (this.cellSize + this.gapSize);
                graphics.fillRect(x, y, this.cellSize, this.cellSize);
            }
        }
    }
}
