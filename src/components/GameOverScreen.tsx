import React, { useState, useEffect, useMemo } from 'react';
import { RoundResult, Category, GameMode, Difficulty } from '../types';
import { CATEGORY_THEMES } from '../config/themes';
import { Trophy, Share2, RotateCcw, Check, Skull, Home, Swords, Copy, Link2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../services/sound';
import {
  MultiplayerChallenge,
  MultiplayerScoreSummary,
  buildChallengeUrl,
  copyToClipboard,
  encodeResultToken,
  decodeResultToken,
  publishChallengeScore,
  loadStoredChallengeScores,
  subscribeChallengeChannel,
  compareChallengeResults,
} from '../services/multiplayer';

interface GameOverScreenProps {
  category: Category;
  gameMode: GameMode;
  difficulty: Difficulty;
  results: RoundResult[];
  finalHp: number;
  onPlayAgain: () => void;
  onGoHome: () => void;
  challenge?: MultiplayerChallenge | null;
  playerName?: string;
  initialOpponentResult?: MultiplayerScoreSummary;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  category,
  gameMode,
  difficulty,
  results,
  finalHp,
  onPlayAgain,
  onGoHome,
  challenge,
  playerName,
  initialOpponentResult,
}) => {
  const theme = CATEGORY_THEMES[category];
  const [copied, setCopied] = useState(false);
  const [finishedAt] = useState<number>(() => Date.now());
  const [copiedResultLink, setCopiedResultLink] = useState(false);
  const [copiedScoreCode, setCopiedScoreCode] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const cleanPlayerName = (playerName || challenge?.hostName || 'Player').trim().slice(0, 20) || 'Player';
  const [opponentSummary, setOpponentSummary] = useState<MultiplayerScoreSummary | undefined>(() => {
    if (initialOpponentResult) return initialOpponentResult;
    if (!challenge) return undefined;
    const existing = loadStoredChallengeScores(challenge.id).filter(
      s => !(s.name === cleanPlayerName && s.finishedAt === finishedAt)
    );
    return existing.length > 0 ? existing[existing.length - 1] : undefined;
  });

  const totalScore = results.reduce((sum, r) => sum + r.totalPoints, 0);
  const isForever = gameMode === 'forever';
  const isFainted = isForever && finalHp <= 0;

  const mySummary: MultiplayerScoreSummary | null = useMemo(() => {
    if (!challenge) return null;
    return {
      challengeId: challenge.id,
      name: cleanPlayerName,
      score: totalScore,
      roundsCompleted: results.length,
      survived: results.length,
      died: isFainted,
      gameMode,
      roundScores: results.map(r => r.totalPoints),
      finishedAt,
    };
  }, [challenge, cleanPlayerName, totalScore, results, isFainted, gameMode, finishedAt]);

  // Publish score & listen for same-browser opponent updates
  useEffect(() => {
    if (!challenge || !mySummary) return;

    publishChallengeScore(challenge.id, mySummary);

    const unsubscribe = subscribeChallengeChannel(challenge.id, incoming => {
      if (incoming.name === mySummary.name && incoming.finishedAt === mySummary.finishedAt) return;
      setOpponentSummary(incoming);
    });

    return unsubscribe;
  }, [challenge, mySummary]);

  const headToHead = useMemo(() => {
    if (!mySummary || !opponentSummary) return null;
    return compareChallengeResults(mySummary, opponentSummary);
  }, [mySummary, opponentSummary]);

  const resultShareUrl = useMemo(() => {
    if (!challenge || !mySummary) return '';
    return buildChallengeUrl(challenge, mySummary);
  }, [challenge, mySummary]);

  const scoreCode = useMemo(() => {
    if (!mySummary) return '';
    return encodeResultToken(mySummary);
  }, [mySummary]);

  const handleCopyResultLink = () => {
    if (!resultShareUrl) return;
    sounds.playCoin();
    copyToClipboard(resultShareUrl).then(() => {
      setCopiedResultLink(true);
      setTimeout(() => setCopiedResultLink(false), 2200);
    });
  };

  const handleCopyScoreCode = () => {
    if (!scoreCode) return;
    sounds.playCoin();
    copyToClipboard(scoreCode).then(() => {
      setCopiedScoreCode(true);
      setTimeout(() => setCopiedScoreCode(false), 2200);
    });
  };

  const handleComparePaste = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError(null);
    const decoded = decodeResultToken(pasteInput);
    if (!decoded) {
      setPasteError('Could not read that link or code — double-check you copied the whole thing.');
      return;
    }
    if (challenge && decoded.challengeId && decoded.challengeId !== challenge.id) {
      setPasteError(`That score is for Room #${decoded.challengeId}, not #${challenge.id}.`);
      return;
    }
    sounds.playSuccess();
    setOpponentSummary(decoded);
    setPasteInput('');
  };

  useEffect(() => {
    if (!isFainted) {
      sounds.playSuccess();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.5 },
      });
    } else {
      sounds.playHurt();
    }
  }, [isFainted]);

  const handleShare = () => {
    sounds.playCoin();
    const rows = results.map((r, i) => {
      const emoji = r.totalPoints >= 8500 ? '🟩' : r.totalPoints >= 5000 ? '🟨' : '🟥';
      return `R${i + 1}: ${emoji} ${r.totalPoints.toLocaleString()} pts`;
    });

    const roomTag = challenge ? ` [Room #${challenge.id}]` : '';
    const vsLine = headToHead && opponentSummary
      ? `\n⚔️ vs ${opponentSummary.name}: ${opponentSummary.score.toLocaleString()} pts — ${headToHead.headline}`
      : '';
    const challengeFooter = resultShareUrl
      ? `\nChallenge link: ${resultShareUrl}`
      : '\nBeat my WhatchaWhen score?';

    const shareText = `🕰️ WhatchaWhen (${theme.name} - ${difficulty.toUpperCase()})${roomTag}
${isForever ? `❤️ Survived: ${results.length} Rounds` : '🏆 Match Complete (50,000 max)'}
🪙 Total Score: ${totalScore.toLocaleString()} pts
${rows.join('\n')}${vsLine}${challengeFooter}`;

    copyToClipboard(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="w-full flex-1 max-w-4xl mx-auto px-4 py-8 flex flex-col items-center animate-fadeIn select-none relative z-10">
      
      {/* Results Card */}
      <div className="w-full pixel-wood-frame rounded p-6 sm:p-8 text-center shadow-2xl relative mb-6">
        
        {isFainted ? (
          <div className="w-16 h-16 rounded-sm bg-[#571414] border-2 border-rose-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Skull className="w-9 h-9 text-rose-300 animate-pulse" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-sm bg-[#8a4b27] border-2 border-[#e6a86c] flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Trophy className="w-9 h-9 text-[#ffe27a]" />
          </div>
        )}

        <div className="text-[10px] font-pixel-title text-[#d7974e] tracking-wider uppercase mb-1">
          {isForever ? 'FOREVER RUN OVER' : 'MATCH COMPLETE'} • {theme.name}
        </div>

        <h1 className="text-3xl sm:text-4xl font-pixel-title text-[#ffe599] tracking-tight mb-2">
          {isFainted ? 'OUT OF HP!' : 'RUN COMPLETE!'}
        </h1>

        <p className="font-pixel-body text-xs sm:text-sm text-[#eed0ae] max-w-md mx-auto mb-4">
          {isFainted
            ? 'Hit 0 HP — shake it off and run it back!'
            : 'Nice run! Check your calls below or share the score.'}
        </p>

        {/* Big Score Plaque */}
        <div className="inline-block px-8 py-3 bg-[#1c0d06] border-2 border-[#e8a34d] rounded-sm mb-6 shadow-inner">
          <div className="text-[10px] font-pixel-ui text-[#b88c60]">TOTAL SCORE</div>
          <div className="font-pixel-title text-3xl sm:text-4xl text-[#fcd34d]">
            🪙 {totalScore.toLocaleString()}
          </div>
          {isForever && (
            <div className="text-[10px] font-pixel-title text-rose-400 mt-1">
              Survived {results.length} Rounds
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleShare}
            className="px-5 py-2.5 bg-[#2b170c] hover:bg-[#3d2314] border-2 border-[#8a4b27] text-white font-pixel-title text-xs rounded-sm pixel-btn cursor-pointer flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onPlayAgain();
            }}
            className="px-8 py-2.5 bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] text-white font-pixel-title text-xs rounded-sm pixel-btn cursor-pointer flex items-center gap-2 shadow-xl"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{challenge ? 'REPLAY SEED' : 'PLAY AGAIN'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onGoHome();
            }}
            className="px-5 py-2.5 bg-[#2b170c] hover:bg-[#3d2314] border-2 border-[#8a4b27] text-[#ffe2a0] hover:text-white font-pixel-title text-xs rounded-sm pixel-btn cursor-pointer flex items-center gap-2"
          >
            <Home className="w-4 h-4 text-amber-300" />
            <span>MENU</span>
          </button>
        </div>

      </div>

      {/* 2P Challenge Comparison Panel */}
      {challenge && mySummary && (
        <div className="w-full pixel-wood-frame rounded p-5 sm:p-6 shadow-2xl mb-6 border-2 border-[#b4692c]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-300" />
              <h2 className="font-pixel-title text-sm text-[#ffe599]">
                2P CHALLENGE RESULTS • #{challenge.id}
              </h2>
            </div>
            <span className="text-[10px] font-pixel-ui text-[#d7974e]">
              Same Questions • Same Choices • Same Hints
            </span>
          </div>

          {headToHead && opponentSummary ? (
            <>
              {/* Outcome Banner */}
              <div
                className={`rounded p-3.5 mb-4 border-2 text-center ${
                  headToHead.outcome === 'win'
                    ? 'bg-[#123d22] border-emerald-500 text-emerald-100'
                    : headToHead.outcome === 'loss'
                    ? 'bg-[#451518] border-rose-500 text-rose-100'
                    : 'bg-[#3d2b0d] border-amber-400 text-amber-100'
                }`}
              >
                <div className="font-pixel-title text-sm sm:text-base mb-1">
                  {headToHead.headline}
                </div>
                <div className="font-pixel-body text-xs opacity-90">
                  {headToHead.subtext}
                </div>
              </div>

              {/* Side-by-Side Totals */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#1b0d06] border-2 border-[#804a23] rounded p-3 text-center">
                  <div className="text-[9px] font-pixel-ui text-amber-300 uppercase">
                    You ({mySummary.name})
                  </div>
                  <div className="font-pixel-title text-lg sm:text-xl text-[#fcd34d] mt-1">
                    🪙 {mySummary.score.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-pixel-ui text-[#eed0ae] mt-0.5">
                    {isForever
                      ? `Survived ${mySummary.survived} Rnds`
                      : `${mySummary.roundsCompleted} / 5 Rounds`}
                  </div>
                </div>

                <div className="bg-[#1b0d06] border-2 border-[#804a23] rounded p-3 text-center">
                  <div className="text-[9px] font-pixel-ui text-sky-300 uppercase">
                    Friend ({opponentSummary.name})
                  </div>
                  <div className="font-pixel-title text-lg sm:text-xl text-sky-200 mt-1">
                    🪙 {opponentSummary.score.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-pixel-ui text-[#eed0ae] mt-0.5">
                    {isForever
                      ? `Survived ${opponentSummary.survived} Rnds`
                      : `${opponentSummary.roundsCompleted} / 5 Rounds`}
                  </div>
                </div>
              </div>

              {/* Round-by-Round Comparison */}
              <div className="bg-[#170a04] border border-[#542813] rounded p-3 mb-4">
                <div className="text-[9px] font-pixel-title text-[#ffe2a0] mb-2">
                  ROUND-BY-ROUND BREAKDOWN
                </div>
                <div className="space-y-1.5 text-[11px] font-pixel-ui">
                  {Array.from({
                    length: Math.max(
                      mySummary.roundScores.length,
                      opponentSummary.roundScores.length
                    ),
                  }).map((_, idx) => {
                    const mine = mySummary.roundScores[idx];
                    const theirs = opponentSummary.roundScores[idx];
                    const workTitle = results[idx]?.item.title;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-2 py-1 bg-[#241108] rounded border border-[#3d2012]"
                      >
                        <div className="truncate text-[#eed0ae]">
                          <span className="text-amber-300 font-bold mr-1.5">R{idx + 1}</span>
                          {workTitle && <span className="opacity-80">{workTitle}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                          <span
                            className={
                              mine !== undefined && theirs !== undefined && mine > theirs
                                ? 'text-emerald-300 font-bold'
                                : 'text-amber-200'
                            }
                          >
                            {mine !== undefined ? `+${mine.toLocaleString()}` : '💀 --'}
                          </span>
                          <span className="text-[#8c603a]">vs</span>
                          <span
                            className={
                              theirs !== undefined && mine !== undefined && theirs > mine
                                ? 'text-sky-300 font-bold'
                                : 'text-stone-300'
                            }
                          >
                            {theirs !== undefined ? `+${theirs.toLocaleString()}` : '💀 --'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#1b0d06] border border-[#542813] rounded p-3 mb-4 text-center text-xs font-pixel-body text-[#eed0ae]">
              Waiting on your friend&apos;s run — send them your Result Link or paste theirs below!
            </div>
          )}

          {/* Share & Compare Controls */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleCopyResultLink}
              className="px-3.5 py-2 bg-[#4a2611] hover:bg-[#5e3116] border-2 border-[#b4692c] text-[#ffe599] font-pixel-title text-[9px] rounded pixel-btn cursor-pointer flex items-center gap-1.5"
            >
              {copiedResultLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">RESULT LINK COPIED!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>COPY RESULT LINK</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyScoreCode}
              className="px-3.5 py-2 bg-[#2b170c] hover:bg-[#3d2314] border-2 border-[#8a4b27] text-amber-200 font-pixel-title text-[9px] rounded pixel-btn cursor-pointer flex items-center gap-1.5"
            >
              {copiedScoreCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">CODE COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>COPY SCORE CODE</span>
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleComparePaste} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={pasteInput}
              onChange={e => setPasteInput(e.target.value)}
              placeholder="Paste friend's Result Link or WW1:... Score Code"
              className="flex-1 min-w-0 px-3 py-2 rounded bg-[#140903] border-2 border-[#542813] text-amber-100 placeholder-[#8c603a] font-pixel-body text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] text-white font-pixel-title text-[9px] rounded pixel-btn cursor-pointer shrink-0"
            >
              COMPARE SCORE
            </button>
          </form>

          {pasteError && (
            <div className="mt-2 text-[10px] font-pixel-ui text-rose-300">
              {pasteError}
            </div>
          )}
        </div>
      )}

      {/* Round Breakdown List */}
      <div className="w-full mb-6">
        <h2 className="text-xs font-pixel-title text-[#ffe599] mb-3 flex items-center gap-2">
          <span>📜 ROUND BREAKDOWN</span>
        </h2>

        <div className="space-y-2">
          {results.map((res, idx) => (
            <div
              key={res.item.id}
              className="pixel-wood-light p-3 rounded-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-[#381a0b]"
            >
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <img
                  src={res.wikiThumbnail || res.item.image}
                  alt={res.item.title}
                  className="w-12 h-12 object-contain bg-black rounded-sm border border-[#522b13] shrink-0"
                />
                <div className="truncate">
                  <div className="text-[9px] font-pixel-title text-[#612f0e]">
                    Round {idx + 1} • {res.item.category === 'music' ? '🎵 MUSIC' : res.item.category === 'books' ? '📚 BOOKS' : '🎨 ART'}
                  </div>
                  <div className="font-pixel-title text-xs text-[#2b1406] truncate max-w-xs">
                    {res.item.title}
                  </div>
                  <div className="text-[11px] font-pixel-body text-[#472209]">
                    by {res.item.creator} ({res.item.year})
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 border-[#7e4720]/30 pt-2 sm:pt-0">
                <div className="text-left sm:text-right text-[10px] font-pixel-ui text-[#54280b]">
                  <div>Guessed: <strong>{res.guess.yearGuess}</strong> ({res.yearDelta === 0 ? 'Exact' : `${res.yearDelta}y off`})</div>
                  <div className="truncate max-w-[150px]">"{res.guess.rawGuess || 'None'}"</div>
                </div>

                <div className="text-right">
                  <div className="font-pixel-title text-sm text-[#7a2007]">
                    +{res.totalPoints}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
