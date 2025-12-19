import React from "react";
import { LeaderboardEntry } from "@/types";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  isLoading: boolean;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  isLoading,
}) => {
  if (!isOpen) return null;

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          color: "text-yellow-400",
          bg: "bg-yellow-400/10",
          border: "border-yellow-400/50",
          medal: "🥇",
        };
      case 2:
        return {
          color: "text-gray-300",
          bg: "bg-gray-300/10",
          border: "border-gray-300/50",
          medal: "🥈",
        };
      case 3:
        return {
          color: "text-amber-600",
          bg: "bg-amber-600/10",
          border: "border-amber-600/50",
          medal: "🥉",
        };
      default:
        return {
          color: "text-gray-500",
          bg: "bg-gray-800/30",
          border: "border-gray-700/50",
          medal: `${rank}.`,
        };
    }
  };

  const topThree = entries.slice(0, 3);
  const others = entries.slice(3, 10);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-gray-800/50 to-transparent flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-yellow-400">🏆</span> HALL OF FAME
            </h2>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mt-1">
              Top Structural Strategists
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {isLoading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                Summoning Legends...
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4 opacity-20">🧊</div>
              <p className="text-gray-500">
                No matches recorded yet. The first legend could be you!
              </p>
            </div>
          ) : (
            <>
              {/* Podium for Top 3 */}
              <div className="grid grid-cols-3 gap-3 items-end pt-4 pb-2">
                {/* 2nd Place */}
                {topThree[1] && (
                  <div className="flex flex-col items-center gap-2 group">
                    <div className="text-2xl mb-1">{getRankStyle(2).medal}</div>
                    <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-400 flex items-center justify-center text-xl font-bold text-white shadow-lg overflow-hidden wood-texture">
                      {topThree[1].playername.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold text-xs truncate max-w-[80px]">
                        {topThree[1].playername}
                      </div>
                      <div className="text-gray-400 text-[10px] font-mono leading-tight">
                        {topThree[1].wins}{" "}
                        {topThree[1].wins === 1 ? "Win" : "Wins"}
                        <br />
                        {topThree[1].totalMatches}{" "}
                        {topThree[1].totalMatches === 1 ? "Match" : "Matches"}
                        <br />
                        <span className="text-gray-500">
                          {topThree[1].winRate}% WR
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-12 bg-gray-800/80 rounded-t-lg border-t border-x border-gray-400/30"></div>
                  </div>
                )}

                {/* 1st Place */}
                {topThree[0] && (
                  <div className="flex flex-col items-center gap-2 group relative -top-2">
                    <div className="text-3xl mb-1 drop-shadow-lg">
                      {getRankStyle(1).medal}
                    </div>
                    <div className="w-20 h-20 rounded-full bg-yellow-600 border-4 border-yellow-400 flex items-center justify-center text-3xl font-black text-white shadow-[0_0_20px_rgba(234,179,8,0.3)] overflow-hidden wood-texture">
                      {topThree[0].playername.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-400 font-black text-sm truncate max-w-[100px] uppercase tracking-tighter">
                        {topThree[0].playername}
                      </div>
                      <div className="text-yellow-400/70 text-[10px] font-mono font-bold leading-tight">
                        {topThree[0].wins}{" "}
                        {topThree[0].wins === 1 ? "Win" : "Wins"}
                        <br />
                        {topThree[0].totalMatches}{" "}
                        {topThree[0].totalMatches === 1 ? "Match" : "Matches"}
                        <br />
                        <span className="text-yellow-400/50">
                          {topThree[0].winRate}% WR
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-20 bg-yellow-400/10 rounded-t-xl border-t border-x border-yellow-400/40 backdrop-blur-sm"></div>
                  </div>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                  <div className="flex flex-col items-center gap-2 group">
                    <div className="text-2xl mb-1">{getRankStyle(3).medal}</div>
                    <div className="w-14 h-14 rounded-full bg-amber-900 border-2 border-amber-600 flex items-center justify-center text-lg font-bold text-white shadow-lg overflow-hidden wood-texture">
                      {topThree[2].playername.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold text-xs truncate max-w-[70px]">
                        {topThree[2].playername}
                      </div>
                      <div className="text-gray-400 text-[10px] font-mono leading-tight">
                        {topThree[2].wins}{" "}
                        {topThree[2].wins === 1 ? "Win" : "Wins"}
                        <br />
                        {topThree[2].totalMatches}{" "}
                        {topThree[2].totalMatches === 1 ? "Match" : "Matches"}
                        <br />
                        <span className="text-gray-500">
                          {topThree[2].winRate}% WR
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-8 bg-gray-800/80 rounded-t-lg border-t border-x border-amber-600/30"></div>
                  </div>
                )}
              </div>

              {/* Others List */}
              <div className="space-y-2">
                <h4 className="text-gray-500 text-[10px] font-black uppercase tracking-widest pl-2">
                  Contenders
                </h4>
                {others.map((entry, idx) => {
                  const style = getRankStyle(idx + 4);
                  return (
                    <div
                      key={entry.playername}
                      className="flex items-center justify-between bg-gray-800/40 p-3 rounded-2xl border border-gray-700/50 hover:bg-gray-800/80 transition-all hover:translate-x-1 group"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`w-6 text-center font-mono font-bold text-xs ${style.color}`}
                        >
                          {idx + 4}
                        </span>
                        <div>
                          <div className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">
                            {entry.playername}
                          </div>
                          <div className="text-gray-500 text-[10px] font-mono">
                            {entry.totalMatches}{" "}
                            {entry.totalMatches === 1 ? "Match" : "Matches"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-green-400 font-black text-sm">
                            {entry.wins}W
                          </div>
                          <div className="text-gray-500 text-[10px] font-mono">
                            {entry.winRate}% WR
                          </div>
                        </div>
                        <div className="w-1.5 h-8 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="bg-green-500 w-full"
                            style={{ height: `${entry.winRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-800/30 text-center">
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">
            Updated after every online match
          </p>
        </div>
      </div>
    </div>
  );
};
