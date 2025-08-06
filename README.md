# [Obstrukt](https://obstrukt.vercel.app/)

<p align="center">
    <img width="3198" height="1710" alt="image" src="https://github.com/user-attachments/assets/00514b35-75fe-4a92-9fa2-6dc91bca4efe" />
</p>

An ongoing effort to implement Obstrukt, an online multi-player turn-based board game inspired by Quoridor, as well as AI opponents for single-player sessions.

### Features Implemented:
1. AI availablility in all game modes
2. AI difficulty configuration (how far ahead the AI searches)
3. Board size (5x5, 7x7, 9x9, and 11x11) configuration
4. Two and four player modes 

### Features in development: 
1. Multiplayer support
5. Player account creation
3. History navigation, allowing players to step through their games both during and after game termination
4. Game analysis using a game engine, allowing players to evaluate board positions and study past games
5. General AI improvement, potentially integrating existing open-source models

### About the AI

The opponent is an implmentation of the NegaMax algorithm. Computation speed is enchanced with Alpha-Beta Pruning, Null-Move Pruning, Zobrist Hashing, and Iterative Deepening. 
The function the model uses to evaluate a position still requires tuning, and more optimizations can be made to reduce think-time at higher depths.  
