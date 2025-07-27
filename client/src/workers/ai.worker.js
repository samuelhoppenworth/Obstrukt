// src/workers/ai.worker.js
import createQuoridorAIModule from '../../../public/ai/ai.js';

let aiModule = null;

// Load the Wasm module once when the worker starts.
createQuoridorAIModule().then(module => {
    aiModule = module;
    // Send a message back to the main thread to confirm readiness.
    self.postMessage({ type: 'worker-ready' });
}).catch(err => {
    console.error("AI Worker failed to load Wasm module:", err);
    self.postMessage({ type: 'worker-error' });
});

// Listen for messages from the main thread.
self.onmessage = (event) => {
    if (!aiModule) {
        console.error("AI Worker received task before Wasm was ready.");
        return;
    }

    const { type, gameState, players } = event.data;

    if (type === 'calculate-move') {
        // This is the blocking call, but it's happening on the worker thread,
        // so it doesn't freeze the UI.
        const move = aiModule.findBestMove(gameState, players);
        
        // Send the result back to the main thread.
        self.postMessage({ type: 'move-calculated', move });
    }
};