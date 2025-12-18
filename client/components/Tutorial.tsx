import React, { useState, useEffect } from "react";

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialVisualProps {
  children: React.ReactNode;
  mediaSrc?: string;
  mediaType?: "video" | "image";
  className?: string;
}

const TutorialVisual = ({
  children,
  mediaSrc,
  mediaType = "image",
  className = "",
}: TutorialVisualProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!mediaSrc);

  // Sync state when the media source changes (important for page transitions)
  useEffect(() => {
    if (mediaSrc) {
      setHasError(false);
      setIsLoading(true);
    } else {
      setHasError(false);
      setIsLoading(false);
    }
  }, [mediaSrc]);

  return (
    <div
      className={`w-full h-44 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center justify-center mb-4 overflow-hidden relative select-none group ${className}`}
    >
      {mediaSrc &&
        (mediaType === "video" ? (
          <video
            key={mediaSrc}
            src={mediaSrc}
            autoPlay
            loop
            muted
            playsInline
            className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-500 ${
              !isLoading && !hasError ? "opacity-100" : "opacity-0"
            }`}
            onLoadedData={() => {
              setIsLoading(false);
              setHasError(false);
            }}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        ) : (
          <img
            key={mediaSrc}
            src={mediaSrc}
            alt="Tutorial Visual"
            className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-500 ${
              !isLoading && !hasError ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => {
              setIsLoading(false);
              setHasError(false);
            }}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        ))}

      {/* Fallback Content (shown if mediaSrc is missing or failed to load) */}
      {(!mediaSrc || hasError) && (
        <div className="absolute inset-0 w-full h-full animate-in fade-in duration-300 bg-gray-900/40">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <svg width="100%" height="100%">
              <defs>
                <pattern
                  id="grid"
                  width="25"
                  height="25"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 25 0 L 0 0 0 25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-gray-600"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [page, setPage] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Objective",
      content: (
        <div className="space-y-4">
          <TutorialVisual mediaSrc="/assets/Win Condition.png">
            <svg viewBox="0 0 300 140" className="w-full h-full p-2">
              <defs>
                <linearGradient
                  id="winGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient
                  id="grayGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#4b5563" />
                  <stop offset="100%" stopColor="#374151" />
                </linearGradient>
              </defs>

              <line
                x1="0"
                y1="120"
                x2="300"
                y2="120"
                stroke="#9ca3af"
                strokeWidth="2"
              />

              <rect
                x="25"
                y="95"
                width="25"
                height="25"
                fill="url(#grayGrad)"
                rx="2"
                stroke="#fff"
                strokeWidth="1"
                strokeOpacity="0.3"
              />
              <rect
                x="175"
                y="95"
                width="25"
                height="25"
                fill="url(#grayGrad)"
                rx="2"
                stroke="#fff"
                strokeWidth="1"
                strokeOpacity="0.3"
              />

              {[0, 1, 2, 3, 4].map((i) => (
                <rect
                  key={i}
                  x={50 + i * 25}
                  y={95}
                  width="25"
                  height="25"
                  fill="url(#winGrad)"
                  rx="2"
                  stroke="#fff"
                  strokeWidth="1"
                />
              ))}

              <circle
                cx="175"
                cy="80"
                r="12"
                fill="#4ade80"
                stroke="white"
                strokeWidth="2"
              />
              <path
                d="M169 80 l4 4 l8 -8"
                stroke="white"
                strokeWidth="3"
                fill="none"
              />
            </svg>
          </TutorialVisual>
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">
              The goal is to connect{" "}
              <strong className="text-white">5 blocks</strong> of your color in
              a line.
            </p>
            <ul className="list-disc list-inside text-xs text-gray-400 ml-2">
              <li>Lines can be Horizontal, Vertical, or Diagonal.</li>
              <li>
                You can use existing blocks (yours or opponent's) for support.
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "Block Types",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center">
              <div className="h-28 w-full mb-3 bg-gray-900/50 rounded-lg relative overflow-hidden flex items-center justify-center">
                <TutorialVisual
                  mediaSrc="/assets/Vertical.png"
                  className="mb-0 h-full border-0 bg-transparent rounded-none"
                >
                  <div
                    className="w-8 h-16 bg-amber-600 rounded border border-white/20 shadow-lg relative animate-bounce"
                    style={{ animationDuration: "2s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                  </div>
                </TutorialVisual>
              </div>
              <div className="text-white font-bold text-sm mb-1">Vertical</div>
              <div className="text-[10px] text-gray-400 text-center leading-tight">
                1x1 Base, 2 High
              </div>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-col items-center">
              <div className="h-28 w-full mb-3 bg-gray-900/50 rounded-lg relative overflow-hidden flex items-center justify-center">
                <TutorialVisual
                  mediaSrc="/assets/Horizontal.png"
                  className="mb-0 h-full border-0 bg-transparent rounded-none"
                >
                  <div
                    className="w-16 h-8 bg-amber-600 rounded border border-white/20 shadow-lg relative animate-bounce"
                    style={{ animationDuration: "2s", animationDelay: "0.5s" }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                  </div>
                </TutorialVisual>
              </div>
              <div className="text-white font-bold text-sm mb-1">
                Horizontal
              </div>
              <div className="text-[10px] text-gray-400 text-center leading-tight">
                2x1 Base, 1 High
              </div>
            </div>
          </div>
          <p className="text-gray-400 text-xs text-center italic">
            Blocks obey gravity and fall to the lowest point.
          </p>
        </div>
      ),
    },
    {
      title: "The Short-Side Rule",
      content: (
        <div className="space-y-4">
          <TutorialVisual
            mediaSrc="/assets/end to end constraint.mp4"
            mediaType="video"
          >
            <div className="flex justify-around items-end w-full px-2 h-full pb-4">
              <div className="flex flex-col items-center">
                <div className="relative flex flex-col items-center justify-end h-24">
                  <div className="w-6 h-10 bg-amber-600 border border-white/30 rounded-sm"></div>
                  <div className="w-6 h-10 bg-amber-600 border border-white/30 rounded-sm -mt-px opacity-90"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-900/80 rounded-full border border-red-500/50">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <span className="text-red-400 text-[10px] font-bold mt-2 uppercase tracking-wide">
                  Invalid
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative flex items-end justify-center h-24">
                  <div className="w-10 h-6 bg-amber-600 border border-white/30 rounded-sm"></div>
                  <div className="w-10 h-6 bg-amber-600 border border-white/30 rounded-sm -ml-px opacity-90"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-900/80 rounded-full border border-red-500/50">
                    <svg
                      className="w-4 h-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
                <span className="text-red-400 text-[10px] font-bold mt-2 uppercase tracking-wide">
                  Invalid
                </span>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative flex flex-col items-center justify-end h-24">
                  <div className="w-6 h-10 bg-amber-600 border border-white/30 rounded-sm"></div>
                  <div className="w-6 h-10 bg-gray-600 border border-white/30 rounded-sm -mt-px opacity-90"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-green-500 rounded-full shadow-lg border-2 border-white">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={4}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <span className="text-green-400 text-[10px] font-bold mt-2 uppercase tracking-wide">
                  Valid
                </span>
              </div>
            </div>
          </TutorialVisual>
          <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
            <p className="text-sm text-gray-200">
              You <strong>cannot</strong> place a block's short end against
              another block's short end of the{" "}
              <strong className="text-amber-400">SAME COLOR</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Controls",
      content: (
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center gap-2 p-2">
              <div className="relative w-12 h-16 border-2 border-gray-500 rounded-full bg-gray-900 overflow-hidden">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[1px] h-6 bg-gray-500"></div>
                <div className="absolute top-0 left-0 w-1/2 h-8 bg-blue-500/40 rounded-tl-full"></div>
              </div>
              <span className="text-white font-bold text-xs mt-1">
                Left Click
              </span>
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">
                Place
              </span>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 p-2">
              <div className="relative w-12 h-16 border-2 border-gray-500 rounded-full bg-gray-900 overflow-hidden">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[1px] h-6 bg-gray-500"></div>
                <div className="absolute top-0 right-0 w-1/2 h-8 bg-amber-500/40 rounded-tr-full"></div>
              </div>
              <span className="text-white font-bold text-xs mt-1">
                Right Click
              </span>
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">
                Rotate
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-400 px-2">
            <div className="flex items-center gap-2">
              <kbd className="bg-gray-700 px-2 py-1 rounded font-mono text-white shadow-sm border-b-2 border-gray-900">
                R
              </kbd>
              <span>Rotate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="bg-gray-700 px-2 py-1 rounded font-mono text-white shadow-sm border-b-2 border-gray-900">
                Space
              </kbd>
              <span>Rotate</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              How to Play
            </h2>
            <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mt-1">
              {slides[page].title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition rounded-full p-1 hover:bg-gray-800"
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

        <div className="p-6 pt-4 flex-1 overflow-y-auto">
          {slides[page].content}
        </div>

        <div className="p-6 pt-2 bg-gray-800/50 border-t border-gray-800 flex justify-between items-center">
          <div className="flex gap-1">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  idx === page ? "bg-blue-500" : "bg-gray-700"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {page > 0 ? (
              <button
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold transition"
              >
                Back
              </button>
            ) : (
              <div className="w-[60px]"></div>
            )}

            <button
              onClick={() => {
                if (page < slides.length - 1) setPage((p) => p + 1);
                else onClose();
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition shadow-lg"
            >
              {page < slides.length - 1 ? "Next" : "Play"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
