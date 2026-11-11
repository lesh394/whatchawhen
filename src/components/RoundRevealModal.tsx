import React, { useEffect, useState } from 'react';
import { RoundResult, GameMode } from '../types';
import { ArrowRight, Calendar, Skull, Flame, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../services/sound';
import { WikiInfoModal } from './WikiInfoModal';

interface RoundRevealModalProps {
  result: RoundResult;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  gameMode: GameMode;
  onNextRound: () => void;
}

export const RoundRevealModal: React.FC<RoundRevealModalProps> = ({
  result,
  roundNumber,
  totalRounds,
  isLastRound,
  gameMode,
  onNextRound,
}) => {
  const { 
    item, guess, yearDelta, yearPoints, identificationPoints, totalPoints, 
    creatorMatchAccuracy, titleMatchAccuracy,
    damageTaken = 0, healed = 0, remainingHp = 100,
    newStreak = 0, difficultyUsed
  } = result;

  const [animatedScore, setAnimatedScore] = useState(0);
  const [isWikiOpen, setIsWikiOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const isFainted = gameMode === 'forever' && remainingHp <= 0;

  // Outcome Tiers: Perfect (10,000 green), Partial/Hit (Amber), Blunder (0 pts Crimson Red)
  const isPerfect = result.guessTier === 'perfect' || (totalPoints === 10000);
  const isBlunder = result.guessTier === 'blunder' || (yearPoints === 0 && identificationPoints === 0);
  const isHalf = !isPerfect && !isBlunder;

  const halfHeadline =
    yearPoints > 0 && identificationPoints > 0
      ? totalPoints >= 8500
        ? `✨ HUGE HIT! (${totalPoints.toLocaleString()} / 10,000)`
        : `🎯 NICE CALL! (${totalPoints.toLocaleString()} / 10,000)`
      : yearPoints > 0
      ? '🌾 YEAR HIT! (ID Missed)'
      : '🌾 WORK NAILED! (Year Too Far)';

  useEffect(() => {
    // Sound effect & visual triggers based on exact tier
    if (isFainted) {
      sounds.playHurt();
    } else if (isPerfect) {
      sounds.playPerfect();
      
      // 2D confetti bursts popping from both sides (scaled for mobile smoothness)
      const burstCount = typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : 90;
      confetti({
        particleCount: burstCount,
        angle: 60,
        spread: 70,
        origin: { x: 0.15, y: 0.6 },
        colors: ['#22c55e', '#facc15', '#ec4899', '#38bdf8', '#a855f7'],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: burstCount,
        angle: 120,
        spread: 70,
        origin: { x: 0.85, y: 0.6 },
        colors: ['#22c55e', '#facc15', '#ec4899', '#38bdf8', '#a855f7'],
        disableForReducedMotion: true,
      });
    } else if (isBlunder) {
      sounds.playBlunder();
    } else {
      sounds.playCoin();
    }

    const duration = 600;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = totalPoints / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= totalPoints) {
        setAnimatedScore(totalPoints);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [totalPoints, isFainted, isPerfect, isBlunder]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/85 sm:backdrop-blur-sm animate-fadeIn select-none">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
      
      {/* Modal Container: Distinct visual cues for Perfect (Green), Half (Amber), and Blunder (Red) */}
      <div className={`relative max-w-lg w-full rounded p-4 sm:p-5 shadow-2xl my-auto text-[#ffebc4] transition-all duration-300 ${
        isPerfect
          ? 'bg-[#0c3318] border-4 border-[#22c55e] shadow-[0_0_40px_rgba(34,197,94,0.7)]'
          : isBlunder
          ? 'bg-[#3b0d0d] border-4 border-[#ef4444] shadow-[0_0_45px_rgba(239,68,68,0.9)] animate-shake'
          : 'bg-[#29170e] border-4 border-[#d97706] shadow-[0_0_25px_rgba(217,119,6,0.5)] pixel-wood-frame'
      }`}>
        
        {/* Tier Specific Banners */}
        {isPerfect && (
          <div className="mb-3 py-1.5 px-2.5 sm:px-3 bg-[#15803d] border-2 border-[#4ade80] rounded text-center font-pixel-title text-[10px] sm:text-xs text-white shadow animate-bounce">
            🌟 10,000 / 10,000 PERFECT BULLSEYE! 🌟
          </div>
        )}

        {isBlunder && (
          <div className="mb-3 py-1.5 px-2.5 sm:px-3 bg-[#991b1b] border-2 border-[#f87171] rounded text-center font-pixel-title text-[10px] sm:text-xs text-white shadow animate-pulse">
            💀 TOTAL BLUNDER! 0 POINTS EARNED! 💀
          </div>
        )}

        {isHalf && (
          <div className="mb-3 py-1.5 px-2.5 sm:px-3 bg-[#78350f] border-2 border-[#f59e0b] rounded text-center font-pixel-title text-[10px] sm:text-[11px] text-amber-100 shadow">
            {halfHeadline}
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-current/20 pb-2.5 mb-3">
          <div className="font-pixel-title text-[10px] text-[#fcd34d] flex items-center gap-2">
            <span>{gameMode === 'forever' ? `ROUND ${roundNumber}` : `ROUND ${roundNumber}/${totalRounds}`}</span>
            {difficultyUsed && (
              <span className="text-[8px] font-pixel-ui px-1.5 py-0.5 rounded bg-black/40 border border-current/20 uppercase text-[#eed0ae]">
                {difficultyUsed}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-1 font-pixel-title text-sm sm:text-base ${
            isBlunder ? 'text-rose-400' : 'text-[#fcd34d]'
          }`}>
            <span>+{animatedScore.toLocaleString()}</span>
            <span className="text-[10px] opacity-75">/ 10k PTS</span>
          </div>
        </div>

        {/* Revealed Unblurred Artifact */}
        <div className="flex gap-3 sm:gap-3.5 items-center mb-3.5 bg-black/40 border-2 border-current/20 p-2.5 rounded">
          <img
            src={result.wikiThumbnail || item.image}
            alt={item.title}
            decoding="async"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain bg-black rounded border border-white/20 shrink-0"
          />

          <div className="flex-1 min-w-0">
            <h2 className="font-pixel-title text-xs sm:text-base text-[#ffe599] leading-snug line-clamp-2 break-words">
              {item.title}
            </h2>
            <div className="text-xs font-pixel-body text-[#eed0ae] truncate mt-0.5">
              by <span className="text-white font-bold">{item.creator}</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#24130a] border border-[#804a23] text-[#f5cba7] text-[9px] font-pixel-ui uppercase">
                <span>{item.category === 'music' ? '🎵' : item.category === 'books' ? '📚' : '🎨'}</span>
                <span>{item.category}</span>
              </div>

              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#3a1d0d] border border-[#a66a3d] text-amber-300 text-[9px] font-pixel-title">
                <Calendar className="w-3 h-3" />
                <span>Released {item.year}</span>
              </div>

              {/* (i) WIKIPEDIA INFO BUTTON (Note 2 requested) */}
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsWikiOpen(true);
                }}
                className="px-2 py-1 sm:py-0.5 bg-[#422210] hover:bg-[#5a3018] border border-[#a66a3d] rounded text-amber-200 hover:text-white font-pixel-ui text-[9px] flex items-center gap-1 pixel-btn cursor-pointer"
                title="Read Wikipedia History & Lore"
              >
                <Info className="w-3 h-3 text-amber-400" />
                <span>Wiki Lore</span>
              </button>
            </div>
          </div>
        </div>

        {/* Perfect Bullseye Streak Callout */}
        {newStreak >= 2 && (
          <div className="p-2 mb-3 bg-gradient-to-r from-amber-900/60 via-purple-900/60 to-rose-900/60 border border-amber-400 rounded flex items-center justify-between flex-wrap gap-1 font-pixel-title text-[9px] text-amber-200">
            <div className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-300 fill-current" />
              <span>{newStreak} ROUND PERFECT STREAK!</span>
            </div>
            <span className="text-white">Unbroken 10,000s</span>
          </div>
        )}

        {/* FOREVER MODE HEALTH NOTICE */}
        {gameMode === 'forever' && (
          <div className={`p-2 rounded border mb-3 flex items-center justify-between gap-2 font-pixel-ui text-xs ${
            isFainted
              ? 'bg-rose-950 border-rose-600 text-rose-200'
              : damageTaken > 0
              ? 'bg-[#3b1717] border-rose-700 text-rose-300'
              : 'bg-[#1b3d1f] border-emerald-500 text-emerald-200'
          }`}>
            <div className="flex items-center gap-1.5">
              {isFainted ? (
                <>
                  <Skull className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-pixel-title text-[9px]">YOU COLLAPSED!</span>
                </>
              ) : damageTaken > 0 ? (
                <>
                  <span>💔</span>
                  <span>Took -{damageTaken} HP Damage</span>
                </>
              ) : (
                <>
                  <span>💖</span>
                  <span>Restored +{healed} HP!</span>
                </>
              )}
            </div>
            <div className="font-pixel-title text-[9px] shrink-0">HP: {remainingHp}/100</div>
          </div>
        )}

        {/* Clean Guesses Comparison with Harsh Visual Color Feedback */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs font-pixel-body">
          {/* Year Result Box */}
          <div className={`p-2.5 rounded border transition-colors ${
            yearPoints > 0
              ? 'bg-[#122e17]/80 border-[#22c55e] text-emerald-100'
              : 'bg-[#3b1212]/85 border-[#ef4444] text-rose-200'
          }`}>
            <div className="text-[9px] font-pixel-title flex justify-between items-center gap-1">
              <span className={yearPoints > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                {yearPoints > 0 ? '🎯 YEAR' : '❌ YEAR'}
              </span>
              <span className={`px-1.5 py-0.5 rounded font-pixel-title text-[9px] shrink-0 ${
                yearPoints > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-rose-950 text-rose-300 border border-rose-600'
              }`}>
                +{yearPoints.toLocaleString()} / 5k
              </span>
            </div>
            <div className="mt-1.5">
              Guessed: <strong className="text-white">{guess.yearGuess}</strong>
            </div>
            <div className={`text-[9px] mt-0.5 font-pixel-ui ${yearPoints > 0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
              {yearDelta === 0 ? '🎯 Perfect Year!' : yearPoints > 0 ? `✨ ${yearDelta}y off` : `❌ ${yearDelta}y off (Too far!)`}
            </div>
          </div>

          {/* Title / Artist Result Box */}
          <div className={`p-2.5 rounded border transition-colors min-w-0 ${
            identificationPoints > 0
              ? 'bg-[#122e17]/80 border-[#22c55e] text-emerald-100'
              : 'bg-[#3b1212]/85 border-[#ef4444] text-rose-200'
          }`}>
            <div className="text-[9px] font-pixel-title flex justify-between items-center gap-1">
              <span className={identificationPoints > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                {identificationPoints > 0 ? '✨ TITLE/ARTIST' : '❌ TITLE/ARTIST'}
              </span>
              <span className={`px-1.5 py-0.5 rounded font-pixel-title text-[9px] shrink-0 ${
                identificationPoints > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-rose-950 text-rose-300 border border-rose-600'
              }`}>
                +{identificationPoints.toLocaleString()} / 5k
              </span>
            </div>
            <div className="mt-1.5 truncate" title={guess.rawGuess}>
              "{guess.rawGuess || 'None'}"
            </div>
            <div className={`text-[9px] mt-0.5 font-pixel-ui ${identificationPoints > 0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
              {creatorMatchAccuracy === 'exact' && titleMatchAccuracy === 'exact'
                ? '🌟 Exact Title & Creator!'
                : titleMatchAccuracy === 'exact'
                ? '✨ Exact Title Matched!'
                : creatorMatchAccuracy === 'exact'
                ? '🎨 Creator Matched!'
                : identificationPoints > 0
                ? '🌾 Partial Match!'
                : '❌ Completely Missed!'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          disabled={isAdvancing}
          onClick={() => {
            if (isAdvancing) return;
            setIsAdvancing(true);
            sounds.playClick();
            onNextRound();
          }}
          className={`w-full py-3.5 sm:py-3 rounded font-pixel-title text-xs tracking-wider pixel-btn shadow-xl cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
            isFainted
              ? 'bg-rose-700 hover:bg-rose-600 border-2 border-rose-950 text-white'
              : 'bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] text-white'
          }`}
        >
          <span>
            {isFainted
              ? 'SEE FINAL RECAP'
              : isLastRound
              ? 'VIEW MATCH RESULTS'
              : `NEXT ROUND (${roundNumber + 1})`}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>

      </div>

      {/* Wikipedia Lore Popup Box with (i) trigger (Note 2) */}
      <WikiInfoModal
        isOpen={isWikiOpen}
        onClose={() => setIsWikiOpen(false)}
        item={item}
        wikiExtract={result.wikiExtract}
        wikiUrl={result.wikiUrl}
      />

    </div>
  );
};
