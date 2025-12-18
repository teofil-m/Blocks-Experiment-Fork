export const GRID_SIZE = 9; // Max width constraint
export const WIN_LENGTH = 5;
export const MAX_BLOCKS_PER_PLAYER = 20; // Max blocks each player can place

// Visual scaling
export const CUBE_SIZE = 1;
// Offset isn't strictly needed for centering if we dynamic pan,
// but keeps 0,0 somewhat centered initially.
// However, since 0 is now the *starting* point and we can go negative,
// let's remove the offset assumption or just treat 0,0 as center.
export const BOARD_OFFSET = 0;

export const COLORS = {
  white: "#e3cba8", // Light wood
  black: "#2d2d2d", // Dark wood
  whiteGhost: "#e3cba880",
  blackGhost: "#2d2d2d80",
  highlight: "#4ade80", // Green for valid move
  error: "#ef4444", // Red for invalid
  background: "#1f2937",
};

export const INITIAL_CAMERA_POSITION: [number, number, number] = [0, 10, 20];

// Timer Settings
export const INITIAL_TIME_SECONDS = 300; // 5 minutes
export const INCREMENT_SECONDS = 5; // 5 seconds added per turn

export const TIME_PRESETS = [
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
];
