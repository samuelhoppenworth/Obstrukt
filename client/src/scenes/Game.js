import Renderer from "../helpers/Renderer.js";

export default class Game extends Phaser.Scene {
    constructor() {
        super ({
            key: 'Game'
        })
    }

    preload() {
        
    }

    create () {
      this.renderer = new Renderer(this);
      this.renderer.drawStaticBoard();
    }

    update() {
    
    }
}