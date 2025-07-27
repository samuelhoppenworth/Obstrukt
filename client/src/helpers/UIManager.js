// src/helpers/UIManager.js

export default class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.sidePanel = document.getElementById('side-panel');
        this.playerInfoElements = {};
    }

    setupGameUI(players, initialTimers, config) {
        this.sidePanel.innerHTML = `
            <div class="player-info-list"></div>
            <div id="action-container"></div>
            <div class="history-controls">
                <button id="hist-start">«</button> <button id="hist-prev">‹</button>
                <button id="hist-next">›</button> <button id="hist-end">»</button>
            </div>`;
        const playerList = this.sidePanel.querySelector('.player-info-list');
        console.log("players", players);
        let playerName = '';        
        players.forEach(player => {            
            const playerEl = document.createElement('div');
            playerEl.className = 'player-info-item';
            playerEl.id = `player-info-${player.id}`;
            const wallsPerPlayer = config.wallsPerPlayer;
            switch (player.id) {
                case 'p1': playerName = 'Red'; break;
                case 'p2': playerName = 'Green'; break;
                case 'p3': playerName = 'Purple'; break;
                case 'p4': playerName = 'Blue'; break;
                default:   playerName = player.id.toUpperCase();
            }

            playerEl.innerHTML = `
                <div class="player-name">
                    <span class="player-color-swatch" style="background-color: #${player.color.toString(16).padStart(6, '0')}"></span>
                    <span>${playerName}</span>
                </div>
                <div class="player-stats">
                    <div class="player-timer">${this.formatTime(initialTimers[player.id])}</div>
                    <div class="player-walls">Walls: ${wallsPerPlayer}</div>
                </div>`;
            playerList.appendChild(playerEl);
            this.playerInfoElements[player.id] = { container: playerEl, timer: playerEl.querySelector('.player-timer'), walls: playerEl.querySelector('.player-walls') };
        });
        
        this.showDefaultActions(config);
        this.addHistoryButtonListeners();
    }

    showDefaultActions(config) {
        const actionContainer = document.getElementById('action-container');
        if (!actionContainer) return;
        console.log("got here!");
        
        let drawButtonHTML = '';
        console.log("config:", config);
        if (config.gameType === 'online' && config.numPlayers === 2) {
            console.log("ran");
            drawButtonHTML = `<button id="draw-btn">Request Draw</button>`;
        }

        actionContainer.innerHTML = `
            <div class="action-buttons">
                <button id="resign-btn">Resign</button>
                ${drawButtonHTML}
            </div>`;
        document.getElementById('resign-btn')?.addEventListener('click', () => this.scene.events.emit('resign-request'));
        document.getElementById('draw-btn')?.addEventListener('click', () => this.scene.events.emit('draw-request'));
    }

    showDrawOffer() {
        const actionContainer = document.getElementById('action-container');
        if (!actionContainer) return;

        actionContainer.innerHTML = `
            <div class="panel-section">
                <h4>Draw Offer from opponent</h4>
                <div class="action-buttons-vertical" style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="accept-draw-btn" style="background-color: #4CAF50; color: white;">Accept</button>
                    <button id="reject-draw-btn" style="background-color: #F44336; color: white;">Reject</button>
                </div>
            </div>`;
        
        document.getElementById('accept-draw-btn')?.addEventListener('click', () => this.scene.events.emit('accept-draw'));
        document.getElementById('reject-draw-btn')?.addEventListener('click', () => this.scene.events.emit('reject-draw'));
    }

    showDrawPending() {
        const actionContainer = document.getElementById('action-container');
        if (!actionContainer) return;
        actionContainer.innerHTML = `<p style="text-align: center;"><i>Draw offer sent. Waiting for response...</i></p>`;
    }
    
    showEndGameUI(endState) {
        const { result, message } = this.formatEndGameMessage(endState);
        this.sidePanel.innerHTML = `
            <div class="end-game-panel">
                <h2 class="end-game-result">${result}</h2>
                <p class="end-game-message">${message}</p>
                <button id="rematch-btn">Rematch</button>
                <button id="new-game-btn">New Game</button>
            </div>
             <div class="history-controls">
                <button id="hist-start">«</button> <button id="hist-prev">‹</button>
                <button id="hist-next">›</button> <button id="hist-end">»</button>
            </div>
        `;
        document.getElementById('rematch-btn').addEventListener('click', () => this.scene.scene.start('Game', this.scene.startupConfig));
        document.getElementById('new-game-btn').addEventListener('click', () => this.scene.scene.start('Menu'));
        this.addHistoryButtonListeners();
    }
    
    showWaitingScreen(message) {
        this.sidePanel.innerHTML = `
            <div class="end-game-panel" style="justify-content: center;">
                <h2>Finding Game...</h2>
                <p>${message}</p>
            </div>
        `;
    }

    formatEndGameMessage(endState) {
        let result = "Game Over";
        let message = "The game ended in a draw.";

        if (endState.winner) {
            const winnerName = endState.winner.toUpperCase();
            result = `${winnerName} WINS`;
            switch(endState.reason) {
                case 'goal': message = `${winnerName} reached the goal`; break;
                case 'timeout': message = `Opponent ran out of time.`; break;
                case 'resignation': message = `Opponent resigned.`; break;
                case 'disconnection': message = `Opponent disconnected.`; break;
                case 'last player standing': message = `${winnerName} is the last player standing`; break;
                default: message = `${winnerName} is victorious!`;
            }
        } else {
            if (endState.reason === 'draw by agreement') {
                message = 'Draw by agreement.';
            }
        }
        return { result, message };
    }

    updatePlayerInfo(gameState) {
        if (!gameState || !this.playerInfoElements) return;
        const activePlayers = Object.keys(gameState.pawnPositions).filter(id => gameState.pawnPositions[id].row !== -1);
        for (const playerId in this.playerInfoElements) {
            const playerUI = this.playerInfoElements[playerId];
            if (gameState.wallsLeft && gameState.wallsLeft[playerId] !== undefined) {
                playerUI.walls.textContent = `Walls: ${gameState.wallsLeft[playerId]}`;
            }
            playerUI.container.classList.toggle('active-turn', playerId === gameState.playerTurn);
            playerUI.container.style.opacity = activePlayers.includes(playerId) ? '1' : '0.4';
        }
    }

    updateTimers(timers) {
        if (!timers) return;
        for (const playerId in timers) {
            if (this.playerInfoElements[playerId]) {
                 this.playerInfoElements[playerId].timer.textContent = this.formatTime(timers[playerId]);
            }
        }
    }
    
    addHistoryButtonListeners() {
        document.getElementById('hist-start')?.addEventListener('click', () => this.scene.events.emit('history-navigate', 'start'));
        document.getElementById('hist-prev')?.addEventListener('click', () => this.scene.events.emit('history-navigate', 'prev'));
        document.getElementById('hist-next')?.addEventListener('click', () => this.scene.events.emit('history-navigate', 'next'));
        document.getElementById('hist-end')?.addEventListener('click', () => this.scene.events.emit('history-navigate', 'end'));
    }

    formatTime(ms) {
        if (ms >= 999 * 60 * 1000) return '∞';
        if (ms < 0) ms = 0;
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}