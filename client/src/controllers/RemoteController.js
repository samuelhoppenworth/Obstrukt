// src/controllers/RemoteController.js

export default class RemoteController {
    constructor(scene) {
        this.scene = scene;
    }

    // Remote players' moves come from the server, so the client does not need to get a move.
    // This resolves immediately to prevent the game loop from waiting.
    getMove(gameState) {
        return Promise.resolve(null);
    }

    destroy() {
        // Nothing to clean up
    }
}