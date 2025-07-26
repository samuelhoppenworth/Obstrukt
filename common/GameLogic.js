// common/GameLogic.js

/**
 * Applies a player's loss to the game state, returning a new state.
 * @param {object} gameState - The current game state.
 * @param {string} losingPlayerId - The ID of the player who lost.
 * @param {string} reason - The reason for the loss (e.g., 'timeout', 'resignation').
 * @returns {object} The new game state.
 */
export function applyPlayerLoss(gameState, losingPlayerId, reason) {
    if (gameState.status !== 'active') return gameState;

    let newState = JSON.parse(JSON.stringify(gameState)); // Deep copy

    const loserIndex = newState.activePlayerIds.indexOf(losingPlayerId);
    if (loserIndex > -1) {
        newState.activePlayerIds.splice(loserIndex, 1);
        newState.pawnPositions[losingPlayerId] = { row: -1, col: -1 };
    } else {
        return gameState; // Player not found or already removed
    }
    
    // Check for game end condition
    if (newState.activePlayerIds.length <= 1) {
        const winnerId = newState.activePlayerIds[0] || null;
        newState.status = 'ended';
        newState.winner = winnerId;
        // Adjust reason if winner is declared due to others losing
        const finalReason = winnerId && reason !== 'goal' ? 'last player standing' : reason;
        newState.reason = winnerId ? finalReason : 'draw';
        newState.playerTurn = null;
        newState.availablePawnMoves = [];
    } else {
        // The game continues, adjust the turn index if needed
        if (newState.playerTurnIndex >= loserIndex) {
            newState.playerTurnIndex %= newState.activePlayerIds.length;
        }
        newState.playerTurn = newState.activePlayerIds[newState.playerTurnIndex];
        // Note: Recalculating moves will be handled by the caller after this function
    }

    return newState;
}


/**
 * Switches the turn to the next active player.
 * @param {object} gameState - The current game state.
 * @returns {object} A new game state with the turn advanced.
 */
function _applySwitchTurn(gameState) {
    const newState = { ...gameState };
    newState.playerTurnIndex = (newState.playerTurnIndex + 1) % newState.activePlayerIds.length;
    newState.playerTurn = newState.activePlayerIds[newState.playerTurnIndex];
    return newState;
}

/**
 * Applies a pawn move to the game state.
 * @param {object} gameState - The current game state.
 * @param {object} moveData - The move data ({row, col}).
 * @param {array} players - The array of player configurations.
 * @param {number} boardSize - The size of the board.
 * @returns {object} The new game state.
 */
function _applyPawnMove(gameState, moveData, players, boardSize) {
    let newState = JSON.parse(JSON.stringify(gameState)); // Deep copy
    const currentPlayerId = newState.playerTurn;
    newState.pawnPositions[currentPlayerId] = { row: moveData.row, col: moveData.col };
    
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    if (currentPlayer.goalCondition(moveData.row, moveData.col, boardSize)) {
        newState.status = 'ended';
        newState.winner = currentPlayerId;
        newState.reason = 'goal';
        newState.playerTurn = null;
        newState.availablePawnMoves = [];
    } else {
        newState = _applySwitchTurn(newState);
    }
    return newState;
}

/**
 * Applies a wall placement to the game state.
 * @param {object} gameState - The current game state.
 * @param {object} wallData - The wall data ({row, col, orientation}).
 * @returns {object} The new game state.
 */
function _applyWallPlacement(gameState, wallData) {
    let newState = JSON.parse(JSON.stringify(gameState)); // Deep copy
    const currentPlayerId = newState.playerTurn;
    newState.placedWalls.push(wallData);
    newState.wallsLeft[currentPlayerId]--;
    newState = _applySwitchTurn(newState);
    return newState;
}


/**
 * The main entry point for processing a move. It validates the move and, if legal,
 * returns a new game state with the move applied.
 * @param {object} gameState - The current game state.
 * @param {object} move - The move object ({type, data}).
 * @param {array} players - The array of player configurations.
 * @param {object} config - The game configuration object.
 * @returns {object|null} The new game state if the move was legal, otherwise null.
 */
export function applyMove(gameState, move, players, config) {
    if (!move || !move.type || gameState.status !== 'active') return null;

    let isLegal = false;
    let nextState = null;

    switch (move.type) {
        case 'cell':
            isLegal = isPawnMoveLegal(move.data, gameState.availablePawnMoves);
            if (isLegal) {
                nextState = _applyPawnMove(gameState, move.data, players, config.boardSize);
            }
            break;
        case 'wall':
            isLegal = isWallPlacementLegal(move.data, gameState, players, config.boardSize);
            if(isLegal) {
                nextState = _applyWallPlacement(gameState, move.data);
            }
            break;
        case 'resign':
            isLegal = true; // Resigning is always legal
            nextState = applyPlayerLoss(gameState, gameState.playerTurn, 'resignation');
            break;
    }

    if (isLegal && nextState) {
        // If the game is still active after the move, recalculate the next player's legal moves.
        if (nextState.status === 'active') {
            nextState.availablePawnMoves = calculateLegalPawnMoves(
                nextState.pawnPositions,
                nextState.placedWalls,
                players,
                nextState.activePlayerIds,
                nextState.playerTurnIndex,
                config.boardSize
            );
        }
        return nextState;
    }
    
    return null; // Return null if the move was illegal
}

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

        if (isWallBetween(placedWalls, row, col, move.r, move.c)) {
            continue;
        }

        if (opponentInCell) {
            const jumpRow = opponentInCell.row + (opponentInCell.row - row);
            const jumpCol = opponentInCell.col + (opponentInCell.col - col);
            const wallBehindOpponent = isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, jumpRow, jumpCol);
            
            if (!wallBehindOpponent && jumpRow >= 0 && jumpRow < boardSize && jumpCol >= 0 && jumpCol < boardSize) {
                availablePawnMoves.push({ row: jumpRow, col: jumpCol });
            } else {
                if (opponentInCell.row === row) { 
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row - 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row - 1, col: opponentInCell.col });
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row + 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row + 1, col: opponentInCell.col });
                } else {
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col - 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col - 1 });
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col + 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col + 1 });
                }
            }
        } else {
            availablePawnMoves.push({ row: move.r, col: move.c });
        }
    }

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