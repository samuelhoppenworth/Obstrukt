// src/scenes/Menu.js
import Renderer from '../helpers/Renderer.js';
import { ALL_PLAYERS, GAME_COLORS } from '../config/gameConfig.js';

export default class Menu extends Phaser.Scene {
    constructor() { super({ key: 'Menu' }); }

    create() {
        this.renderConfig = { boardSize: 9, players: ALL_PLAYERS, colors: GAME_COLORS };
        this.renderer = new Renderer(this, this.renderConfig);
        
        const sidePanel = document.getElementById('side-panel');
        sidePanel.innerHTML = `
            <div class="panel-section menu-panel">
                <div class="setting-group">
                    <h3>Board</h3>
                    <div class="setting-row">
                        <label>Board Size</label>
                        <div class="segmented-control" id="board-size-control">
                            <button data-value="5">5x5</button>
                            <button data-value="7">7x7</button>
                            <button data-value="9" class="active">9x9</button>
                            <button data-value="11">11x11</button>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label>Players</label>
                        <div class="segmented-control" id="num-players-control">
                            <button data-value="2" class="active">2</button>
                            <button data-value="4">4</button>
                        </div>
                    </div>
                </div>

                <div class="setting-group">
                    <h3>Players</h3>
                    <div class="player-setup-table" id="player-types-container">
                        <!-- Player type selectors are dynamically added here -->
                    </div>
                </div>
            </div>
            <button id="start-game-btn">Start Game</button>
        `;
        
        this.settings = {
            numPlayers: 2,
            boardSize: 9
        };

        const startButton = document.getElementById('start-game-btn');
        
        this.setupSegmentedControl('num-players-control', 'numPlayers');
        this.setupSegmentedControl('board-size-control', 'boardSize');

        startButton.addEventListener('click', () => {
            const playersForGame = this.settings.numPlayers === 2
                ? [ALL_PLAYERS[0], ALL_PLAYERS[2]]
                : ALL_PLAYERS.slice(0, 4);

            const playerTypes = {};
            const playerDifficulties = {};
            playersForGame.forEach(player => {
                const typeToggle = document.querySelector(`input[name="${player.id}-type"]:checked`);
                playerTypes[player.id] = typeToggle.value;
                if (typeToggle.value === 'ai') {
                    const difficultySelect = document.getElementById(`${player.id}-difficulty`);
                    playerDifficulties[player.id] = parseInt(difficultySelect.value, 10);
                }
            });
            
            this.scene.start('Game', {
                gameType: 'local',
                numPlayers: this.settings.numPlayers,
                playerTypes: playerTypes,
                playerDifficulties: playerDifficulties,
                boardSize: this.settings.boardSize
            });
        });

        this.updateUI(); // Initial call
    }

    setupSegmentedControl(containerId, settingKey) {
        const container = document.getElementById(containerId);
        container.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                const value = parseInt(event.target.dataset.value, 10);
                this.settings[settingKey] = value;
                
                container.querySelector('.active').classList.remove('active');
                event.target.classList.add('active');
                
                this.updateUI();
            }
        });
    }

    updateUI() {
        this.generatePlayerTypeSelectors(this.settings.numPlayers);
        this.updatePreview(this.settings.numPlayers, this.settings.boardSize);
    }

    generatePlayerTypeSelectors(numPlayers) {
        const container = document.getElementById('player-types-container');
        container.innerHTML = '';
        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

        playersForGame.forEach((player, index) => {
            const playerColors = { p1: 'Red', p2: 'Green', p3: 'Purple', p4: 'Blue' };
            const playerName = playerColors[player.id];

            const isInitiallyAI = index !== 0;

            const playerRow = document.createElement('div');
            playerRow.className = 'player-config-row';
            
            playerRow.innerHTML = `
                <div class="player-name-label">${playerName}</div>
                <div class="player-type-toggle">
                    <input type="radio" id="${player.id}-human" name="${player.id}-type" value="human" ${!isInitiallyAI ? 'checked' : ''}>
                    <label for="${player.id}-human">Human</label>
                    <input type="radio" id="${player.id}-ai" name="${player.id}-type" value="ai" ${isInitiallyAI ? 'checked' : ''}>
                    <label for="${player.id}-ai">AI</label>
                </div>
                <div class="player-difficulty-selector">
                    <select id="${player.id}-difficulty">
                        <option value="2">Depth 2</option>
                        <option value="4">Depth 4</option>
                        <option value="6">Depth 6</option>
                        <option value="8">Depth 8</option>
                    </select>
                </div>
            `;
            container.appendChild(playerRow);
            
            const difficultySelector = playerRow.querySelector('.player-difficulty-selector');
            const typeToggles = playerRow.querySelectorAll(`input[name="${player.id}-type"]`);
            
            const toggleDifficultyVisibility = () => {
                const selectedType = playerRow.querySelector(`input[name="${player.id}-type"]:checked`).value;
                difficultySelector.style.visibility = selectedType === 'ai' ? 'visible' : 'hidden';
            };
            
            typeToggles.forEach(toggle => toggle.addEventListener('change', toggleDifficultyVisibility));
            toggleDifficultyVisibility();
        });
    }

    updatePreview(numPlayers, boardSize) {
        if (this.renderer) this.renderer.destroy();

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