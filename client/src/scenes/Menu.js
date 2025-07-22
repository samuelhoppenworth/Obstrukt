// src/scenes/Menu.js
import Renderer from '../helpers/Renderer.js';
import { ALL_PLAYERS, GAME_COLORS } from '../config/gameConfig.js';

export default class Menu extends Phaser.Scene {
    constructor() { super({ key: 'Menu' }); }

    create() {
        // Initial render
        this.renderConfig = { boardSize: 9, players: ALL_PLAYERS, colors: GAME_COLORS };
        this.renderer = new Renderer(this, this.renderConfig);
        
        const sidePanel = document.getElementById('side-panel');
        sidePanel.innerHTML = `
            <div class="panel-section">
                <h2>Game Mode</h2>
                <div class="config-item">
                    <label for="game-mode">Mode:</label>
                    <select id="game-mode">
                        <option value="local">Local Play</option>
                        <option value="online">Online Multiplayer</option>
                    </select>
                </div>
                <div class="config-item">
                    <label for="num-players">Players:</label>
                    <select id="num-players">
                        <option value="2">2</option>
                        <option value="4">4</option>
                    </select>
                </div>
                <div id="local-options">
                    <h2>Player Settings</h2>
                    <!-- FIX: Added Board Size Selector -->
                    <div class="config-item">
                        <label for="board-size">Board Size:</label>
                        <select id="board-size">
                            <option value="7">7x7</option>
                            <option value="9" selected>9x9</option>
                            <option value="11">11x11</option>
                        </select>
                    </div>
                    <div id="player-types-container"></div>
                </div>
            </div>
            <button id="start-game-btn">Start Game</button>
        `;

        const gameModeSelect = document.getElementById('game-mode');
        const localOptions = document.getElementById('local-options');
        const numPlayersSelect = document.getElementById('num-players');
        const startButton = document.getElementById('start-game-btn');
        const boardSizeSelect = document.getElementById('board-size'); // Get the new element

        const updateUI = () => {
            const isLocal = gameModeSelect.value === 'local';
            const numPlayers = parseInt(numPlayersSelect.value, 10);
            const boardSize = parseInt(boardSizeSelect.value, 10);
            
            localOptions.style.display = isLocal ? 'block' : 'none';
            startButton.textContent = isLocal ? 'Start Game' : 'Find Game';
            
            // Online mode should only allow 9x9 board
            boardSizeSelect.parentElement.style.display = isLocal ? 'flex' : 'none';
            if (!isLocal) {
                 numPlayersSelect.querySelector('option[value="4"]').disabled = false;
            } else {
                // For simplicity, 4 players only on 9x9 for now
                 numPlayersSelect.querySelector('option[value="4"]').disabled = boardSize !== 9;
                 if (boardSize !== 9 && numPlayersSelect.value === '4') {
                    numPlayersSelect.value = '2';
                 }
            }
            
            if (isLocal) {
                this.generatePlayerTypeSelectors(numPlayers);
            }
            // Pass the board size to the preview
            this.updatePreview(numPlayers, boardSize);
        };
        
        gameModeSelect.addEventListener('change', updateUI);
        numPlayersSelect.addEventListener('change', updateUI);
        boardSizeSelect.addEventListener('change', updateUI); // Add listener for board size changes

        startButton.addEventListener('click', () => {
            const mode = gameModeSelect.value;
            const numPlayers = parseInt(numPlayersSelect.value, 10);
            const boardSize = parseInt(boardSizeSelect.value, 10);

            if (mode === 'online') {
                this.scene.start('Game', { 
                    gameType: 'online',
                    numPlayers: numPlayers
                    // boardSize for online is determined by the server (hardcoded to 9)
                });
            } else {
                const playersForGame = numPlayers === 2
                    ? [ALL_PLAYERS[0], ALL_PLAYERS[2]]
                    : ALL_PLAYERS.slice(0, 4);

                const playerTypes = {};
                playersForGame.forEach(player => {
                    const select = document.getElementById(`${player.id}-type`);
                    playerTypes[player.id] = select.value;
                });
                
                this.scene.start('Game', {
                    gameType: 'local',
                    numPlayers: numPlayers,
                    playerTypes: playerTypes,
                    boardSize: boardSize // Pass the selected board size
                });
            }
        });
        
        updateUI();
    }

    generatePlayerTypeSelectors(numPlayers) {
        const container = document.getElementById('player-types-container');
        container.innerHTML = '';
        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

        playersForGame.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'config-item';
            item.innerHTML = `
                <label for="${player.id}-type">Player ${index + 1}:</label>
                <select id="${player.id}-type">
                    <option value="human" ${index === 0 ? 'selected' : ''}>Human</option>
                </select>
            `;
            container.appendChild(item);
        });
    }

    updatePreview(numPlayers, boardSize) {
        // --- FIX: Destroy and recreate the renderer to show the new size ---
        if (this.renderer) {
            this.renderer.destroy();
        }
        this.renderConfig = { boardSize, players: ALL_PLAYERS, colors: GAME_COLORS };
        this.renderer = new Renderer(this, this.renderConfig);

        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);
        
        let pawnPositions = {};
        playersForGame.forEach(player => {
             // Call the startPos function with the new board size
             pawnPositions[player.id] = player.startPos(boardSize);
        });

        const previewState = { pawnPositions, placedWalls: [], availablePawnMoves: [], status: 'menu' };
        this.renderer.drawGameState(previewState, { perspective: 'p1', shouldShowHighlights: false });
    }
}