import { GridState, BlockData, Orientation, Player, CellData } from "../types";
import { GRID_SIZE, WIN_LENGTH } from "../constants";

// We use a Map now, so "creating" is just a new Map.
export const createEmptyGrid = (): GridState => {
  return new Map();
};

const getCell = (
  grid: GridState,
  x: number,
  y: number
): CellData | undefined => {
  return grid.get(`${x},${y}`);
};

// Helper to reconstruct grid from blocks (useful for network sync)
export const rebuildGridFromBlocks = (blocks: BlockData[]): GridState => {
  const grid = createEmptyGrid();
  for (const block of blocks) {
    applyBlockToGridInPlace(grid, block);
  }
  return grid;
};

// Internal helper that modifies the map directly
const applyBlockToGridInPlace = (grid: GridState, block: BlockData) => {
  const { x, y, orientation, player, id } = block;
  const cellOrigin: CellData = {
    player,
    orientation,
    blockId: id,
    part: "origin",
  };
  const cellExt: CellData = {
    player,
    orientation,
    blockId: id,
    part: "extension",
  };

  if (orientation === "vertical") {
    grid.set(`${x},${y}`, cellOrigin);
    grid.set(`${x},${y + 1}`, cellExt);
  } else {
    grid.set(`${x},${y}`, cellOrigin);
    grid.set(`${x + 1},${y}`, cellExt);
  }
};

export const applyBlockToGrid = (
  grid: GridState,
  block: BlockData
): GridState => {
  // Shallow copy the map for immutability in React state
  const newGrid = new Map(grid);
  applyBlockToGridInPlace(newGrid, block);
  return newGrid;
};

/**
 * Calculates the landing Y position for a block given X and orientation.
 * Returns -1 if the placement is invalid (e.g. gap bridging rule).
 * Y is >= 0 (floor).
 */
export const findDropPosition = (
  grid: GridState,
  x: number,
  orientation: Orientation
): number => {
  // Find highest occupied cell in column x.
  const getColumnHeight = (cx: number) => {
    let y = 0;
    while (grid.has(`${cx},${y}`)) {
      y++;
    }
    return y;
  };

  let targetY = -1;

  if (orientation === "vertical") {
    // Needs 1 column width at x.
    const h = getColumnHeight(x);
    // Vertical block takes h and h+1.
    targetY = h;
  } else {
    // Horizontal: Needs column x and x+1.
    const h1 = getColumnHeight(x);
    const h2 = getColumnHeight(x + 1);

    // Gravity Rule: The block rests on the highest point.
    targetY = Math.max(h1, h2);

    // Stability Rule:
    // To place horizontally bridging two columns, usually both columns must support it (y1 == y2).
    // Or at least, you cannot have a gap underneath one side if it's not supported.
    // If h1 != h2, then one side is hanging in the air.
    // Strict rule: h1 must equal h2.
    // Exception: Placing on the ground (y=0) is always stable.
    if (targetY === 0) {
      // valid
    } else if (h1 !== h2) {
      // Invalid bridging
      return -1;
    }
  }

  // HEIGHT CONSTRAINT:
  // The block must fit within the vertical grid size (0 to GRID_SIZE-1).
  // Vertical block needs targetY and targetY+1. Max index is GRID_SIZE-1.
  if (orientation === "vertical") {
    if (targetY + 1 >= GRID_SIZE) return -1;
  } else {
    if (targetY >= GRID_SIZE) return -1;
  }

  return targetY;
};

/**
 * Checks if a block is connected to any existing block on the board.
 */
const isConnectedToExisting = (
  grid: GridState,
  x: number,
  y: number,
  orientation: Orientation
): boolean => {
  const checkPositions: Array<[number, number]> = [];

  if (orientation === "vertical") {
    // Occupies (x,y), (x,y+1)
    checkPositions.push(
      [x - 1, y],
      [x + 1, y],
      [x, y - 1], // Around bottom
      [x - 1, y + 1],
      [x + 1, y + 1],
      [x, y + 2] // Around top
    );
  } else {
    // Occupies (x,y), (x+1,y)
    checkPositions.push(
      [x - 1, y],
      [x, y - 1],
      [x, y + 1], // Around left
      [x + 1, y - 1],
      [x + 1, y + 1],
      [x + 2, y] // Around right
    );
  }

  for (const [bx, qy] of checkPositions) {
    if (grid.has(`${bx},${qy}`)) return true;
  }
  return false;
};

export const getGridBounds = (
  grid: GridState
): { minX: number; maxX: number } => {
  let minX = Infinity;
  let maxX = -Infinity;

  if (grid.size === 0) return { minX: 0, maxX: 0 }; // Default center if empty

  for (const key of grid.keys()) {
    const [cxStr] = key.split(",");
    const cx = parseInt(cxStr);
    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
  }
  return { minX, maxX };
};

/**
 * Checks if the new block would violate the max width constraint (9 columns).
 */
const checkWidthConstraint = (
  grid: GridState,
  x: number,
  orientation: Orientation
): boolean => {
  if (grid.size === 0) return true;

  const { minX, maxX } = getGridBounds(grid);

  // Determine the X range of the NEW block
  const newBlockMinX = x;
  const newBlockMaxX = orientation === "horizontal" ? x + 1 : x;

  // Calculate prospective bounds
  const newMin = Math.min(minX, newBlockMinX);
  const newMax = Math.max(maxX, newBlockMaxX);

  // Width = (Max - Min) + 1. e.g. if blocks at 0 and 8, width is 9.
  const width = newMax - newMin + 1;

  return width <= GRID_SIZE; // Use constant 9
};

export const validateMove = (
  grid: GridState,
  x: number,
  y: number,
  orientation: Orientation,
  player: Player
): boolean => {
  if (y === -1) return false;

  // 1. Width Constraint
  if (!checkWidthConstraint(grid, x, orientation)) return false;

  // 2. Connectivity (unless first move)
  if (grid.size > 0) {
    if (!isConnectedToExisting(grid, x, y, orientation)) return false;
  }

  // 3. Short Side Constraint
  if (orientation === "vertical") {
    // Bottom touching Top of same color block below
    if (y > 0) {
      const below = grid.get(`${x},${y - 1}`);
      if (below && below.player === player && below.orientation === "vertical")
        return false;
    }
  } else {
    // Horizontal: Left side touching Right side of same color block to left
    const left = grid.get(`${x - 1},${y}`);
    if (left && left.player === player && left.orientation === "horizontal")
      return false;

    // Right side touching Left side of same color block to right
    const right = grid.get(`${x + 2},${y}`);
    if (right && right.player === player && right.orientation === "horizontal")
      return false;
  }

  return true;
};

export const hasValidMove = (grid: GridState, player: Player): boolean => {
  // If grid is empty, player can place anywhere (typically around 0 for UI sanity, but valid logic allows 0)
  if (grid.size === 0) return true;

  const { minX, maxX } = getGridBounds(grid);

  // We iterate through a range of X values that could possibly form a valid move.
  // The max width is GRID_SIZE (9).
  // A new block could extend the bounds to the left or right, up to the limit.
  // We safely check a range slightly larger than the current bounds to catch all possibilities.
  // Range [minX - 9, maxX + 9] is more than sufficient.

  const startX = minX - GRID_SIZE;
  const endX = maxX + GRID_SIZE;

  for (let x = startX; x <= endX; x++) {
    for (const orientation of ["vertical", "horizontal"] as Orientation[]) {
      const y = findDropPosition(grid, x, orientation);
      if (validateMove(grid, x, y, orientation, player)) {
        return true;
      }
    }
  }

  return false;
};

export const checkWin = (
  grid: GridState,
  player: Player
): { x: number; y: number }[] | null => {
  const directions = [
    [1, 0], // Horizontal
    [0, 1], // Vertical
    [1, 1], // Diagonal /
    [1, -1], // Diagonal \
  ];

  const cells: { x: number; y: number }[] = [];
  for (const [key, cell] of grid.entries()) {
    if (cell.player === player) {
      const [kx, ky] = key.split(",").map(Number);
      cells.push({ x: kx, y: ky });
    }
  }

  for (const { x, y } of cells) {
    for (const [dx, dy] of directions) {
      const winningLine = [{ x, y }];

      for (let step = 1; step < WIN_LENGTH; step++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        const key = `${nx},${ny}`;
        const nextCell = grid.get(key);

        if (nextCell && nextCell.player === player) {
          winningLine.push({ x: nx, y: ny });
        } else {
          break;
        }
      }

      if (winningLine.length >= WIN_LENGTH) {
        return winningLine;
      }
    }
  }

  return null;
};
