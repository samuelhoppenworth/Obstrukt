# [Obstrukt](https://obstrukt.vercel.app/)

<p align="center">
    <img width="3198" height="1710" alt="image" src="https://github.com/user-attachments/assets/00514b35-75fe-4a92-9fa2-6dc91bca4efe" />
</p>

An ongoing effort to implement Obstrukt, an online multi-player turn-based board game inspired by Quoridor, as well as AI opponents for single-player sessions.

### Features Implemented:
2. AI availablility in all game modes
3. Board size (5x5, 7x7, 9x9, and 11x11) configuration
4. Two and four player modes 

### Features in development: 
1. Multiplayer support 
5. Player account creation
2. AI difficulty configuration
3. History navigation, allowing players to step through their games both during and after game termination
4. Game analysis using a game engine, allowing players to evaluate board positions and study past games


### About the AI

The opponent is an implmentation of the NegaMax algorithm. Computation speed is enchanced with alpha-beta pruning and Zobrist hashing. 
Currently, all AI opponents search is limited to a depth of 4, which is more than enough to beat most players. Increasing the depth, particularly for larger board sizes, is possible, but slower. This is will be configurable in the future.
