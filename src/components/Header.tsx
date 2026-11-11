import React from 'react';
import { GameMode, Difficulty } from '../types';
import { Volume2, VolumeX, HelpCircle, RotateCcw, Flame } from 'lucide-react';
import { sounds } from '../services/sound';

interface HeaderProps {
  gamePhase: 'home' | 'playing' | 'revealing' | 'gameover';
  roundIndex: number;
  totalRounds: number;
  currentScore: number;
  gameMode: GameMode;
  difficulty: Difficulty;
  currentHp: number;
  streakMultiplier: number;
  onGoHome: () => void;
  onOpenHelp: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gamePhase,
  roundIndex,
  totalRounds,
  currentScore,
  gameMode,
  currentHp,
  streakMultiplier,
  onGoHome,
  onOpenHelp,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="w-full bg-[#2c170c] border-b-4 border-[#4d2915] shadow-2xl relative z-40 select-none">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        
        {/* Brand */}
        <button
          onClick={() => {
            sounds.playClick();
            onGoHome();
          }}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <div className="w-9 h-9 rounded bg-[#e8a34d] border-2 border-[#542509] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <span className="text-lg">🕰️</span>
          </div>
          <div>
            <div className="font-pixel-title text-sm sm:text-base text-[#ffe8a3] tracking-wide drop-shadow-[0_2px_0_#2b1308]">
              WhatchaWhen
            </div>
          </div>
        </button>

        {/* In-Game Status */}
        {gamePhase !== 'home' && (
          <div className="flex items-center gap-2">
            
            {/* PERFECT STREAK BADGE */}
            {streakMultiplier >= 2 && (
              <div className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-rose-600 border border-amber-300 rounded font-pixel-title text-[9px] text-white flex items-center gap-1 shadow animate-pulse">
                <Flame className="w-3 h-3 fill-current" />
                <span>{streakMultiplier} STREAK!</span>
              </div>
            )}

            {/* HP in Forever Mode OR Round in Classic Mode */}
            {gameMode === 'forever' ? (
              <div className="flex items-center gap-1.5 bg-[#1a0b04] border-2 border-[#542509] px-2.5 py-0.5 rounded">
                <span className="text-xs">❤️</span>
                <span className="font-pixel-title text-[10px] text-rose-300">
                  {currentHp} HP
                </span>
              </div>
            ) : (
              <div className="bg-[#1a0b04] border-2 border-[#542509] px-2 py-0.5 rounded text-[10px] font-pixel-title text-[#fcd34d]">
                RND {roundIndex + 1}/{totalRounds}
              </div>
            )}

            {/* Score */}
            <div className="bg-[#1a0b04] border-2 border-[#e8a34d]/60 px-2.5 py-0.5 rounded flex items-center gap-1 font-pixel-title text-xs text-[#ffe27a]">
              <span>🪙</span>
              <span>{currentScore.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Right buttons */}
        <div className="flex items-center gap-1">
          {gamePhase !== 'home' && (
            <button
              onClick={() => {
                sounds.playClick();
                if (window.confirm('Restart game?')) onGoHome();
              }}
              className="p-1.5 bg-[#422210] hover:bg-[#5a3018] border border-[#261106] rounded text-amber-200 cursor-pointer pixel-btn"
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => {
              sounds.playClick();
              onOpenHelp();
            }}
            className="p-1.5 bg-[#422210] hover:bg-[#5a3018] border border-[#261106] rounded text-amber-200 cursor-pointer pixel-btn"
            title="Help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              onToggleMute();
              sounds.playClick();
            }}
            className="p-1.5 bg-[#422210] hover:bg-[#5a3018] border border-[#261106] rounded text-amber-200 cursor-pointer pixel-btn"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
