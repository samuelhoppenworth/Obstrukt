// src/controllers/HumanController.js

export default class HumanController {
    constructor(scene) {
        this.scene = scene;
    }

    // This class is a placeholder for local games. Its existence in the
    // controllers list signals to the LocalGameOrchestrator that it should
    // listen for 'human-action-input' events for this player's turn.
    // All promise and event-handling logic has been removed.

    destroy() {
        // No listeners to remove, but the method exists for API consistency.
    }
}