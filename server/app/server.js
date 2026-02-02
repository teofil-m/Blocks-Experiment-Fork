import "dotenv/config";
import { Server } from "socket.io";
import {
  saveMatch,
  getAllMatches,
  getMatchesByPlayer,
  getPlayerStats,
  getLeaderboard,
} from "./db.js";

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const io = new Server(PORT, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  host: "0.0.0.0",
});

// HTTP server for REST endpoints
const httpServer = io.httpServer || io.engine.server;

// Add HTTP endpoint for leaderboard - must be registered before Socket.IO handles requests
if (httpServer) {
  const originalEmit = httpServer.emit;
  httpServer.emit = function (event, req, res) {
    if (event === "request") {
      // Only handle our specific endpoint
      if (req.url === "/leaderboard") {
        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === "GET") {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Content-Type", "application/json");

          getLeaderboard(10)
            .then((leaderboard) => {
              res.writeHead(200);
              res.end(JSON.stringify({ leaderboard }));
            })
            .catch((error) => {
              res.writeHead(500);
              res.end(JSON.stringify({ error: error.message }));
            });
          return;
        }
      }
    }
    // Let Socket.IO handle all other requests
    return originalEmit.apply(this, arguments);
  };
}

console.log(`Game Server running on port ${PORT}`);

// State
const rooms = new Map();
// Room Structure:
// {
//   id: string,
//   isPrivate: boolean,
//   roomCode: string (only for private rooms),
//   white: socketId,
//   whiteName: string,
//   black: socketId,
//   blackName: string,
//   spectators: [],
//   whiteRematch: boolean,
//   blackRematch: boolean,
//   whiteScore: number,
//   blackScore: number,
//   lastWinner: string | null (tracks who won the last game: 'white', 'black', or 'draw'),
//   timeSettings: { isTimed: boolean, initialTime: number, increment: number },
//   createdAt: timestamp
// }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create_room", (data) => {
    const playerName = data?.playerName || "White";
    const isPrivate = data?.isPrivate || false;
    const timeSettings = data?.timeSettings || {
      isTimed: true,
      initialTime: 300,
      increment: 5,
    };
    const roomId = Math.random().toString(36).substr(2, 4).toUpperCase();
    const roomCode = isPrivate
      ? Math.random().toString(36).substr(2, 4).toUpperCase()
      : null;

    rooms.set(roomId, {
      id: roomId,
      isPrivate,
      roomCode,
      white: socket.id,
      whiteName: playerName,
      black: null,
      blackName: null,
      spectators: [],
      whiteRematch: false,
      blackRematch: false,
      whiteScore: 0,
      blackScore: 0,
      lastWinner: null,
      timeSettings,
      createdAt: Date.now(),
    });

    socket.join(roomId);
    socket.emit("room_created", { roomId, roomCode });
    console.log(
      `Room ${roomId} created by ${socket.id} (${playerName}) - ${
        isPrivate ? "Private" : "Public"
      } with time settings`,
      timeSettings
    );

    // Broadcast updated room list to all clients
    broadcastRoomList();
  });

  socket.on("get_rooms", () => {
    sendRoomList(socket);
  });

  socket.on("join_room", async (data) => {
    const roomId = typeof data === "string" ? data : data.roomId;
    const playerName = typeof data === "object" ? data.playerName : "Black";
    const roomCode = typeof data === "object" ? data.roomCode : null;

    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    // Check if joining player has the same name as the host
    if (room.whiteName.toLowerCase() === playerName.toLowerCase()) {
      socket.emit("error", {
        message: "You cannot use the same name as the host",
      });
      return;
    }

    // Check if room is private and room code is required
    if (room.isPrivate && room.roomCode !== roomCode) {
      socket.emit("error", { message: "Invalid room code" });
      return;
    }

    if (!room.black) {
      room.black = socket.id;
      room.blackName = playerName;
      socket.join(roomId);

      let whiteStats = null;
      let blackStats = null;
      try {
        whiteStats = await getPlayerStats(room.whiteName);
        blackStats = await getPlayerStats(room.blackName);
      } catch (err) {
        console.error("Error fetching stats on game start:", err);
      }

      io.to(roomId).emit("game_start", {
        whiteId: room.white,
        blackId: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
        whiteStats,
        blackStats,
        timeSettings: room.timeSettings,
        startingPlayer: "white",
      });
      console.log(
        `Game started in room ${roomId}. ${room.whiteName} vs ${room.blackName}`
      );

      // Broadcast updated room list to all clients
      broadcastRoomList();
    } else {
      socket.emit("error", { message: "Room is full" });
    }
  });

  socket.on("spectate_room", (data) => {
    const roomId = typeof data === "string" ? data : data.roomId;
    const spectatorName = typeof data === "object" ? data.spectatorName : "Spectator";
    const roomCode = typeof data === "object" ? data.roomCode : null;

    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    // Check if room is private and room code is required
    if (room.isPrivate && room.roomCode !== roomCode) {
      socket.emit("error", { message: "Invalid room code" });
      return;
    }

    // Check if spectator name conflicts with existing players
    if (room.whiteName && room.whiteName.toLowerCase() === spectatorName.toLowerCase()) {
      socket.emit("error", {
        message: "You cannot use the same name as an existing player",
      });
      return;
    }
    if (room.blackName && room.blackName.toLowerCase() === spectatorName.toLowerCase()) {
      socket.emit("error", {
        message: "You cannot use the same name as an existing player",
      });
      return;
    }

    // Check if spectator name conflicts with existing spectators
    const existingSpectator = room.spectators.find(
      spec => spec.name.toLowerCase() === spectatorName.toLowerCase()
    );
    if (existingSpectator) {
      socket.emit("error", {
        message: "A spectator with this name already exists in the room",
      });
      return;
    }

    // Add spectator to room
    room.spectators.push({
      id: socket.id,
      name: spectatorName,
    });

    socket.join(roomId);

    // Notify spectator they joined successfully
    socket.emit("spectate_joined", {
      roomId,
      spectatorCount: room.spectators.length,
      whiteName: room.whiteName,
      blackName: room.blackName,
      isGameInProgress: !!(room.white && room.black),
      timeSettings: room.timeSettings,
    });

    // Notify all players and spectators about new spectator
    socket.to(roomId).emit("spectator_joined", {
      spectatorName,
      spectatorCount: room.spectators.length,
    });

    console.log(
      `Spectator ${spectatorName} (${socket.id}) joined room ${roomId}. Total spectators: ${room.spectators.length}`
    );
  });

  socket.on("game_action", (payload) => {
    const { roomId, type, ...data } = payload;
    socket.to(roomId).emit("game_action", { type, ...data });
  });

  socket.on("send_message", (data) => {
    const { roomId, message, playerName } = data;
    if (!roomId) return;

    io.to(roomId).emit("receive_message", {
      sender: playerName,
      text: message,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9),
    });
  });

  socket.on("request_rematch", async ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (socket.id === room.white) room.whiteRematch = true;
    if (socket.id === room.black) room.blackRematch = true;

    socket.to(roomId).emit("rematch_requested");

    if (room.whiteRematch && room.blackRematch) {
      // Reset rematch flags
      room.whiteRematch = false;
      room.blackRematch = false;

      // Determine starting player: loser of previous match goes first
      // If previous game was a draw or no previous game, white (host) starts
      let startingPlayer = "white";
      if (room.lastWinner === "white") {
        startingPlayer = "black"; // White won last, so black (loser) starts
      } else if (room.lastWinner === "black") {
        startingPlayer = "white"; // Black won last, so white (loser) starts
      }
      // If lastWinner is null or "draw", white starts (default)

      let whiteStats = null;
      let blackStats = null;
      try {
        whiteStats = await getPlayerStats(room.whiteName);
        blackStats = await getPlayerStats(room.blackName);
      } catch (err) {
        console.error("Error fetching stats on rematch:", err);
      }

      io.to(roomId).emit("game_start", {
        whiteId: room.white,
        blackId: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
        whiteStats,
        blackStats,
        timeSettings: room.timeSettings,
        startingPlayer,
      });
    }
  });

  socket.on("save_match", (matchData) => {
    saveMatch(matchData)
      .then((savedMatch) => {
        socket.emit("match_saved", { success: true, matchId: savedMatch.id });
      })
      .catch((error) => {
        socket.emit("match_saved", { success: false, error: error.message });
      });
  });

  socket.on("update_score", ({ roomId, winner }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Track the last winner for rematch starting player logic
    room.lastWinner = winner;

    // Update scores
    if (winner === "white") {
      room.whiteScore++;
    } else if (winner === "black") {
      room.blackScore++;
    }
    // No score update for draw, but lastWinner is still set to "draw"
  });

  socket.on("get_matches", (data) => {
    const { playerName, limit } = data || {};
    const matchesPromise = playerName
      ? getMatchesByPlayer(playerName, limit)
      : getAllMatches(limit);

    matchesPromise
      .then((matches) => {
        socket.emit("matches_data", { matches });
      })
      .catch((error) => {
        socket.emit("matches_data", { matches: [], error: error.message });
      });
  });

  socket.on("get_player_stats", (data) => {
    const { playerName } = data;
    getPlayerStats(playerName)
      .then((stats) => {
        socket.emit("player_stats", { stats });
      })
      .catch((error) => {
        socket.emit("player_stats", { stats: null, error: error.message });
      });
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    handleDisconnect(socket, roomId);
  });

  socket.on("leave_spectate", (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      const spectatorIndex = room.spectators.findIndex(spec => spec.id === socket.id);
      if (spectatorIndex !== -1) {
        socket.leave(roomId);
        handleSpectatorDisconnect(socket, roomId, spectatorIndex);
      }
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.white === socket.id || room.black === socket.id) {
        handleDisconnect(socket, roomId);
      } else {
        // Check if disconnecting socket is a spectator
        const spectatorIndex = room.spectators.findIndex(spec => spec.id === socket.id);
        if (spectatorIndex !== -1) {
          handleSpectatorDisconnect(socket, roomId, spectatorIndex);
        }
      }
    });
  });
});

function handleDisconnect(socket, roomId) {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit("opponent_left");
    rooms.delete(roomId);
    console.log(`Room ${roomId} closed due to disconnect`);

    // Broadcast updated room list to all clients
    broadcastRoomList();
  }
}

function handleSpectatorDisconnect(socket, roomId, spectatorIndex) {
  const room = rooms.get(roomId);
  if (room && spectatorIndex !== -1) {
    const spectator = room.spectators[spectatorIndex];
    room.spectators.splice(spectatorIndex, 1);

    // Notify remaining players and spectators
    socket.to(roomId).emit("spectator_left", {
      spectatorName: spectator.name,
      spectatorCount: room.spectators.length,
    });

    console.log(
      `Spectator ${spectator.name} (${socket.id}) left room ${roomId}. Remaining spectators: ${room.spectators.length}`
    );
  }
}

function sendRoomList(socket) {
  const roomList = Array.from(rooms.values())
    .filter((room) => !room.isPrivate) // Show all public rooms (including full ones for spectating)
    .map((room) => ({
      roomId: room.id,
      hostName: room.whiteName,
      isPrivate: room.isPrivate,
      playerCount: room.black ? 2 : 1,
      maxPlayers: 2,
      spectatorCount: room.spectators.length,
      timeSettings: room.timeSettings,
      isGameInProgress: !!(room.white && room.black),
    }));

  socket.emit("room_list", { rooms: roomList });
}

function broadcastRoomList() {
  const roomList = Array.from(rooms.values())
    .filter((room) => !room.isPrivate) // Show all public rooms (including full ones for spectating)
    .map((room) => ({
      roomId: room.id,
      hostName: room.whiteName,
      isPrivate: room.isPrivate,
      playerCount: room.black ? 2 : 1,
      maxPlayers: 2,
      spectatorCount: room.spectators.length,
      timeSettings: room.timeSettings,
      isGameInProgress: !!(room.white && room.black),
    }));

  io.emit("room_list", { rooms: roomList });
}
