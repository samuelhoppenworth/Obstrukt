/**
 * Manages the state and rules of the Quoridor game.
 * It does not interact with Phaser directly.
 * 
 * Responsibilities:
 *  - Tracks pawn positions, wall placements, and wall counts.
 *  - Determines the current player's turn.
 *  - Calculates legal moves for pawns and walls.
 *  - Checks for win conditions.
 *  - Responds to actions from the InputHandler (e.g., a player trying to move a pawn).
 */
export default class GameManager {
    constructor({boardSize, p1Start, p2Start, numWalls}) {
        this.boardSize = boardSize;
        this.playerTurn = 'p1'; // or 'p2'
        this.gameState = 'inactive'; // 'inactive', 'active', 'p1_win', 'p2_win'

        this.placedWalls = [];
        this.pawnPositions = {
            p1: p1Start,
            p2: p2Start
        };
        this.wallsLeft = {
            p1: numWalls,
            p2: numWalls
        };        
        this.availablePawnMoves = [];
        this.illegalWallMoves = [];
    }

    /**
     * Initializes the game state to start a new game.
     */
    startGame() {
        this.gameState = 'active';
        this.calculateLegalPawnMoves();
        console.log("Game started. It's P1's turn.");
    }

    /**
     * Checks if the last move resulted in a win.
     * @returns {boolean} True if a player has won, false otherwise.
     */
    checkWinCondition() {
        const p1_won = this.pawnPositions.p1.row === 0;
        const p2_won = this.pawnPositions.p2.row === this.boardSize - 1;

        if (p1_won) {
            this.gameState = 'p1_win';
            console.log("GAME OVER: P1 Wins");
            return true;
        }
        if (p2_won) {
            this.gameState = 'p2_win';
            console.log("GAME OVER: P2 Wins");
            return true;
        }

        return false;
    }


    /**
     * Provides the entire current game state, used by the Renderer.
     * Return a deep copy to prevent external mutation.
     * @returns {object} A snapshot of the current game state.
     */
    getGameState() {
        return {
            playerTurn: this.playerTurn,
            gameState: this.gameState,
            pawnPositions: JSON.parse(JSON.stringify(this.pawnPositions)),
            wallsLeft: { ...this.wallsLeft },
            placedWalls: JSON.parse(JSON.stringify(this.placedWalls)),
            availablePawnMoves: JSON.parse(JSON.stringify(this.availablePawnMoves)),
        };
    }

    /**
     * Updates current player's pawn location
     */
    movePawn(row, col) {
        if (this.playerTurn === 'p1') {
            this.pawnPositions.p1 = {row, col};
        } else {
            this.pawnPositions.p2 = {row, col};
        }
    }

    /**
     * Places wall and decremenets current player wallsLeft
     */
    placeWall(row, col, orientation) {
        this.placedWalls.push({row: row, col: col, orientation: orientation});
        if (this.playerTurn === 'p1') {
            this.wallsLeft['p1'] -= 1;
        } else {
            this.wallsLeft['p2'] -= 1;
        }
    }

    /**
     * Ends the current player's turn and sets up for the next player.
     */
    endTurn() {
        if (this.checkWinCondition()) return;
        this.playerTurn = (this.playerTurn === 'p1') ? 'p2' : 'p1';
        this.calculateLegalPawnMoves();
        console.log(`Turn ended. It's now ${this.playerTurn}'s turn.`);
    }

    /**
     * Calculates all valid pawn moves for the current player.
     * Stores the result in `this.availablePawnMoves`.
     */
    calculateLegalPawnMoves() {
        console.log("calculating legal pawn moves")
        this.availablePawnMoves = [];
        const currentPlayer = this.playerTurn;
        const opponentPlayer = (currentPlayer === 'p1') ? 'p2' : 'p1';
        const { row, col } = this.pawnPositions[currentPlayer];
        const opponentPos = this.pawnPositions[opponentPlayer];

        const potentialMoves = [
            { r: row - 1, c: col }, // Up
            { r: row + 1, c: col }, // Down
            { r: row, c: col - 1 }, // Left
            { r: row, c: col + 1 }, // Right
        ];

        for (const move of potentialMoves) {
            if (move.r < 0 || move.r >= this.boardSize || move.c < 0 || move.c >= this.boardSize) continue;
            if (this.#isWallBetween(row, col, move.r, move.c)) continue;

            // Check if opponent is in the target cell
            if (move.r === opponentPos.row && move.c === opponentPos.col) {
                // Handle jumps
                const jumpRow = opponentPos.row + (opponentPos.row - row);
                const jumpCol = opponentPos.col + (opponentPos.col - col);

                // Check if space behind opponent is clear for a straight jump
                if (jumpRow >= 0 && jumpRow < this.boardSize && jumpCol >= 0 && jumpCol < this.boardSize && !this.#isWallBetween(opponentPos.row, opponentPos.col, jumpRow, jumpCol)) {
                    this.availablePawnMoves.push({ row: jumpRow, col: jumpCol });
                } else {
                    // Handle diagonal jumps if straight jump is blocked
                    if (row === opponentPos.row) { // Pawns are aligned horizontally
                        if (!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row - 1, opponentPos.col)) this.availablePawnMoves.push({ row: opponentPos.row - 1, col: opponentPos.col });
                        if (!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row + 1, opponentPos.col)) this.availablePawnMoves.push({ row: opponentPos.row + 1, col: opponentPos.col });
                    } else { // Pawns are aligned vertically
                        if (!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row, opponentPos.col - 1)) this.availablePawnMoves.push({ row: opponentPos.row, col: opponentPos.col - 1 });
                        if (!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row, opponentPos.col + 1)) this.availablePawnMoves.push({ row: opponentPos.row, col: opponentPos.col + 1 });
                    }
                }
            } else {
                this.availablePawnMoves.push({ row: move.r, col: move.c });
            }
        }
    }

    /**
     * Checks if the placement of a wall is valid.
     * @param {number} row 
     * @param {number} col 
     * @param {'horizontal' | 'vertical'} orientation 
     * @returns {boolean}
     */
    isWallPlacementLegal(row, col, orientation) {
        // 1. Check if player has walls left
        if (this.wallsLeft[this.playerTurn] <= 0) return false;

        // 2. Check if wall is within bounds (wall slots are 0-7)
        if (row < 0 || row > this.boardSize - 2 || col < 0 || col > this.boardSize - 2) return false;

        // 3. Check for overlapping walls
        for (const wall of this.placedWalls) {
            if (wall.row === row && wall.col === col) return false; // Crosses existing wall
            if (orientation === 'horizontal' && wall.orientation === 'horizontal' && wall.row === row && Math.abs(wall.col - col) < 2) return false;
            if (orientation === 'vertical' && wall.orientation === 'vertical' && wall.col === col && Math.abs(wall.row - row) < 2) return false;
        }

        // 4. Check if the wall traps a player
        const tempWall = { row, col, orientation };
        this.placedWalls.push(tempWall);

        const p1Goal = (r, c) => r === this.boardSize - 1;
        const p2Goal = (r, c) => r === 0;

        const p1HasPath = this.#pathExistsFor(this.pawnPositions.p1, p1Goal);
        const p2HasPath = this.#pathExistsFor(this.pawnPositions.p2, p2Goal);

        this.placedWalls.pop(); // Backtrack: remove the temporary wall
        
        return p1HasPath && p2HasPath;
    }

    // --- Private Helper Methods ---

    #isWallBetween(r1, c1, r2, c2) {
        if (r1 === r2) { // Horizontal move
            const wallCol = Math.min(c1, c2);
            return this.placedWalls.some(w => w.orientation === 'vertical' && w.col === wallCol && (w.row === r1 || w.row === r1 - 1));
        } else { // Vertical move
            const wallRow = Math.min(r1, r2);
            return this.placedWalls.some(w => w.orientation === 'horizontal' && w.row === wallRow && (w.col === c1 || w.col === c1 - 1));
        }
    }

    /**
     * BFS from pawn location.
     * If goal is reachable, return true.
     * @param {*} startPos 
     * @param {*} isGoal 
     * @returns {boolean}
     */
    #pathExistsFor(startPos, isGoal) {
        const queue = [startPos];
        const visited = new Set([`${startPos.row},${startPos.col}`]);
        
        while (queue.length > 0) {
            const { row, col } = queue.shift();
            if (isGoal(row, col)) return true;

            const neighbors = [
                { r: row - 1, c: col }, { r: row + 1, c: col },
                { r: row, c: col - 1 }, { r: row, c: col + 1 }
            ];

            for (const n of neighbors) {
                const key = `${n.r},${n.c}`;
                if (n.r >= 0 && n.r < this.boardSize && n.c >= 0 && n.c < this.boardSize && !visited.has(key) && !this.#isWallBetween(row, col, n.r, n.c)) {
                    visited.add(key);
                    queue.push({ row: n.r, col: n.c });
                }
            }
        }
        return false;
    }
}