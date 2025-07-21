import Game from './scenes/Game.js'
import Menu from './scenes/Menu.js'

const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 960,
    parent: 'game-container',
    dom: {
        createContainer: true
    },
    backgroundColor: '#3d3d3d', 
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