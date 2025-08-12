import Game from './scenes/Game.js'
import Menu from './scenes/Menu.js'
import { GAME_COLORS  } from './config/gameConfig.js';
const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 960,
    parent: 'game-container',
    dom: {
        createContainer: true
    },
    backgroundColor: GAME_COLORS.background, 
    pauseOnBlur: false,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: false,
    render: {
        antialias: true,
    },
    
    scene: [
        Menu,
        Game
    ]
};

const game = new Phaser.Game(config);