#include <iostream>
#include <vector>
#include <string>
#include <queue>
#include <algorithm>
#include <map>
#include <set>
#include <cmath>
#include <functional>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

// --- CONFIGURATION ---
const int DEFAULT_MAX_DEPTH = 2; 

// --- DATA STRUCTURES ---
struct PawnPos { int row; int col; bool operator==(const PawnPos& o) const { return row == o.row && col == o.col; } bool operator<(const PawnPos& o) const { return row != o.row ? row < o.row : col < o.col; } };
struct Wall { int row; int col; std::string orientation; bool operator==(const Wall& o) const { return row == o.row && col == o.col && orientation == o.orientation; } };
struct Move { std::string type; PawnPos pos; Wall wall; };
struct Player { std::string id; std::function<bool(int, int, int)> goalCondition; };
struct GameState { int boardSize; std::map<std::string, PawnPos> pawnPositions; std::map<std::string, int> wallsLeft; std::vector<Wall> placedWalls; std::string playerTurn; std::vector<std::string> activePlayerIds; int playerTurnIndex; std::string status = "active"; std::string winner = ""; };

// --- FORWARD DECLARATIONS ---
bool isWallBetween(const PawnPos& p1, const PawnPos& p2, const GameState& state);
int getShortestPathLength(const PawnPos& startPos, const std::function<bool(int, int, int)>& goalCondition, const GameState& state);

// --- CORE GAME LOGIC ---
std::vector<PawnPos> calculateLegalPawnMoves(const GameState& state) {
    std::vector<PawnPos> moves;
    if (state.pawnPositions.find(state.playerTurn) == state.pawnPositions.end()) return moves;
    const PawnPos& currentPawnPos = state.pawnPositions.at(state.playerTurn);
    int dr[] = {-1, 1, 0, 0}; int dc[] = {0, 0, -1, 1};
    std::set<PawnPos> allPawnLocations;
    for(const auto& pair : state.pawnPositions) allPawnLocations.insert(pair.second);

    for (int i = 0; i < 4; ++i) {
        PawnPos nextPos = {currentPawnPos.row + dr[i], currentPawnPos.col + dc[i]};
        if (nextPos.row < 0 || nextPos.row >= state.boardSize || nextPos.col < 0 || nextPos.col >= state.boardSize || isWallBetween(currentPawnPos, nextPos, state)) continue;
        
        if (allPawnLocations.find(nextPos) == allPawnLocations.end()) {
            moves.push_back(nextPos);
        } else {
            PawnPos jumpPos = {nextPos.row + dr[i], nextPos.col + dc[i]};
            bool straightJumpIsOnBoard = jumpPos.row >= 0 && jumpPos.row < state.boardSize && jumpPos.col >= 0 && jumpPos.col < state.boardSize;
            if (straightJumpIsOnBoard && !isWallBetween(nextPos, jumpPos, state) && allPawnLocations.find(jumpPos) == allPawnLocations.end()) {
                moves.push_back(jumpPos);
            } else {
                if (dr[i] != 0) { // Vertical move -> check horizontal sides
                    PawnPos s1 = {nextPos.row, nextPos.col - 1}, s2 = {nextPos.row, nextPos.col + 1};
                    if (s1.col >= 0 && !isWallBetween(nextPos, s1, state) && allPawnLocations.find(s1) == allPawnLocations.end()) moves.push_back(s1);
                    if (s2.col < state.boardSize && !isWallBetween(nextPos, s2, state) && allPawnLocations.find(s2) == allPawnLocations.end()) moves.push_back(s2);
                } else { // Horizontal move -> check vertical sides
                    PawnPos s1 = {nextPos.row - 1, nextPos.col}, s2 = {nextPos.row + 1, nextPos.col};
                    if (s1.row >= 0 && !isWallBetween(nextPos, s1, state) && allPawnLocations.find(s1) == allPawnLocations.end()) moves.push_back(s1);
                    if (s2.row < state.boardSize && !isWallBetween(nextPos, s2, state) && allPawnLocations.find(s2) == allPawnLocations.end()) moves.push_back(s2);
                }
            }
        }
    }
    return moves;
}

bool isWallPlacementLegal(const Wall& wall, const GameState& state, const std::map<std::string, Player>& players) {
    if (state.wallsLeft.find(state.playerTurn) == state.wallsLeft.end() || state.wallsLeft.at(state.playerTurn) <= 0) return false;
    if (wall.row < 0 || wall.row >= state.boardSize - 1 || wall.col < 0 || wall.col >= state.boardSize - 1) return false;
    for (const auto& placed : state.placedWalls) {
        if (placed.row == wall.row && placed.col == wall.col) return false;
        if (wall.orientation == "horizontal" && placed.orientation == "horizontal" && placed.row == wall.row && abs(placed.col - wall.col) == 1) return false;
        if (wall.orientation == "vertical" && placed.orientation == "vertical" && placed.col == wall.col && abs(placed.row - wall.row) == 1) return false;
    }
    GameState tempState = state; tempState.placedWalls.push_back(wall);
    for (const auto& p_id : state.activePlayerIds) {
        if (players.count(p_id) && tempState.pawnPositions.count(p_id)) {
            if (getShortestPathLength(tempState.pawnPositions.at(p_id), players.at(p_id).goalCondition, tempState) == -1) return false;
        }
    }
    return true;
}

GameState applyMove(GameState state, const Move& move, const std::map<std::string, Player>& players) {
    if (move.type == "pawn") state.pawnPositions[state.playerTurn] = move.pos;
    else if (move.type == "wall") { state.placedWalls.push_back(move.wall); state.wallsLeft[state.playerTurn]--; }

    if (players.count(state.playerTurn)) {
        const PawnPos& pPos = state.pawnPositions.at(state.playerTurn);
        if (players.at(state.playerTurn).goalCondition(pPos.row, pPos.col, state.boardSize)) {
            state.status = "ended"; state.winner = state.playerTurn; return state;
        }
    }
    if (!state.activePlayerIds.empty()) {
        state.playerTurnIndex = (state.playerTurnIndex + 1) % state.activePlayerIds.size();
        state.playerTurn = state.activePlayerIds[state.playerTurnIndex];
    }
    return state;
}

std::vector<Move> generateAllMoves(const GameState& state, const std::map<std::string, Player>& players) {
    std::vector<Move> allMoves;
    for (const auto& pos : calculateLegalPawnMoves(state)) allMoves.push_back({"pawn", pos});
    if (state.wallsLeft.count(state.playerTurn) && state.wallsLeft.at(state.playerTurn) > 0) {
        for (int r = 0; r < state.boardSize - 1; ++r) {
            for (int c = 0; c < state.boardSize - 1; ++c) {
                if (isWallPlacementLegal({r, c, "horizontal"}, state, players)) allMoves.push_back({"wall", {}, {r, c, "horizontal"}});
                if (isWallPlacementLegal({r, c, "vertical"}, state, players)) allMoves.push_back({"wall", {}, {r, c, "vertical"}});
            }
        }
    }
    return allMoves;
}

// =========================================================================================
// --- 4-PLAYER FIX: The evaluation function now considers ALL opponents ---
// =========================================================================================
int evaluate(const GameState& state, const std::map<std::string, Player>& players) {
    if (state.status == "ended") return (state.winner == state.playerTurn) ? 10000 : -10000;
    
    std::string myId = state.playerTurn;
    if (!players.count(myId)) return 0; // Should not happen

    int myPath = getShortestPathLength(state.pawnPositions.at(myId), players.at(myId).goalCondition, state);
    if (myPath == -1) return -9999; // I am trapped, this is very bad.

    int minOpponentPath = 999;
    int totalWallsLeft = 0;
    
    // Find the opponent who is closest to winning. That's the biggest threat.
    for (const auto& p_id : state.activePlayerIds) {
        if (p_id == myId) continue; // Skip myself
        if (players.count(p_id)) {
            int oppPath = getShortestPathLength(state.pawnPositions.at(p_id), players.at(p_id).goalCondition, state);
            if (oppPath != -1 && oppPath < minOpponentPath) {
                minOpponentPath = oppPath;
            }
        }
    }

    // If all opponents are trapped, that's a winning position.
    if (minOpponentPath == 999) return 9999;
    
    // Main Heuristic: My path vs the most threatening opponent's path.
    // Also consider the advantage of having more walls than opponents.
    int pathDifference = minOpponentPath - myPath;
    int wallAdvantage = state.wallsLeft.at(myId) - (state.activePlayerIds.size() - 1 > 0 ? 5 / (state.activePlayerIds.size() - 1) : 0);

    return (pathDifference * 10) + (wallAdvantage * 2);
}

int negamax(GameState state, int depth, int alpha, int beta, int color, const std::map<std::string, Player>& players) {
    if (depth == 0 || state.status == "ended") return color * evaluate(state, players);
    int maxVal = -10001;
    std::vector<Move> moves = generateAllMoves(state, players);
    std::sort(moves.begin(), moves.end(), [](const Move& a, const Move& b){ return a.type == "pawn" && b.type == "wall"; });
    if (moves.empty()) return color * evaluate(state, players);
    for (const auto& move : moves) {
        GameState nextState = applyMove(state, move, players);
        int val = -negamax(nextState, depth - 1, -beta, -alpha, -color, players);
        maxVal = std::max(maxVal, val); alpha = std::max(alpha, val);
        if (alpha >= beta) break;
    }
    return maxVal;
}

bool isWallBetween(const PawnPos& p1, const PawnPos& p2, const GameState& state) {
    for (const auto& wall : state.placedWalls) {
        if (wall.orientation == "horizontal") {
            if (p1.col == p2.col && (wall.col == p1.col || wall.col == p1.col - 1)) {
                if (p1.row + 1 == p2.row && wall.row == p1.row) return true;
                if (p1.row - 1 == p2.row && wall.row == p2.row) return true;
            }
        } else {
            if (p1.row == p2.row && (wall.row == p1.row || wall.row == p1.row - 1)) {
                if (p1.col + 1 == p2.col && wall.col == p1.col) return true;
                if (p1.col - 1 == p2.col && wall.col == p2.col) return true;
            }
        }
    }
    return false;
}

int getShortestPathLength(const PawnPos& startPos, const std::function<bool(int, int, int)>& goalCondition, const GameState& state) {
    if (goalCondition(startPos.row, startPos.col, state.boardSize)) return 0;
    std::queue<std::pair<PawnPos, int>> q; q.push({startPos, 0});
    std::set<PawnPos> visited; visited.insert(startPos);
    int dr[] = {-1, 1, 0, 0}, dc[] = {0, 0, -1, 1};
    while (!q.empty()) {
        PawnPos cPos = q.front().first; int dist = q.front().second; q.pop();
        if (goalCondition(cPos.row, cPos.col, state.boardSize)) return dist;
        for (int i = 0; i < 4; i++) {
            PawnPos nPos = {cPos.row + dr[i], cPos.col + dc[i]};
            if (nPos.row >= 0 && nPos.row < state.boardSize && nPos.col >= 0 && nPos.col < state.boardSize &&
                !isWallBetween(cPos, nPos, state) && visited.find(nPos) == visited.end()) {
                visited.insert(nPos); q.push({nPos, dist + 1});
            }
        }
    }
    return -1;
}

GameState jsToCppState(const emscripten::val& jsState) {
    GameState state;
    if (jsState.hasOwnProperty("boardSize")) state.boardSize = jsState["boardSize"].as<int>();
    if (jsState.hasOwnProperty("playerTurn")) state.playerTurn = jsState["playerTurn"].as<std::string>();
    if (jsState.hasOwnProperty("playerTurnIndex")) state.playerTurnIndex = jsState["playerTurnIndex"].as<int>();
    if (jsState.hasOwnProperty("status")) state.status = jsState["status"].as<std::string>();
    if (jsState.hasOwnProperty("pawnPositions")) {
        emscripten::val jsPawnPositions = jsState["pawnPositions"];
        std::vector<std::string> keys = emscripten::vecFromJSArray<std::string>(emscripten::val::global("Object").call<emscripten::val>("keys", jsPawnPositions));
        for (const auto& key : keys) state.pawnPositions[key] = {jsPawnPositions[key]["row"].as<int>(), jsPawnPositions[key]["col"].as<int>()};
    }
    if (jsState.hasOwnProperty("wallsLeft")) {
        emscripten::val jsWallsLeft = jsState["wallsLeft"];
        std::vector<std::string> keys = emscripten::vecFromJSArray<std::string>(emscripten::val::global("Object").call<emscripten::val>("keys", jsWallsLeft));
        for (const auto& key : keys) state.wallsLeft[key] = jsWallsLeft[key].as<int>();
    }
    if (jsState.hasOwnProperty("placedWalls") && !jsState["placedWalls"].isUndefined()) {
        emscripten::val jsPlacedWalls = jsState["placedWalls"];
        for (int i = 0; i < jsPlacedWalls["length"].as<int>(); ++i) {
            state.placedWalls.push_back({jsPlacedWalls[i]["row"].as<int>(), jsPlacedWalls[i]["col"].as<int>(), jsPlacedWalls[i]["orientation"].as<std::string>()});
        }
    }
    if (jsState.hasOwnProperty("activePlayerIds")) state.activePlayerIds = emscripten::vecFromJSArray<std::string>(jsState["activePlayerIds"]);
    return state;
}

// --- 4-PLAYER FIX: This function now correctly defines goals for ALL players ---
std::map<std::string, Player> jsToCppPlayers(const emscripten::val& jsPlayers) {
    std::map<std::string, Player> players;
    if (jsPlayers.isUndefined()) return players;
    for (int i = 0; i < jsPlayers["length"].as<int>(); ++i) {
        std::string id = jsPlayers[i]["id"].as<std::string>();
        if (id == "p1") players[id] = {id, [](int r, int c, int bS){ return r == 0; }};
        else if (id == "p2") players[id] = {id, [](int r, int c, int bS){ return c == 0; }};
        else if (id == "p3") players[id] = {id, [](int r, int c, int bS){ return r == bS - 1; }};
        else if (id == "p4") players[id] = {id, [](int r, int c, int bS){ return c == bS - 1; }};
    }
    return players;
}

emscripten::val cppMoveToJs(const Move& move) {
    emscripten::val jsMove = emscripten::val::object();
    jsMove.set("type", move.type);
    if (move.type != "resign") {
        emscripten::val data = emscripten::val::object();
        if (move.type == "pawn") { data.set("row", move.pos.row); data.set("col", move.pos.col); } 
        else if (move.type == "wall") { data.set("row", move.wall.row); data.set("col", move.wall.col); data.set("orientation", move.wall.orientation); }
        jsMove.set("data", data);
    }
    return jsMove;
}

emscripten::val findBestMove(const emscripten::val& jsState, const emscripten::val& jsPlayers) {
    GameState state = jsToCppState(jsState);
    std::map<std::string, Player> players = jsToCppPlayers(jsPlayers);
    Move bestMove;
    int bestValue = -10002;
    std::vector<Move> moves = generateAllMoves(state, players);
    if (moves.empty()) return cppMoveToJs({"resign"});
    bestMove = moves[0];
    for (const auto& move : moves) {
        GameState nextState = applyMove(state, move, players);
        int value = -negamax(nextState, DEFAULT_MAX_DEPTH - 1, -10001, 10001, -1, players);
        if (value > bestValue) { bestValue = value; bestMove = move; }
    }
    return cppMoveToJs(bestMove);
}

EMSCRIPTEN_BINDINGS(quoridor_ai_module) {
    emscripten::function("findBestMove", &findBestMove);
}