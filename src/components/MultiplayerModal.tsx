import React, { useState } from 'react';
import { X, Copy, Check, Swords, Play, Trophy, Heart } from 'lucide-react';
import {
  MultiplayerChallenge,
  MultiplayerScoreSummary,
  buildChallengeUrl,
  copyToClipboard,
} from '../services/multiplayer';
import { sounds } from '../services/sound';

interface MultiplayerModalProps {
  isOpen: boolean;
  mode: 'create' | 'join';
  challenge: MultiplayerChallenge;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  opponentResult?: MultiplayerScoreSummary;
  onStartChallenge: () => void;
  onDismissChallenge: () => void;
  onClose: () => void;
}

const CAT_LABELS: Record<string, string> = {
  music: '🎵 Music',
  books: '📚 Books',
  art: '🎨 Art',
  everything: '🎲 Everything',
};

const DIFF_LABELS: Record<string, string> = {
  easy: '🌱 Easy',
  normal: '🌾 Normal',
  hard: '⚔️ Hard',
};

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  mode,
  challenge,
  playerName,
  onChangePlayerName,
  opponentResult,
  onStartChallenge,
  onDismissChallenge,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const liveChallenge: MultiplayerChallenge = {
    ...challenge,
    hostName:
      mode === 'create'
        ? playerName.trim() || challenge.hostName || 'Player 1'
        : challenge.hostName,
  };

  const shareUrl = buildChallengeUrl(liveChallenge);

  const handleCopy = () => {
    sounds.playCoin();
    copyToClipboard(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn select-none"
      onClick={mode === 'create' ? onClose : undefined}
    >
      <div
        className="relative max-w-lg w-full pixel-wood-frame rounded p-6 shadow-2xl text-[#ffebc4]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => {
            sounds.playClick();
            if (mode === 'join') {
              onDismissChallenge();
            } else {
              onClose();
            }
          }}
          className="absolute top-4 right-4 p-1 bg-[#261106] border border-[#a47648] text-[#ffe2a0] hover:text-white rounded-sm pixel-btn cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded bg-amber-900/60 border-2 border-amber-500 flex items-center justify-center">
            <Swords className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="font-pixel-title text-sm sm:text-base text-[#ffe599]">
              {mode === 'join'
                ? `CHALLENGE FROM ${challenge.hostName.toUpperCase()}`
                : '2P FRIEND CHALLENGE'}
            </h2>
            <p className="text-[10px] font-pixel-ui text-[#d7974e]">
              Room #{challenge.id}
            </p>
          </div>
        </div>

        <p className="font-pixel-body text-xs text-[#eed0ae] leading-relaxed mb-4">
          {mode === 'join'
            ? 'You get the exact same rounds, choices & hints. Play it out and see who scores higher!'
            : 'Send this link to a friend — you both get the exact same rounds, choices & hints! In Forever mode, keep getting matching rounds until someone drops.'}
        </p>

        {/* Locked Match Settings */}
        <div className="bg-[#1b0d06] border-2 border-[#4d2817] rounded p-3 mb-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[8px] font-pixel-ui text-[#b88c60] uppercase">Category</div>
            <div className="text-[10px] font-pixel-title text-amber-200 mt-0.5">
              {CAT_LABELS[challenge.category] || challenge.category}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-pixel-ui text-[#b88c60] uppercase">Difficulty</div>
            <div className="text-[10px] font-pixel-title text-emerald-300 mt-0.5">
              {DIFF_LABELS[challenge.difficulty] || challenge.difficulty}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-pixel-ui text-[#b88c60] uppercase">Mode</div>
            <div className="text-[10px] font-pixel-title text-rose-300 mt-0.5 flex items-center justify-center gap-1">
              {challenge.gameMode === 'forever' ? (
                <>
                  <Heart className="w-3 h-3 fill-current" />
                  <span>Forever</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3 h-3" />
                  <span>Classic</span>
                </>
              )}
            </div>
          </div>
        </div>

        {opponentResult && (
          <div className="mb-4 px-3 py-2 bg-[#14332b] border border-emerald-500/70 rounded text-[11px] font-pixel-ui text-emerald-200 text-center">
            🔒 {opponentResult.name} already played this seed — finish your run to reveal the head-to-head winner!
          </div>
        )}

        {/* Your Name */}
        <div className="mb-4">
          <label className="block text-[9px] font-pixel-title text-[#ffe2a0] mb-1">
            YOUR NAME
          </label>
          <input
            type="text"
            maxLength={20}
            value={playerName}
            onChange={e => onChangePlayerName(e.target.value)}
            placeholder={mode === 'join' ? 'Player 2' : 'Player 1'}
            className="w-full px-3 py-2 rounded bg-[#170a04] border-2 border-[#542813] text-amber-100 placeholder-[#8c603a] font-pixel-body text-xs focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Shareable Link Box */}
        <div className="mb-5">
          <label className="block text-[9px] font-pixel-title text-[#ffe2a0] mb-1">
            SHARE LINK WITH YOUR FRIEND
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={e => e.currentTarget.select()}
              className="flex-1 min-w-0 px-2.5 py-2 rounded bg-[#140903] border border-[#542813] text-[#d7974e] font-mono text-[10px] focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-[#2b170c] hover:bg-[#3d2314] border-2 border-[#8a4b27] text-amber-200 hover:text-white font-pixel-title text-[9px] rounded pixel-btn cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>COPY LINK</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              sounds.playCoin();
              onStartChallenge();
            }}
            className="flex-1 py-3 rounded bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] font-pixel-title text-xs text-white pixel-btn shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{mode === 'join' ? 'PLAY SAME QUESTIONS' : 'START MATCH'}</span>
          </button>

          {mode === 'join' && (
            <button
              onClick={() => {
                sounds.playClick();
                onDismissChallenge();
              }}
              className="px-4 py-3 rounded bg-[#2b170c] hover:bg-[#3d2012] border-2 border-[#542813] font-pixel-ui text-xs text-[#eed0ae] hover:text-white pixel-btn cursor-pointer"
            >
              Back to Solo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
