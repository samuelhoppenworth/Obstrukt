// src/config/gameConfig.js

const PALETTE = {
    green: 0x4CAF50,    // Player 1 (South)
    pink: 0xE91E63,     // Player 2 (East)
    blue: 0x2196F3,     // Player 3 (North)
    orange: 0xFF9800,   // Player 4 (West)
    brownGrey: 0x8D6E63, // Walls
    lightGrey: 0xE0E0E0, // Board Cells
    lightGreen: 0x8BC34A, // Legal Move Highlight
    red: 0xF44336       // Illegal Action Highlight
};

export const ALL_PLAYERS = [
    { id: 'p1', startPos: { row: 8, col: 4 }, goalCondition: (r, c, bS) => r === 0, color: PALETTE.green },
    { id: 'p2', startPos: { row: 4, col: 8 }, goalCondition: (r, c, bS) => c === 0, color: PALETTE.pink },
    { id: 'p3', startPos: { row: 0, col: 4 }, goalCondition: (r, c, bS) => r === bS - 1, color: PALETTE.blue },
    { id: 'p4', startPos: { row: 4, col: 0 }, goalCondition: (r, c, bS) => c === bS - 1, color: PALETTE.orange },
];

export const GAME_COLORS = {
    wall: PALETTE.brownGrey,
    board: PALETTE.lightGrey,
    legalMove: PALETTE.lightGreen,
    legalWall: PALETTE.green,
    illegalWall: PALETTE.red,
    localPlayer: PALETTE.green,
    opponentPlayer: PALETTE.blue,
};