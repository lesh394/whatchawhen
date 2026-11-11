import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="relative max-w-xl w-full pixel-wood-frame rounded p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-[#ffebc4]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 bg-[#261106] border border-[#a47648] text-[#ffe2a0] hover:text-white rounded-sm pixel-btn cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-pixel-title text-base sm:text-lg text-[#ffe599] mb-1 flex items-center gap-2">
          <span>🕰️ HOW TO PLAY</span>
        </h2>
        <p className="font-pixel-ui text-[11px] text-[#d7974e] mb-4">
          Guess the work. Call the year. Simple as that.
        </p>

        <div className="space-y-3.5 font-pixel-body text-xs text-[#eed0ae]">
          
          {/* Rule 1 */}
          <div className="bg-[#1f0e06] border-2 border-[#4d2817] p-3 rounded-sm">
            <h3 className="font-pixel-title text-[11px] text-[#fcd34d] mb-1">
              1. WHAT YOU DO
            </h3>
            <p className="leading-relaxed">
              Every round throws up a song cover, book cover, or painting. Call the year it came out and tell us what it is — the closer your guess, the bigger your score.
            </p>
          </div>

          {/* Rule 2: Modes & Difficulties */}
          <div className="bg-[#1f0e06] border-2 border-[#4d2817] p-3 rounded-sm">
            <h3 className="font-pixel-title text-[11px] text-emerald-400 mb-1">
              2. LEVELS &amp; MODES
            </h3>
            <div className="leading-relaxed space-y-1">
              <div>• <strong className="text-amber-200">Classic vs Forever:</strong> Play a 5-round run for points, or go endless on 100 HP where misses cost health and clutch guesses heal you.</div>
              <div>• <strong className="text-emerald-300">🌱 Easy:</strong> 4 multiple-choice picks and super forgiving timing.</div>
              <div>• <strong className="text-amber-300">🌾 Normal:</strong> Type or slide yourself, stricter scoring, plus 1 free hint (or watch a goofy fake ad for another).</div>
              <div>• <strong className="text-rose-300">⚔️ Hard:</strong> Pure memory. Tight year window, no hints, and no autocomplete.</div>
              <div>• <strong className="text-sky-300">⚔️ Multiplayer:</strong> Create one room link for 2 or more friends — everyone gets the exact same live rounds, covers, choices &amp; hints on one shared leaderboard.</div>
            </div>
          </div>

          {/* Rule 3: Covers & Art */}
          <div className="bg-[#1f0e06] border-2 border-[#4d2817] p-3 rounded-sm">
            <h3 className="font-pixel-title text-[11px] text-amber-300 mb-1">
              3. COVERS &amp; ART
            </h3>
            <p className="leading-relaxed">
              Music &amp; Book covers are pixelated with spoiler title text hidden — go off the artwork alone. Paintings stay clear and you can click to zoom right in!
            </p>
          </div>

        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-sm bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] font-pixel-title text-xs text-white pixel-btn shadow-lg cursor-pointer"
        >
          LET'S PLAY!
        </button>
      </div>
    </div>
  );
};
