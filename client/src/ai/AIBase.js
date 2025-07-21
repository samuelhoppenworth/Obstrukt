// src/ai/AIBase.js
export default class AIBase {
    findBestMove(gameManager) {
        throw new Error("AIBase subclasses must implement the findBestMove() method.");
    }
}