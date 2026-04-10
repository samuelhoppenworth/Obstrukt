// test/GameManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameManager from '../server/GameManager.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makePlayers() {
    return [
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
}

function makeConfig(players) {
    return {
        numPlayers: 2,
        players,
        wallsPerPlayer: 10,
        timePerPlayer: 5 * 60 * 1000,
        boardSize: 9,
    };
}

/** Returns a GameManager with a spy emitter and a fresh 2-player game. */
function makeGameManager() {
    const players = makePlayers();
    const config = makeConfig(players);
    const emitter = { emit: vi.fn() };
    const manager = new GameManager(emitter, config);
    return { manager, emitter, config, players };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('GameManager constructor', () => {
    it('initialises game status as "active"', () => {
        const { manager } = makeGameManager();
        expect(manager.gameState.status).toBe('active');
    });

    it('sets the first player turn to p1', () => {
        const { manager } = makeGameManager();
        expect(manager.gameState.playerTurn).toBe('p1');
    });

    it('starts with no placed walls', () => {
        const { manager } = makeGameManager();
        expect(manager.gameState.placedWalls).toHaveLength(0);
    });

    it('gives each player the correct initial wall count', () => {
        const { manager } = makeGameManager();
        expect(manager.gameState.wallsLeft.p1).toBe(10);
        expect(manager.gameState.wallsLeft.p3).toBe(10);
    });

    it('pre-computes available pawn moves for the first player', () => {
        const { manager } = makeGameManager();
        expect(manager.gameState.availablePawnMoves.length).toBeGreaterThan(0);
    });

    it('records one history entry on construction', () => {
        const { manager } = makeGameManager();
        expect(manager.history).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// handleMoveRequest
// ---------------------------------------------------------------------------

describe('GameManager.handleMoveRequest', () => {
    it('returns true and updates state for a valid pawn move', () => {
        const { manager, emitter } = makeGameManager();
        // p1 is at (8,4) and can move to (7,4)
        const result = manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(result).toBe(true);
        expect(manager.gameState.pawnPositions.p1).toEqual({ row: 7, col: 4 });
    });

    it('emits "game-state-updated" after a valid move', () => {
        const { manager, emitter } = makeGameManager();
        manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(emitter.emit).toHaveBeenCalledWith('game-state-updated', expect.any(Object));
    });

    it('advances the turn after a valid pawn move', () => {
        const { manager } = makeGameManager();
        manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(manager.gameState.playerTurn).toBe('p3');
    });

    it('returns false for an illegal pawn move', () => {
        const { manager } = makeGameManager();
        // (5,4) is not adjacent to starting position (8,4)
        const result = manager.handleMoveRequest({ type: 'cell', data: { row: 5, col: 4 } });
        expect(result).toBe(false);
    });

    it('does not change state after an illegal move', () => {
        const { manager } = makeGameManager();
        const originalTurn = manager.gameState.playerTurn;
        manager.handleMoveRequest({ type: 'cell', data: { row: 5, col: 4 } });
        expect(manager.gameState.playerTurn).toBe(originalTurn);
    });

    it('returns true and decrements walls for a valid wall placement', () => {
        const { manager } = makeGameManager();
        const result = manager.handleMoveRequest({
            type: 'wall',
            data: { row: 4, col: 4, orientation: 'horizontal' },
        });
        expect(result).toBe(true);
        expect(manager.gameState.wallsLeft.p1).toBe(9);
        expect(manager.gameState.placedWalls).toHaveLength(1);
    });

    it('returns false and does not place when the player has no walls', () => {
        const { manager } = makeGameManager();
        manager.gameState.wallsLeft.p1 = 0;
        const result = manager.handleMoveRequest({
            type: 'wall',
            data: { row: 4, col: 4, orientation: 'horizontal' },
        });
        expect(result).toBe(false);
        expect(manager.gameState.placedWalls).toHaveLength(0);
    });

    it('returns false when the game is not active', () => {
        const { manager } = makeGameManager();
        manager.gameState.status = 'ended';
        const result = manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(result).toBe(false);
    });

    it('clears any draw offer on a valid move', () => {
        const { manager } = makeGameManager();
        manager.gameState.drawOfferFrom = 'p3';
        manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(manager.gameState.drawOfferFrom).toBeNull();
    });

    it('appends to history after a valid move', () => {
        const { manager } = makeGameManager();
        const historyBefore = manager.history.length;
        manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        expect(manager.history.length).toBe(historyBefore + 1);
    });
});

// ---------------------------------------------------------------------------
// handlePlayerLoss
// ---------------------------------------------------------------------------

describe('GameManager.handlePlayerLoss', () => {
    it('ends the game when the only remaining opponent loses', () => {
        const { manager } = makeGameManager();
        manager.handlePlayerLoss('p3', 'resignation');
        expect(manager.gameState.status).toBe('ended');
        expect(manager.gameState.winner).toBe('p1');
    });

    it('emits "game-state-updated" after a player loss', () => {
        const { manager, emitter } = makeGameManager();
        manager.handlePlayerLoss('p3', 'resignation');
        expect(emitter.emit).toHaveBeenCalledWith('game-state-updated', expect.any(Object));
    });

    it('sets the loser\'s pawn to (-1, -1)', () => {
        const { manager } = makeGameManager();
        manager.handlePlayerLoss('p3', 'timeout');
        expect(manager.gameState.pawnPositions.p3).toEqual({ row: -1, col: -1 });
    });

    it('does nothing when the game is already ended', () => {
        const { manager, emitter } = makeGameManager();
        manager.gameState.status = 'ended';
        emitter.emit.mockClear();
        manager.handlePlayerLoss('p3', 'resignation');
        expect(emitter.emit).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// endGameAsDraw
// ---------------------------------------------------------------------------

describe('GameManager.endGameAsDraw', () => {
    it('sets status to "ended" with no winner', () => {
        const { manager } = makeGameManager();
        manager.endGameAsDraw('draw by agreement');
        expect(manager.gameState.status).toBe('ended');
        expect(manager.gameState.winner).toBeNull();
        expect(manager.gameState.reason).toBe('draw by agreement');
    });

    it('emits "game-state-updated" after a draw', () => {
        const { manager, emitter } = makeGameManager();
        manager.endGameAsDraw('draw by agreement');
        expect(emitter.emit).toHaveBeenCalledWith('game-state-updated', expect.any(Object));
    });

    it('clears the active draw offer', () => {
        const { manager } = makeGameManager();
        manager.gameState.drawOfferFrom = 'p1';
        manager.endGameAsDraw('draw by agreement');
        expect(manager.gameState.drawOfferFrom).toBeNull();
    });

    it('does nothing when the game is already ended', () => {
        const { manager, emitter } = makeGameManager();
        manager.gameState.status = 'ended';
        emitter.emit.mockClear();
        manager.endGameAsDraw('draw by agreement');
        expect(emitter.emit).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getGameState
// ---------------------------------------------------------------------------

describe('GameManager.getGameState', () => {
    it('returns an object with all required fields', () => {
        const { manager } = makeGameManager();
        const state = manager.getGameState();
        const requiredFields = [
            'status', 'winner', 'reason', 'playerTurn', 'pawnPositions',
            'wallsLeft', 'timers', 'placedWalls', 'availablePawnMoves',
            'activePlayerIds', 'drawOfferFrom',
        ];
        for (const field of requiredFields) {
            expect(state).toHaveProperty(field);
        }
    });

    it('returns a plain object (not a GameManager instance)', () => {
        const { manager } = makeGameManager();
        const state = manager.getGameState();
        expect(state).not.toBeInstanceOf(GameManager);
    });

    it('reflects changes made by a valid move', () => {
        const { manager } = makeGameManager();
        manager.handleMoveRequest({ type: 'cell', data: { row: 7, col: 4 } });
        const state = manager.getGameState();
        expect(state.pawnPositions.p1).toEqual({ row: 7, col: 4 });
        expect(state.playerTurn).toBe('p3');
    });

    it('returns "active" status before any winner', () => {
        const { manager } = makeGameManager();
        expect(manager.getGameState().status).toBe('active');
    });
});
