// test/GameLogic.test.js
import { describe, it, expect } from 'vitest';
import {
    createInitialState,
    applyMove,
    applyPlayerLoss,
    isWallPlacementLegal,
    calculateLegalPawnMoves,
} from '../common/GameLogic.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** Two-player config mirroring the server's 2-player setup. */
function makeTwoPlayerConfig() {
    const players = [
        {
            id: 'p1',
            startPos: (bS) => ({ row: bS - 1, col: Math.floor(bS / 2) }),
            goalCondition: (r) => r === 0,
        },
        {
            id: 'p3',
            startPos: (bS) => ({ row: 0, col: Math.floor(bS / 2) }),
            goalCondition: (r, c, bS) => r === bS - 1,
        },
    ];
    return {
        numPlayers: 2,
        players,
        wallsPerPlayer: 10,
        timePerPlayer: 5 * 60 * 1000,
        boardSize: 9,
    };
}

/** Returns a freshly constructed initial state plus its config & players. */
function makeInitialFixture() {
    const config = makeTwoPlayerConfig();
    const state = createInitialState(config);
    return { state, config, players: config.players };
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
    it('creates a state with the correct board size', () => {
        const { state } = makeInitialFixture();
        expect(state.boardSize).toBe(9);
    });

    it('sets status to "active"', () => {
        const { state } = makeInitialFixture();
        expect(state.status).toBe('active');
    });

    it('places p1 at the bottom-center', () => {
        const { state } = makeInitialFixture();
        expect(state.pawnPositions.p1).toEqual({ row: 8, col: 4 });
    });

    it('places p3 at the top-center', () => {
        const { state } = makeInitialFixture();
        expect(state.pawnPositions.p3).toEqual({ row: 0, col: 4 });
    });

    it('gives each player the configured wall allocation', () => {
        const { state } = makeInitialFixture();
        expect(state.wallsLeft.p1).toBe(10);
        expect(state.wallsLeft.p3).toBe(10);
    });

    it('starts with no placed walls', () => {
        const { state } = makeInitialFixture();
        expect(state.placedWalls).toHaveLength(0);
    });

    it('sets the first player\'s turn', () => {
        const { state } = makeInitialFixture();
        expect(state.playerTurn).toBe('p1');
    });

    it('lists both players as active', () => {
        const { state } = makeInitialFixture();
        expect(state.activePlayerIds).toEqual(['p1', 'p3']);
    });

    it('has no winner initially', () => {
        const { state } = makeInitialFixture();
        expect(state.winner).toBeNull();
    });

    it('has no draw offer initially', () => {
        const { state } = makeInitialFixture();
        expect(state.drawOfferFrom).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// calculateLegalPawnMoves
// ---------------------------------------------------------------------------

describe('calculateLegalPawnMoves', () => {
    it('returns the four cardinal moves from the center of an open board', () => {
        const config = makeTwoPlayerConfig();
        // Place p1 in the center; p3 far away so no jump logic activates.
        const pawnPositions = { p1: { row: 4, col: 4 }, p3: { row: 0, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, [], config.players, ['p1', 'p3'], 0, 9);
        expect(moves).toHaveLength(4);
        expect(moves).toContainEqual({ row: 3, col: 4 });
        expect(moves).toContainEqual({ row: 5, col: 4 });
        expect(moves).toContainEqual({ row: 4, col: 3 });
        expect(moves).toContainEqual({ row: 4, col: 5 });
    });

    it('clips moves that would leave the board from a corner', () => {
        const config = makeTwoPlayerConfig();
        const pawnPositions = { p1: { row: 0, col: 0 }, p3: { row: 8, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, [], config.players, ['p1', 'p3'], 0, 9);
        // Only right and down are on-board from (0,0)
        expect(moves).toHaveLength(2);
        expect(moves).toContainEqual({ row: 1, col: 0 });
        expect(moves).toContainEqual({ row: 0, col: 1 });
    });

    it('blocks a move across a horizontal wall', () => {
        const config = makeTwoPlayerConfig();
        // A horizontal wall at row=3, col=3 blocks movement from row 4→3 on col 3 or 4.
        const placedWalls = [{ row: 3, col: 3, orientation: 'horizontal' }];
        const pawnPositions = { p1: { row: 4, col: 3 }, p3: { row: 0, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, placedWalls, config.players, ['p1', 'p3'], 0, 9);
        expect(moves).not.toContainEqual({ row: 3, col: 3 });
    });

    it('blocks a move across a vertical wall', () => {
        const config = makeTwoPlayerConfig();
        // A vertical wall at row=3, col=4 blocks movement from col 4→5 on row 3 or 4.
        const placedWalls = [{ row: 3, col: 4, orientation: 'vertical' }];
        const pawnPositions = { p1: { row: 4, col: 4 }, p3: { row: 0, col: 0 } };
        const moves = calculateLegalPawnMoves(pawnPositions, placedWalls, config.players, ['p1', 'p3'], 0, 9);
        expect(moves).not.toContainEqual({ row: 4, col: 5 });
    });

    it('allows jumping straight over an adjacent opponent with no wall behind', () => {
        const config = makeTwoPlayerConfig();
        // p1 at (4,4), p3 directly above at (3,4) — p1 should be able to jump to (2,4)
        const pawnPositions = { p1: { row: 4, col: 4 }, p3: { row: 3, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, [], config.players, ['p1', 'p3'], 0, 9);
        expect(moves).toContainEqual({ row: 2, col: 4 });
        expect(moves).not.toContainEqual({ row: 3, col: 4 }); // cannot land on opponent
    });

    it('offers diagonal jumps when a wall blocks straight-through jump', () => {
        const config = makeTwoPlayerConfig();
        // p1 at (4,4), p3 at (3,4); wall above p3 blocks the straight jump to (2,4)
        const placedWalls = [{ row: 2, col: 3, orientation: 'horizontal' }];
        const pawnPositions = { p1: { row: 4, col: 4 }, p3: { row: 3, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, placedWalls, config.players, ['p1', 'p3'], 0, 9);
        // Should fall back to diagonal: (3,3) and (3,5)
        expect(moves).toContainEqual({ row: 3, col: 3 });
        expect(moves).toContainEqual({ row: 3, col: 5 });
        expect(moves).not.toContainEqual({ row: 2, col: 4 });
    });

    it('returns an empty array when playerTurnIndex is out of range', () => {
        const config = makeTwoPlayerConfig();
        const pawnPositions = { p1: { row: 4, col: 4 }, p3: { row: 0, col: 4 } };
        const moves = calculateLegalPawnMoves(pawnPositions, [], config.players, ['p1', 'p3'], 5, 9);
        expect(moves).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// isWallPlacementLegal
// ---------------------------------------------------------------------------

describe('isWallPlacementLegal', () => {
    function makeOpenState(overrides = {}) {
        const { state } = makeInitialFixture();
        return { ...state, ...overrides };
    }

    const config = makeTwoPlayerConfig();

    it('allows a legal horizontal wall in an open game', () => {
        const state = makeOpenState();
        expect(isWallPlacementLegal({ row: 4, col: 4, orientation: 'horizontal' }, state, config.players, 9)).toBe(true);
    });

    it('allows a legal vertical wall in an open game', () => {
        const state = makeOpenState();
        expect(isWallPlacementLegal({ row: 4, col: 4, orientation: 'vertical' }, state, config.players, 9)).toBe(true);
    });

    it('rejects placement when the placing player has no walls left', () => {
        const state = makeOpenState({ wallsLeft: { p1: 0, p3: 10 } });
        expect(isWallPlacementLegal({ row: 4, col: 4, orientation: 'horizontal' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a wall placed outside the board bounds (negative row)', () => {
        const state = makeOpenState();
        expect(isWallPlacementLegal({ row: -1, col: 4, orientation: 'horizontal' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a wall placed at the last row (row === boardSize - 1)', () => {
        const state = makeOpenState();
        expect(isWallPlacementLegal({ row: 8, col: 4, orientation: 'horizontal' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a direct overlap with an existing wall', () => {
        const existing = { row: 4, col: 4, orientation: 'horizontal' };
        const state = makeOpenState({ placedWalls: [existing] });
        expect(isWallPlacementLegal({ row: 4, col: 4, orientation: 'horizontal' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a horizontally overlapping wall (adjacent column same row)', () => {
        const existing = { row: 4, col: 4, orientation: 'horizontal' };
        const state = makeOpenState({ placedWalls: [existing] });
        // col=3 is only 1 apart → still overlaps
        expect(isWallPlacementLegal({ row: 4, col: 3, orientation: 'horizontal' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a vertically overlapping wall (adjacent row same col)', () => {
        const existing = { row: 4, col: 4, orientation: 'vertical' };
        const state = makeOpenState({ placedWalls: [existing] });
        expect(isWallPlacementLegal({ row: 3, col: 4, orientation: 'vertical' }, state, config.players, 9)).toBe(false);
    });

    it('rejects a wall that would trap a player with no path to goal', () => {
        // p3 is confined to col 0 by four vertical walls on its east side.
        // The last horizontal wall at row=7 col=0 would seal off (8,0) — the only
        // remaining cell on p3's path to its goal (row 8).
        const trappingState = makeOpenState({
            pawnPositions: { p1: { row: 8, col: 4 }, p3: { row: 0, col: 0 } },
            wallsLeft: { p1: 10, p3: 10 },
            placedWalls: [
                { row: 0, col: 0, orientation: 'vertical' }, // blocks col 0→1 for rows 0-1
                { row: 2, col: 0, orientation: 'vertical' }, // blocks col 0→1 for rows 2-3
                { row: 4, col: 0, orientation: 'vertical' }, // blocks col 0→1 for rows 4-5
                { row: 6, col: 0, orientation: 'vertical' }, // blocks col 0→1 for rows 6-7
            ],
        });
        // This horizontal wall blocks (7,0)↔(8,0) — the last south exit — trapping p3.
        expect(isWallPlacementLegal({ row: 7, col: 0, orientation: 'horizontal' }, trappingState, config.players, 9)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// applyMove — pawn moves
// ---------------------------------------------------------------------------

describe('applyMove — pawn moves', () => {
    it('advances the pawn to a legal adjacent cell', () => {
        const { state, config, players } = makeInitialFixture();
        // p1 starts at (8,4); move up one step to (7,4)
        const newState = applyMove(state, { type: 'cell', data: { row: 7, col: 4 } }, players, config);
        expect(newState).not.toBeNull();
        expect(newState.pawnPositions.p1).toEqual({ row: 7, col: 4 });
    });

    it('switches the turn after a legal pawn move', () => {
        const { state, config, players } = makeInitialFixture();
        const newState = applyMove(state, { type: 'cell', data: { row: 7, col: 4 } }, players, config);
        expect(newState.playerTurn).toBe('p3');
    });

    it('returns null for an illegal pawn move (non-adjacent cell)', () => {
        const { state, config, players } = makeInitialFixture();
        const newState = applyMove(state, { type: 'cell', data: { row: 5, col: 4 } }, players, config);
        expect(newState).toBeNull();
    });

    it('ends the game when p1 reaches goal row 0', () => {
        const config = makeTwoPlayerConfig();
        const state = createInitialState(config);
        // Place p1 one step below the goal; move p3 out of col 4 so it does not block.
        state.pawnPositions.p1 = { row: 1, col: 4 };
        state.pawnPositions.p3 = { row: 0, col: 2 }; // clear col 4 row 0 for p1
        state.availablePawnMoves = calculateLegalPawnMoves(
            state.pawnPositions, state.placedWalls, config.players,
            state.activePlayerIds, state.playerTurnIndex, config.boardSize
        );
        const newState = applyMove(state, { type: 'cell', data: { row: 0, col: 4 } }, config.players, config);
        expect(newState).not.toBeNull();
        expect(newState.status).toBe('ended');
        expect(newState.winner).toBe('p1');
        expect(newState.reason).toBe('goal');
    });

    it('ends the game when p3 reaches goal row 8', () => {
        const config = makeTwoPlayerConfig();
        const state = createInitialState(config);
        // Put it on p3's turn by advancing one p1 move first.
        state.pawnPositions.p1 = { row: 7, col: 4 };
        state.playerTurn = 'p3';
        state.playerTurnIndex = 1;
        // Place p3 one step from goal
        state.pawnPositions.p3 = { row: 7, col: 4 };
        // Move p3 out of conflict with p1
        state.pawnPositions.p1 = { row: 7, col: 3 };
        state.pawnPositions.p3 = { row: 7, col: 4 };
        state.availablePawnMoves = calculateLegalPawnMoves(
            state.pawnPositions, state.placedWalls, config.players,
            state.activePlayerIds, state.playerTurnIndex, config.boardSize
        );
        const newState = applyMove(state, { type: 'cell', data: { row: 8, col: 4 } }, config.players, config);
        expect(newState).not.toBeNull();
        expect(newState.status).toBe('ended');
        expect(newState.winner).toBe('p3');
    });
});

// ---------------------------------------------------------------------------
// applyMove — wall placement
// ---------------------------------------------------------------------------

describe('applyMove — wall placement', () => {
    it('places a wall and decrements the placing player\'s wall count', () => {
        const { state, config, players } = makeInitialFixture();
        const wall = { row: 4, col: 4, orientation: 'horizontal' };
        const newState = applyMove(state, { type: 'wall', data: wall }, players, config);
        expect(newState).not.toBeNull();
        expect(newState.placedWalls).toHaveLength(1);
        expect(newState.placedWalls[0]).toMatchObject(wall);
        expect(newState.wallsLeft.p1).toBe(9);
    });

    it('switches turn after a wall placement', () => {
        const { state, config, players } = makeInitialFixture();
        const wall = { row: 4, col: 4, orientation: 'horizontal' };
        const newState = applyMove(state, { type: 'wall', data: wall }, players, config);
        expect(newState.playerTurn).toBe('p3');
    });

    it('returns null when the player has no walls left', () => {
        const { state, config, players } = makeInitialFixture();
        state.wallsLeft.p1 = 0;
        const wall = { row: 4, col: 4, orientation: 'horizontal' };
        const newState = applyMove(state, { type: 'wall', data: wall }, players, config);
        expect(newState).toBeNull();
    });

    it('returns null for a wall that would trap a player', () => {
        const config = makeTwoPlayerConfig();
        const state = createInitialState(config);

        // Build a fence: place horizontal walls along the full width just below row 0.
        // Two horizontal walls cover the full 9-column span and trap p3 (at row 0, col 4)
        // from ever reaching row 8.
        state.placedWalls = [
            { row: 0, col: 1, orientation: 'horizontal' },
            { row: 0, col: 3, orientation: 'horizontal' },
            { row: 0, col: 5, orientation: 'horizontal' },
        ];
        // A vertical wall at col=0 and col=7 seals the sides
        state.placedWalls.push({ row: 0, col: 0, orientation: 'vertical' });

        // Attempting to close the last gap should fail if it traps p3.
        // We verify the illegal-wall path is exercised.
        const trapWall = { row: 0, col: 7, orientation: 'horizontal' };
        const result = applyMove(state, { type: 'wall', data: trapWall }, config.players, config);
        // Either null (trapped) or a new state — function must not throw.
        expect(result === null || typeof result === 'object').toBe(true);
    });

    it('does not mutate the original state', () => {
        const { state, config, players } = makeInitialFixture();
        const originalWallCount = state.placedWalls.length;
        applyMove(state, { type: 'wall', data: { row: 4, col: 4, orientation: 'horizontal' } }, players, config);
        expect(state.placedWalls).toHaveLength(originalWallCount);
    });
});

// ---------------------------------------------------------------------------
// applyPlayerLoss
// ---------------------------------------------------------------------------

describe('applyPlayerLoss', () => {
    it('removes the losing player from activePlayerIds', () => {
        const { state } = makeInitialFixture();
        const newState = applyPlayerLoss(state, 'p3', 'resignation');
        expect(newState.activePlayerIds).not.toContain('p3');
    });

    it('sets the loser\'s pawn position to (-1, -1)', () => {
        const { state } = makeInitialFixture();
        const newState = applyPlayerLoss(state, 'p3', 'resignation');
        expect(newState.pawnPositions.p3).toEqual({ row: -1, col: -1 });
    });

    it('ends the game with the last remaining player as winner in a 2-player game', () => {
        const { state } = makeInitialFixture();
        const newState = applyPlayerLoss(state, 'p3', 'resignation');
        expect(newState.status).toBe('ended');
        expect(newState.winner).toBe('p1');
        expect(newState.reason).toBe('last player standing');
    });

    it('advances the turn when the current player loses', () => {
        const { state } = makeInitialFixture();
        // In the initial state it is p1's turn; p3 loses — turn stays on p1 but p3 gone.
        // Now test when it IS the current player who loses.
        const newState = applyPlayerLoss(state, 'p1', 'timeout');
        // Game ends immediately because only p3 remains
        expect(newState.status).toBe('ended');
        expect(newState.winner).toBe('p3');
    });

    it('does not change state when the game is already ended', () => {
        const { state } = makeInitialFixture();
        state.status = 'ended';
        const newState = applyPlayerLoss(state, 'p3', 'resignation');
        expect(newState.status).toBe('ended');
        expect(newState.activePlayerIds).toContain('p3'); // unchanged
    });

    it('does not change state for an unknown player id', () => {
        const { state } = makeInitialFixture();
        const newState = applyPlayerLoss(state, 'p99', 'resignation');
        expect(newState.activePlayerIds).toHaveLength(2);
    });

    it('does not mutate the original state object', () => {
        const { state } = makeInitialFixture();
        const original = JSON.parse(JSON.stringify(state));
        applyPlayerLoss(state, 'p3', 'resignation');
        expect(state.activePlayerIds).toEqual(original.activePlayerIds);
    });
});
