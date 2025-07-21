// src/controllers/PlayerController.js

export default class PlayerController {
    constructor(scene) {
        this.scene = scene;
        this._resolveMove = null;
    }
    getMove() {
        return new Promise(resolve => {
            this._resolveMove = resolve;
        });
    }
    _handleAction(action) {
        if (this._resolveMove) {
            this._resolveMove(action);
            this._resolveMove = null;
        }
    }
    destroy() {
        this.scene.events.off('human-action-input', this._handleAction, this);
    }
}