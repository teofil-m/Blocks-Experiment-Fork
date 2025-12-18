import {
  GridState,
  BlockData,
  Player,
  Orientation,
  AIDifficulty,
} from "../types";
import { GRID_SIZE, WIN_LENGTH } from "../constants";
import {
  findDropPosition,
  validateMove,
  applyBlockToGrid,
  checkWin,
  getGridBounds,
} from "./gameLogic";

const SCORES = {
  WIN: 100000,
  FOUR_IN_ROW: 1000,
  THREE_IN_ROW: 100,
  TWO_IN_ROW: 10,
  CENTER: 3,
  CONNECTIVITY: 5,
};

const getHeuristicScore = (grid: GridState, player: Player): number => {
  const opponent: Player = player === "white" ? "black" : "white";
  let score = 0;

  const checkLine = (x: number, y: number, dx: number, dy: number) => {
    let playerCount = 0;
    let opponentCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < WIN_LENGTH; i++) {
      const cell = grid.get(`${x + dx * i},${y + dy * i}`);
      if (cell) {
        if (cell.player === player) playerCount++;
        else opponentCount++;
      } else {
        emptyCount++;
      }
    }

    // Score for player's potential winning lines
    if (playerCount > 0 && opponentCount === 0) {
      if (playerCount === 5) return SCORES.WIN;
      if (playerCount === 4) return SCORES.FOUR_IN_ROW;
      if (playerCount === 3) return SCORES.THREE_IN_ROW;
      if (playerCount === 2) return SCORES.TWO_IN_ROW;
    }

    // Score for blocking opponent's potential winning lines (weighted higher)
    if (opponentCount > 0 && playerCount === 0) {
      if (opponentCount === 5) return -SCORES.WIN;
      if (opponentCount === 4) return -SCORES.FOUR_IN_ROW * 2; // Critical to block!
      if (opponentCount === 3) return -SCORES.THREE_IN_ROW * 1.5; // Important to block
      if (opponentCount === 2) return -SCORES.TWO_IN_ROW;
    }
    return 0;
  };

  const { minX, maxX } = getGridBounds(grid);
  const startX = minX - 2;
  const endX = maxX + 2;
  const startY = 0;
  const endY = GRID_SIZE;

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      score += checkLine(x, y, 1, 0); // Horizontal
      score += checkLine(x, y, 0, 1); // Vertical
      score += checkLine(x, y, 1, 1); // Diagonal down-right
      score += checkLine(x, y, 1, -1); // Diagonal up-right

      // Central positioning bonus
      const cell = grid.get(`${x},${y}`);
      if (cell && cell.player === player) {
        const distFromCenter = Math.abs(x);
        score += Math.max(0, 5 - distFromCenter) * SCORES.CENTER;

        // Bonus for connectivity (pieces adjacent to other pieces)
        let adjacentCount = 0;
        const adjacent = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
          [x + 1, y + 1],
          [x - 1, y - 1],
          [x + 1, y - 1],
          [x - 1, y + 1],
        ];
        for (const [ax, ay] of adjacent) {
          const adjCell = grid.get(`${ax},${ay}`);
          if (adjCell && adjCell.player === player) adjacentCount++;
        }
        score += adjacentCount * SCORES.CONNECTIVITY;
      }
    }
  }

  return score;
};

const getAllPossibleMoves = (grid: GridState, player: Player): BlockData[] => {
  const moves: BlockData[] = [];
  const { minX, maxX } = getGridBounds(grid);

  // Search range expanded to possible next valid placements
  const startX = grid.size === 0 ? 0 : minX - 2;
  const endX = grid.size === 0 ? 0 : maxX + 2;

  const orientations: Orientation[] = ["vertical", "horizontal"];

  for (let x = startX; x <= endX; x++) {
    for (const orientation of orientations) {
      const y = findDropPosition(grid, x, orientation);
      if (validateMove(grid, x, y, orientation, player)) {
        moves.push({
          id: `ai-${Math.random()}`,
          x,
          y,
          orientation,
          player,
        });
      }
    }
  }
  return moves;
};

const minimax = (
  grid: GridState,
  depth: number,
  isMaximizing: boolean,
  player: Player,
  alpha: number,
  beta: number
): number => {
  const opponent = player === "white" ? "black" : "white";
  const winner = checkWin(grid, isMaximizing ? player : opponent);

  if (winner) return isMaximizing ? SCORES.WIN + depth : -SCORES.WIN - depth;
  if (depth === 0) return getHeuristicScore(grid, player);

  const moves = getAllPossibleMoves(grid, isMaximizing ? player : opponent);
  if (moves.length === 0) return 0; // Draw or no moves

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newGrid = applyBlockToGrid(grid, move);
      const evalValue = minimax(newGrid, depth - 1, false, player, alpha, beta);
      maxEval = Math.max(maxEval, evalValue);
      alpha = Math.max(alpha, evalValue);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newGrid = applyBlockToGrid(grid, move);
      const evalValue = minimax(newGrid, depth - 1, true, player, alpha, beta);
      minEval = Math.min(minEval, evalValue);
      beta = Math.min(beta, evalValue);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

export const getBestMove = (
  grid: GridState,
  player: Player,
  difficulty: AIDifficulty
): BlockData | null => {
  const moves = getAllPossibleMoves(grid, player);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    // Easy: 70% random, 30% semi-smart
    if (Math.random() < 0.7) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
  }

  // Check for immediate win first
  for (const move of moves) {
    const newGrid = applyBlockToGrid(grid, move);
    if (checkWin(newGrid, player)) {
      return move; // Take the winning move!
    }
  }

  // Check for immediate block of opponent win
  const opponent = player === "white" ? "black" : "white";
  for (const move of moves) {
    // Simulate opponent's moves from current position
    const opponentMoves = getAllPossibleMoves(grid, opponent);
    for (const oppMove of opponentMoves) {
      const testGrid = applyBlockToGrid(grid, oppMove);
      if (checkWin(testGrid, opponent)) {
        // Opponent can win next turn! Check if our move blocks it
        const ourGrid = applyBlockToGrid(grid, move);
        const opponentMovesAfter = getAllPossibleMoves(ourGrid, opponent);
        let canStillWin = false;
        for (const oppMove2 of opponentMovesAfter) {
          const testGrid2 = applyBlockToGrid(ourGrid, oppMove2);
          if (checkWin(testGrid2, opponent)) {
            canStillWin = true;
            break;
          }
        }
        if (!canStillWin) {
          return move; // This blocks their win!
        }
      }
    }
  }

  // Medium or Hard: Use minimax with appropriate depth
  const depth = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const newGrid = applyBlockToGrid(grid, move);
    const score = minimax(newGrid, depth, false, player, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};
