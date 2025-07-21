// src/ai/SimpleHeuristicAI.js
import AIBase from "./AIBase.js";
export default class SimpleHeuristicAI extends AIBase {
    constructor() { super(); }
    findBestMove(gameManager) { /* ... full AI logic ... */ }
    #evaluatePawnMove(pawnMove, myId, opponentId, gameManager) { /* ... */ }
    #evaluateWallPlacement(wall, opponentId, gameManager) { /* ... */ }
    #getPotentialWallPlacements(pos, gameManager) { /* ... */ }
    #getShortestPathLength(startPos, playerId, gameManager) { /* ... */ }
}