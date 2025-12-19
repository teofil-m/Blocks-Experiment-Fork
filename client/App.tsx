import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Canvas } from "@react-three/fiber";
import { io, Socket } from "socket.io-client";
import { GameScene } from "@/components/GameScene";
import { Chat, ChatMessage } from "@/components/Chat";
import { Tutorial } from "@/components/Tutorial";
import { LeaderboardModal } from "@/components/LeaderboardModal";
import {
  createEmptyGrid,
  findDropPosition,
  validateMove,
  applyBlockToGrid,
  checkWin,
  rebuildGridFromBlocks,
  hasValidMove,
} from "@/utils/gameLogic";
import { getBestMove } from "@/utils/aiPlayer";
import {
  GridState,
  BlockData,
  Player,
  Orientation,
  GameMode,
  AIDifficulty,
  NetworkRole,
  NetworkMessage,
  PlayerStats,
  LeaderboardEntry,
} from "@/types";
import {
  INITIAL_CAMERA_POSITION,
  INITIAL_TIME_SECONDS,
  INCREMENT_SECONDS,
  TIME_PRESETS,
  MAX_BLOCKS_PER_PLAYER,
} from "@/constants";

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTime = (seconds: number) => {
  if (seconds >= 999999) return "∞";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const SERVER_URL =
  (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:3000";

// --- Time Selector Component ---
const TimeControlSelector = ({
  isTimed,
  setIsTimed,
  initialTime,
  setInitialTime,
  increment,
  setIncrement,
}: {
  isTimed: boolean;
  setIsTimed: (v: boolean) => void;
  initialTime: number;
  setInitialTime: (v: number) => void;
  increment: number;
  setIncrement: (v: number) => void;
}) => {
  const [customMinutes, setCustomMinutes] = useState(
    Math.floor(initialTime / 60)
  );
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-4 bg-gray-900/40 p-4 rounded-xl border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold">
          Time Control
        </label>
        <button
          onClick={() => setIsTimed(!isTimed)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition ${
            isTimed ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"
          }`}
        >
          {isTimed ? "Enabled" : "Unlimited"}
        </button>
      </div>

      {isTimed && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setInitialTime(p.value);
                  setCustomMinutes(Math.floor(p.value / 60));
                  setShowCustom(false);
                }}
                className={`py-2 text-xs font-bold rounded-lg border transition ${
                  initialTime === p.value && !showCustom
                    ? "bg-blue-600 border-blue-400 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className={`py-2 text-xs font-bold rounded-lg border transition ${
                showCustom
                  ? "bg-blue-600 border-blue-400 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
              }`}
            >
              Custom
            </button>
          </div>

          {showCustom && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
              <div>
                <label className="block text-gray-500 text-[10px] uppercase mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={customMinutes}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setCustomMinutes(val);
                    setInitialTime(val * 60);
                  }}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-500 text-[10px] uppercase mb-1">
                  Bonus Time per Move (s)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={increment}
                  onChange={(e) =>
                    setIncrement(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-full bg-gray-800 border border-gray-700 text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Player Card Modal ---
const PlayerCardModal = ({
  player,
  name,
  stats,
  onClose,
}: {
  player: Player;
  name: string;
  stats: PlayerStats;
  onClose: () => void;
}) => {
  const winRate =
    stats.totalMatches > 0
      ? Math.round((stats.wins / stats.totalMatches) * 100)
      : 0;
  const avgTime = Math.round(stats.avgMatchTime / 60);
  const avgBlocks = Math.round(stats.avgBlocks * 10) / 10;

  const borderColor =
    player === "white" ? "border-amber-500/50" : "border-gray-500/50";
  const textColor = player === "white" ? "text-amber-400" : "text-gray-300";
  const avatarColor = player === "white" ? "bg-amber-600" : "bg-gray-700";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm bg-gray-900 border-2 ${borderColor} rounded-2xl p-8 shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex flex-col items-center mb-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg mb-4 ${avatarColor} text-white ring-4 ring-black`}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <h2 className={`text-2xl font-bold ${textColor}`}>{name}</h2>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mt-1">
            Player Statistics
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 flex flex-col items-center justify-center border border-gray-700">
            <span className="text-2xl font-mono font-bold text-white">
              {stats.totalMatches}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
              Matches
            </span>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 flex flex-col items-center justify-center border border-gray-700">
            <span
              className={`text-2xl font-mono font-bold ${
                winRate >= 50 ? "text-green-400" : "text-orange-400"
              }`}
            >
              {winRate}%
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
              Win Rate
            </span>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 flex flex-col items-center justify-center border border-gray-700">
            <span className="text-xl font-mono font-bold text-white">
              {stats.wins} - {stats.losses}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
              W - L
            </span>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 flex flex-col items-center justify-center border border-gray-700">
            <span className="text-xl font-mono font-bold text-white">
              {avgBlocks}
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
              Avg Blocks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [grid, setGrid] = useState<GridState>(createEmptyGrid());
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player>("white");
  const [previousLoser, setPreviousLoser] = useState<Player | null>(null);
  const [winner, setWinner] = useState<Player | "draw" | null>(null);
  const [winningCells, setWinningCells] = useState<
    { x: number; y: number }[] | null
  >(null);

  const [whiteScore, setWhiteScore] = useState(0);
  const [blackScore, setBlackScore] = useState(0);

  const [myName, setMyName] = useState("Player");
  const [whiteName, setWhiteName] = useState("White");
  const [blackName, setBlackName] = useState("Black");

  const [whiteStats, setWhiteStats] = useState<PlayerStats | null>(null);
  const [blackStats, setBlackStats] = useState<PlayerStats | null>(null);

  // Time Settings State
  const [isTimed, setIsTimed] = useState(true);
  const [initialTimeSetting, setInitialTimeSetting] =
    useState(INITIAL_TIME_SECONDS);
  const [incrementSetting, setIncrementSetting] = useState(INCREMENT_SECONDS);

  // State for modals
  const [viewStatsPlayer, setViewStatsPlayer] = useState<Player | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const hasShownStatsRef = useRef(false);

  const [localWhiteName, setLocalWhiteName] = useState("Player 1");
  const [localBlackName, setLocalBlackName] = useState("Player 2");
  const [showLocalSetup, setShowLocalSetup] = useState(false);
  const [showAISetup, setShowAISetup] = useState(false);
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>("medium");
  const [aiPlayer, setAIPlayer] = useState<Player>("black");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);

  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME_SECONDS);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME_SECONDS);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);

  const [hoverX, setHoverX] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("vertical");

  const [gameMode, setGameMode] = useState<GameMode>("local");
  const [networkRole, setNetworkRole] = useState<NetworkRole>(null);
  const [myPlayer, setMyPlayer] = useState<Player>("white");
  const [roomId, setRoomId] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "waiting" | "connected" | "error"
  >("idle");
  const [isInLobby, setIsInLobby] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentRematchRequested, setOpponentRematchRequested] =
    useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  const socketRef = useRef<Socket | null>(null);

  const currentPlayerRef = useRef<Player>(currentPlayer);
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  useEffect(() => {
    if (winner && winner !== "draw") {
      if (winner === "white") {
        setWhiteScore((s) => s + 1);
        setPreviousLoser("black"); // Black lost, goes first next game
      } else {
        setBlackScore((s) => s + 1);
        setPreviousLoser("white"); // White lost, goes first next game
      }
    } else if (winner === "draw") {
      // On draw, keep the previous loser or default to white
      setPreviousLoser(previousLoser || "white");
    }
  }, [winner, previousLoser]);

  // Save match to database when game ends
  useEffect(() => {
    if (winner && gameStartTime) {
      // Only save multiplayer (online) games to the database
      const shouldSave = gameMode === "online" && myPlayer === "white";

      if (!shouldSave) return;

      const matchEndTime = Date.now();
      const matchDurationSeconds = Math.round(
        (matchEndTime - gameStartTime) / 1000
      );

      const whiteBlocks = blocks.filter((b) => b.player === "white").length;
      const blackBlocks = blocks.filter((b) => b.player === "black").length;

      const matchData = {
        whiteName: whiteName,
        blackName: blackName,
        winner: winner,
        matchTime: matchDurationSeconds,
        whiteNumberOfBlocks: whiteBlocks,
        blackNumberOfBlocks: blackBlocks,
        matchEndTimestamp: new Date(matchEndTime).toISOString(),
      };

      if (socketRef.current?.connected) {
        socketRef.current.emit("save_match", matchData);
      }
    }
  }, [
    winner,
    gameStartTime,
    blocks,
    gameMode,
    localWhiteName,
    localBlackName,
    whiteName,
    blackName,
    myPlayer,
    aiPlayer,
    myName,
  ]);

  useEffect(() => {
    if (winner || isInLobby || showLocalSetup || showAISetup || !isTimed)
      return;
    const interval = setInterval(() => {
      const active = currentPlayerRef.current;
      if (active === "white") {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            setWinner("black");
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            setWinner("white");
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [winner, isInLobby, showLocalSetup, showAISetup, isTimed]);

  // AI Turn Logic
  useEffect(() => {
    if (
      gameMode === "ai" &&
      currentPlayer === aiPlayer &&
      !winner &&
      !isInLobby
    ) {
      setIsAiThinking(true);
      const timer = setTimeout(() => {
        const bestMove = getBestMove(grid, aiPlayer, aiDifficulty);
        if (bestMove) {
          handleAIPlace(bestMove);
        } else {
          const otherPlayer = aiPlayer === "white" ? "black" : "white";
          if (!hasValidMove(grid, otherPlayer)) {
            setWinner("draw");
          } else {
            setWinner(otherPlayer);
          }
        }
        setIsAiThinking(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [
    gameMode,
    currentPlayer,
    aiPlayer,
    winner,
    isInLobby,
    grid,
    aiDifficulty,
  ]);

  useEffect(() => {
    if (gameMode === "online" && !isInLobby && !hasShownStatsRef.current) {
      const opponent = myPlayer === "white" ? "black" : "white";
      if (opponent === "white" && whiteStats) {
        setViewStatsPlayer("white");
        hasShownStatsRef.current = true;
      } else if (opponent === "black" && blackStats) {
        setViewStatsPlayer("black");
        hasShownStatsRef.current = true;
      }
    }
  }, [isInLobby, gameMode, myPlayer, whiteStats, blackStats]);

  // Fetch leaderboard when in lobby or leaderboard modal opened
  const fetchLeaderboard = useCallback(() => {
    setIsLeaderboardLoading(true);
    fetch(`${SERVER_URL}/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
        setIsLeaderboardLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch leaderboard:", error);
        setIsLeaderboardLoading(false);
      });
  }, []);

  useEffect(() => {
    if (isInLobby || showLeaderboard) {
      fetchLeaderboard();
    }
  }, [isInLobby, showLeaderboard, fetchLeaderboard]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = () => {
    if (socketRef.current?.connected) return socketRef.current;

    setConnectionStatus("connecting");
    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("Connected to server", socket.id);
    });

    socket.on("connect_error", (err) => {
      setErrorMessage(
        "Could not connect to game server. Is 'node server.js' running?"
      );
      setConnectionStatus("error");
    });

    socket.on("room_created", ({ roomId }) => {
      setRoomId(roomId);
      setConnectionStatus("waiting");
      setNetworkRole("host");
      setMyPlayer("white");
      setChatMessages([]);
      setWhiteStats(null);
      setBlackStats(null);
      hasShownStatsRef.current = false;
    });

    socket.on(
      "game_start",
      ({
        whiteId,
        blackId,
        whiteName: sWhiteName,
        blackName: sBlackName,
        whiteStats: wStats,
        blackStats: bStats,
        timeSettings,
      }) => {
        setConnectionStatus("connected");
        setIsInLobby(false);

        setWhiteName(sWhiteName || "White");
        setBlackName(sBlackName || "Black");
        setWhiteStats(wStats);
        setBlackStats(bStats);

        // Apply time settings from server
        if (timeSettings) {
          setIsTimed(timeSettings.isTimed);
          setInitialTimeSetting(timeSettings.initialTime);
          setIncrementSetting(timeSettings.increment);
        }

        hasShownStatsRef.current = false;

        if (socket.id === blackId) {
          setNetworkRole("client");
          setMyPlayer("black");
        } else {
          setNetworkRole("host");
          setMyPlayer("white");
        }

        setRematchRequested(false);
        setOpponentRematchRequested(false);

        internalResetWithSettings(timeSettings);
      }
    );

    socket.on("game_action", (data: any) => {
      handleNetworkAction(data);
    });

    socket.on("receive_message", (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on("rematch_requested", () => {
      setOpponentRematchRequested(true);
    });

    socket.on("opponent_left", () => {
      alert("Opponent disconnected.");
      setConnectionStatus("idle");
      setIsInLobby(true);
      internalReset();
      setWhiteScore(0);
      setBlackScore(0);
      setPreviousLoser(null); // Reset for new game series
      setChatMessages([]);
      hasShownStatsRef.current = false;
    });

    socket.on("error", ({ message }) => {
      alert(message);
      setConnectionStatus("idle");
      setIsInLobby(true);
    });

    socketRef.current = socket;
    return socket;
  };

  const startHost = () => {
    if (!myName.trim()) {
      alert("Please enter your name first");
      return;
    }
    const socket = connectSocket();
    if (socket) {
      socket.emit("create_room", {
        playerName: myName,
        timeSettings: {
          isTimed,
          initialTime: initialTimeSetting,
          increment: incrementSetting,
        },
      });
      setWhiteScore(0);
      setBlackScore(0);
    }
  };

  const joinGame = (inputRoomId: string) => {
    if (!myName.trim()) {
      alert("Please enter your name first");
      return;
    }
    const socket = connectSocket();
    if (socket) {
      setRoomId(inputRoomId);
      socket.emit("join_room", { roomId: inputRoomId, playerName: myName });
      setWhiteScore(0);
      setBlackScore(0);
      setChatMessages([]);
    }
  };

  const cancelHosting = () => {
    if (socketRef.current) {
      if (roomId) socketRef.current.emit("leave_room", roomId);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus("idle");
    setNetworkRole(null);
    setRoomId("");
    setPreviousLoser(null); // Reset for new game series
    setChatMessages([]);
  };

  const sendNetworkAction = (action: any) => {
    if (socketRef.current && connectionStatus === "connected") {
      socketRef.current.emit("game_action", { roomId, ...action });
    }
  };

  const requestRematch = () => {
    if (socketRef.current && roomId) {
      setRematchRequested(true);
      socketRef.current.emit("request_rematch", { roomId });
    }
  };

  const handleSendMessage = (text: string) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit("send_message", {
        roomId,
        message: text,
        playerName: myName,
      });
    }
  };

  const handleNetworkAction = (data: any) => {
    if (data.type === "MOVE") {
      const { block, nextPlayer, wTime, bTime, isDraw, gameEnded } = data;
      setBlocks((prev) => {
        const newBlocks = [...prev, block];
        const newGrid = rebuildGridFromBlocks(newBlocks);

        // Count blocks for each player
        const whiteBlockCount = newBlocks.filter(
          (b) => b.player === "white"
        ).length;
        const blackBlockCount = newBlocks.filter(
          (b) => b.player === "black"
        ).length;

        const win = checkWin(newGrid, block.player);
        if (win) {
          setWinner(block.player);
          setWinningCells(win);
        } else if (isDraw) {
          setWinner("draw");
        } else if (gameEnded) {
          // Game ended due to no valid moves - determine winner
          const nextCanMove = hasValidMove(newGrid, nextPlayer);
          const nextPlayerBlockCount =
            nextPlayer === "white" ? whiteBlockCount : blackBlockCount;

          if (!nextCanMove && nextPlayerBlockCount < MAX_BLOCKS_PER_PLAYER) {
            // Next player can't move and hasn't exhausted blocks - they lose
            setWinner(block.player);
          }
        }

        setGrid(newGrid);
        return newBlocks;
      });
      setCurrentPlayer(nextPlayer);
      setWhiteTime(wTime);
      setBlackTime(bTime);
    } else if (data.type === "RESET") {
      internalReset();
    }
  };

  const getGhost = useCallback(() => {
    if (hoverX === null || winner || isAiThinking) return null;

    if (gameMode === "online" && currentPlayer !== myPlayer) return null;
    if (gameMode === "ai" && currentPlayer === aiPlayer) return null;

    const validX = hoverX;

    const targetY = findDropPosition(grid, validX, orientation);
    const isValid = validateMove(
      grid,
      validX,
      targetY,
      orientation,
      currentPlayer
    );

    return {
      x: validX,
      y: targetY,
      orientation,
      isValid: targetY !== -1 && isValid,
    };
  }, [
    hoverX,
    orientation,
    grid,
    currentPlayer,
    winner,
    gameMode,
    myPlayer,
    aiPlayer,
    isAiThinking,
  ]);

  const ghost = getGhost();

  const handleRotate = useCallback(() => {
    if (winner || isAiThinking) return;
    if (gameMode === "online" && currentPlayer !== myPlayer) return;
    if (gameMode === "ai" && currentPlayer === aiPlayer) return null;
    setOrientation((prev) => (prev === "vertical" ? "horizontal" : "vertical"));
  }, [winner, gameMode, currentPlayer, myPlayer, aiPlayer, isAiThinking]);

  const handlePlace = useCallback(() => {
    if (!ghost || !ghost.isValid || winner || isAiThinking) return;
    if (gameMode === "online" && currentPlayer !== myPlayer) return;

    const newBlock: BlockData = {
      id: generateId(),
      x: ghost.x,
      y: ghost.y,
      orientation: ghost.orientation,
      player: currentPlayer,
    };

    applyNewBlock(newBlock);
  }, [
    ghost,
    grid,
    blocks,
    currentPlayer,
    winner,
    gameMode,
    myPlayer,
    whiteTime,
    blackTime,
    isTimed,
    incrementSetting,
    isAiThinking,
  ]);

  const handleAIPlace = (bestMove: BlockData) => {
    applyNewBlock(bestMove);
  };

  const applyNewBlock = (newBlock: BlockData) => {
    const newGrid = applyBlockToGrid(grid, newBlock);
    const newBlocks = [...blocks, newBlock];

    setGrid(newGrid);
    setBlocks(newBlocks);

    let newWhiteTime = whiteTime;
    let newBlackTime = blackTime;
    if (isTimed) {
      if (currentPlayer === "white") newWhiteTime += incrementSetting;
      else newBlackTime += incrementSetting;

      if (currentPlayer === "white") setWhiteTime(newWhiteTime);
      else setBlackTime(newBlackTime);
    }

    const winResult = checkWin(newGrid, currentPlayer);
    let nextPlayer: Player = currentPlayer === "white" ? "black" : "white";
    let isDraw = false;
    let gameEnded = false;

    if (winResult) {
      setWinner(currentPlayer);
      setWinningCells(winResult);
      gameEnded = true;
    } else {
      // Count blocks for each player
      const whiteBlockCount = newBlocks.filter(
        (b) => b.player === "white"
      ).length;
      const blackBlockCount = newBlocks.filter(
        (b) => b.player === "black"
      ).length;

      // Check if next player can move
      const nextCanMove = hasValidMove(newGrid, nextPlayer);
      const nextPlayerBlockCount =
        nextPlayer === "white" ? whiteBlockCount : blackBlockCount;

      if (!nextCanMove) {
        // If next player has reached max blocks, check if current player can move
        if (nextPlayerBlockCount >= MAX_BLOCKS_PER_PLAYER) {
          const currentCanMove = hasValidMove(newGrid, currentPlayer);
          const currentPlayerBlockCount =
            currentPlayer === "white" ? whiteBlockCount : blackBlockCount;

          if (
            !currentCanMove ||
            currentPlayerBlockCount >= MAX_BLOCKS_PER_PLAYER
          ) {
            // Both players exhausted - draw
            setWinner("draw");
            isDraw = true;
            gameEnded = true;
          }
          // else: only next player exhausted, game continues (shouldn't happen but handle gracefully)
        } else {
          // Next player has no valid moves but hasn't used all blocks - they lose
          setWinner(currentPlayer);
          gameEnded = true;
        }
      } else {
        // Next player can move - check if current player has exhausted their blocks
        const currentPlayerBlockCount =
          currentPlayer === "white" ? whiteBlockCount : blackBlockCount;
        if (currentPlayerBlockCount >= MAX_BLOCKS_PER_PLAYER) {
          const currentCanMove = hasValidMove(newGrid, currentPlayer);
          if (!currentCanMove) {
            // Current player exhausted, next player wins
            setWinner(nextPlayer);
            gameEnded = true;
          }
        }
      }

      if (!gameEnded) {
        setCurrentPlayer(nextPlayer);
      }
    }

    if (gameMode === "online") {
      sendNetworkAction({
        type: "MOVE",
        block: newBlock,
        nextPlayer,
        wTime: newWhiteTime,
        bTime: newBlackTime,
        isDraw,
        gameEnded,
      });
    }
  };

  const internalReset = () => {
    setGrid(createEmptyGrid());
    setBlocks([]);
    // Previous loser goes first, or default to white
    setCurrentPlayer(previousLoser || "white");
    setWinner(null);
    setWinningCells(null);
    setOrientation("vertical");
    setHoverX(null);
    const startVal = isTimed ? initialTimeSetting : 999999;
    setWhiteTime(startVal);
    setBlackTime(startVal);
    setGameStartTime(Date.now());
    setIsAiThinking(false);
  };

  const internalResetWithSettings = (settings?: any) => {
    const timeToSet = settings?.isTimed ? settings.initialTime : 999999;
    setGrid(createEmptyGrid());
    setBlocks([]);
    // Previous loser goes first, or default to white
    setCurrentPlayer(previousLoser || "white");
    setWinner(null);
    setWinningCells(null);
    setOrientation("vertical");
    setHoverX(null);
    setWhiteTime(timeToSet);
    setBlackTime(timeToSet);
    setGameStartTime(Date.now());
    setIsAiThinking(false);
  };

  const handleReset = () => {
    internalReset();
    if (gameMode === "online") {
      sendNetworkAction({ type: "RESET" });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (isInLobby || showLocalSetup || showAISetup) return;
      if (e.code === "Space" || e.key === "r" || e.key === "R") {
        handleRotate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRotate, isInLobby, showLocalSetup, showAISetup]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleRotate();
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [handleRotate]);

  const startLocalGame = () => {
    setGameMode("local");
    setWhiteName(localWhiteName || "Player 1");
    setBlackName(localBlackName || "Player 2");
    setWhiteStats(null);
    setBlackStats(null);
    setShowLocalSetup(false);
    setIsInLobby(false);
    setWhiteScore(0);
    setBlackScore(0);
    setPreviousLoser(null); // Reset for new game series
    internalReset();
  };

  const startAIGame = () => {
    setGameMode("ai");
    setMyPlayer(aiPlayer === "white" ? "black" : "white");
    setWhiteName(aiPlayer === "white" ? "AI" : myName);
    setBlackName(aiPlayer === "black" ? "AI" : myName);
    setWhiteStats(null);
    setBlackStats(null);
    setShowAISetup(false);
    setIsInLobby(false);
    setWhiteScore(0);
    setBlackScore(0);
    setPreviousLoser(null); // Reset for new game series
    internalReset();
  };

  const canExplode = useMemo(() => {
    if (!winner) return false;
    if (winner === "draw") return true;
    if (gameMode === "local" || gameMode === "ai") return true;
    return myPlayer !== winner;
  }, [winner, gameMode, myPlayer]);

  if (showLocalSetup) {
    return (
      <div className="w-full h-[100dvh] bg-gray-900 flex items-center justify-center p-4">
        <Tutorial
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
        />
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            Local Game Setup
          </h2>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">
                  White (1st)
                </label>
                <input
                  type="text"
                  value={localWhiteName}
                  onChange={(e) => setLocalWhiteName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="Player 1"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">
                  Black (2nd)
                </label>
                <input
                  type="text"
                  value={localBlackName}
                  onChange={(e) => setLocalBlackName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="Player 2"
                />
              </div>
            </div>

            <TimeControlSelector
              isTimed={isTimed}
              setIsTimed={setIsTimed}
              initialTime={initialTimeSetting}
              setInitialTime={setInitialTimeSetting}
              increment={incrementSetting}
              setIncrement={setIncrementSetting}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowLocalSetup(false)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
            >
              Back
            </button>
            <button
              onClick={startLocalGame}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition shadow-lg"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showAISetup) {
    return (
      <div className="w-full h-[100dvh] bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 animate-in fade-in zoom-in duration-300">
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            Solo Challenge
          </h2>

          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">
                  Difficulty
                </label>
                <div className="flex flex-col gap-1">
                  {(["easy", "medium", "hard"] as AIDifficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setAIDifficulty(d)}
                      className={`py-2 text-[10px] font-bold rounded-lg border transition uppercase tracking-tighter ${
                        aiDifficulty === d
                          ? "bg-indigo-600 border-indigo-400 text-white shadow-lg"
                          : "bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-700"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">
                  Play As
                </label>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setAIPlayer("black")}
                    className={`py-2 text-[10px] rounded-lg border flex items-center justify-center gap-2 transition font-bold uppercase ${
                      aiPlayer === "black"
                        ? "bg-amber-600 border-amber-400 text-white shadow-lg"
                        : "bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-700"
                    }`}
                  >
                    White
                  </button>
                  <button
                    onClick={() => setAIPlayer("white")}
                    className={`py-2 text-[10px] rounded-lg border flex items-center justify-center gap-2 transition font-bold uppercase ${
                      aiPlayer === "white"
                        ? "bg-neutral-600 border-neutral-400 text-white shadow-lg"
                        : "bg-gray-900 border-gray-700 text-gray-500 hover:bg-gray-700"
                    }`}
                  >
                    Black
                  </button>
                </div>
              </div>
            </div>

            <TimeControlSelector
              isTimed={isTimed}
              setIsTimed={setIsTimed}
              initialTime={initialTimeSetting}
              setInitialTime={setInitialTimeSetting}
              increment={incrementSetting}
              setIncrement={setIncrementSetting}
            />

            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                placeholder="Enter your name"
                maxLength={12}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAISetup(false)}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
            >
              Back
            </button>
            <button
              onClick={startAIGame}
              className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg"
            >
              Launch Match
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isInLobby) {
    return (
      <div className="w-full h-[100dvh] bg-gray-900 flex items-center justify-center p-4">
        <Tutorial
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
        />

        <LeaderboardModal
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
          entries={leaderboard}
          isLoading={isLeaderboardLoading}
        />

        {/* Main Menu */}
        <div className="max-w-md w-full bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-700 relative overflow-hidden">
          {/* Subtle Background Accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 rounded-full"></div>

          <h1 className="text-4xl font-black text-white text-center mb-1 tracking-tight">
            BLOCKS 3D
          </h1>
          <p className="text-gray-500 text-center mb-8 uppercase text-[10px] tracking-[0.3em] font-black">
            Structural Strategy
          </p>

          <div className="flex justify-center gap-6 mb-8">
            <button
              onClick={() => setShowTutorial(true)}
              className="text-gray-400 text-xs hover:text-blue-400 font-black flex items-center gap-1.5 transition-all uppercase tracking-widest"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Guide
            </button>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="text-gray-400 text-xs hover:text-yellow-400 font-black flex items-center gap-1.5 transition-all uppercase tracking-widest"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Hall of Fame
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowAISetup(true)}
                className="py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition shadow-lg flex flex-col items-center justify-center gap-2 group"
              >
                <div className="p-2 bg-indigo-700/50 rounded-lg group-hover:scale-110 transition-transform">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-[10px] uppercase tracking-widest">
                  Solo AI
                </span>
              </button>

              <button
                onClick={() => setShowLocalSetup(true)}
                className="py-5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl transition shadow-lg flex flex-col items-center justify-center gap-2 group"
              >
                <div className="p-2 bg-amber-700/50 rounded-lg group-hover:scale-110 transition-transform">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <span className="text-[10px] uppercase tracking-widest">
                  Local VS
                </span>
              </button>
            </div>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-gray-700/50"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black">
                Online Arena
              </span>
              <div className="flex-grow border-t border-gray-700/50"></div>
            </div>

            <div className="mb-2">
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 text-center font-bold"
                placeholder="YOUR NAME"
                maxLength={12}
              />
            </div>

            {connectionStatus === "error" && (
              <div className="bg-red-500/20 text-red-300 text-[10px] p-3 rounded-xl border border-red-500/30 mb-2 uppercase font-bold text-center">
                {errorMessage || "Connection Error"}
              </div>
            )}

            {connectionStatus === "idle" || connectionStatus === "error" ? (
              <div className="space-y-4">
                <TimeControlSelector
                  isTimed={isTimed}
                  setIsTimed={setIsTimed}
                  initialTime={initialTimeSetting}
                  setInitialTime={setInitialTimeSetting}
                  increment={incrementSetting}
                  setIncrement={setIncrementSetting}
                />

                <button
                  onClick={() => {
                    setGameMode("online");
                    startHost();
                  }}
                  className="w-full py-4 bg-blue-700 hover:bg-blue-600 text-white font-black rounded-2xl transition shadow-xl flex items-center justify-center gap-3 border border-blue-400/20 group"
                >
                  <span className="bg-blue-400/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </span>
                  HOST NEW MATCH
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ROOM CODE"
                    id="roomInput"
                    maxLength={4}
                    className="flex-1 bg-gray-900/50 border border-gray-700 text-white px-4 rounded-2xl uppercase tracking-[0.3em] text-center font-bold focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      const val = (
                        document.getElementById("roomInput") as HTMLInputElement
                      ).value.toUpperCase();
                      if (val.length >= 4) {
                        setGameMode("online");
                        joinGame(val);
                      }
                    }}
                    className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-2xl transition border border-gray-600/50"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-900/80 rounded-2xl border border-blue-500/30 animate-in fade-in zoom-in duration-500 shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                {networkRole === "host" ? (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
                        Ready to Build
                      </p>
                      <p className="text-gray-400 text-xs">
                        Awaiting structural opponent...
                      </p>
                    </div>
                    <div className="text-5xl text-white font-mono font-black tracking-[0.3em] bg-gray-950/80 py-4 rounded-2xl mx-6 border border-gray-800 shadow-inner">
                      {roomId}
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(roomId);
                          alert("Room code copied!");
                        }}
                        className="text-blue-500 text-[10px] uppercase font-black hover:text-blue-400 transition tracking-widest bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20"
                      >
                        Copy Code
                      </button>
                      <button
                        onClick={cancelHosting}
                        className="text-red-500 text-[10px] uppercase font-black hover:text-red-400 transition tracking-widest"
                      >
                        Cancel Match
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-white font-black uppercase tracking-widest text-sm">
                      Synchronizing...
                    </div>
                    <button
                      onClick={cancelHosting}
                      className="text-red-500 text-[10px] uppercase font-black hover:text-red-400 transition tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] bg-gray-900 font-sans select-none overflow-hidden touch-none">
      <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

      {viewStatsPlayer && (
        <PlayerCardModal
          player={viewStatsPlayer}
          name={viewStatsPlayer === "white" ? whiteName : blackName}
          stats={viewStatsPlayer === "white" ? whiteStats! : blackStats!}
          onClose={() => setViewStatsPlayer(null)}
        />
      )}

      <Canvas
        shadows
        camera={{ position: INITIAL_CAMERA_POSITION, fov: 45 }}
        dpr={[1, 2]}
        className="touch-none"
      >
        <GameScene
          blocks={blocks}
          ghost={ghost}
          currentPlayer={currentPlayer}
          onHover={setHoverX}
          onClick={handlePlace}
          winningCells={winningCells}
          canExplode={canExplode}
        />
      </Canvas>

      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="bg-black/80 backdrop-blur-md px-6 py-3 rounded-xl text-white shadow-xl border border-white/10 flex items-center gap-6 md:gap-8 min-w-[300px] justify-between">
          {/* White Player Info */}
          <div
            className={`flex items-center gap-3 transition-opacity duration-300 relative group ${
              currentPlayer === "white" && !winner
                ? "opacity-100 scale-105"
                : "opacity-40"
            }`}
          >
            <div className="relative cursor-help">
              <div
                className={`w-4 h-4 rounded-full bg-amber-600 shadow-sm ${
                  currentPlayer === "white" && !winner
                    ? "ring-2 ring-white/50"
                    : ""
                }`}
              />
              {currentPlayer === "white" && !winner && (
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-75"></div>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                  {whiteName}
                </span>
                {gameMode === "online" && whiteStats && (
                  <button
                    onClick={() => setViewStatsPlayer("white")}
                    className="pointer-events-auto text-gray-500 hover:text-white transition p-1 hover:bg-white/10 rounded"
                    title="View Stats"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}
                <span className="text-xs bg-gray-700 px-1.5 rounded text-white">
                  {whiteScore}
                </span>
              </div>
              <span
                className={`font-mono text-xl font-bold ${
                  whiteTime < 30 ? "text-red-400" : "text-white"
                }`}
              >
                {isTimed ? formatTime(whiteTime) : "∞"}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {blocks.filter((b) => b.player === "white").length}/
                {MAX_BLOCKS_PER_PLAYER} blocks
              </span>
              {(gameMode === "online" || gameMode === "ai") && (
                <span className="text-[10px] text-gray-500 uppercase">
                  {gameMode === "ai"
                    ? aiPlayer === "white"
                      ? "CPU"
                      : "YOU"
                    : myPlayer === "white"
                    ? "YOU"
                    : "OPP"}
                </span>
              )}
            </div>
          </div>

          <div className="text-white/20 font-bold text-sm flex flex-col items-center">
            <span>VS</span>
            {gameMode === "online" && (
              <span className="text-[10px] text-green-500 tracking-wider">
                LIVE
              </span>
            )}
            {gameMode === "ai" && (
              <span className="text-[10px] text-indigo-400 tracking-wider uppercase">
                {aiDifficulty}
              </span>
            )}
          </div>

          {/* Black Player Info */}
          <div
            className={`flex items-center gap-3 transition-opacity duration-300 relative group ${
              currentPlayer === "black" && !winner
                ? "opacity-100 scale-105"
                : "opacity-40"
            }`}
          >
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-700 px-1.5 rounded text-white">
                  {blackScore}
                </span>
                {gameMode === "online" && blackStats && (
                  <button
                    onClick={() => setViewStatsPlayer("black")}
                    className="pointer-events-auto text-gray-500 hover:text-white transition p-1 hover:bg-white/10 rounded"
                    title="View Stats"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                  {blackName}
                </span>
              </div>
              <span
                className={`font-mono text-xl font-bold ${
                  blackTime < 30 ? "text-red-400" : "text-white"
                }`}
              >
                {isTimed ? formatTime(blackTime) : "∞"}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {blocks.filter((b) => b.player === "black").length}/
                {MAX_BLOCKS_PER_PLAYER} blocks
              </span>
              {(gameMode === "online" || gameMode === "ai") && (
                <span className="text-[10px] text-gray-500 uppercase">
                  {gameMode === "ai"
                    ? aiPlayer === "black"
                      ? "CPU"
                      : "YOU"
                    : myPlayer === "black"
                    ? "YOU"
                    : "OPP"}
                </span>
              )}
            </div>
            <div className="relative cursor-help">
              <div
                className={`w-4 h-4 rounded-full bg-neutral-800 border border-gray-500 shadow-sm ${
                  currentPlayer === "black" && !winner
                    ? "ring-2 ring-white/50"
                    : ""
                }`}
              />
              {currentPlayer === "black" && !winner && (
                <div className="absolute inset-0 bg-gray-600 rounded-full animate-ping opacity-75"></div>
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-gray-700 text-blue-400 rounded-lg transition border border-gray-700 backdrop-blur-md"
            title="How to Play"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <button
            onClick={() => {
              cancelHosting();
              setIsInLobby(true);
              setWhiteScore(0);
              setBlackScore(0);
              internalReset();
            }}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition text-sm font-medium border border-red-500/20 backdrop-blur-md"
          >
            Quit
          </button>
          {(gameMode === "local" || gameMode === "ai") && (
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg transition text-sm font-medium border border-white/10 backdrop-blur-md"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {winner && (
        <div className="absolute top-28 left-1/2 transform -translate-x-1/2 pointer-events-none z-20 animate-in fade-in zoom-in duration-500">
          <div className="bg-gradient-to-br from-green-500/90 to-emerald-600/90 backdrop-blur-md px-10 py-6 rounded-2xl shadow-2xl border-2 border-green-300/50 flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-md whitespace-nowrap text-center">
              {winner === "draw"
                ? "GAME DRAWN"
                : `${
                    winner === "white"
                      ? whiteName.toUpperCase()
                      : blackName.toUpperCase()
                  } WINS!`}
            </h2>
            <div className="text-green-50 text-sm font-bold tracking-widest uppercase mt-2">
              {winner === "draw"
                ? "NO MOVES POSSIBLE"
                : isTimed && (whiteTime === 0 || blackTime === 0)
                ? "ON TIME"
                : "BY CONNECT FIVE"}
            </div>
            {(gameMode === "online" || gameMode === "ai") &&
              winner !== "draw" &&
              winner ===
                (gameMode === "ai"
                  ? aiPlayer === "white"
                    ? "black"
                    : "white"
                  : myPlayer) && (
                <div className="mt-2 text-xs bg-white/20 px-2 py-1 rounded text-white font-bold">
                  VICTORY
                </div>
              )}
            {canExplode && (
              <div className="mt-4 text-xs text-white/50 animate-pulse uppercase tracking-widest font-mono">
                Click board to explode
              </div>
            )}
          </div>
        </div>
      )}

      {gameMode === "online" && !isInLobby && !winner && (
        <div className="absolute bottom-32 right-4 pointer-events-auto z-50">
          {!isChatOpen && (
            <button
              onClick={() => {
                setIsChatOpen(true);
                setUnreadCount(0);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110 relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-900 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {gameMode === "online" && (
        <Chat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          myName={myName}
        />
      )}

      <div className="absolute bottom-0 left-0 w-full p-4 pointer-events-none z-10 flex flex-col items-center gap-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:pb-4">
        {!winner && (
          <div className="hidden md:block text-white/50 text-xs bg-black/40 px-3 py-1 rounded backdrop-blur-sm">
            {gameMode === "online" && currentPlayer !== myPlayer ? (
              <span className="text-yellow-400 animate-pulse">
                {currentPlayer === "white" ? whiteName : blackName} is
                thinking...
              </span>
            ) : gameMode === "ai" && currentPlayer === aiPlayer ? (
              <span className="text-indigo-400 animate-pulse">
                AI is calculating...
              </span>
            ) : (
              <span>Rotate: Right Click / Space • Place: Left Click</span>
            )}
          </div>
        )}

        <div className="pointer-events-auto w-full max-w-lg flex items-center justify-between gap-4">
          {!winner ? (
            <>
              <button
                onClick={handleRotate}
                disabled={
                  (gameMode === "online" && currentPlayer !== myPlayer) ||
                  (gameMode === "ai" && currentPlayer === aiPlayer)
                }
                className={`flex-1 h-14 font-bold rounded-2xl shadow-lg backdrop-blur-sm border border-white/10 transition-transform active:scale-95 flex items-center justify-center gap-2
                  ${
                    (gameMode === "online" && currentPlayer !== myPlayer) ||
                    (gameMode === "ai" && currentPlayer === aiPlayer)
                      ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600/90 hover:bg-blue-500 active:bg-blue-400 text-white"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                ROTATE
              </button>

              <button
                onClick={handlePlace}
                disabled={
                  !ghost?.isValid ||
                  (gameMode === "online" && currentPlayer !== myPlayer) ||
                  (gameMode === "ai" && currentPlayer === aiPlayer)
                }
                className={`flex-[2] h-14 font-bold rounded-2xl shadow-lg backdrop-blur-sm border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-2
                  ${
                    ghost?.isValid &&
                    (gameMode !== "online" || currentPlayer === myPlayer) &&
                    (gameMode !== "ai" || currentPlayer !== aiPlayer)
                      ? "bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-400 text-white cursor-pointer"
                      : "bg-gray-700/50 text-gray-400 cursor-not-allowed opacity-50"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
                PLACE BLOCK
              </button>
            </>
          ) : (
            <div className="w-full flex gap-3">
              {gameMode === "local" || gameMode === "ai" ? (
                <button
                  onClick={handleReset}
                  className="w-full h-16 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xl font-bold rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  PLAY AGAIN
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      cancelHosting();
                      setIsInLobby(true);
                      setWhiteScore(0);
                      setBlackScore(0);
                    }}
                    className="flex-1 h-16 bg-gray-700/80 hover:bg-gray-600/80 backdrop-blur-md text-white text-lg font-bold rounded-2xl shadow-xl transition-all border border-white/10"
                  >
                    EXIT
                  </button>
                  <button
                    onClick={requestRematch}
                    disabled={rematchRequested}
                    className={`flex-[2] h-16 text-white text-xl font-bold rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 ${
                      rematchRequested
                        ? "bg-amber-800/80 cursor-default"
                        : "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
                    }`}
                  >
                    {rematchRequested ? (
                      <span>WAITING...</span>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        REMATCH
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
          {winner &&
            opponentRematchRequested &&
            !rematchRequested &&
            gameMode === "online" && (
              <div className="absolute -top-12 left-0 w-full text-center">
                <span className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg font-bold animate-bounce text-sm">
                  Opponent wants a rematch!
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;
