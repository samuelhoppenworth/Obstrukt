// common/GameLogic.js

/**
 * Checks if a wall directly blocks movement between two adjacent cells.
 */
function isWallBetween(placedWalls, r1, c1, r2, c2) {
    if (c1 === c2) { // Moving vertically
        const wallRow = Math.min(r1, r2);
        return placedWalls.some(wall => 
            wall.orientation === 'horizontal' && wall.row === wallRow && (wall.col === c1 || wall.col === c1 - 1)
        );
    } else if (r1 === r2) { // Moving horizontally
        const wallCol = Math.min(c1, c2);
        return placedWalls.some(wall =>
            wall.orientation === 'vertical' && wall.col === wallCol && (wall.row === r1 || wall.row === r1 - 1)
        );
    }
    return false;
}

/**
 * Performs a Breadth-First Search for pathfinding.
 */
function pathExistsFor(startPos, isGoal, placedWalls, boardSize) {
    if (startPos.row === -1) return true;
    const queue = [startPos];
    const visited = new Set([`${startPos.row},${startPos.col}`]);
    while (queue.length > 0) {
        const { row, col } = queue.shift();
        if (isGoal(row, col)) return true;
        const neighbors = [{ r: row - 1, c: col }, { r: row + 1, c: col }, { r: row, c: col - 1 }, { r: row, c: col + 1 }];
        for (const n of neighbors) {
            const key = `${n.r},${n.c}`;
            if (n.r >= 0 && n.r < boardSize && n.c >= 0 && n.c < boardSize && !visited.has(key) && !isWallBetween(placedWalls, row, col, n.r, n.c)) {
                visited.add(key);
                queue.push({ row: n.r, col: n.c });
            }
        }
    }
    return false;
}

/**
 * Calculates all legal pawn moves for the current player with corrected jump logic.
 */
export function calculateLegalPawnMoves(pawnPositions, placedWalls, players, activePlayerIds, playerTurnIndex, boardSize) {
    const availablePawnMoves = [];
    const currentPlayerId = activePlayerIds[playerTurnIndex];
    if (!currentPlayerId) return [];
    
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const { row, col } = pawnPositions[currentPlayer.id];

    const opponentPositions = players
        .filter(p => p.id !== currentPlayer.id && activePlayerIds.includes(p.id))
        .map(p => pawnPositions[p.id]);

    const potentialMoves = [{ r: row - 1, c: col }, { r: row + 1, c: col }, { r: row, c: col - 1 }, { r: row, c: col + 1 }];

    for (const move of potentialMoves) {
        if (move.r < 0 || move.r >= boardSize || move.c < 0 || move.c >= boardSize) {
            continue;
        }

        const opponentInCell = opponentPositions.find(p => p.row === move.r && p.col === move.c);

        // First, check for a wall between the current player and the target adjacent square.
        // If there's a wall, NO move (neither simple nor jump) is possible in this direction.
        if (isWallBetween(placedWalls, row, col, move.r, move.c)) {
            continue;
        }

        if (opponentInCell) {
            // JUMP CASE: Adjacent square has an opponent and is not blocked by a wall.

            // Check for a straight jump over the opponent.
            const jumpRow = opponentInCell.row + (opponentInCell.row - row);
            const jumpCol = opponentInCell.col + (opponentInCell.col - col);
            const wallBehindOpponent = isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, jumpRow, jumpCol);
            
            if (!wallBehindOpponent && jumpRow >= 0 && jumpRow < boardSize && jumpCol >= 0 && jumpCol < boardSize) {
                // If there's no wall behind, the straight jump is the only possible move.
                availablePawnMoves.push({ row: jumpRow, col: jumpCol });
            } else {
                // If a wall IS behind the opponent, check for diagonal side-steps.
                if (opponentInCell.row === row) { // Opponent is horizontal (left/right)
                    // Check up
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row - 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row - 1, col: opponentInCell.col });
                    // Check down
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row + 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row + 1, col: opponentInCell.col });
                } else { // Opponent is vertical (up/down)
                    // Check left
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col - 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col - 1 });
                    // Check right
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col + 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col + 1 });
                }
            }
        } else {
            // SIMPLE MOVE CASE: The adjacent square is empty and not blocked by a wall.
            availablePawnMoves.push({ row: move.r, col: move.c });
        }
    }

    // Final filter to ensure no move lands on another pawn's square.
    return availablePawnMoves.filter(m => 
        !opponentPositions.some(op => op.row === m.row && op.col === m.col) &&
        m.row >= 0 && m.row < boardSize && m.col >= 0 && m.col < boardSize
    );
}


/**
 * Checks if a proposed wall placement is legal.
 */
export function isWallPlacementLegal(wallData, gameState, players, boardSize) {
    const { row, col, orientation } = wallData;
    const { placedWalls, wallsLeft, pawnPositions, activePlayerIds, playerTurn } = gameState;

    if (!wallsLeft || wallsLeft[playerTurn] <= 0) return false;
    if (row < 0 || row > boardSize - 2 || col < 0 || col > boardSize - 2) return false;

    for (const wall of placedWalls) {
        if (wall.row === row && wall.col === col) return false;
        if (orientation === 'horizontal' && wall.orientation === 'horizontal' && wall.row === row && Math.abs(wall.col - col) < 2) return false;
        if (orientation === 'vertical' && wall.orientation === 'vertical' && wall.col === col && Math.abs(wall.row - row) < 2) return false;
    }

    const tempPlacedWalls = [...placedWalls, wallData];
    
    const activePlayersWithPositions = players.filter(p => activePlayerIds.includes(p.id));
    return activePlayersWithPositions.every(player => 
        pathExistsFor(pawnPositions[player.id], (r, c) => player.goalCondition(r, c, boardSize), tempPlacedWalls, boardSize)
    );
}

/**
 * Checks if a proposed pawn move is legal.
 */
export function isPawnMoveLegal(moveData, availablePawnMoves) {
    return availablePawnMoves.some(move => move.row === moveData.row && move.col === moveData.col);
}