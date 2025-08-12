// src/config/gameConfig.js

const PALETTE = {
    green: "#4CAF50",
    pink: "#E91E63",
    blue: "#2196F3",
    orange: "#FF9800",
    
    // Background
    darkGrey: "#3d3d3d",

    // Neutrals & Board
    brownGrey: "#8D6E63",
    lightGrey: "#E0E0E0",
    lightGreen: "#8BC34A",
    red: "#F44336",

    emerald: "#66BB6A",
    purple: "#a970ff",
    skyBlue: "#4FC3F7",
    coral: "#FF7043",
    indigo: "#5C6BC0",
    forestGreen: "#2E7D32",

    deepTeal: "#00796B",
    crimson: "#C62828",
    royalPurple: "#6A1B9A",
    burntOrange: "#EF6C00",
    midnightBlue: "#283593",
    slateIndigo: "#3949AB",
    brass: "#D4AF37",
    oliveGreen: "#558B2F",

    walnut: "#5D4037",
    steelGray: "#455A64",
    charcoal: "#37474F",
    rust: "#8D6E63",
    clay: "#795548",
    graphite: "#263238",

    darkBrown: "#5D4037",
    warmBrown: "#795548",
    mossGreen: "#8A9A5B",
    paleGreen: "#B3C59D",

    brightRed: "#C62828",
    softOrange: "#FF7043",
    deepPurple: "#6A1B9A",
    brightBlue: "#4FC3F7",

    freshGreen: "#8BC34A",
    strongRed: "#F44336"
};


export const ALL_PLAYERS = [
    { id: 'p1', startPos: (bS) => ({ row: bS - 1, col: Math.floor(bS / 2) }), goalCondition: (r, c, bS) => r === 0, color: PALETTE.brightRed },
    { id: 'p2', startPos: (bS) => ({ row: Math.floor(bS / 2), col: bS - 1 }), goalCondition: (r, c, bS) => c === 0, color: PALETTE.softOrange },
    { id: 'p3', startPos: (bS) => ({ row: 0, col: Math.floor(bS / 2) }), goalCondition: (r, c, bS) => r === bS - 1, color: PALETTE.deepPurple },
    { id: 'p4', startPos: (bS) => ({ row: Math.floor(bS / 2), col: 0 }), goalCondition: (r, c, bS) => c === bS - 1, color: PALETTE.brightBlue },
];

export const GAME_COLORS = {
    wall: PALETTE.oliveGreen,
    board: PALETTE.lightGrey,
    legalWall: PALETTE.oliveGreen,
    illegalWall: PALETTE.red,
    background: PALETTE.darkGrey
};