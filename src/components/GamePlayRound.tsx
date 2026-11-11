import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Category, CulturalItem, RoundGuess, Difficulty } from '../types';
import { CATEGORY_THEMES } from '../config/themes';
import { 
  ZoomIn, HelpCircle, ChevronsLeft, ChevronsRight, 
  Check, Tv, X, Lock, Swords, Copy
} from 'lucide-react';
import { sounds } from '../services/sound';
import { MultiplayerChallenge, buildChallengeUrl, copyToClipboard } from '../services/multiplayer';
import {
  getLocalSuggestions,
  searchWikipediaTitles,
  getActiveSuggestionSegment,
  hasEnoughQueryForSuggestions,
  AutocompleteOption,
} from '../services/wikipedia';
import {
  generateEasyOptions,
  generateQuirkyHint,
  EasyDistractorSource,
} from '../services/choices';
import { ImageZoomModal } from './ImageZoomModal';
import { BookCoverMask } from './BookCoverMask';
import { PixelCover } from './PixelCover';
import { RetroAdModal } from './RetroAdModal';

interface GamePlayRoundProps {
  item: CulturalItem;
  gameCategory?: Category;
  difficulty: Difficulty;
  hintTokens: number;
  onUseHint: () => void;
  onSubmitGuess: (guess: RoundGuess) => void;
  allItems: CulturalItem[];
  easyLivePool?: EasyDistractorSource[];
  fallbackCatalogItems?: CulturalItem[];
  challenge?: MultiplayerChallenge | null;
  roundIndex?: number;
}

export const GamePlayRound: React.FC<GamePlayRoundProps> = ({
  item,
  gameCategory,
  difficulty,
  hintTokens,
  onUseHint,
  onSubmitGuess,
  allItems,
  easyLivePool,
  fallbackCatalogItems,
  challenge,
  roundIndex,
}) => {
  const theme = CATEGORY_THEMES[item.category];
  const [minYear, maxYear] = theme.yearRange;
  const defaultYear = item.category === 'music' ? 1980 : item.category === 'books' ? 1920 : 1800;

  // Easy mode choices computed once per round item & difficulty (never resets mid-round!)
  const easyOptions = useMemo(() => {
    if (difficulty !== 'easy') return null;
    const easySeed =
      challenge && typeof roundIndex === 'number'
        ? `${challenge.id}:easy:${roundIndex}`
        : undefined;
    const primaryPool: EasyDistractorSource[] = challenge
      ? [
          ...(challenge.distractors || []),
          ...(challenge.manifest || []),
          ...(easyLivePool || []),
        ]
      : easyLivePool || [];
    return generateEasyOptions(item, primaryPool, easySeed, fallbackCatalogItems || []);
  }, [item, difficulty, easyLivePool, fallbackCatalogItems, challenge, roundIndex]);

  const initialYear = difficulty === 'easy' && easyOptions ? easyOptions.years[0] : defaultYear;

  // Selected State
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [yearInputText, setYearInputText] = useState<string>(String(initialYear));
  const [typedGuess, setTypedGuess] = useState<string>('');
  const [selectedEasyId, setSelectedEasyId] = useState<string>('');
  
  // Hint State (strictly isolated per mounted round!)
  const [hasUsedHintInRound, setHasUsedHintInRound] = useState<boolean>(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState<boolean>(false);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [copiedChallengeLink, setCopiedChallengeLink] = useState<boolean>(false);
  const [wikiMatchState, setWikiMatchState] = useState<{
    query: string;
    options: AutocompleteOption[];
  }>({ query: '', options: [] });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const suppressAutoOpenRef = useRef<boolean>(false);
  const suggestionCategory = gameCategory ?? item.category;
  const suggestionSegment = useMemo(
    () => getActiveSuggestionSegment(typedGuess).segment,
    [typedGuess]
  );
  const queryCanSuggest = useMemo(
    () => difficulty === 'normal' && hasEnoughQueryForSuggestions(suggestionSegment),
    [difficulty, suggestionSegment]
  );

  const localSuggestions = useMemo(() => {
    if (!queryCanSuggest) return [];
    return getLocalSuggestions(suggestionCategory, suggestionSegment, allItems);
  }, [queryCanSuggest, suggestionCategory, suggestionSegment, allItems]);

  const suggestions = useMemo(() => {
    if (!queryCanSuggest) return [];
    const normalizedSeg = suggestionSegment.trim().toLowerCase();
    const activeWiki =
      wikiMatchState.query === normalizedSeg ? wikiMatchState.options : [];
    const dedupedWiki = activeWiki.filter(
      w => !localSuggestions.some(lm => lm.label.toLowerCase() === w.label.toLowerCase())
    );
    return [...localSuggestions.slice(0, 4), ...dedupedWiki].slice(0, 7);
  }, [queryCanSuggest, suggestionSegment, wikiMatchState, localSuggestions]);

  // Debounced Wikipedia OpenSearch fetch (only when typed query satisfies anti-spoiler threshold)
  useEffect(() => {
    if (!queryCanSuggest) return;

    const normalizedSeg = suggestionSegment.trim().toLowerCase();
    const controller = new AbortController();
    const wikiTimer = setTimeout(() => {
      searchWikipediaTitles(suggestionSegment, 4, controller.signal).then(wikiTitles => {
        if (controller.signal.aborted) return;
        const wikiOptions: AutocompleteOption[] = wikiTitles.map(t => ({
          label: t,
          secondary: 'Wiki Match',
          type: 'wiki' as const,
        }));
        setWikiMatchState({ query: normalizedSeg, options: wikiOptions });
        if (!suppressAutoOpenRef.current && wikiOptions.length > 0) {
          setIsDropdownOpen(true);
        }
      });
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(wikiTimer);
    };
  }, [queryCanSuggest, suggestionSegment]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adjustYear = (delta: number) => {
    sounds.playTick();
    const nextYear = Math.max(minYear, Math.min(maxYear, selectedYear + delta));
    setSelectedYear(nextYear);
    setYearInputText(String(nextYear));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setSelectedYear(val);
    setYearInputText(String(val));
    sounds.playTick();
  };

  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearInputText(digits);

    if (digits.length > 0) {
      const parsed = parseInt(digits, 10);
      if (!Number.isNaN(parsed) && parsed >= minYear && parsed <= maxYear) {
        setSelectedYear(parsed);
      }
    }
  };

  const commitTypedYear = (): number => {
    const parsed = parseInt(yearInputText, 10);
    if (Number.isNaN(parsed)) {
      setYearInputText(String(selectedYear));
      return selectedYear;
    }
    const clamped = Math.max(minYear, Math.min(maxYear, parsed));
    setSelectedYear(clamped);
    setYearInputText(String(clamped));
    return clamped;
  };

  const parsedTypedPreview = parseInt(yearInputText, 10);
  const displaySubmitYear =
    difficulty !== 'easy' &&
    !Number.isNaN(parsedTypedPreview) &&
    yearInputText.length === 4
      ? Math.max(minYear, Math.min(maxYear, parsedTypedPreview))
      : selectedYear;

  const handleUseFreeHint = () => {
    if (difficulty !== 'normal' || hasUsedHintInRound || hintTokens <= 0) return;
    sounds.playCoin();
    onUseHint();
    setHasUsedHintInRound(true);
  };

  const handleOpenAdForHint = () => {
    if (difficulty !== 'normal' || hasUsedHintInRound) return;
    sounds.playClick();
    setIsAdModalOpen(true);
  };

  const handleAdCompleted = () => {
    // Only unlocks the hint for THIS round; future rounds still require another ad!
    setHasUsedHintInRound(true);
  };

  const quirkyHints = generateQuirkyHint(item);

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sounds.playClick();

    const finalYear = difficulty === 'easy' ? selectedYear : commitTypedYear();
    const finalGuessText = difficulty === 'easy' ? selectedEasyId : typedGuess.trim();

    onSubmitGuess({
      yearGuess: finalYear,
      rawGuess: finalGuessText,
      hintsUsed: hasUsedHintInRound ? 1 : 0,
      isEasyChoice: difficulty === 'easy',
    });
  };

  return (
    <div className="w-full flex-1 max-w-4xl mx-auto px-4 py-4 flex flex-col items-center relative z-10 select-none">
      
      {/* Clean Category Badge & Hint Action */}
      <div className="w-full flex items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 bg-[#2b1408] border-2 border-[#804a23] rounded text-[#ffe2a0] font-pixel-title text-[9px]">
            {gameCategory === 'everything'
              ? `🎲 EVERYTHING • ${item.category.toUpperCase()}`
              : item.category.toUpperCase()}
          </span>

          {challenge && (
            <button
              type="button"
              onClick={() => {
                sounds.playCoin();
                copyToClipboard(buildChallengeUrl(challenge)).then(() => {
                  setCopiedChallengeLink(true);
                  setTimeout(() => setCopiedChallengeLink(false), 2000);
                });
              }}
              title="Copy Multiplayer Room Link"
              className="flex items-center gap-1 px-2 py-1 bg-[#431f0a] hover:bg-[#5c2c0e] border border-[#b4692c] rounded text-[#fcd34d] font-pixel-title text-[8px] pixel-btn cursor-pointer"
            >
              <Swords className="w-3 h-3 text-amber-300" />
              <span>#{challenge.id}</span>
              {copiedChallengeLink ? (
                <span className="text-emerald-300 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Copied
                </span>
              ) : (
                <span className="text-amber-200/90 flex items-center gap-0.5">
                  <Copy className="w-2.5 h-2.5" /> Link
                </span>
              )}
            </button>
          )}
        </div>

        {/* Hints Button */}
        {difficulty === 'hard' ? (
          <span className="text-[9px] font-pixel-ui text-rose-400 bg-rose-950/80 px-2 py-1 border border-rose-700 rounded">
            ⚔️ No Hints
          </span>
        ) : difficulty === 'easy' ? (
          <span className="text-[9px] font-pixel-ui text-emerald-300 bg-emerald-950/80 px-2 py-1 border border-emerald-700 rounded">
            🌱 4 Options Mode
          </span>
        ) : hasUsedHintInRound ? (
          <span className="flex items-center gap-1 text-[9px] font-pixel-ui text-stone-400 bg-[#241107] px-2 py-1 border border-[#522b13] rounded">
            <Lock className="w-3 h-3 text-amber-500" />
            <span>Hint Used (Max 1)</span>
          </span>
        ) : hintTokens > 0 ? (
          <button
            onClick={handleUseFreeHint}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-700 hover:bg-amber-600 border border-amber-950 text-white font-pixel-title text-[9px] rounded pixel-btn cursor-pointer"
          >
            <HelpCircle className="w-3 h-3 text-amber-200" />
            <span>FREE HINT (1 Left)</span>
          </button>
        ) : (
          <button
            onClick={handleOpenAdForHint}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-700 hover:bg-purple-600 border border-purple-950 text-white font-pixel-title text-[9px] rounded pixel-btn cursor-pointer"
          >
            <Tv className="w-3 h-3 text-purple-200 animate-pulse" />
            <span>WATCH AD FOR HINT</span>
          </button>
        )}
      </div>

      {/* Clue Banner */}
      {hasUsedHintInRound && (
        <div className="w-full pixel-parchment rounded p-2.5 mb-3 shadow text-[#3d2010] text-xs font-pixel-body animate-fadeIn">
          <div><strong className="font-pixel-title text-[9px] text-amber-900">🌾 Clue:</strong> {quirkyHints.riddle}</div>
          <div className="mt-1 font-mono font-bold text-[#5c2409]"><strong className="font-pixel-title text-[9px] text-purple-900">🪶 Mask:</strong> {quirkyHints.initials}</div>
        </div>
      )}

      {/* Main Grid: Clean, Centered & Less Overwhelming */}
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        
        {/* ================= ARTIFACT IMAGE ================= */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-[280px] sm:max-w-[300px] flex items-center justify-center">
            
            {/* MUSIC (Pixelated Cover, NOT clickable!) */}
            {item.category === 'music' && (
              <div className="w-full aspect-square rounded p-2 bg-[#241135] border-4 border-[#5b2b64] shadow-2xl select-none cursor-default relative overflow-hidden">
                <PixelCover
                  imageUrl={item.image}
                  altText={item.title}
                  pixelWidth={34}
                  placeholderIcon="🎵"
                  placeholderBgClass="bg-[#180b24]"
                />
                <BookCoverMask isRevealed={false} />
              </div>
            )}

            {/* BOOKS (Pixelated Cover, NOT clickable!) */}
            {item.category === 'books' && (
              <div className="w-full aspect-[3/4] rounded p-2 bg-[#2b160b] border-4 border-[#613318] shadow-2xl select-none cursor-default relative overflow-hidden">
                <PixelCover
                  imageUrl={item.image}
                  altText={item.title}
                  pixelWidth={34}
                />
                <BookCoverMask isRevealed={false} />
              </div>
            )}

            {/* ART */}
            {item.category === 'art' && (
              <div 
                className="w-full aspect-[4/3] rounded p-2 bg-[#231b10] border-4 border-[#664e1c] shadow-2xl cursor-pointer"
                onClick={() => setIsZoomOpen(true)}
              >
                <img
                  src={item.image}
                  alt="Art Painting"
                  className="w-full h-full object-contain rounded shadow"
                />
              </div>
            )}

          </div>

          {/* Picture Subtitle (Art only) */}
          {item.category === 'art' && (
            <button
              onClick={() => setIsZoomOpen(true)}
              className="mt-1.5 text-[9px] font-pixel-ui text-amber-300/80 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ZoomIn className="w-3 h-3" />
              <span>Click to zoom</span>
            </button>
          )}
        </div>

        {/* ================= GUESS CONTROLS ================= */}
        <div className="md:col-span-7 flex flex-col gap-3.5">

          {/* 1. YEAR GUESS */}
          <div className="pixel-wood-frame rounded p-3.5 shadow">
            <div className="flex justify-between items-center mb-1.5 font-pixel-title text-[9px] text-[#ffe599]">
              <span>1. GUESS THE YEAR</span>
              <span className="text-amber-400 font-pixel-ui">{minYear} - {maxYear}</span>
            </div>

            {/* Easy mode 4 year buttons */}
            {difficulty === 'easy' && easyOptions ? (
              <div className="grid grid-cols-4 gap-1.5 my-1">
                {easyOptions.years.map(yr => (
                  <button
                    key={yr}
                    onClick={() => {
                      sounds.playTick();
                      setSelectedYear(yr);
                    }}
                    className={`py-2 px-1 rounded font-pixel-title text-xs pixel-btn cursor-pointer ${
                      selectedYear === yr
                        ? 'bg-[#5c993d] border-2 border-[#97e072] text-white shadow font-bold'
                        : 'bg-[#29160d] border border-[#542813] text-[#ffe2a0] hover:bg-[#3d2012]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            ) : (
              /* Normal & Hard: Slider */
              <>
                <div className="flex items-center justify-center gap-2 py-1">
                  <button
                    onClick={() => adjustYear(-10)}
                    className="p-1 px-2 bg-[#29160d] hover:bg-[#3d2012] border border-[#542813] text-amber-300 rounded pixel-btn cursor-pointer"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => adjustYear(-1)}
                    className="p-1 px-2.5 bg-[#29160d] hover:bg-[#3d2012] border border-[#542813] text-amber-300 font-pixel-title text-xs rounded pixel-btn cursor-pointer"
                  >
                    -1
                  </button>

                  <div className="px-2 py-1 bg-[#170a04] border-2 border-[#e8a34d] focus-within:border-[#fde047] rounded min-w-[116px] text-center shadow-inner">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Type release year"
                      title={`Type a year (${minYear}-${maxYear})`}
                      value={yearInputText}
                      onChange={handleYearInputChange}
                      onBlur={commitTypedYear}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitTypedYear();
                          e.currentTarget.blur();
                        }
                      }}
                      maxLength={4}
                      className="w-24 bg-transparent text-center font-pixel-title text-xl text-[#fcd34d] focus:outline-none tabular-nums"
                    />
                    <div className="text-[8px] font-pixel-ui text-[#b88c60] -mt-0.5">
                      type or slide
                    </div>
                  </div>

                  <button
                    onClick={() => adjustYear(1)}
                    className="p-1 px-2.5 bg-[#29160d] hover:bg-[#3d2012] border border-[#542813] text-amber-300 font-pixel-title text-xs rounded pixel-btn cursor-pointer"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjustYear(10)}
                    className="p-1 px-2 bg-[#29160d] hover:bg-[#3d2012] border border-[#542813] text-amber-300 rounded pixel-btn cursor-pointer"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  value={selectedYear}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-[#170a04] rounded appearance-none cursor-pointer accent-amber-500 border border-[#542813] mt-2"
                />
              </>
            )}
          </div>

          {/* 2. TITLE / ARTIST GUESS */}
          <div className="pixel-wood-frame rounded p-3.5 shadow" ref={searchContainerRef}>
            <div className="font-pixel-title text-[9px] text-[#ffe599] mb-1.5">
              2. GUESS {theme.creatorLabel.toUpperCase()} / TITLE
            </div>

            {/* Easy mode 4 cards */}
            {difficulty === 'easy' && easyOptions ? (
              <div className="grid grid-cols-2 gap-1.5 my-1">
                {easyOptions.identifications.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      sounds.playTick();
                      setSelectedEasyId(opt.label);
                    }}
                    className={`p-2 rounded text-left pixel-btn cursor-pointer flex flex-col justify-between ${
                      selectedEasyId === opt.label
                        ? 'bg-[#5c993d] border-2 border-[#97e072] text-white shadow'
                        : 'bg-[#29160d] border border-[#542813] text-[#ffe2a0] hover:bg-[#3d2012]'
                    }`}
                  >
                    <div className="font-pixel-title text-[10px] leading-snug truncate">
                      {opt.title}
                    </div>
                    <div className="text-[8px] font-pixel-ui opacity-75 truncate">
                      by {opt.creator}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Normal & Hard: Search Input */
              <div className="relative">
                <input
                  type="text"
                  value={typedGuess}
                  autoComplete="off"
                  onChange={e => {
                    const nextVal = e.target.value;
                    suppressAutoOpenRef.current = false;
                    setTypedGuess(nextVal);
                    const { segment } = getActiveSuggestionSegment(nextVal);
                    setIsDropdownOpen(difficulty === 'normal' && hasEnoughQueryForSuggestions(segment));
                  }}
                  onFocus={() => {
                    if (difficulty === 'normal' && suggestions.length > 0) setIsDropdownOpen(true);
                  }}
                  placeholder={
                    difficulty === 'hard'
                      ? `Type from memory: Title, ${theme.creatorLabel}, or both...`
                      : `Type Title, ${theme.creatorLabel}, or both...`
                  }
                  className="w-full px-3 py-2 rounded bg-[#170a04] border-2 border-[#542813] text-amber-100 placeholder-[#8c603a] font-pixel-body text-xs focus:outline-none focus:border-amber-400"
                />

                {typedGuess && (
                  <button
                    onClick={() => {
                      suppressAutoOpenRef.current = false;
                      setTypedGuess('');
                      setIsDropdownOpen(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-amber-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Suggestions Dropdown (Normal mode only; disabled completely in Hard mode) */}
                {difficulty === 'normal' && isDropdownOpen && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-[#261309] border-2 border-[#542813] rounded shadow-2xl max-h-40 overflow-y-auto z-30 py-0.5 divide-y divide-[#3d2012]">
                    {suggestions.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          sounds.playClick();
                          const { prefix } = getActiveSuggestionSegment(typedGuess);
                          suppressAutoOpenRef.current = true;
                          setTypedGuess(prefix + opt.label);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1 hover:bg-[#3d2012] flex items-center justify-between text-xs font-pixel-body cursor-pointer"
                      >
                        <span className="font-bold text-[#ffe2a0] truncate mr-2">{opt.label}</span>
                        {opt.secondary && (
                          <span className="text-[8px] font-pixel-ui text-[#b88c60] shrink-0">{opt.secondary}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. SUBMIT BUTTON */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 bg-[#be2e2e] hover:bg-[#d63a3a] border-4 border-[#570f0f] font-pixel-title text-sm text-white rounded pixel-btn shadow-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>SUBMIT GUESS ({displaySubmitYear})</span>
          </button>

        </div>

      </div>

      {/* Lightbox Modal (Art only) */}
      {item.category === 'art' && (
        <ImageZoomModal
          isOpen={isZoomOpen}
          onClose={() => setIsZoomOpen(false)}
          imageUrl={item.highResImage || item.image}
          altText={item.title}
          category={item.category}
        />
      )}

      {/* Retro 30s Ad Modal */}
      {isAdModalOpen && (
        <RetroAdModal
          isOpen={isAdModalOpen}
          onClose={() => setIsAdModalOpen(false)}
          onAdCompleted={handleAdCompleted}
        />
      )}

    </div>
  );
};
