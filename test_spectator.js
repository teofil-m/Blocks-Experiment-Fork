// Test script to verify spectator functionality
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";

async function testSpectatorFunctionality() {
  console.log("Testing spectator functionality...");

  // Create host socket
  const hostSocket = io(SERVER_URL);
  
  // Create player socket
  const playerSocket = io(SERVER_URL);
  
  // Create spectator socket
  const spectatorSocket = io(SERVER_URL);

  return new Promise((resolve, reject) => {
    let roomId = null;
    let testsPassed = 0;
    const totalTests = 4;

    // Host creates a room
    hostSocket.on("connect", () => {
      console.log("Host connected");
      hostSocket.emit("create_room", {
        playerName: "Host",
        isPrivate: false,
        timeSettings: { isTimed: true, initialTime: 300, increment: 5 }
      });
    });

    hostSocket.on("room_created", (data) => {
      roomId = data.roomId;
      console.log(`✓ Room created: ${roomId}`);
      testsPassed++;
      
      // Player joins the room
      playerSocket.emit("join_room", {
        roomId: roomId,
        playerName: "Player"
      });
    });

    playerSocket.on("game_start", (data) => {
      console.log("✓ Game started between Host and Player");
      testsPassed++;
      
      // Now spectator tries to join
      spectatorSocket.emit("spectate_room", {
        roomId: roomId,
        spectatorName: "Spectator1"
      });
    });

    spectatorSocket.on("spectate_joined", (data) => {
      console.log(`✓ Spectator joined room ${data.roomId}. Spectator count: ${data.spectatorCount}`);
      testsPassed++;
      
      // Test spectator leaving
      spectatorSocket.emit("leave_spectate", roomId);
    });

    spectatorSocket.on("spectator_left", (data) => {
      console.log(`✓ Spectator left notification received. Remaining spectators: ${data.spectatorCount}`);
      testsPassed++;
      
      if (testsPassed === totalTests) {
        console.log("All tests passed!");
        hostSocket.disconnect();
        playerSocket.disconnect();
        spectatorSocket.disconnect();
        resolve();
      }
    });

    hostSocket.on("error", (error) => {
      console.error("Host error:", error);
      reject(error);
    });

    playerSocket.on("error", (error) => {
      console.error("Player error:", error);
      reject(error);
    });

    spectatorSocket.on("error", (error) => {
      console.error("Spectator error:", error);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log(`Tests completed: ${testsPassed}/${totalTests}`);
      if (testsPassed < totalTests) {
        reject(new Error("Not all tests passed within timeout"));
      }
    }, 10000);
  });
}

// Run the test
testSpectatorFunctionality()
  .then(() => {
    console.log("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });