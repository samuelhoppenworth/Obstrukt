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
                    <h3>Match Settings</h3>
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
                        <label>Time</label>
                        <div class="segmented-control" id="time-control-control">
                            <button data-value="1">1m</button>
                            <button data-value="3">3m</button>
                            <button data-value="5" class="active">5m</button>
                            <button data-value="10">10m</button>
                            <button data-value="20">20m</button>
                        </div>
                    </div>
                     <div class="setting-row-note">
                        <p id="time-warning-message" class="time-warning"></p>
                    </div>
                </div>

                <div class="setting-group">
                    <h3>Player Settings</h3>
                    <div class="setting-row">
                        <label>Players</label>
                        <div class="segmented-control" id="num-players-control">
                            <button data-value="2" class="active">2</button>
                            <button data-value="4">4</button>
                        </div>
                    </div>
                    <div class="player-setup-table" id="player-types-container">
                        <!-- Player type selectors are dynamically added here -->
                    </div>
                </div>
            </div>
            <button id="start-game-btn">Start Game</button>
        `;
        
        this.settings = {
            numPlayers: 2,
            boardSize: 9,
            timePerPlayer: 5,
            players: {}
        };

        const startButton = document.getElementById('start-game-btn');
        
        this.setupSegmentedControl('num-players-control', 'numPlayers');
        this.setupSegmentedControl('board-size-control', 'boardSize');
        this.setupSegmentedControl('time-control-control', 'timePerPlayer');

        startButton.addEventListener('click', () => {
            this._savePlayerSettings();
            const playersForGame = this.settings.numPlayers === 2
                ? [ALL_PLAYERS[0], ALL_PLAYERS[2]]
                : ALL_PLAYERS.slice(0, 4);

            const playerTypes = {};
            const playerDifficulties = {};
            
            playersForGame.forEach(player => {
                const playerConfig = this.settings.players[player.id];
                if (playerConfig) {
                    playerTypes[player.id] = playerConfig.type;
                    if (playerConfig.type === 'ai') {
                        playerDifficulties[player.id] = playerConfig.difficulty;
                    }
                }
            });
            
            this.scene.start('Game', {
                gameType: 'local',
                numPlayers: this.settings.numPlayers,
                playerTypes: playerTypes,
                playerDifficulties: playerDifficulties,
                boardSize: this.settings.boardSize,
                timePerPlayer: this.settings.timePerPlayer * 60 * 1000
            });
        });

        this.updateUI();
    }

    _savePlayerSettings() {
        const playerRows = document.querySelectorAll('.player-config-row');
        playerRows.forEach(row => {
            const playerId = row.dataset.playerId;
            const typeToggle = row.querySelector(`input[name="${playerId}-type"]:checked`);
            const difficultySelect = row.querySelector(`#${playerId}-difficulty`);

            if (playerId && typeToggle && difficultySelect) {
                this.settings.players[playerId] = {
                    type: typeToggle.value,
                    difficulty: parseInt(difficultySelect.value, 10)
                };
            }
        });
    }

    setupSegmentedControl(containerId, settingKey) {
        const container = document.getElementById(containerId);
        container.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                this._savePlayerSettings();
                
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
        this.updateTimeControlWarning();
    }

    updateTimeControlWarning() {
        const warningEl = document.getElementById('time-warning-message');
        const boardSize = this.settings.boardSize;
        const time = this.settings.timePerPlayer;

        const aiDifficultySelects = document.querySelectorAll('.player-difficulty-selector select');
        const activeAiDifficulties = [];
        aiDifficultySelects.forEach(select => {
            const playerRow = select.closest('.player-config-row');
            const typeToggle = playerRow.querySelector('input[name*="-type"]:checked');
            if (typeToggle && typeToggle.value === 'ai') {
                activeAiDifficulties.push(parseInt(select.value, 10));
            }
        });

        let showWarning = false;
        if (boardSize === 9 && [1, 3, 5].includes(time) && activeAiDifficulties.includes(8)) {
            showWarning = true;
        } else if (boardSize === 11 && [1, 3].includes(time) && (activeAiDifficulties.includes(6) || activeAiDifficulties.includes(8))) {
            showWarning = true;
        }
        
        warningEl.textContent = showWarning ? 'High-depth AIs may time out with this setting.' : '';
    }

    generatePlayerTypeSelectors(numPlayers) {
        const container = document.getElementById('player-types-container');
        container.innerHTML = '';
        const playersForGame = numPlayers === 2 ? [ALL_PLAYERS[0], ALL_PLAYERS[2]] : ALL_PLAYERS.slice(0, 4);

        playersForGame.forEach((player, index) => {
            const playerColors = { p1: 'Red', p2: 'Green', p3: 'Purple', p4: 'Blue' };
            const playerName = playerColors[player.id];
            
            const savedSettings = this.settings.players[player.id];
            const initialType = savedSettings ? savedSettings.type : (index !== 0 ? 'ai' : 'human');
            const initialDifficulty = savedSettings ? savedSettings.difficulty : 2;

            const playerRow = document.createElement('div');
            playerRow.className = 'player-config-row';
            playerRow.dataset.playerId = player.id;
            
            playerRow.innerHTML = `
                <div class="player-name-label">${playerName}</div>
                <div class="player-type-toggle">
                    <input type="radio" id="${player.id}-human" name="${player.id}-type" value="human" ${initialType === 'human' ? 'checked' : ''}>
                    <label for="${player.id}-human">Human</label>
                    <input type="radio" id="${player.id}-ai" name="${player.id}-type" value="ai" ${initialType === 'ai' ? 'checked' : ''}>
                    <label for="${player.id}-ai">AI</label>
                </div>
                <div class="player-difficulty-selector" data-tooltip="AI search depth. Higher is stronger but takes more time.">
                    <select id="${player.id}-difficulty">
                        <option value="2" ${initialDifficulty === 2 ? 'selected' : ''}>Depth 2</option>
                        <option value="4" ${initialDifficulty === 4 ? 'selected' : ''}>Depth 4</option>
                        <option value="6" ${initialDifficulty === 6 ? 'selected' : ''}>Depth 6</option>
                        <option value="8" ${initialDifficulty === 8 ? 'selected' : ''}>Depth 8</option>
                    </select>
                </div>
            `;
            container.appendChild(playerRow);
            
            const difficultySelect = playerRow.querySelector('.player-difficulty-selector select');
            const typeToggles = playerRow.querySelectorAll(`input[name="${player.id}-type"]`);
            
            const toggleDifficultyVisibility = () => {
                const selectedType = playerRow.querySelector(`input[name="${player.id}-type"]:checked`).value;
                playerRow.querySelector('.player-difficulty-selector').style.visibility = selectedType === 'ai' ? 'visible' : 'hidden';
            };
            
            typeToggles.forEach(toggle => {
                toggle.addEventListener('change', () => {
                    toggleDifficultyVisibility();
                    this.updateTimeControlWarning();
                });
            });

            difficultySelect.addEventListener('change', () => this.updateTimeControlWarning());
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