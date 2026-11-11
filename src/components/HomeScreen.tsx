import React, { useState } from 'react';
import { Category, GameMode, Difficulty } from '../types';
import { Play, Trophy, Heart, HelpCircle, EyeOff, Info, Swords } from 'lucide-react';
import { sounds } from '../services/sound';
import { InfoModal } from './InfoModal';

interface HomeScreenProps {
  selectedCategory: Category;
  onSelectCategory: (cat: Category) => void;
  gameMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  difficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStartGame: () => void;
  onOpenMultiplayer: () => void;
  onOpenHelp: () => void;
  highScores: Record<Category, number>;
  foreverStreaks: Record<Category, number>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  selectedCategory,
  onSelectCategory,
  gameMode,
  onSelectMode,
  difficulty,
  onSelectDifficulty,
  onStartGame,
  onOpenMultiplayer,
  onOpenHelp,
  highScores,
  foreverStreaks,
}) => {
  // Information box pop-up state
  const [activeInfo, setActiveInfo] = useState<{
    title: string;
    icon: string;
    subtitle?: string;
    description: string;
    rules: string[];
  } | null>(null);

  const openInfo = (
    e: React.MouseEvent,
    info: { title: string; icon: string; subtitle?: string; description: string; rules: string[] }
  ) => {
    e.stopPropagation();
    sounds.playClick();
    setActiveInfo(info);
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-4 sm:py-8 max-w-3xl mx-auto relative z-10 select-none">
      
      {/* Clean Hero Header */}
      <div className="text-center mb-4 sm:mb-6 w-full">
        <h1 className="text-[24px] min-[380px]:text-[29px] sm:text-5xl md:text-6xl font-pixel-title text-[#ffe599] tracking-tight drop-shadow-[0_4px_0_#2b1308] mb-2 leading-tight">
          WhatchaWhen
        </h1>
        <p className="font-pixel-ui text-[11px] sm:text-sm text-[#eec48e] max-w-md mx-auto px-1">
          Spot the cover. Call the year. Prove you know your culture.
        </p>
      </div>

      {/* Main Game Setup Card */}
      <div className="w-full pixel-wood-frame rounded-lg p-3.5 sm:p-6 shadow-2xl mb-5 sm:mb-6">
        
        {/* Step 1: Category Selector */}
        <div className="mb-4 sm:mb-5">
          <div className="mb-2">
            <span className="text-[10px] font-pixel-title text-[#ffe2a0] uppercase tracking-wider">
              1. Pick a Category
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Music */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectCategory('music');
              }}
              className={`relative pt-7 pb-2.5 px-1.5 sm:p-3 rounded flex flex-col items-center justify-center gap-1 pixel-btn cursor-pointer transition-all ${
                selectedCategory === 'music'
                  ? 'bg-[#4a1c59] border-2 border-[#d946ef] text-white shadow-[0_4px_0_#2b0c36] -translate-y-0.5'
                  : 'bg-[#291612] border-2 border-[#4d2817] text-[#edd1b0] hover:bg-[#381e18]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Music',
                  icon: '🎵',
                  subtitle: 'Albums & Singles',
                  description: 'Covers from iconic albums and hits — blurred just enough so words won\'t spoil it.',
                  rules: [
                    'Slide or type what year it dropped.',
                    'Name the artist, title, or both — nailing both gets top points.'
                  ]
                })}
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1.5 sm:p-1 bg-black/40 hover:bg-black/70 rounded-full text-purple-300 hover:text-white cursor-pointer z-10"
                title="Category Info"
                aria-label="Music category info"
              >
                <Info className="w-3 h-3" />
              </button>

              <span className="text-xl sm:text-2xl">🎵</span>
              <span className="font-pixel-title text-[10px] sm:text-xs">Music</span>
              <span className="text-[8px] sm:text-[9px] font-pixel-ui opacity-75 whitespace-nowrap">1950 - 2026</span>
            </div>

            {/* Books */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectCategory('books');
              }}
              className={`relative pt-7 pb-2.5 px-1.5 sm:p-3 rounded flex flex-col items-center justify-center gap-1 pixel-btn cursor-pointer transition-all ${
                selectedCategory === 'books'
                  ? 'bg-[#522b14] border-2 border-[#f59e0b] text-white shadow-[0_4px_0_#331808] -translate-y-0.5'
                  : 'bg-[#291612] border-2 border-[#4d2817] text-[#edd1b0] hover:bg-[#381e18]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Books',
                  icon: '📚',
                  subtitle: 'Classics & Bestsellers',
                  description: 'Famous book covers with spoiler title text swapped out.',
                  rules: [
                    'No zoom here — read the cover art, colors, and overall vibe.',
                    'Call the year it came out and name the book and author.'
                  ]
                })}
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1.5 sm:p-1 bg-black/40 hover:bg-black/70 rounded-full text-amber-300 hover:text-white cursor-pointer z-10"
                title="Category Info"
                aria-label="Books category info"
              >
                <Info className="w-3 h-3" />
              </button>

              <span className="text-xl sm:text-2xl">📚</span>
              <span className="font-pixel-title text-[10px] sm:text-xs flex items-center justify-center gap-1">
                <span>Books</span>
                <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 shrink-0" />
              </span>
              <span className="text-[8px] sm:text-[9px] font-pixel-ui opacity-75 whitespace-nowrap">1600 - 2026</span>
            </div>

            {/* Art */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectCategory('art');
              }}
              className={`relative pt-7 pb-2.5 px-1.5 sm:p-3 rounded flex flex-col items-center justify-center gap-1 pixel-btn cursor-pointer transition-all ${
                selectedCategory === 'art'
                  ? 'bg-[#4a3b12] border-2 border-[#eab308] text-white shadow-[0_4px_0_#2b2207] -translate-y-0.5'
                  : 'bg-[#291612] border-2 border-[#4d2817] text-[#edd1b0] hover:bg-[#381e18]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Art',
                  icon: '🎨',
                  subtitle: 'Famous Paintings',
                  description: 'Museum pieces you can actually zoom into and explore.',
                  rules: [
                    'Click or tap any painting to zoom and pinch-inspect brushwork.',
                    'Guess when it was painted plus the artist and title.'
                  ]
                })}
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1.5 sm:p-1 bg-black/40 hover:bg-black/70 rounded-full text-yellow-300 hover:text-white cursor-pointer z-10"
                title="Category Info"
                aria-label="Art category info"
              >
                <Info className="w-3 h-3" />
              </button>

              <span className="text-xl sm:text-2xl">🎨</span>
              <span className="font-pixel-title text-[10px] sm:text-xs">Art</span>
              <span className="text-[8px] sm:text-[9px] font-pixel-ui opacity-75 whitespace-nowrap">1400 - 2026</span>
            </div>

            {/* Everything (Wide full-span button below the 3 categories above) */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectCategory('everything');
              }}
              className={`col-span-3 relative px-3 sm:px-4 py-3 rounded flex items-center justify-center gap-2.5 sm:gap-3 pixel-btn cursor-pointer transition-all ${
                selectedCategory === 'everything'
                  ? 'bg-[#12453b] border-2 border-[#10b981] text-white shadow-[0_4px_0_#072620] -translate-y-0.5'
                  : 'bg-[#291612] border-2 border-[#4d2817] text-[#edd1b0] hover:bg-[#381e18]'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Everything Mix',
                  icon: '🎲',
                  subtitle: 'Total Wildcard',
                  description: 'Every round randomly pulls music, a book, or a painting.',
                  rules: [
                    'All three categories shuffled into one run.',
                    'Music and book covers stay pixelated; paintings stay zoomable.'
                  ]
                })}
                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 sm:p-1 bg-black/40 hover:bg-black/70 rounded-full text-emerald-300 hover:text-white cursor-pointer z-10"
                title="Category Info"
                aria-label="Everything Mix category info"
              >
                <Info className="w-3 h-3" />
              </button>

              <span className="text-2xl sm:text-3xl shrink-0">🎲</span>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5 text-left sm:text-left pr-8">
                <span className="font-pixel-title text-xs sm:text-sm">Everything</span>
                <span className="text-[9px] sm:text-[10px] font-pixel-ui opacity-80 leading-snug">
                  All Mixed • Random Music, Books &amp; Art
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Difficulty Level */}
        <div className="mb-4 sm:mb-5">
          <div className="mb-2">
            <span className="text-[10px] font-pixel-title text-[#ffe2a0] uppercase tracking-wider">
              2. Difficulty
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {/* EASY */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectDifficulty('easy');
              }}
              className={`relative pt-6 pb-2 px-1 sm:py-2.5 sm:px-2 text-center rounded pixel-btn cursor-pointer ${
                difficulty === 'easy'
                  ? 'bg-[#1b431f] border-2 border-[#4ade80] text-emerald-200 font-bold'
                  : 'bg-[#1e110a] border-2 border-[#3d2012] text-stone-400 hover:text-white'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Easy Mode',
                  icon: '🌱',
                  subtitle: 'Chill Warmup',
                  description: 'Pick from 4 multiple-choice answers instead of typing from scratch.',
                  rules: [
                    'Choose the year and work from 4 options.',
                    'Super forgiving if your year guess is a bit off.'
                  ]
                })}
                className="absolute top-1 right-1 p-1 sm:p-0.5 bg-black/40 hover:bg-black/70 rounded-full text-emerald-300 z-10"
                aria-label="Easy difficulty info"
              >
                <Info className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
              </button>
              <div className="font-pixel-title text-[9px] sm:text-[10px] whitespace-nowrap">🌱 EASY</div>
              <div className="text-[8px] font-pixel-ui opacity-75 leading-tight mt-0.5">4 Choices • Chill</div>
            </div>

            {/* NORMAL */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectDifficulty('normal');
              }}
              className={`relative pt-6 pb-2 px-1 sm:py-2.5 sm:px-2 text-center rounded pixel-btn cursor-pointer ${
                difficulty === 'normal'
                  ? 'bg-[#4a3311] border-2 border-[#f59e0b] text-amber-200 font-bold'
                  : 'bg-[#1e110a] border-2 border-[#3d2012] text-stone-400 hover:text-white'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Normal Mode',
                  icon: '🌾',
                  subtitle: 'Standard Challenge',
                  description: 'How the game is meant to be played — no choices, just your memory plus a lifeline.',
                  rules: [
                    'Slide or type the year, then search/type the title and creator.',
                    'Year guesses are scored tighter than Easy.',
                    '1 free hint per run — need more? Watch a quick goofy ad.'
                  ]
                })}
                className="absolute top-1 right-1 p-1 sm:p-0.5 bg-black/40 hover:bg-black/70 rounded-full text-amber-300 z-10"
                aria-label="Normal difficulty info"
              >
                <Info className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
              </button>
              <div className="font-pixel-title text-[9px] sm:text-[10px] whitespace-nowrap">🌾 NORMAL</div>
              <div className="text-[8px] font-pixel-ui opacity-75 leading-tight mt-0.5">Type It • 1 Hint</div>
            </div>

            {/* HARD */}
            <div
              onClick={() => {
                sounds.playClick();
                onSelectDifficulty('hard');
              }}
              className={`relative pt-6 pb-2 px-1 sm:py-2.5 sm:px-2 text-center rounded pixel-btn cursor-pointer ${
                difficulty === 'hard'
                  ? 'bg-[#4a1515] border-2 border-[#f87171] text-rose-200 font-bold'
                  : 'bg-[#1e110a] border-2 border-[#3d2012] text-stone-400 hover:text-white'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Hard Mode',
                  icon: '⚔️',
                  subtitle: 'Pure Memory',
                  description: 'Zero help, strict year window, no mercy for vague guesses.',
                  rules: [
                    'Your year has to be really close or you get nothing.',
                    'No partial credit for half-remembered names.',
                    'Zero hints and no autocomplete in any category.'
                  ]
                })}
                className="absolute top-1 right-1 p-1 sm:p-0.5 bg-black/40 hover:bg-black/70 rounded-full text-rose-300 z-10"
                aria-label="Hard difficulty info"
              >
                <Info className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
              </button>
              <div className="font-pixel-title text-[9px] sm:text-[10px] whitespace-nowrap">⚔️ HARD</div>
              <div className="text-[8px] font-pixel-ui opacity-75 leading-tight mt-0.5">No Mercy • Zero Help</div>
            </div>
          </div>
        </div>

        {/* Step 3: Game Mode */}
        <div>
          <div className="mb-2">
            <span className="text-[10px] font-pixel-title text-[#ffe2a0] uppercase tracking-wider">
              3. Game Mode
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              onClick={() => {
                sounds.playClick();
                onSelectMode('classic');
              }}
              className={`relative pt-6 pb-2.5 px-2 sm:py-2.5 sm:px-3 sm:pr-7 rounded flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 pixel-btn cursor-pointer ${
                gameMode === 'classic'
                  ? 'bg-[#824419] border-2 border-[#e6a86c] text-[#ffeec9] font-bold'
                  : 'bg-[#1e110a] border-2 border-[#3d2012] text-stone-400 hover:text-white'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Classic Mode',
                  icon: '🏆',
                  subtitle: '5 Rounds',
                  description: 'A quick 5-round run. Stack points and beat your best score.',
                  rules: [
                    'Play 5 rounds back-to-back.',
                    'Get graded on how close your year was and whether you nailed the work.'
                  ]
                })}
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1 sm:p-0.5 bg-black/40 hover:bg-black/70 rounded-full text-amber-300 z-10"
                aria-label="Classic mode info"
              >
                <Info className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
              </button>
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-pixel-title text-[9px] sm:text-[10px] text-center">Classic (5 Rnds)</span>
            </div>

            <div
              onClick={() => {
                sounds.playClick();
                onSelectMode('forever');
              }}
              className={`relative pt-6 pb-2.5 px-2 sm:py-2.5 sm:px-3 sm:pr-7 rounded flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 pixel-btn cursor-pointer ${
                gameMode === 'forever'
                  ? 'bg-[#821919] border-2 border-[#e66c6c] text-[#ffeec9] font-bold'
                  : 'bg-[#1e110a] border-2 border-[#3d2012] text-stone-400 hover:text-white'
              }`}
            >
              <button
                type="button"
                onClick={(e) => openInfo(e, {
                  title: 'Forever Survival',
                  icon: '❤️',
                  subtitle: 'Play Until You Drop',
                  description: 'Endless run where misses drain your health — nail rounds cleanly to heal back up.',
                  rules: [
                    'Start with 100 HP.',
                    'Big misses chip your health; clutch calls restore HP.',
                    'Survive as many rounds as possible!'
                  ]
                })}
                className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 p-1 sm:p-0.5 bg-black/40 hover:bg-black/70 rounded-full text-rose-300 z-10"
                aria-label="Forever mode info"
              >
                <Info className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
              </button>
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-current shrink-0" />
              <span className="font-pixel-title text-[9px] sm:text-[10px] text-center">Forever (100 HP)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center flex-wrap gap-2.5 sm:gap-3 w-full sm:w-auto">
        <button
          onClick={() => {
            sounds.playCoin();
            onStartGame();
          }}
          className="w-full sm:w-auto px-10 py-3.5 sm:py-4 bg-[#5c993d] hover:bg-[#6ab346] border-4 border-[#2b4c1a] font-pixel-title text-base sm:text-lg text-white rounded pixel-btn shadow-2xl cursor-pointer flex items-center justify-center gap-2 tracking-wider"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>PLAY NOW</span>
        </button>

        <button
          onClick={() => {
            sounds.playCoin();
            onOpenMultiplayer();
          }}
          className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-[#7b3d17] hover:bg-[#934a1d] border-4 border-[#431e08] font-pixel-title text-xs sm:text-sm text-[#ffe599] hover:text-white rounded pixel-btn shadow-xl cursor-pointer flex items-center justify-center gap-2"
        >
          <Swords className="w-4 h-4 text-amber-300" />
          <span>MULTIPLAYER</span>
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            onOpenHelp();
          }}
          className="w-full sm:w-auto px-5 py-3.5 sm:py-4 bg-[#2b170c] hover:bg-[#3d2012] border-2 border-[#542813] text-[#eed0ae] font-pixel-ui text-xs rounded pixel-btn cursor-pointer flex items-center justify-center gap-1.5"
        >
          <HelpCircle className="w-4 h-4" />
          <span>How to Play</span>
        </button>
      </div>

      {/* Information Box Modal */}
      {activeInfo && (
        <InfoModal
          isOpen={Boolean(activeInfo)}
          onClose={() => setActiveInfo(null)}
          title={activeInfo.title}
          icon={activeInfo.icon}
          subtitle={activeInfo.subtitle}
        >
          <p className="mb-2 text-stone-200">{activeInfo.description}</p>
          <div className="bg-[#1b0d06] p-2.5 rounded border border-[#522b13] space-y-1 text-[11px]">
            <strong className="font-pixel-title text-[9px] text-[#fcd34d] block mb-1">
              KEY RULES:
            </strong>
            {activeInfo.rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-stone-300">
                <span className="text-amber-400 shrink-0">•</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

    </div>
  );
};
