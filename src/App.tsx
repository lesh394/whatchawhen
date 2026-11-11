import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, GameMode, Difficulty, GamePhase, CulturalItem, RoundGuess, RoundResult } from './types';
import { CATEGORY_THEMES } from './config/themes';
import { CULTURAL_ITEMS } from './data/items';
import {
  buildMultiplayerLiveRoomPool,
  checkLiveDistractorSeen,
  extractNormalizedImageKey,
  getLivePoolDistractors,
  getNextLiveRoundItem,
  getQueuedLiveOptionKeys,
  getSeededChallengeRoundItem,
  hydrateMultiplayerChallenge,
  prewarmLiveQueues,
  recordSeenWork,
  toCanonicalWorkKey,
} from './services/liveWikipediaEngine';
import { getAllKnownItems } from './services/infinitePool';
import { toEasyOptionKey } from './services/choices';
import { evaluateRound } from './services/scoring';
import { fetchWikiSummary } from './services/wikipedia';
import { sounds } from './services/sound';
import {
  MultiplayerChallenge,
  MultiplayerScoreSummary,
  generateChallengeId,
  parseChallengeFromLocation,
  buildChallengeUrl,
  clearChallengeFromUrl,
  loadRoomRunSnapshot,
} from './services/multiplayer';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { GamePlayRound } from './components/GamePlayRound';
import { RoundRevealModal } from './components/RoundRevealModal';
import { GameOverScreen } from './components/GameOverScreen';
import { HelpModal } from './components/HelpModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { PixelDecorations } from './components/PixelDecorations';

export function App() {
  const [initialInvite] = useState(() => parseChallengeFromLocation());

  // Category & Difficulty & GameMode
  const [category, setCategory] = useState<Category>(
    () => initialInvite?.challenge.category ?? 'music'
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => initialInvite?.challenge.difficulty ?? 'normal'
  );
  const [gameMode, setGameMode] = useState<GameMode>(
    () => initialInvite?.challenge.gameMode ?? 'classic'
  );
  const [gamePhase, setGamePhase] = useState<GamePhase>('home');

  // Multiplayer Challenge State
  const [activeChallenge, setActiveChallenge] = useState<MultiplayerChallenge | null>(
    () => initialInvite?.challenge ?? null
  );
  const [draftChallenge, setDraftChallenge] = useState<MultiplayerChallenge>(
    () =>
      initialInvite?.challenge ?? {
        id: generateChallengeId(),
        category: 'music',
        difficulty: 'normal',
        gameMode: 'classic',
        hostName: 'Player 1',
      }
  );
  const [challengeModal, setChallengeModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'join';
  }>(() => ({
    isOpen: Boolean(initialInvite),
    mode: initialInvite ? 'join' : 'create',
  }));
  const [challengePlayerName, setChallengePlayerName] = useState<string>(() =>
    initialInvite
      ? `Player ${(initialInvite.opponentResults?.length || 0) + 2}`
      : 'Player 1'
  );
  const [opponentResultsFromUrl, setOpponentResultsFromUrl] = useState<
    MultiplayerScoreSummary[]
  >(() => initialInvite?.opponentResults ?? []);
  const [isGeneratingRoom, setIsGeneratingRoom] = useState<boolean>(false);

  // Cached hydrated items for the current/draft Multiplayer manifest
  const hydratedManifestRef = useRef<{ challengeId: string; items: CulturalItem[] }>({
    challengeId: '',
    items: [],
  });
  const roomGenSeqRef = useRef<number>(0);

  // Match State
  const [roundItems, setRoundItems] = useState<CulturalItem[]>([]);
  const [roundIndex, setRoundIndex] = useState<number>(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [latestResult, setLatestResult] = useState<RoundResult | null>(null);
  const [isLoadingLiveItem, setIsLoadingLiveItem] = useState<boolean>(false);

  // Perfect Bullseye Streak Counter
  const [streakMultiplier, setStreakMultiplier] = useState<number>(0);

  // Anti-Recycle tracker: prevents items from repeating across solo runs & new rooms
  const seenItemIdsRef = useRef<Set<string>>(new Set());
  const playedQuestionKeysRef = useRef<Set<string>>(new Set());
  const [, setSeenItemIds] = useState<Set<string>>(new Set());
  const isAdvancingRoundRef = useRef<boolean>(false);

  const trackPlayedItem = (item: CulturalItem) => {
    recordSeenWork(item);
    seenItemIdsRef.current.add(item.id);
    if (item.wikiSlug) {
      seenItemIdsRef.current.add(item.wikiSlug);
      seenItemIdsRef.current.add(item.wikiSlug.toLowerCase());
    }
    if (item.wikiPageId && item.wikiPageId > 0) {
      seenItemIdsRef.current.add(`pid:${item.wikiPageId}`);
    }
    const imgKey = extractNormalizedImageKey(item.image || item.highResImage);
    if (imgKey) {
      seenItemIdsRef.current.add(imgKey);
    }
    seenItemIdsRef.current.add(toCanonicalWorkKey(item.category, item.title, item.creator));
    playedQuestionKeysRef.current.add(toEasyOptionKey(item.title, item.creator));
    setSeenItemIds(new Set(seenItemIdsRef.current));
  };

  // Hints: 1 hint token for the entire match/level by default
  const [hintTokens, setHintTokens] = useState<number>(1);

  // Forever Survival Mode State
  const [currentHp, setCurrentHp] = useState<number>(100);

  // Track Easy choices shown across rounds/games in Solo so distractors never repeat
  const easyUsedCountsRef = useRef<Record<string, number>>({});
  const [easyUsedCounts, setEasyUsedCounts] = useState<Record<string, number>>({});

  // Audio & Modals
  const [isMuted, setIsMuted] = useState<boolean>(() => sounds.getMuted());
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // High Scores & Forever Streaks in localStorage
  const [highScores, setHighScores] = useState<Record<Category, number>>(() => {
    const defaults: Record<Category, number> = { music: 0, books: 0, art: 0, everything: 0 };
    try {
      const saved = localStorage.getItem('whatchawhen_highscores');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  const [foreverStreaks, setForeverStreaks] = useState<Record<Category, number>>(() => {
    const defaults: Record<Category, number> = { music: 0, books: 0, art: 0, everything: 0 };
    try {
      const saved = localStorage.getItem('whatchawhen_forever_streaks');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Prewarm Wikipedia live queues + distractor pools sequentially, prioritizing active category
  useEffect(() => {
    if (gamePhase === 'home') {
      prewarmLiveQueues(category);
    }
  }, [category, gamePhase]);

  const totalRounds = gameMode === 'classic' ? 5 : 999;
  const currentScore = results.reduce((sum, r) => sum + r.totalPoints, 0);
  const theme = CATEGORY_THEMES[category];
  const knownItems = useMemo(() => getAllKnownItems(), []);
  const currentRoundItem = roundItems[roundIndex];

  // Snapshot live pool distractors per round item so Easy options stay stable mid-round
  // while originating purely from unused random live Wikipedia works (never round Questions)
  const easyLivePool = useMemo(() => {
    if (activeChallenge) return [];
    return getLivePoolDistractors(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoundItem?.id, category, activeChallenge?.id, roundItems.length]);

  const soloExcludeOptionKeys = useMemo(() => {
    if (activeChallenge) return undefined;
    const excluded = new Set<string>(playedQuestionKeysRef.current);
    for (const key of getQueuedLiveOptionKeys(category)) {
      excluded.add(key);
    }
    return excluded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoundItem?.id, category, activeChallenge?.id, roundItems.length]);

  const priorRoundItems = useMemo(
    () => roundItems.slice(0, roundIndex),
    [roundItems, roundIndex]
  );

  const autocompleteItems = useMemo(() => {
    const liveBank = getLivePoolDistractors(category);
    return [...liveBank, ...roundItems, ...knownItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoundItem?.id, category, knownItems, roundItems.length]);

  const savedRoomSnapshot = useMemo(() => {
    if (!challengeModal.isOpen || challengeModal.mode !== 'join') return null;
    return loadRoomRunSnapshot(draftChallenge.id);
  }, [challengeModal.isOpen, challengeModal.mode, draftChallenge.id]);

  // Generate fresh live Wikipedia room manifest for Multiplayer creation/reroll
  const generateLiveMultiplayerDraft = async (
    targetCat: Category,
    targetDiff: Difficulty,
    targetMode: GameMode,
    hostName: string
  ) => {
    const seq = ++roomGenSeqRef.current;
    const newId = generateChallengeId();
    setIsGeneratingRoom(true);
    setDraftChallenge({
      id: newId,
      category: targetCat,
      difficulty: targetDiff,
      gameMode: targetMode,
      hostName,
    });

    try {
      const { manifest, distractors, hydratedItems } = await buildMultiplayerLiveRoomPool(
        targetCat,
        targetMode
      );
      if (roomGenSeqRef.current !== seq) return;

      hydratedManifestRef.current = {
        challengeId: newId,
        items: hydratedItems,
      };
      setDraftChallenge(prev =>
        prev.id === newId
          ? {
              ...prev,
              manifest,
              distractors,
            }
          : prev
      );
    } finally {
      if (roomGenSeqRef.current === seq) {
        setIsGeneratingRoom(false);
      }
    }
  };

  // Start a new match (either Solo live Wikipedia OR Multiplayer locked manifest)
  const startMatch = async (
    targetChallenge: MultiplayerChallenge | null,
    overrideCategory?: Category
  ) => {
    if (isAdvancingRoundRef.current) return;
    isAdvancingRoundRef.current = true;

    const activeCat = targetChallenge
      ? targetChallenge.category
      : overrideCategory || category;

    if (targetChallenge) {
      setCategory(targetChallenge.category);
      setDifficulty(targetChallenge.difficulty);
      setGameMode(targetChallenge.gameMode);
      setActiveChallenge(targetChallenge);
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, '', buildChallengeUrl(targetChallenge));
      }
    } else {
      if (overrideCategory) setCategory(overrideCategory);
      setActiveChallenge(null);
      setOpponentResultsFromUrl([]);
      clearChallengeFromUrl();
    }

    setIsLoadingLiveItem(true);
    try {
      let firstItem: CulturalItem;
      if (targetChallenge) {
        let resolvedChallenge = targetChallenge;
        let hydratedItems =
          hydratedManifestRef.current.challengeId === targetChallenge.id
            ? hydratedManifestRef.current.items
            : [];

        const needsHydration =
          hydratedItems.length === 0 ||
          (targetChallenge.manifest || []).some(m => !m.title) ||
          (targetChallenge.distractors || []).some(d => !d.title);

        if (
          needsHydration &&
          ((targetChallenge.manifest && targetChallenge.manifest.length > 0) ||
            (targetChallenge.distractors && targetChallenge.distractors.length > 0))
        ) {
          const hydrated = await hydrateMultiplayerChallenge(targetChallenge);
          resolvedChallenge = hydrated.challenge;
          if (hydrated.items.length > 0) {
            hydratedItems = hydrated.items;
            hydratedManifestRef.current = {
              challengeId: targetChallenge.id,
              items: hydratedItems,
            };
          }
          setActiveChallenge(resolvedChallenge);
          setDraftChallenge(resolvedChallenge);
        }

        firstItem = await getSeededChallengeRoundItem(
          resolvedChallenge,
          0,
          hydratedItems,
          []
        );
      } else {
        const usedDistKeys = new Set(Object.keys(easyUsedCountsRef.current));
        firstItem = await getNextLiveRoundItem(activeCat, seenItemIdsRef.current, {
          minUnusedDistractors: difficulty === 'easy' ? 10 : 0,
          usedDistractorKeys: usedDistKeys,
        });
      }
      trackPlayedItem(firstItem);

      setRoundItems([firstItem]);
      setRoundIndex(0);
      setResults([]);
      setLatestResult(null);
      setCurrentHp(100);
      setHintTokens(1);
      setStreakMultiplier(0);
      setGamePhase('playing');
    } finally {
      isAdvancingRoundRef.current = false;
      setIsLoadingLiveItem(false);
    }
  };

  const handleOpenMultiplayer = () => {
    setOpponentResultsFromUrl([]);
    const freshHostName = challengePlayerName.trim() || 'Player 1';
    setChallengePlayerName(freshHostName);
    setChallengeModal({ isOpen: true, mode: 'create' });
    generateLiveMultiplayerDraft(category, difficulty, gameMode, freshHostName);
  };

  const handleRerollMultiplayerRoom = () => {
    const freshHostName = challengePlayerName.trim() || 'Player 1';
    generateLiveMultiplayerDraft(category, difficulty, gameMode, freshHostName);
  };

  const handleStartFromChallengeModal = () => {
    if (isGeneratingRoom) return;
    const cleanName =
      challengePlayerName.trim() ||
      (challengeModal.mode === 'join'
        ? `Player ${(opponentResultsFromUrl.length || 0) + 2}`
        : 'Player 1');
    setChallengePlayerName(cleanName);

    const resolvedChallenge: MultiplayerChallenge =
      challengeModal.mode === 'create'
        ? { ...draftChallenge, hostName: cleanName }
        : draftChallenge;

    setChallengeModal(prev => ({ ...prev, isOpen: false }));
    startMatch(resolvedChallenge);
  };

  const handleViewSavedRoomLeaderboard = () => {
    if (!savedRoomSnapshot) return;
    setCategory(draftChallenge.category);
    setDifficulty(draftChallenge.difficulty);
    setGameMode(draftChallenge.gameMode);
    setActiveChallenge(draftChallenge);
    setChallengePlayerName(savedRoomSnapshot.playerName);
    setResults(savedRoomSnapshot.results);
    setCurrentHp(savedRoomSnapshot.finalHp);
    setRoundItems(savedRoomSnapshot.results.map(r => r.item));
    setRoundIndex(Math.max(0, savedRoomSnapshot.results.length - 1));
    setChallengeModal(prev => ({ ...prev, isOpen: false }));
    setGamePhase('gameover');
  };

  const handleDismissChallenge = () => {
    setActiveChallenge(null);
    setOpponentResultsFromUrl([]);
    clearChallengeFromUrl();
    setChallengeModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleGoHome = () => {
    setActiveChallenge(null);
    setOpponentResultsFromUrl([]);
    clearChallengeFromUrl();
    setGamePhase('home');
  };

  const handleUseHint = () => {
    setHintTokens(prev => Math.max(0, prev - 1));
  };

  // Submit Guess using TimeGuessr difficulty-scaled scoring
  const handleSubmitGuess = async (guess: RoundGuess) => {
    const currentItem = roundItems[roundIndex];
    if (!currentItem) return;

    // Evaluate score & damage with difficulty harshness profile
    const evaluated = evaluateRound(currentItem, guess, currentHp, streakMultiplier, difficulty);

    let wikiExtract = currentItem.wikiExtract;
    let wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(currentItem.wikiSlug)}`;
    let wikiThumbnail = currentItem.image;

    if (!wikiExtract) {
      try {
        const summary = await fetchWikiSummary(currentItem.wikiSlug);
        if (summary) {
          if (summary.extract) wikiExtract = summary.extract;
          if (summary.url) wikiUrl = summary.url;
          if (summary.thumbnail && !currentItem.altCoverApplied) wikiThumbnail = summary.thumbnail;
        }
      } catch {}
    }

    const roundRes: RoundResult = {
      ...evaluated,
      wikiExtract,
      wikiUrl,
      wikiThumbnail,
    };

    if (gameMode === 'forever' && evaluated.remainingHp !== undefined) {
      setCurrentHp(evaluated.remainingHp);
    }

    // Update streak multiplier for the next round
    setStreakMultiplier(evaluated.newStreak);

    // Record Easy options shown this round so Solo distractors never repeat or leak into future Questions
    if (difficulty === 'easy') {
      const nextCounts = { ...easyUsedCountsRef.current };
      const targetKey = toEasyOptionKey(currentItem.title, currentItem.creator);
      nextCounts[targetKey] = (nextCounts[targetKey] || 0) + 1;
      for (const key of guess.shownDistractorKeys || []) {
        nextCounts[key] = (nextCounts[key] || 0) + 1;
      }
      easyUsedCountsRef.current = nextCounts;
      setEasyUsedCounts(nextCounts);

      if (!activeChallenge && guess.shownDistractors) {
        for (const dist of guess.shownDistractors) {
          recordSeenWork({
            category: dist.category,
            title: dist.title,
            creator: dist.creator,
            wikiSlug: dist.slug,
            wikiPageId: dist.pageId,
            image: dist.image,
          });
          if (dist.slug) {
            seenItemIdsRef.current.add(dist.slug);
            seenItemIdsRef.current.add(dist.slug.toLowerCase());
          }
          if (dist.pageId && dist.pageId > 0) {
            seenItemIdsRef.current.add(`pid:${dist.pageId}`);
          }
          const distImgKey = extractNormalizedImageKey(dist.image);
          if (distImgKey) {
            seenItemIdsRef.current.add(distImgKey);
          }
          seenItemIdsRef.current.add(
            toCanonicalWorkKey(dist.category, dist.title, dist.creator)
          );
        }
        setSeenItemIds(new Set(seenItemIdsRef.current));
      }
    }

    setLatestResult(roundRes);
    setResults(prev => [...prev, roundRes]);
    setGamePhase('revealing');
  };

  // Next Round / Game Over
  const handleNextRound = async () => {
    if (isAdvancingRoundRef.current) return;
    isAdvancingRoundRef.current = true;

    try {
      setLatestResult(null);

      // Check if player died in Forever Mode
      if (gameMode === 'forever' && currentHp <= 0) {
        const survivedRounds = results.length;
        if (survivedRounds > (foreverStreaks[category] || 0)) {
          const updated = { ...foreverStreaks, [category]: survivedRounds };
          setForeverStreaks(updated);
          try {
            localStorage.setItem('whatchawhen_forever_streaks', JSON.stringify(updated));
          } catch {}
        }
        setGamePhase('gameover');
        return;
      }

      // Check if Classic Mode finished (5 rounds)
      if (gameMode === 'classic' && roundIndex >= 4) {
        const finalScore = results.reduce((sum, r) => sum + r.totalPoints, 0);
        if (finalScore > (highScores[category] || 0)) {
          const updated = { ...highScores, [category]: finalScore };
          setHighScores(updated);
          try {
            localStorage.setItem('whatchawhen_highscores', JSON.stringify(updated));
          } catch {}
        }
        setGamePhase('gameover');
        return;
      }

      // Next round index
      const nextIndex = roundIndex + 1;

      // Fetch the next round item if not already buffered
      if (nextIndex >= roundItems.length) {
        setIsLoadingLiveItem(true);
        try {
          if (activeChallenge) {
            const hydratedItems =
              hydratedManifestRef.current.challengeId === activeChallenge.id
                ? hydratedManifestRef.current.items
                : [];
            const priorPlayed = roundItems.slice(0, nextIndex);
            const nextItem = await getSeededChallengeRoundItem(
              activeChallenge,
              nextIndex,
              hydratedItems,
              priorPlayed
            );
            trackPlayedItem(nextItem);
            setRoundItems(prev => [...prev, nextItem]);
          } else {
            const usedDistKeys = new Set(Object.keys(easyUsedCountsRef.current));
            const nextItem = await getNextLiveRoundItem(category, seenItemIdsRef.current, {
              minUnusedDistractors: difficulty === 'easy' ? 10 : 0,
              usedDistractorKeys: usedDistKeys,
            });
            trackPlayedItem(nextItem);
            setRoundItems(prev => [...prev, nextItem]);
          }
        } finally {
          setIsLoadingLiveItem(false);
        }
      }

      setRoundIndex(nextIndex);
      setGamePhase('playing');
    } finally {
      isAdvancingRoundRef.current = false;
    }
  };

  const handleToggleMute = () => {
    const state = sounds.toggleMute();
    setIsMuted(state);
  };

  return (
    <div
      className={`min-h-screen flex flex-col relative transition-colors duration-500 bg-gradient-to-b ${theme.bgTexture} text-[#ffebc4]`}
    >
      {/* 2D Pixel Animated Background Characters & Floating Symbols */}
      <PixelDecorations category={category} />

      {/* Top Header */}
      <Header
        gamePhase={gamePhase}
        roundIndex={roundIndex}
        totalRounds={totalRounds}
        currentScore={currentScore}
        gameMode={gameMode}
        difficulty={difficulty}
        currentHp={currentHp}
        streakMultiplier={streakMultiplier}
        onGoHome={handleGoHome}
        onOpenHelp={() => setIsHelpOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center relative z-10">
        {gamePhase === 'home' && (
          <HomeScreen
            selectedCategory={category}
            onSelectCategory={setCategory}
            gameMode={gameMode}
            onSelectMode={setGameMode}
            difficulty={difficulty}
            onSelectDifficulty={setDifficulty}
            onStartGame={() => startMatch(null)}
            onOpenMultiplayer={handleOpenMultiplayer}
            onOpenHelp={() => setIsHelpOpen(true)}
            highScores={highScores}
            foreverStreaks={foreverStreaks}
          />
        )}

        {gamePhase === 'playing' && roundItems[roundIndex] && (
          <GamePlayRound
            key={`${roundItems[roundIndex].id}-${roundIndex}-${difficulty}`}
            item={roundItems[roundIndex]}
            gameCategory={category}
            gameMode={gameMode}
            difficulty={difficulty}
            hintTokens={hintTokens}
            onUseHint={handleUseHint}
            onSubmitGuess={handleSubmitGuess}
            allItems={autocompleteItems}
            easyLivePool={easyLivePool}
            easyUsedCounts={easyUsedCounts}
            soloExcludeOptionKeys={soloExcludeOptionKeys}
            soloSeenCheck={checkLiveDistractorSeen}
            fallbackCatalogItems={CULTURAL_ITEMS}
            challenge={activeChallenge}
            roundIndex={roundIndex}
            priorRoundItems={priorRoundItems}
          />
        )}

        {gamePhase === 'revealing' && latestResult && (
          <RoundRevealModal
            result={latestResult}
            roundNumber={roundIndex + 1}
            totalRounds={totalRounds}
            isLastRound={gameMode === 'classic' && roundIndex >= 4}
            gameMode={gameMode}
            onNextRound={handleNextRound}
          />
        )}

        {gamePhase === 'gameover' && (
          <GameOverScreen
            category={category}
            gameMode={gameMode}
            difficulty={difficulty}
            results={results}
            finalHp={currentHp}
            onPlayAgain={() => startMatch(activeChallenge)}
            onGoHome={handleGoHome}
            challenge={activeChallenge}
            playerName={challengePlayerName}
            initialOpponentResults={opponentResultsFromUrl}
          />
        )}

        {/* Live Wikipedia Fetching Modal Overlay */}
        {isLoadingLiveItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="pixel-wood-frame p-6 max-w-sm w-full text-center rounded shadow-2xl">
              <div className="text-4xl mb-3 animate-spin duration-1000">⏳</div>
              <h3 className="font-pixel-title text-sm text-[#fcd34d] mb-1">
                PULLING NEXT COVER...
              </h3>
              <p className="font-pixel-ui text-[11px] text-[#eed0ae] mb-3">
                Grabbing a fresh random pick from Wikipedia archives.
              </p>
              <div className="w-full bg-[#1b0d06] rounded-full h-2 border border-[#804a23] overflow-hidden">
                <div className="bg-[#4ade80] h-full w-2/3 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Multiplayer Challenge Room Modal (2+ Players) */}
      <MultiplayerModal
        isOpen={challengeModal.isOpen}
        mode={challengeModal.mode}
        challenge={draftChallenge}
        playerName={challengePlayerName}
        onChangePlayerName={name => {
          setChallengePlayerName(name);
          if (challengeModal.mode === 'create') {
            setDraftChallenge(prev => ({
              ...prev,
              hostName: name.trim() || 'Player 1',
            }));
          }
        }}
        opponentResults={opponentResultsFromUrl}
        isGeneratingRoom={isGeneratingRoom}
        hasSavedRunForRoom={Boolean(savedRoomSnapshot)}
        onViewSavedRoomLeaderboard={handleViewSavedRoomLeaderboard}
        onRerollRoom={handleRerollMultiplayerRoom}
        onStartChallenge={handleStartFromChallengeModal}
        onDismissChallenge={handleDismissChallenge}
        onClose={() => {
          roomGenSeqRef.current++;
          setIsGeneratingRoom(false);
          setChallengeModal(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}

export default App;
