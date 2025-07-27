// src/controllers/AIController.js

export default class AIController {
    constructor(scene, orchestrator) {
        this.orchestrator = orchestrator;
        this.worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
        
        // This will hold the 'resolve' function for the promise returned by getMove()
        this.resolveMovePromise = null;
        
        // --- READINESS FIX: Create a promise that resolves when the worker is ready. ---
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
                // --- READINESS FIX: The worker is ready, so we resolve the promise. ---
                console.log("AI Worker is ready.");
                this.makeWorkerReady();
            } else if (type === 'worker-error') {
                console.error("AI Worker failed to initialize.");
                // We could also reject the promise here if needed.
            }
        };
    }

    /**
     * This function now waits for the worker to be ready before sending its task.
     * It returns a promise that is resolved when the worker sends back a move.
     */
    async getMove() {
        // --- READINESS FIX: Wait for the readyPromise to resolve before proceeding. ---
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

    /**
     * Terminate the worker to prevent memory leaks when the scene is destroyed.
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}