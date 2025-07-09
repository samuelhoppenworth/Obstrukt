export default class GameManager {
    constructor(scene, config) {
        this.scene = scene; // For emitting events
        this.boardSize = config.boardSize;
        this.playerTurn = 'p1';
        this.pawnPositions = {
            p1: { ...config.p1Start },
            p2: { ...config.p2Start }
        };
        this.wallsLeft = {
            p1: config.numWalls,
            p2: config.numWalls
        };
        this.placedWalls = [];
        this.gameState = 'active'; // 'active', 'p1_wins', 'p2_wins'
        this.availablePawnMoves = [];

        this.calculateLegalPawnMoves();
    }

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

    movePawn(row, col) {
        const isLegal = this.availablePawnMoves.some(move => move.row === row && move.col === col);
        if (!isLegal) {
            console.log("Illegal pawn move attempted.");
            return;
        }

        this.pawnPositions[this.playerTurn] = { row, col };

        // Check for win condition
        if (this.playerTurn === 'p1' && row === this.boardSize - 1) {
            this.gameState = 'p1_wins';
        } else if (this.playerTurn === 'p2' && row === 0) {
            this.gameState = 'p2_wins';
        }

        if (this.gameState === 'active') {
            this.#switchTurn();
        }
        
        // Announce that the state has changed
        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    placeWall({ row, col, orientation }) {
        if (!this.isWallPlacementLegal(row, col, orientation)) {
            console.log("Illegal wall placement attempted.");
            return;
        }
        
        this.placedWalls.push({ row, col, orientation });
        this.wallsLeft[this.playerTurn]--;
        this.#switchTurn();

        // Announce that the state has changed
        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    #switchTurn() {
        this.playerTurn = (this.playerTurn === 'p1') ? 'p2' : 'p1';
        this.calculateLegalPawnMoves();
    }

    calculateLegalPawnMoves() {
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
            const isOutOfBounds = move.r < 0 || move.r >= this.boardSize || move.c < 0 || move.c >= this.boardSize;
            if (isOutOfBounds || this.#isWallBetween(row, col, move.r, move.c)) continue;

            // Check if opponent is in the target cell
            if (move.r === opponentPos.row && move.c === opponentPos.col) {
                // Handle jumps
                const jumpRow = opponentPos.row + (opponentPos.row - row);
                const jumpCol = opponentPos.col + (opponentPos.col - col);
                
                // Check if space behind opponent is clear for a straight jump
                if (!this.#isWallBetween(opponentPos.row, opponentPos.col, jumpRow, jumpCol) && jumpRow >= 0 && jumpRow < this.boardSize && jumpCol >= 0 && jumpCol < this.boardSize) {
                    this.availablePawnMoves.push({ row: jumpRow, col: jumpCol });
                } else {
                    // Handle diagonal jumps if straight jump is blocked
                    const dirRow = opponentPos.row - row; // e.g., 1, -1, 0
                    const dirCol = opponentPos.col - col; // e.g., 1, -1, 0
                    if(dirRow === 0){ // Pawns are aligned horizontally
                        if(!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row - 1, opponentPos.col)) this.availablePawnMoves.push({ row: opponentPos.row - 1, col: opponentPos.col });
                        if(!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row + 1, opponentPos.col)) this.availablePawnMoves.push({ row: opponentPos.row + 1, col: opponentPos.col });
                    } else if (dirCol === 0){ // Pawns are aligned vertically
                        if(!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row, opponentPos.col - 1)) this.availablePawnMoves.push({ row: opponentPos.row, col: opponentPos.col - 1 });
                        if(!this.#isWallBetween(opponentPos.row, opponentPos.col, opponentPos.row, opponentPos.col + 1)) this.availablePawnMoves.push({ row: opponentPos.row, col: opponentPos.col + 1 });
                    }
                }
            } else {
                this.availablePawnMoves.push({ row: move.r, col: move.c });
            }
        }
        // Filter out any invalid moves that might land on the opponent if not part of a valid jump
        this.availablePawnMoves = this.availablePawnMoves.filter(m => (m.row !== opponentPos.row || m.col !== opponentPos.col) && (m.row >= 0 && m.row < this.boardSize && m.col >= 0 && m.col < this.boardSize));
    }

    isWallPlacementLegal(row, col, orientation) {
        // 1. Check if player has walls left
        if (this.wallsLeft[this.playerTurn] <= 0) return false;

        // 2. Check if wall is within bounds (wall slots are 0-7)
        if (row < 0 || row > this.boardSize - 2 || col < 0 || col > this.boardSize - 2) return false;

        // 3. Check for overlapping walls
        for (const wall of this.placedWalls) {
            // Exact same slot
            if (wall.row === row && wall.col === col) return false;
            // Overlapping horizontal walls
            if (orientation === 'horizontal' && wall.orientation === 'horizontal' && wall.row === row && Math.abs(wall.col - col) < 2) return false;
            // Overlapping vertical walls
            if (orientation === 'vertical' && wall.orientation === 'vertical' && wall.col === col && Math.abs(wall.row - row) < 2) return false;
        }

        // 4. Check if the wall traps a player
        const tempWall = { row, col, orientation };
        this.placedWalls.push(tempWall);

        const p1HasPath = this.#pathExistsFor(this.pawnPositions.p1, (r) => r === this.boardSize - 1);
        const p2HasPath = this.#pathExistsFor(this.pawnPositions.p2, (r) => r === 0);

        this.placedWalls.pop(); // Backtrack: remove the temporary wall
        
        return p1HasPath && p2HasPath;
    }

    #isWallBetween(r1, c1, r2, c2) {
        if (r1 === r2) { // Horizontal move
            const wallCol = Math.min(c1, c2);
            return this.placedWalls.some(w => w.orientation === 'vertical' && w.col === wallCol && (w.row === r1 || w.row === r1 - 1));
        } else if (c1 === c2) { // Vertical move
            const wallRow = Math.min(r1, r2);
            return this.placedWalls.some(w => w.orientation === 'horizontal' && w.row === wallRow && (w.col === c1 || w.col === c1 - 1));
        }
        return false; // Not an adjacent move
    }

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