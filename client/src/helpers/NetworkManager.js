// src/helpers/NetworkManager.js
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

export default class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
    }

    connect() {
        // Prevent creating multiple sockets if connect is called more than once
        if (this.socket) return;

        this.socket = io('http://localhost:3000');
        
        this.socket.on('connect', () => console.log('Connected to server:', this.socket.id));
        this.socket.on('waiting', (message) => this.scene.events.emit('network-waiting', message));
        this.socket.on('gameStart', (data) => this.scene.events.emit('network-game-start', data));
        this.socket.on('game-state-updated', (gameState) => this.scene.events.emit('network-state-received', gameState));
        
        this.socket.on('timers-updated', (timers) => {
            if (this.scene && this.scene.uiManager) {
                this.scene.uiManager.updateTimers(timers);
            }
        });
        
        this.socket.on('error', (message) => console.error('Server Error:', message));

        this.socket.on('drawOfferReceived', (data) => this.scene.events.emit('draw-offer-received', data));
        this.socket.on('drawOfferPending', () => this.scene.events.emit('draw-offer-pending'));
        this.socket.on('drawOfferRescinded', () => this.scene.events.emit('draw-offer-rescinded'));
    }

    requestMove(move) {
        if (this.socket) this.socket.emit('requestMove', move);
    }

    sendResignationRequest() {
        if (this.socket) this.socket.emit('resign');
    }

    sendDrawRequest() {
        if (this.socket) this.socket.emit('requestDraw');
    }

    sendDrawResponse(accepted) {
        if (this.socket) this.socket.emit('respondToDraw', { accepted });
    }

    destroy() {
        if (this.socket) {
            this.socket.disconnect();            
            this.socket = null;
        }
    }
}