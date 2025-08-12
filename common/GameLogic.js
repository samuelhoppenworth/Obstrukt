// common/GameLogic.js

/**
 * Creates the initial state object for a new game.
 * @param {object} config - The game configuration.
 * @returns {object} The initial game state.
 */
export function createInitialState(config) {
    return {
        boardSize: config.boardSize,
        status: 'active',
        winner: null,
        reason: null,
        playerTurn: config.players[0].id,
        pawnPositions: config.players.reduce((acc, p) => { acc[p.id] = p.startPos(config.boardSize); return acc; }, {}),
        wallsLeft: config.players.reduce((acc, p) => { acc[p.id] = config.wallsPerPlayer; return acc; }, {}),
        timers: config.players.reduce((acc, p) => { acc[p.id] = config.timePerPlayer; return acc; }, {}),
        placedWalls: [],
        activePlayerIds: config.players.map(p => p.id),
        playerTurnIndex: 0,
        availablePawnMoves: [],
        drawOfferFrom: null,
    };
}

/**
 * The main dispatcher for applying a move. It validates and applies the move, returning a new state.
 * @param {object} gameState The current game state.
 * @param {object} move The move to apply { type: 'cell'/'wall', data: {...} }.
 * @param {Array} players The array of player configurations.
 * @param {object} config The game configuration.
 * @returns {object|null} The new game state, or null if the move is illegal.
 */
export function applyMove(gameState, move, players, config) {
    let newGameState = JSON.parse(JSON.stringify(gameState));

    if (move.type === 'cell') {
        const legalMoves = calculateLegalPawnMoves(newGameState.pawnPositions, newGameState.placedWalls, players, newGameState.activePlayerIds, newGameState.playerTurnIndex, newGameState.boardSize);
        const isLegal = legalMoves.some(legalMove => legalMove.row === move.data.row && legalMove.col === move.data.col);
        if (!isLegal) return null;
        newGameState = applyPawnMove(newGameState, move.data, players, config);
    } else if (move.type === 'wall') {
        if (!isWallPlacementLegal(move.data, newGameState, players, newGameState.boardSize)) return null;
        newGameState = applyWallPlacement(newGameState, move.data);
    }

    if (newGameState.status === 'active') {
        newGameState.availablePawnMoves = calculateLegalPawnMoves(
            newGameState.pawnPositions, newGameState.placedWalls,
            players, newGameState.activePlayerIds,
            newGameState.playerTurnIndex, newGameState.boardSize
        );
    }

    return newGameState;
}

/**
 * Applies a player losing, removes them from the turn order, and checks for a winner.
 * @param {object} gameState The current game state.
 * @param {string} losingPlayerId The ID of the player who lost.
 * @param {string} reason The reason for the loss.
 * @returns {object} The new game state.
 */
export function applyPlayerLoss(gameState, losingPlayerId, reason) {
    let newGameState = JSON.parse(JSON.stringify(gameState));
    if (newGameState.status !== 'active') return newGameState;

    const playerIndex = newGameState.activePlayerIds.indexOf(losingPlayerId);
    if (playerIndex === -1) return newGameState;
    
    newGameState.activePlayerIds.splice(playerIndex, 1);
    newGameState.pawnPositions[losingPlayerId] = { row: -1, col: -1 };
    
    if (newGameState.activePlayerIds.length === 1) {
        newGameState.status = 'ended';
        newGameState.winner = newGameState.activePlayerIds[0];
        newGameState.reason = 'last player standing';
        newGameState.playerTurn = null;
    } else {
        const turnWasLosers = newGameState.playerTurn === losingPlayerId;
        if (turnWasLosers) {
             // The turn index of the loser might now be out of bounds for the new array size.
             // We adjust to the same index, which now points to the *next* player.
            newGameState.playerTurnIndex = playerIndex % newGameState.activePlayerIds.length;
            newGameState.playerTurn = newGameState.activePlayerIds[newGameState.playerTurnIndex];
        } else {
            // The loser wasn't the current player, so we need to find the new index of the current player.
            newGameState.playerTurnIndex = newGameState.activePlayerIds.indexOf(newGameState.playerTurn);
        }
    }

    return newGameState;
}


// --- Internal Helper Functions ---

function applyPawnMove(gameState, moveData, players, config) {
    const currentPlayerId = gameState.playerTurn;
    gameState.pawnPositions[currentPlayerId] = moveData;

    const playerConfig = players.find(p => p.id === currentPlayerId);
    if (playerConfig.goalCondition(moveData.row, moveData.col, config.boardSize)) {
        gameState.status = 'ended';
        gameState.winner = currentPlayerId;
        gameState.reason = 'goal';
    } else {
        gameState = switchTurn(gameState);
    }
    return gameState;
}

function applyWallPlacement(gameState, wallData) {
    gameState.placedWalls.push(wallData);
    gameState.wallsLeft[gameState.playerTurn]--;
    gameState = switchTurn(gameState);
    return gameState;
}

function switchTurn(gameState) {
    gameState.playerTurnIndex = (gameState.playerTurnIndex + 1) % gameState.activePlayerIds.length;
    gameState.playerTurn = gameState.activePlayerIds[gameState.playerTurnIndex];
    return gameState;
}


// --- Validation and Pathfinding Logic ---

export function isWallPlacementLegal(wallData, gameState, players, boardSize) {
    if (gameState.wallsLeft[gameState.playerTurn] <= 0) return false;
    if (wallData.row < 0 || wallData.row > boardSize - 2 || wallData.col < 0 || wallData.col > boardSize - 2) return false;

    // Check for overlap with existing walls
    for (const wall of gameState.placedWalls) {
        if (wall.row === wallData.row && wall.col === wallData.col) return false; // Direct overlap
        if (wallData.orientation === 'horizontal' && wall.orientation === 'horizontal' && wall.row === wallData.row && Math.abs(wall.col - wallData.col) < 2) return false;
        if (wallData.orientation === 'vertical' && wall.orientation === 'vertical' && wall.col === wallData.col && Math.abs(wall.row - wallData.row) < 2) return false;
    }

    // Check if it traps any player
    const tempPlacedWalls = [...gameState.placedWalls, wallData];
    for (const playerId of gameState.activePlayerIds) {
        const playerConfig = players.find(p => p.id === playerId);
        const playerPos = gameState.pawnPositions[playerId];
        if (playerConfig && playerPos.row !== -1) {
            if (!pathExistsFor(playerPos, playerConfig.goalCondition, tempPlacedWalls, boardSize)) {
                return false;
            }
        }
    }

    return true;
}

export function calculateLegalPawnMoves(pawnPositions, placedWalls, players, activePlayerIds, playerTurnIndex, boardSize) {
    const availablePawnMoves = [];
    if (playerTurnIndex >= activePlayerIds.length) return availablePawnMoves;
    
    const currentPlayerId = activePlayerIds[playerTurnIndex];
    if (!pawnPositions[currentPlayerId] || pawnPositions[currentPlayerId].row === -1) return availablePawnMoves;

    const { row, col } = pawnPositions[currentPlayerId];
    
    const opponentPositions = players
        .filter(p => p.id !== currentPlayerId && activePlayerIds.includes(p.id))
        .map(p => pawnPositions[p.id]);

    const potentialMoves = [{ r: row - 1, c: col }, { r: row + 1, c: col }, { r: row, c: col - 1 }, { r: row, c: col + 1 }];

    for (const move of potentialMoves) {
        if (move.r < 0 || move.r >= boardSize || move.c < 0 || move.c >= boardSize) continue;

        const opponentInCell = opponentPositions.find(p => p.row === move.r && p.col === move.c);

        if (isWallBetween(placedWalls, row, col, move.r, move.c)) continue;
        
        if (opponentInCell) { // Jump logic
            const jumpRow = opponentInCell.row + (opponentInCell.row - row);
            const jumpCol = opponentInCell.col + (opponentInCell.col - col);
            const wallBehindOpponent = isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, jumpRow, jumpCol);

            if (!wallBehindOpponent && jumpRow >= 0 && jumpRow < boardSize && jumpCol >= 0 && jumpCol < boardSize) {
                availablePawnMoves.push({ row: jumpRow, col: jumpCol });
            } else { // Diagonal jumps
                if (opponentInCell.row === row) { // Horizontal opponent
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row - 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row - 1, col: opponentInCell.col });
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row + 1, opponentInCell.col)) availablePawnMoves.push({ row: opponentInCell.row + 1, col: opponentInCell.col });
                } else { // Vertical opponent
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col - 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col - 1 });
                    if (!isWallBetween(placedWalls, opponentInCell.row, opponentInCell.col, opponentInCell.row, opponentInCell.col + 1)) availablePawnMoves.push({ row: opponentInCell.row, col: opponentInCell.col + 1 });
                }
            }
        } else {
            availablePawnMoves.push({ row: move.r, col: move.c });
        }
    }

    // Final filter to remove any moves that land on an opponent (can happen in diagonal jump logic)
    return availablePawnMoves.filter(m => !opponentPositions.some(op => op.row === m.row && op.col === m.col));
}

function isWallBetween(placedWalls, r1, c1, r2, c2) {
    if (c1 === c2) { // Vertical move
        const wallRow = Math.min(r1, r2);
        for (const wall of placedWalls) {
            if (wall.orientation === "horizontal" && wall.row === wallRow && (wall.col === c1 || wall.col === c1 - 1)) return true;
        }
    } else if (r1 === r2) { // Horizontal move
        const wallCol = Math.min(c1, c2);
        for (const wall of placedWalls) {
            if (wall.orientation === "vertical" && wall.col === wallCol && (wall.row === r1 || wall.row === r1 - 1)) return true;
        }
    }
    return false;
}

function pathExistsFor(startPos, goalCondition, placedWalls, boardSize) {
    if (startPos.row === -1) return true; // Player is already out of the game
    return getShortestPathLength(startPos, goalCondition, placedWalls, boardSize) !== -1;
}

function getShortestPathLength(startPos, goalCondition, placedWalls, boardSize) {
    if (goalCondition(startPos.row, startPos.col, boardSize)) return 0;
    
    const queue = [{ pos: startPos, dist: 0 }];
    const visited = new Set([`${startPos.row},${startPos.col}`]);

    while (queue.length > 0) {
        const { pos, dist } = queue.shift();

        const neighbors = [
            { row: pos.row - 1, col: pos.col }, { row: pos.row + 1, col: pos.col },
            { row: pos.row, col: pos.col - 1 }, { row: pos.row, col: pos.col + 1 }
        ];

        for (const neighbor of neighbors) {
            if (neighbor.row >= 0 && neighbor.row < boardSize && neighbor.col >= 0 && neighbor.col < boardSize) {
                const visitedKey = `${neighbor.row},${neighbor.col}`;
                if (!visited.has(visitedKey) && !isWallBetween(placedWalls, pos.row, pos.col, neighbor.row, neighbor.col)) {
                    if (goalCondition(neighbor.row, neighbor.col, boardSize)) {
                        return dist + 1;
                    }
                    visited.add(visitedKey);
                    queue.push({ pos: neighbor, dist: dist + 1 });
                }
            }
        }
    }
    return -1; // No path found
}