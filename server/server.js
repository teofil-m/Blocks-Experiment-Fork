import { Server } from "socket.io";

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
//   blackRematch: boolean
// }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("create_room", (data) => {
    // Data might contain playerName
    const playerName = data?.playerName || "White";
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
    });

    socket.join(roomId);
    socket.emit("room_created", { roomId });
    console.log(`Room ${roomId} created by ${socket.id} (${playerName})`);
  });

  socket.on("join_room", (data) => {
    // Support both old string format and new object format
    const roomId = typeof data === "string" ? data : data.roomId;
    const playerName = typeof data === "object" ? data.playerName : "Black";

    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    // If room has no black player, join as black
    if (!room.black) {
      room.black = socket.id;
      room.blackName = playerName;
      socket.join(roomId);

      // Notify everyone game starts
      io.to(roomId).emit("game_start", {
        whiteId: room.white,
        blackId: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
      });
      console.log(
        `Game started in room ${roomId}. ${room.whiteName} vs ${room.blackName}`
      );
    } else {
      // Room full
      socket.emit("error", { message: "Room is full" });
    }
  });

  socket.on("game_action", (payload) => {
    const { roomId, type, ...data } = payload;
    // Relay to everyone else in the room
    console.log(`Relaying action in room ${roomId}:`, type, data);
    socket.to(roomId).emit("game_action", { type, ...data });
  });

  socket.on("request_rematch", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (socket.id === room.white) room.whiteRematch = true;
    if (socket.id === room.black) room.blackRematch = true;

    // Notify others that a rematch was requested
    socket.to(roomId).emit("rematch_requested");

    // If both agreed
    if (room.whiteRematch && room.blackRematch) {
      // Swap roles
      const tempId = room.white;
      room.white = room.black;
      room.black = tempId;

      const tempName = room.whiteName;
      room.whiteName = room.blackName;
      room.blackName = tempName;

      // Reset flags
      room.whiteRematch = false;
      room.blackRematch = false;

      console.log(`Rematch starting in room ${roomId}. Swapping roles.`);

      // Restart game with swapped roles
      io.to(roomId).emit("game_start", {
        whiteId: room.white,
        blackId: room.black,
        whiteName: room.whiteName,
        blackName: room.blackName,
      });
    }
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
    handleDisconnect(socket, roomId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Find rooms this socket was in and clean up
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
