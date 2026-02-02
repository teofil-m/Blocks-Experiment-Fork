import React, { useState, useEffect } from "react";
import { RoomInfo } from "../types";

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: RoomInfo[];
  onJoinRoom: (roomId: string, roomCode?: string) => void;
  onSpectateRoom: (roomId: string, roomCode?: string) => void;
  isLoading: boolean;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  onClose,
  rooms,
  onJoinRoom,
  onSpectateRoom,
  isLoading,
}) => {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showCodePrompt, setShowCodePrompt] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [filterPrivate, setFilterPrivate] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedRoom(null);
      setRoomCodeInput("");
      setShowCodePrompt(false);
      setIsSpectating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoinClick = (room: RoomInfo) => {
    if (room.playerCount >= room.maxPlayers) {
      return; // Room is full
    }

    if (room.isPrivate) {
      setSelectedRoom(room.roomId);
      setIsSpectating(false);
      setShowCodePrompt(true);
    } else {
      onJoinRoom(room.roomId);
    }
  };

  const handleSpectateClick = (room: RoomInfo) => {
    if (room.isPrivate) {
      setSelectedRoom(room.roomId);
      setIsSpectating(true);
      setShowCodePrompt(true);
    } else {
      onSpectateRoom(room.roomId);
    }
  };

  const handleCodeSubmit = () => {
    if (selectedRoom && roomCodeInput.trim()) {
      if (isSpectating) {
        onSpectateRoom(selectedRoom, roomCodeInput.trim().toUpperCase());
      } else {
        onJoinRoom(selectedRoom, roomCodeInput.trim().toUpperCase());
      }
      setShowCodePrompt(false);
      setRoomCodeInput("");
      setSelectedRoom(null);
      setIsSpectating(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 999999) return "∞";
    const m = Math.floor(seconds / 60);
    return `${m}min`;
  };

  const filteredRooms = rooms.filter((room) => {
    if (filterPrivate) return room.isPrivate;
    return true;
  });

  const publicRooms = filteredRooms.filter((r) => !r.isPrivate);
  const privateRooms = filteredRooms.filter((r) => r.isPrivate);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-gray-800/50 to-transparent flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-blue-400">🎮</span> GAME LOBBY
            </h2>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mt-1">
              Join an active game
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-2 hover:bg-gray-800 rounded-full"
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
        </div>

        {/* Filter Tabs */}
        <div className="px-6 pb-4 flex gap-2">
          <button
            onClick={() => setFilterPrivate(false)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${
              !filterPrivate
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All Rooms ({rooms.length})
          </button>
          <button
            onClick={() => setFilterPrivate(true)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${
              filterPrivate
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Private Only ({privateRooms.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                Loading games...
              </p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4 opacity-20">🎲</div>
              <p className="text-gray-500">
                No active games found. Be the first to host!
              </p>
            </div>
          ) : (
            <>
              {/* Public Rooms */}
              {!filterPrivate && publicRooms.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest pl-2">
                    Public Games
                  </h3>
                  {publicRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 hover:bg-gray-800/80 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                          {room.hostName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors flex items-center gap-2">
                            {room.hostName}
                            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full font-mono">
                              PUBLIC
                            </span>
                          </div>
                          <div className="text-gray-500 text-[10px] font-mono">
                            {room.timeSettings.isTimed
                              ? `${formatTime(
                                  room.timeSettings.initialTime
                                )} + ${room.timeSettings.increment}s`
                              : "Unlimited Time"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-gray-400 text-xs font-mono">
                            {room.playerCount}/{room.maxPlayers} players
                          </div>
                          {room.spectatorCount > 0 && (
                            <div className="text-purple-400 text-xs font-mono">
                              {room.spectatorCount} spectator{room.spectatorCount !== 1 ? 's' : ''}
                            </div>
                          )}
                          {room.isGameInProgress && (
                            <div className="text-green-400 text-xs font-mono">
                              🎮 In Progress
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {room.playerCount < room.maxPlayers && (
                            <button
                              onClick={() => handleJoinClick(room)}
                              className="px-4 py-2 rounded-lg text-xs font-bold uppercase transition bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Join
                            </button>
                          )}
                          <button
                            onClick={() => handleSpectateClick(room)}
                            className="px-4 py-2 rounded-lg text-xs font-bold uppercase transition bg-purple-600 text-white hover:bg-purple-700"
                          >
                            Spectate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Private Rooms */}
              {privateRooms.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest pl-2">
                    Private Games
                  </h3>
                  {privateRooms.map((room) => (
                    <div
                      key={room.roomId}
                      className="flex items-center justify-between bg-gray-800/40 p-4 rounded-2xl border border-amber-700/50 hover:bg-gray-800/80 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
                          {room.hostName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm group-hover:text-amber-400 transition-colors flex items-center gap-2">
                            {room.hostName}
                            <span className="text-xs bg-amber-600/20 text-amber-400 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                              🔒 PRIVATE
                            </span>
                          </div>
                          <div className="text-gray-500 text-[10px] font-mono">
                            {room.timeSettings.isTimed
                              ? `${formatTime(
                                  room.timeSettings.initialTime
                                )} + ${room.timeSettings.increment}s`
                              : "Unlimited Time"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-gray-400 text-xs font-mono">
                            {room.playerCount}/{room.maxPlayers} players
                          </div>
                          {room.spectatorCount > 0 && (
                            <div className="text-purple-400 text-xs font-mono">
                              {room.spectatorCount} spectator{room.spectatorCount !== 1 ? 's' : ''}
                            </div>
                          )}
                          {room.isGameInProgress && (
                            <div className="text-green-400 text-xs font-mono">
                              🎮 In Progress
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {room.playerCount < room.maxPlayers && (
                            <button
                              onClick={() => handleJoinClick(room)}
                              className="px-4 py-2 rounded-lg text-xs font-bold uppercase transition bg-amber-600 text-white hover:bg-amber-700"
                            >
                              Join
                            </button>
                          )}
                          <button
                            onClick={() => handleSpectateClick(room)}
                            className="px-4 py-2 rounded-lg text-xs font-bold uppercase transition bg-purple-600 text-white hover:bg-purple-700"
                          >
                            Spectate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-800/30 text-center">
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">
            List refreshes automatically every 3 seconds
          </p>
        </div>
      </div>

      {/* Room Code Prompt Modal */}
      {showCodePrompt && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowCodePrompt(false)}
        >
          <div
            className="bg-gray-900 border-2 border-amber-600/50 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{isSpectating ? "👁️" : "🔒"}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {isSpectating ? "Spectate Private Game" : "Private Game"}
              </h3>
              <p className="text-gray-400 text-sm">
                Enter the room code to {isSpectating ? "spectate" : "join"} this private game
              </p>
            </div>

            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) =>
                setRoomCodeInput(e.target.value.toUpperCase().slice(0, 4))
              }
              onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              placeholder="XXXX"
              maxLength={4}
              className="w-full bg-gray-800 border-2 border-amber-600/50 text-white text-center text-2xl font-mono font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-amber-500 uppercase mb-6"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCodePrompt(false);
                  setRoomCodeInput("");
                  setSelectedRoom(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCodeSubmit}
                disabled={roomCodeInput.length !== 4}
                className={`flex-1 px-4 py-2 rounded-lg transition font-bold text-sm ${
                  roomCodeInput.length === 4
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
