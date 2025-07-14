// src/helpers/GameManager.js

export default class GameManager {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.boardSize = config.boardSize;
        this.numPlayers = config.numPlayers;
        this.players = config.players.slice(0, this.numPlayers);

        this.playerTurnIndex = 0; // Use an index to track turns
        
        // Use objects to store player-specific data, keyed by player ID
        this.pawnPositions = this.players.reduce((acc, player) => {
            acc[player.id] = { ...player.startPos };
            return acc;
        }, {});

        this.wallsLeft = this.players.reduce((acc, player) => {
            acc[player.id] = config.wallsPerPlayer;
            return acc;
        }, {});

        this.placedWalls = [];
        this.gameState = 'active'; // 'active', 'p1_wins', etc.
        this.availablePawnMoves = [];

        this.calculateLegalPawnMoves();
    }

    getCurrentPlayer() {
        return this.players[this.playerTurnIndex];
    }

    getGameState() {
        return {
            playerTurn: this.getCurrentPlayer().id,
            gameState: this.gameState,
            pawnPositions: JSON.parse(JSON.stringify(this.pawnPositions)),
            wallsLeft: { ...this.wallsLeft },
            placedWalls: JSON.parse(JSON.stringify(this.placedWalls)),
            availablePawnMoves: JSON.parse(JSON.stringify(this.availablePawnMoves)),
        };
    }

    movePawn(row, col) {
        if (this.gameState !== 'active') return;

        const isLegal = this.availablePawnMoves.some(move => move.row === row && move.col === col);
        if (!isLegal) {
            console.log("Illegal pawn move attempted.");
            return;
        }

        const currentPlayer = this.getCurrentPlayer();
        this.pawnPositions[currentPlayer.id] = { row, col };

        // Check for win condition using the player's goal function from config
        if (currentPlayer.goalCondition(row, col, this.boardSize)) {
            this.gameState = `${currentPlayer.id}_wins`;
            console.log(`${currentPlayer.id} wins!`);
        }

        if (this.gameState === 'active') {
            this.#switchTurn();
        }

        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    placeWall({ row, col, orientation }) {
        if (this.gameState !== 'active') return;
        
        if (!this.isWallPlacementLegal(row, col, orientation)) {
            console.log("Illegal wall placement attempted.");
            return;
        }
        
        const currentPlayerId = this.getCurrentPlayer().id;
        this.placedWalls.push({ row, col, orientation });
        this.wallsLeft[currentPlayerId]--;
        this.#switchTurn();
        this.scene.events.emit('game-state-updated', this.getGameState());
    }

    #switchTurn() {
        this.playerTurnIndex = (this.playerTurnIndex + 1) % this.numPlayers;
        this.calculateLegalPawnMoves();
        console.log("Switched to %s's turn", this.getCurrentPlayer().id);
    }

    calculateLegalPawnMoves() {
        this.availablePawnMoves = [];
        const currentPlayer = this.getCurrentPlayer();
        const { row, col } = this.pawnPositions[currentPlayer.id];

        const opponentPositions = this.players
            .filter(p => p.id !== currentPlayer.id)
            .map(p => this.pawnPositions[p.id]);

        const potentialMoves = [
            { r: row - 1, c: col }, { r: row + 1, c: col },
            { r: row, c: col - 1 }, { r: row, c: col + 1 },
        ];

        for (const move of potentialMoves) {
            // Check move bounds and obstructing walls
            if (move.r < 0 || move.r >= this.boardSize || move.c < 0 || move.c >= this.boardSize || this.#isWallBetween(row, col, move.r, move.c)) continue;
            
            // Check if jumps are possible
            const opponentInCell = opponentPositions.find(p => p.row === move.r && p.col === move.c);
            if (opponentInCell) {
                const jumpRow = opponentInCell.row + (opponentInCell.row - row);
                const jumpCol = opponentInCell.col + (opponentInCell.col - col);
                
                // Check if the destination is occupied by another opponent.
                const isDestinationOccupied = opponentPositions.some(p => p.row === jumpRow && p.col === jumpCol);

                if (!this.#isWallBetween(opponentInCell.row, opponentInCell.col, jumpRow, jumpCol) &&
                    jumpRow >= 0 && jumpRow < this.boardSize &&
                    jumpCol >= 0 && jumpCol < this.boardSize &&
                    !isDestinationOccupied) {
                    this.availablePawnMoves.push({ row: jumpRow, col: jumpCol });
                } else { // Diagonal jumps are only possible if the straight jump is blocked (by wall OR another pawn)
                    const dirRow = opponentInCell.row - row;
                    const dirCol = opponentInCell.col - col;
                    if(dirRow === 0){ // Horizontal alignment
                        if(!this.#isWallBetween(opponentInCell.row, opponentInCell.col, opponentInCell.row - 1, opponentInCell.col)) this.availablePawnMoves.push({ row: opponentInCell.row - 1, col: opponentInCell.col });
                        if(!this.#isWallBetween(opponentInCell.row, opponentInCell.col, opponentInCell.row + 1, opponentInCell.col)) this.availablePawnMoves.push({ row: opponentInCell.row + 1, col: opponentInCell.col });
                    } else if (dirCol === 0){ // Vertical alignment
                        if(!this.#isWallBetween(opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col - 1)) this.availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col - 1 });
                        if(!this.#isWallBetween(opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col + 1)) this.availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col + 1 });
                    }
                }
            } else {
                this.availablePawnMoves.push({ row: move.r, col: move.c });
            }
        }
        // Filter out any diagonal jumps that land on a third pawn
        this.availablePawnMoves = this.availablePawnMoves.filter(m => 
            !opponentPositions.some(op => op.row === m.row && op.col === m.col) &&
            m.row >= 0 && m.row < this.boardSize && m.col >= 0 && m.col < this.boardSize
        );
    }

    isWallPlacementLegal(row, col, orientation) {
        const currentPlayerId = this.getCurrentPlayer().id;
        if (this.wallsLeft[currentPlayerId] <= 0) return false;
        if (row < 0 || row > this.boardSize - 2 || col < 0 || col > this.boardSize - 2) return false;

        for (const wall of this.placedWalls) {
            if (wall.row === row && wall.col === col) return false;
            if (orientation === 'horizontal' && wall.orientation === 'horizontal' && wall.row === row && Math.abs(wall.col - col) < 2) return false;
            if (orientation === 'vertical' && wall.orientation === 'vertical' && wall.col === col && Math.abs(wall.row - row) < 2) return false;
        }

        // Check if the wall traps any player
        const tempWall = { row, col, orientation };
        this.placedWalls.push(tempWall);

        const allPlayersHavePath = this.players.every(player => 
            this.#pathExistsFor(this.pawnPositions[player.id], (r, c) => player.goalCondition(r, c, this.boardSize))
        );

        this.placedWalls.pop(); // Backtrack
        
        return allPlayersHavePath;
    }

    #isWallBetween(r1, c1, r2, c2) {
        if (r1 === r2) {
            const wallCol = Math.min(c1, c2);
            return this.placedWalls.some(w => w.orientation === 'vertical' && w.col === wallCol && (w.row === r1 || w.row === r1 - 1));
        } else if (c1 === c2) {
            const wallRow = Math.min(r1, r2);
            return this.placedWalls.some(w => w.orientation === 'horizontal' && w.row === wallRow && (w.col === c1 || w.col === c1 - 1));
        }
        return false;
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