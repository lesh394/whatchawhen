import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, Lock, Crown } from 'lucide-react';
import { sounds } from '../services/sound';

interface RetroAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdCompleted: () => void;
}

const RETRO_ADS = [
  {
    sponsor: 'CRATE DIGGER AUDIO',
    tagline: 'Save Your Scratched 1973 Pressings',
    product: 'SpinClean 3000 Vinyl Mist',
    body: "Got a mystery sleeve stuck in your head? Two spritzes won't decode the cover art, but at least your records will shine while you sweat the decade.",
    icon: '💿',
    disclaimer: 'Not liable for confident guesses off by 15 years.',
    themeBg: 'bg-blue-950 border-blue-500 text-blue-100',
    accent: 'bg-blue-600',
  },
  {
    sponsor: 'BOOKWORM OPTICS',
    tagline: 'Squint Smarter, Not Harder',
    product: 'Pixel-Breaker Monocle',
    body: 'Trying to read a pixelated book cover? Spoiler: our glass doesn\'t un-blur it one bit, so good luck guessing purely off vibes!',
    icon: '🧐',
    disclaimer: 'Zero refunds on confident wrong authors.',
    themeBg: 'bg-amber-950 border-amber-600 text-amber-100',
    accent: 'bg-amber-600',
  },
  {
    sponsor: 'CHRONO GARAGE',
    tagline: 'Slightly Rusty Time Travel Parts',
    product: 'Deluxe Decade Dial Lube',
    body: 'Slider slipping past 1969? Grab a tube of Chrono Grease and slide straight onto the exact year like a true trivia demon.',
    icon: '⚙️',
    disclaimer: 'May void warranty if used prior to 1400.',
    themeBg: 'bg-purple-950 border-purple-500 text-purple-100',
    accent: 'bg-purple-600',
  },
  {
    sponsor: 'GOLD FRAME EMPORIUM',
    tagline: 'Museum Vibes on an Indie Budget',
    product: 'Solid Oak Brushstroke Magnifier',
    body: 'Zooming in on oil paintings won’t whisper the painter’s name, but those tiny brushstrokes sure look neat while we load your clue.',
    icon: '🖼️',
    disclaimer: 'Do not lick oil paint over 200 years old.',
    themeBg: 'bg-stone-900 border-amber-700 text-amber-100',
    accent: 'bg-amber-700',
  },
  {
    sponsor: 'INDIE DEV COFFEE FUND',
    tagline: 'Powered by 2 AM Espresso',
    product: 'Triple-Shot Clue Brew',
    body: "Thanks for sitting through our completely fake ad! We're cooking up your spoiler-free hint right now — promise we took out the exact year.",
    icon: '☕',
    disclaimer: '100% pretend sponsor. Your secret hint unlocks at 0s.',
    themeBg: 'bg-[#29170e] border-[#8a4b27] text-[#ffe6cb]',
    accent: 'bg-[#8a4b27]',
  },
];

export const RetroAdModal: React.FC<RetroAdModalProps> = ({
  isOpen,
  onClose,
  onAdCompleted,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [adIndex, setAdIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    // Pick random ad
    const randomAd = Math.floor(Math.random() * RETRO_ADS.length);
    setAdIndex(randomAd);
    setSecondsRemaining(30);

    const timer = setInterval(() => {
      setSecondsRemaining(sec => {
        if (sec <= 1) {
          clearInterval(timer);
          sounds.playSuccess();
          return 0;
        }
        sounds.playTick();
        return sec - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const ad = RETRO_ADS[adIndex];
  const progressPercent = ((30 - secondsRemaining) / 30) * 100;

  const handleClaim = () => {
    sounds.playCoin();
    onAdCompleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn select-none">
      <div className={`relative max-w-lg w-full ${ad.themeBg} pixel-wood-frame rounded p-6 shadow-2xl flex flex-col`}>
        
        {/* Retro Commercial Header */}
        <div className="flex items-center justify-between border-b-2 border-current/30 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">{ad.icon}</span>
            <div>
              <div className="font-pixel-title text-[10px] tracking-wider text-amber-300">
                COMMERCIAL BREAK
              </div>
              <div className="text-[10px] opacity-75 font-pixel-ui">
                SPONSORED BY {ad.sponsor}
              </div>
            </div>
          </div>

          {/* Unskippable 30-Second Countdown */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/70 border border-amber-500/40 rounded font-pixel-title text-xs text-amber-400">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{secondsRemaining > 0 ? `${secondsRemaining}s` : 'DONE!'}</span>
          </div>
        </div>

        {/* Ad Progress Bar */}
        <div className="w-full bg-black/70 h-3 border border-white/20 rounded-sm mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Ad Body Content */}
        <div className="bg-black/50 border-2 border-current/20 p-4 rounded-sm mb-4">
          <div className="font-pixel-title text-xs sm:text-sm text-amber-300 mb-1">
            {ad.product}
          </div>
          <div className="text-[10px] font-pixel-ui text-amber-100/90 mb-2 italic">
            "{ad.tagline}"
          </div>
          <p className="text-xs leading-relaxed font-pixel-body mb-2">
            {ad.body}
          </p>
          <div className="text-[9px] opacity-50 font-mono">
            * {ad.disclaimer}
          </div>
        </div>

        {/* Paid Version Teaser (Unclickable Button requested in Note 1) */}
        <div className="mb-4 p-2.5 bg-amber-950/40 border-2 border-dashed border-amber-600/60 rounded flex items-center justify-between opacity-80 cursor-not-allowed">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-left">
              <div className="font-pixel-title text-[9px] text-amber-300">
                WhatchaWhen GOLD (Ad-Free)
              </div>
              <div className="text-[8px] font-pixel-ui text-amber-200/70">
                Skip all 30s ads instantly forever
              </div>
            </div>
          </div>

          <button
            disabled
            className="px-2.5 py-1 bg-amber-900/60 border border-amber-600/60 text-amber-300/80 font-pixel-ui text-[8px] rounded cursor-not-allowed flex items-center gap-1"
          >
            <Lock className="w-2.5 h-2.5" />
            <span>COMING SOON</span>
          </button>
        </div>

        {/* Ad Actions: Unskippable until timer reaches 0 */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClose}
            className="text-[10px] font-pixel-ui text-stone-400 hover:text-white underline cursor-pointer"
          >
            Cancel (No Hint)
          </button>

          {secondsRemaining === 0 ? (
            <button
              onClick={handleClaim}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-950 text-white font-pixel-title text-xs rounded pixel-btn shadow-lg animate-pulse cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>CLAIM HINT FOR THIS ROUND!</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-black/60 border border-stone-700 text-stone-400 font-pixel-ui text-[10px] rounded cursor-not-allowed">
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Must watch full ad ({secondsRemaining}s remaining)</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
