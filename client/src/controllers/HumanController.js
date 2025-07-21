// src/controllers/HumanController.js

export default class HumanController {
    constructor(scene) {
        this.scene = scene;
        this.resolveMove = null;
        this.waitingForMove = false;

        // Listen for input events from the InputHandler
        this.scene.events.on('human-action-input', this.handleInput, this);
    }

    getMove(gameState) {
        if (this.waitingForMove) return; // Prevent multiple pending promises
        this.waitingForMove = true;
        return new Promise(resolve => {
            this.resolveMove = resolve;
        });
    }
    handleInput(moveData) {
        if (this.waitingForMove && this.resolveMove) {
            this.waitingForMove = false;
            this.resolveMove(moveData);
            this.resolveMove = null;
        }
    }
    
    destroy() {
        // Clean up the event listener when the controller is no longer needed
        this.scene.events.off('human-action-input', this.handleInput, this);
    }
}