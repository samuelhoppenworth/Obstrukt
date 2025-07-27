// common/GameLogic.js

export function applyPlayerLoss(gameState, losingPlayerId, reason) {
    if (gameState.status !== 'active') return gameState;

    let newState = JSON.parse(JSON.stringify(gameState));

    const loserIndex = newState.activePlayerIds.indexOf(losingPlayerId);
    if (loserIndex > -1) {
        newState.activePlayerIds.splice(loserIndex, 1);
        newState.pawnPositions[losingPlayerId] = { row: -1, col: -1 };
    } else {
        return gameState;
    }
    
    if (newState.activePlayerIds.length <= 1) {
        const winnerId = newState.activePlayerIds[0] || null;
        newState.status = 'ended';
        newState.winner = winnerId;
        const finalReason = winnerId && reason !== 'goal' ? 'last player standing' : reason;
        newState.reason = winnerId ? finalReason : 'draw';
        newState.playerTurn = null;
        newState.availablePawnMoves = [];
    } else {
        if (newState.playerTurnIndex >= loserIndex) {
            newState.playerTurnIndex %= newState.activePlayerIds.length;
        }
        newState.playerTurn = newState.activePlayerIds[newState.playerTurnIndex];
    }

    return newState;
}

function _applySwitchTurn(gameState) {
    const newState = { ...gameState };
    newState.playerTurnIndex = (newState.playerTurnIndex + 1) % newState.activePlayerIds.length;
    newState.playerTurn = newState.activePlayerIds[newState.playerTurnIndex];
    return newState;
}

function _applyPawnMove(gameState, moveData, players, boardSize) {
    let newState = JSON.parse(JSON.stringify(gameState));
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

function _applyWallPlacement(gameState, wallData) {
    let newState = JSON.parse(JSON.stringify(gameState));
    const currentPlayerId = newState.playerTurn;
    newState.placedWalls.push(wallData);
    newState.wallsLeft[currentPlayerId]--;
    newState = _applySwitchTurn(newState);
    return newState;
}

export function applyMove(gameState, move, players, config) {
    if (!move || !move.type || gameState.status !== 'active') return null;

    let isLegal = false;
    let nextState = null;

    console.log("apply move ", move);
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
    }
    console.log("islegal: ", isLegal);
    console.log("nextState: ", nextState);

    if (isLegal && nextState) {
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
    
    return null;
}

function isWallBetween(placedWalls, r1, c1, r2, c2) {
    if (c1 === c2) {
        const wallRow = Math.min(r1, r2);
        return placedWalls.some(wall => 
            wall.orientation === 'horizontal' && wall.row === wallRow && (wall.col === c1 || wall.col === c1 - 1)
        );
    } else if (r1 === r2) {
        const wallCol = Math.min(c1, c2);
        return placedWalls.some(wall =>
            wall.orientation === 'vertical' && wall.col === wallCol && (wall.row === r1 || wall.row === r1 - 1)
        );
    }
    return false;
}

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

export function isPawnMoveLegal(moveData, availablePawnMoves) {
    return availablePawnMoves.some(move => move.row === moveData.row && move.col === moveData.col);
}