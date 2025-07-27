// src/config/gameConfig.js

const PALETTE = {
    green: 0x4CAF50,       // Player 1 (South)
    pink: 0xE91E63,        // Player 2 (East)
    blue: 0x2196F3,        // Player 3 (North)
    orange: 0xFF9800,      // Player 4 (West)
    
    // Neutrals & Board
    brownGrey: 0x8D6E63,   // Walls
    lightGrey: 0xE0E0E0,   // Board Cells
    lightGreen: 0x8BC34A,  // Legal Move Highlight
    red: 0xF44336,         // Illegal Action Highlight

    // Alternative Player/Wall Colors
    emerald: 0x66BB6A,     // (Alt) wall
    purple: 0xa970ff,      // (Alt) Player 1
    skyBlue: 0x4FC3F7,     // (Alt) Player 2
    coral: 0xFF7043,
    indigo: 0x5C6BC0,
    forestGreen: 0x2E7D32,

    // New Full-Bodied Additions
    deepTeal: 0x00796B,
    crimson: 0xC62828,
    royalPurple: 0x6A1B9A,
    burntOrange: 0xEF6C00,
    midnightBlue: 0x283593,
    slateIndigo: 0x3949AB,
    brass: 0xD4AF37,
    oliveGreen: 0x558B2F,

    walnut: 0x5D4037,      // Wall option: dark walnut
    steelGray: 0x455A64,   // Wall option: industrial steel
    charcoal: 0x37474F,    // Wall option: near-black neutral
    rust: 0x8D6E63,        // Wall option: classic muted red/brown
    clay: 0x795548,        // Wall option: warm, earthy
    graphite: 0x263238     // Wall option: very dark, bluish tone
};

export const ALL_PLAYERS = [
    { id: 'p1', startPos: (bS) => ({ row: bS - 1, col: Math.floor(bS / 2) }), goalCondition: (r, c, bS) => r === 0, color: PALETTE.crimson },
    { id: 'p2', startPos: (bS) => ({ row: Math.floor(bS / 2), col: bS - 1 }), goalCondition: (r, c, bS) => c === 0, color: PALETTE.oliveGreen },
    { id: 'p3', startPos: (bS) => ({ row: 0, col: Math.floor(bS / 2) }), goalCondition: (r, c, bS) => r === bS - 1, color: PALETTE.royalPurple },
    { id: 'p4', startPos: (bS) => ({ row: Math.floor(bS / 2), col: 0 }), goalCondition: (r, c, bS) => c === bS - 1, color: PALETTE.slateIndigo },
];

export const GAME_COLORS = {
    wall: PALETTE.clay,
    board: PALETTE.lightGrey,
    legalWall: PALETTE.green,
    illegalWall: PALETTE.red,
};