// src/controllers/AIController.js
import PlayerController from './PlayerController.js';

export default class AIController extends PlayerController {
    constructor(scene, aiModel, orchestrator) {
        super(scene);
        this.aiModel = aiModel;
        this.orchestrator = orchestrator; // The AI needs access to the game state
    }

    async getMove() {
        // Use a clone of the state so the AI can't mutate the real game state
        const gameState = this.orchestrator.getGameState();

        // Pass the state to the AI model
        const move = this.aiModel.findBestMove(gameState, this.orchestrator.players, this.orchestrator.config);
        
        // Add a thinking delay
        const thinkingTime = 500 + Math.random() * 500;
        await new Promise(resolve => this.scene.time.delayedCall(thinkingTime, resolve));

        if (!move || !move.data) {
            return { type: 'resign' };
        }
        return move;
    }
}