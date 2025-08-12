# Obstrukt

<p align="center">
  <a href="https://obstrukt.vercel.app/">
    <img width="3198" height="1710" alt="Screenshot of Obstrukt game interface" src="https://github.com/user-attachments/assets/00514b35-75fe-4a92-9fa2-6dc91bca4efe" />
  </a>
</p>

*Obstrukt* is an online, multiplayer, turn-based board game inspired by *Quoridor*.  
Play against friends in real-time or challenge an AI opponent with adjustable difficulty.

---

## Features Implemented
1. **Multiplayer mode** – play anonymously over the internet.
2. **Two and four player modes**.
3. **AI opponents** with configurable difficulty.
4. **Board size configuration** - 5x5, 7x7, 9x9, and 11x11 board sizes available.
5. **Custom time control** – set time per player.
6. **Game history navigation** – step through past moves during or after the game.

## Features in Development
1. **Player accounts** – persistent profiles and stats.
2. **Post-game analysis** – engine-powered board evaluation and study tools.
3. **Improved AI** – potential integration of neural network and self-play learning models.

---

## About the AI
The current AI uses the NegaMax search algorithm, enhanced with:
- Alpha-Beta Pruning
- Null-Move Pruning
- Zobrist Hashing
- Iterative Deepening

The evaluation function is still being tuned, and further optimizations are planned to improve response times at higher search depths.

---

## Play Now
🔗 **[Play Obstrukt in your browser](https://obstrukt.vercel.app/)** – no download necessary.
