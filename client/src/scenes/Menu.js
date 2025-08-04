// src/scenes/Menu.js
import Renderer from '../helpers/Renderer.js';
import { ALL_PLAYERS, GAME_COLORS } from '../config/gameConfig.js';

export default class Menu extends Phaser.Scene {
    constructor() { super({ key: 'Menu' }); }

    create() {
        this.renderConfig = { boardSize: 9, players: ALL_PLAYERS, colors: GAME_COLORS };
        this.renderer = new Renderer(this, this.renderConfig);
        
        const sidePanel = document.getElementById('side-panel');
        // --- MODIFIED: The HTML is now condensed into one section ---
        sidePanel.innerHTML = `
            <div class="panel-section">
                <h2>Game Settings</h2>
                <div class="config-item">
                    <label for="num-players">Players:</label>
                    <select id="num-players">
                        <option value="2">2</option>
                        <option value="4">4</option>
                    </select>
                </div>
                <div class="config-item">
                    <label for="board-size">Board Size:</label>
                    <select id="board-size">
                        <option value="5">5x5</option>
                        <option value="7">7x7</option>
                        <option value="9" selected>9x9</option>
                        <option value="11">11x11</option>
                    </select>
                </div>
                <div id="player-types-container">
                    <!-- Player type selectors are dynamically added here -->
                </div>
            </div>
            <button id="start-game-btn">Start Game</button>
        `;

        const numPlayersSelect = document.getElementById('num-players');
        const startButton = document.getElementById('start-game-btn');
        const boardSizeSelect = document.getElementById('board-size');

        // This function remains the same, but now there's only one UI state.
        const updateUI = () => {
            const numPlayers = parseInt(numPlayersSelect.value, 10);
            const boardSize = parseInt(boardSizeSelect.value, 10);
            
            this.generatePlayerTypeSelectors(numPlayers);
            this.updatePreview(numPlayers, boardSize);
        };
        
        numPlayersSelect.addEventListener('change', updateUI);
        boardSizeSelect.addEventListener('change', updateUI);

        startButton.addEventListener('click', () => {
            const numPlayers = parseInt(numPlayersSelect.value, 10);
            const boardSize = parseInt(boardSizeSelect.value, 10);

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
                boardSize: boardSize
            });
        });

        updateUI(); // Initial call
    }

    generatePlayerTypeSelectors(numPlayers) {
        const container = document.getElementById('player-types-container');
        container.innerHTML = '';
        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

        playersForGame.forEach((player, index) => {
            const item = document.createElement('div');
            // This class is important for consistent styling
            item.className = 'config-item';
            item.innerHTML = `
                <label for="${player.id}-type">Player ${index + 1}:</label>
                <select id="${player.id}-type">
                    <option value="human" ${index === 0 ? 'selected' : ''}>Human</option>
                    <option value="ai" ${index !== 0 ? 'selected' : ''}>AI</option>
                </select>
            `;
            container.appendChild(item);
        });
    }

    updatePreview(numPlayers, boardSize) {
        if (this.renderer) {
            this.renderer.destroy();
        }

        this.renderConfig = { boardSize, players: ALL_PLAYERS, colors: GAME_COLORS };
        this.renderer = new Renderer(this, this.renderConfig);

        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);
        
        let pawnPositions = {};
        playersForGame.forEach(player => {
             pawnPositions[player.id] = player.startPos(boardSize);
        });

        const previewState = { pawnPositions, placedWalls: [], availablePawnMoves: [], status: 'menu' };
        this.renderer.drawGameState(previewState, { perspective: 'p1', shouldShowHighlights: false });
    }
}