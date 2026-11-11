import React, { useState, useEffect, useMemo } from 'react';
import { RoundResult, Category, GameMode, Difficulty } from '../types';
import { CATEGORY_THEMES } from '../config/themes';
import { Trophy, Share2, RotateCcw, Check, Skull, Home, Swords, Copy, Link2, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../services/sound';
import {
  MultiplayerChallenge,
  MultiplayerScoreSummary,
  buildChallengeUrl,
  copyToClipboard,
  encodeLeaderboardToken,
  decodeScoreInput,
  publishChallengeScore,
  loadStoredChallengeScores,
  saveChallengeScoresToStorage,
  subscribeChallengeChannel,
  mergeChallengeScores,
  sortChallengeLeaderboard,
  evaluateRoomStanding,
  getOrCreateClientPlayerId,
  isSameScoreIdentity,
  saveRoomRunSnapshot,
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
  initialOpponentResults?: MultiplayerScoreSummary[];
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
  initialOpponentResults,
  initialOpponentResult,
}) => {
  const theme = CATEGORY_THEMES[category];
  const [copied, setCopied] = useState(false);
  const [finishedAt] = useState<number>(() => Date.now());
  const [clientPlayerId] = useState<string>(() => getOrCreateClientPlayerId());
  const [copiedResultLink, setCopiedResultLink] = useState(false);
  const [copiedScoreCode, setCopiedScoreCode] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [pasteNotice, setPasteNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);
  const cleanPlayerName = (playerName || challenge?.hostName || 'Player').trim().slice(0, 20) || 'Player';

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
      playerId: clientPlayerId,
    };
  }, [challenge, cleanPlayerName, totalScore, results, isFainted, gameMode, finishedAt, clientPlayerId]);

  const [roomOpponents, setRoomOpponents] = useState<MultiplayerScoreSummary[]>(() => {
    if (!challenge) return [];
    const fromProps =
      initialOpponentResults && initialOpponentResults.length > 0
        ? initialOpponentResults
        : initialOpponentResult
        ? [initialOpponentResult]
        : [];
    const fromStorage = loadStoredChallengeScores(challenge.id);
    return mergeChallengeScores(challenge.id, fromStorage, fromProps);
  });

  // Persist URL-imported scores + own summary and subscribe to same-browser tabs
  useEffect(() => {
    if (!challenge || !mySummary) return;

    saveRoomRunSnapshot({
      challengeId: challenge.id,
      playerName: cleanPlayerName,
      finalHp,
      results,
      savedAt: finishedAt,
    });

    if (roomOpponents.length > 0) {
      saveChallengeScoresToStorage(challenge.id, roomOpponents);
    }
    publishChallengeScore(challenge.id, mySummary);

    const unsubscribe = subscribeChallengeChannel(challenge.id, incoming => {
      if (isSameScoreIdentity(incoming, mySummary)) return;
      setRoomOpponents(prev => mergeChallengeScores(challenge.id, prev, [incoming]));
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, mySummary]);

  const leaderboard = useMemo(() => {
    if (!challenge || !mySummary) return [];
    const merged = mergeChallengeScores(challenge.id, roomOpponents, [mySummary]);
    return sortChallengeLeaderboard(merged, gameMode);
  }, [challenge, mySummary, roomOpponents, gameMode]);

  const roomStanding = useMemo(() => {
    if (!mySummary || leaderboard.length === 0) return null;
    return evaluateRoomStanding(mySummary, leaderboard);
  }, [mySummary, leaderboard]);

  const resultShareUrl = useMemo(() => {
    if (!challenge || !mySummary) return '';
    return buildChallengeUrl(challenge, leaderboard.length > 0 ? leaderboard : [mySummary]);
  }, [challenge, mySummary, leaderboard]);

  const scoreCode = useMemo(() => {
    if (!challenge || !mySummary) return '';
    return encodeLeaderboardToken(
      challenge.id,
      leaderboard.length > 0 ? leaderboard : [mySummary]
    );
  }, [challenge, mySummary, leaderboard]);

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
    setPasteNotice(null);
    const decodedList = decodeScoreInput(pasteInput);
    if (decodedList.length === 0) {
      setPasteNotice({
        type: 'error',
        text: 'Could not read that link or code — make sure you copied the whole thing.',
      });
      return;
    }

    const matching = challenge
      ? decodedList.filter(d => !d.challengeId || d.challengeId === challenge.id)
      : decodedList;

    if (matching.length === 0) {
      const foreignId = decodedList[0]?.challengeId;
      setPasteNotice({
        type: 'error',
        text: `That score is for Room #${foreignId}, not #${challenge?.id}.`,
      });
      return;
    }

    sounds.playSuccess();
    setRoomOpponents(prev => {
      const next = mergeChallengeScores(challenge?.id || '', prev, matching);
      if (challenge) saveChallengeScoresToStorage(challenge.id, next);
      return next;
    });
    setPasteInput('');
    setPasteNotice({
      type: 'ok',
      text: `Added ${matching.map(m => m.name).join(', ')} to the room leaderboard!`,
    });
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
    const standLine =
      challenge && leaderboard.length >= 2
        ? `\n🏆 Leaderboard (${leaderboard.length} players):\n` +
          leaderboard
            .map((p, idx) => `#${idx + 1} ${p.name}: ${p.score.toLocaleString()} pts${isForever ? ` (${p.survived} rnds)` : ''}`)
            .join('\n')
        : '';
    const challengeFooter = resultShareUrl
      ? `\nRoom link: ${resultShareUrl}`
      : '\nBeat my WhatchaWhen score?';

    const shareText = `🕰️ WhatchaWhen (${theme.name} - ${difficulty.toUpperCase()})${roomTag}
${isForever ? `❤️ Survived: ${results.length} Rounds` : '🏆 Match Complete (50,000 max)'}
🪙 Total Score: ${totalScore.toLocaleString()} pts
${rows.join('\n')}${standLine}${challengeFooter}`;

    copyToClipboard(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const maxRoundsInRoom = Math.max(
    results.length,
    ...leaderboard.map(p => p.roundScores.length)
  );

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
            <span>{challenge ? 'REPLAY ROOM' : 'PLAY AGAIN'}</span>
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

      {/* Multi-Player Room Leaderboard Panel */}
      {challenge && mySummary && (
        <div className="w-full pixel-wood-frame rounded p-5 sm:p-6 shadow-2xl mb-6 border-2 border-[#b4692c]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-300" />
              <h2 className="font-pixel-title text-sm text-[#ffe599]">
                MULTIPLAYER LEADERBOARD • #{challenge.id}
              </h2>
            </div>
            <span className="text-[10px] font-pixel-ui text-[#d7974e] inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              {leaderboard.length} {leaderboard.length === 1 ? 'Player' : 'Players'} Ranked
            </span>
          </div>

          {roomStanding && roomStanding.outcome !== 'solo' ? (
            <>
              {/* Outcome Banner */}
              <div
                className={`rounded p-3.5 mb-4 border-2 text-center ${
                  roomStanding.outcome === 'win'
                    ? 'bg-[#123d22] border-emerald-500 text-emerald-100'
                    : roomStanding.outcome === 'loss'
                    ? 'bg-[#451518] border-rose-500 text-rose-100'
                    : 'bg-[#3d2b0d] border-amber-400 text-amber-100'
                }`}
              >
                <div className="font-pixel-title text-sm sm:text-base mb-1">
                  {roomStanding.headline}
                </div>
                <div className="font-pixel-body text-xs opacity-90">
                  {roomStanding.subtext}
                </div>
              </div>

              {/* Ranked Standings List (supports 2, 3, 4, 10+ players) */}
              <div className="space-y-2 mb-4">
                {leaderboard.map((entry, idx) => {
                  const isMe = isSameScoreIdentity(entry, mySummary);
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                  return (
                    <div
                      key={`${entry.playerId || entry.name}-${entry.finishedAt}-${idx}`}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded border-2 ${
                        isMe
                          ? 'bg-[#2a1a09] border-[#fcd34d] shadow'
                          : 'bg-[#1b0d06] border-[#542813]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-pixel-title text-sm w-7 text-center shrink-0 text-amber-300">
                          {medal}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-pixel-title text-xs text-[#ffe599] truncate">
                              {entry.name}
                            </span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-900/80 border border-emerald-500 text-[8px] font-pixel-title text-emerald-200">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-pixel-ui text-[#b88c60]">
                            {isForever
                              ? `Survived ${entry.survived} Rnds`
                              : `${entry.roundsCompleted} / 5 Rounds`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-pixel-title text-sm sm:text-base text-[#fcd34d]">
                          🪙 {entry.score.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Multi-Player Round-by-Round Table */}
              <div className="bg-[#170a04] border border-[#542813] rounded p-3 mb-4 overflow-x-auto">
                <div className="text-[9px] font-pixel-title text-[#ffe2a0] mb-2">
                  ROUND-BY-ROUND COMPARISON
                </div>
                <table className="w-full text-[11px] font-pixel-ui border-collapse">
                  <thead>
                    <tr className="border-b border-[#3d2012] text-[#b88c60]">
                      <th className="text-left py-1 pr-3 font-normal">Round</th>
                      {leaderboard.map((p, idx) => (
                        <th key={idx} className="text-right py-1 px-2 font-pixel-title text-[9px] text-amber-200 truncate max-w-[90px]">
                          {isSameScoreIdentity(p, mySummary) ? `${p.name} (You)` : p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxRoundsInRoom }).map((_, rIdx) => {
                      const workTitle = results[rIdx]?.item.title;
                      const roundVals = leaderboard.map(p => p.roundScores[rIdx] ?? -1);
                      const topRound = Math.max(...roundVals);
                      return (
                        <tr key={rIdx} className="border-b border-[#2b150a] last:border-b-0">
                          <td className="py-1.5 pr-3 text-[#eed0ae] truncate max-w-[180px]">
                            <span className="text-amber-300 font-bold mr-1.5">R{rIdx + 1}</span>
                            {workTitle && <span className="opacity-80">{workTitle}</span>}
                          </td>
                          {leaderboard.map((p, pIdx) => {
                            const val = p.roundScores[rIdx];
                            const isBest = val !== undefined && val > 0 && val === topRound;
                            return (
                              <td
                                key={pIdx}
                                className={`py-1.5 px-2 text-right font-mono text-[10px] ${
                                  isBest ? 'text-emerald-300 font-bold' : 'text-stone-300'
                                }`}
                              >
                                {val !== undefined ? `+${val.toLocaleString()}` : '💀 --'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-[#1b0d06] border border-[#542813] rounded p-3 mb-4 text-center text-xs font-pixel-body text-[#eed0ae]">
              Waiting on friends&apos; runs — send them your Result Link (carries the whole leaderboard!) or paste theirs below!
            </div>
          )}

          {/* Share & Merge Controls */}
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
                  <span>
                    {leaderboard.length >= 2 ? 'COPY GROUP RESULT LINK' : 'COPY RESULT LINK'}
                  </span>
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
              placeholder="Paste any friend's Result Link or Score Code"
              className="flex-1 min-w-0 px-3 py-2 rounded bg-[#140903] border-2 border-[#542813] text-amber-100 placeholder-[#8c603a] font-pixel-body text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] text-white font-pixel-title text-[9px] rounded pixel-btn cursor-pointer shrink-0"
            >
              ADD SCORE
            </button>
          </form>

          {pasteNotice && (
            <div
              className={`mt-2 text-[10px] font-pixel-ui ${
                pasteNotice.type === 'error' ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {pasteNotice.text}
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
