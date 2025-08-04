// src/controllers/AIController.js

export default class AIController {
    constructor(scene, orchestrator) {
        this.orchestrator = orchestrator;
        this.worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
        
        this.resolveMovePromise = null;
        
        this.readyPromise = new Promise(resolve => {
            this.makeWorkerReady = resolve;
        });

        // Listen for messages coming back from the worker
        this.worker.onmessage = (event) => {
            const { type, move } = event.data;

            if (type === 'move-calculated') {
                if (this.resolveMovePromise) {
                    this.resolveMovePromise(move);
                    this.resolveMovePromise = null;
                }
            } else if (type === 'worker-ready') {
                console.log("AI Worker is ready.");
                this.makeWorkerReady();
            } else if (type === 'worker-error') {
                console.error("AI Worker failed to initialize.");
            }
        };
    }

    async getMove() {
        await this.readyPromise;

        return new Promise((resolve) => {
            this.resolveMovePromise = resolve;

            const gameState = this.orchestrator.getGameState();
            const serializablePlayers = this.orchestrator.players.map(p => ({ id: p.id }));
            
            this.worker.postMessage({
                type: 'calculate-move',
                gameState,
                players: serializablePlayers
            });
        });
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}