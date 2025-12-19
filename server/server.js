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
//   white: socketId,
//   whiteName: string,
//   black: socketId,
//   blackName: string,
//   spectators: [],
//   whiteRematch: boolean,
//   blackRematch: boolean,
//   timeSettings: { isTimed: boolean, initialTime: number, increment: number }
// }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create_room", (data) => {
    const playerName = data?.playerName || "White";
    const timeSettings = data?.timeSettings || {
      isTimed: true,
      initialTime: 300,
      increment: 5,
    };
    const roomId = Math.random().toString(36).substr(2, 4).toUpperCase();

    rooms.set(roomId, {
      id: roomId,
      white: socket.id,
      whiteName: playerName,
      black: null,
      blackName: null,
      spectators: [],
      whiteRematch: false,
      blackRematch: false,
      timeSettings,
    });

    socket.join(roomId);
    socket.emit("room_created", { roomId });
    console.log(
      `Room ${roomId} created by ${socket.id} (${playerName}) with time settings`,
      timeSettings
    );
  });

  socket.on("join_room", async (data) => {
    const roomId = typeof data === "string" ? data : data.roomId;
    const playerName = typeof data === "object" ? data.playerName : "Black";

    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
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
      });
      console.log(
        `Game started in room ${roomId}. ${room.whiteName} vs ${room.blackName}`
      );
    } else {
      socket.emit("error", { message: "Room is full" });
    }
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
      const tempId = room.white;
      room.white = room.black;
      room.black = tempId;

      const tempName = room.whiteName;
      room.whiteName = room.blackName;
      room.blackName = tempName;

      room.whiteRematch = false;
      room.blackRematch = false;

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

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.white === socket.id || room.black === socket.id) {
        handleDisconnect(socket, roomId);
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
  }
}
