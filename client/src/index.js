import Game from './scenes/game.js'

const config = {
    type: Phaser.AUTO,
    width: 960,
    height: 960,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: false,
    render: {
        antialias: true,
    },
    
    scene: [
        Game
    ]
};

const game = new Phaser.Game(config)