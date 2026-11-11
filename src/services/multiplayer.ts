import { Category, Difficulty, GameMode } from '../types';

export interface MultiplayerChallenge {
  id: string;
  category: Category;
  difficulty: Difficulty;
  gameMode: GameMode;
  hostName: string;
}

export interface MultiplayerScoreSummary {
  challengeId: string;
  name: string;
  score: number;
  roundsCompleted: number;
  survived: number;
  died: boolean;
  gameMode: GameMode;
  roundScores: number[];
  finishedAt: number;
}

export interface HeadToHeadOutcome {
  outcome: 'win' | 'loss' | 'tie';
  headline: string;
  subtext: string;
}

// ---------------- DETERMINISTIC SEEDED PRNG ----------------

export function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Pure Mulberry32 deterministic PRNG in [0, 1).
 */
export function createSeededRng(seedStr: string): () => number {
  let state = fnv1a32(seedStr) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Unbiased Fisher-Yates shuffle backed by a deterministic RNG.
 */
export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------- CHALLENGE IDS & URL CODECS ----------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateChallengeId(length: number = 8): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return id;
}

const VALID_CATEGORIES = new Set<Category>(['music', 'books', 'art', 'everything']);
const VALID_DIFFICULTIES = new Set<Difficulty>(['easy', 'normal', 'hard']);
const VALID_MODES = new Set<GameMode>(['classic', 'forever']);

function toBase64Url(jsonText: string): string {
  const bytes = new TextEncoder().encode(jsonText);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(token: string): string | null {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeResultToken(summary: MultiplayerScoreSummary): string {
  const compact = {
    c: summary.challengeId,
    n: summary.name.slice(0, 20),
    s: summary.score,
    r: summary.roundsCompleted,
    v: summary.survived,
    d: summary.died ? 1 : 0,
    m: summary.gameMode === 'forever' ? 'f' : 'c',
    p: summary.roundScores,
    t: summary.finishedAt,
  };
  return `WW1:${toBase64Url(JSON.stringify(compact))}`;
}

export function decodeResultToken(rawInput: string): MultiplayerScoreSummary | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();

  // Extract ?opp=... if user pasted a full share URL
  let token = trimmed;
  if (trimmed.includes('opp=')) {
    try {
      const url = trimmed.startsWith('http')
        ? new URL(trimmed)
        : new URL(trimmed, 'http://localhost');
      const oppParam = url.searchParams.get('opp');
      if (oppParam) token = oppParam;
    } catch {
      const m = trimmed.match(/[?&]opp=([^&\s]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }
  }

  if (token.startsWith('WW1:')) {
    token = token.slice(4);
  }

  const decoded = fromBase64Url(token);
  if (!decoded) return null;

  try {
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object' || typeof data.s !== 'number') return null;

    return {
      challengeId: String(data.c || ''),
      name: String(data.n || 'Friend').slice(0, 20),
      score: Math.max(0, Math.round(data.s)),
      roundsCompleted: Math.max(0, Math.round(data.r ?? 0)),
      survived: Math.max(0, Math.round(data.v ?? data.r ?? 0)),
      died: Boolean(data.d),
      gameMode: data.m === 'f' ? 'forever' : 'classic',
      roundScores: Array.isArray(data.p) ? data.p.map((x: unknown) => Math.max(0, Number(x) || 0)) : [],
      finishedAt: Number(data.t) || Date.now(),
    };
  } catch {
    return null;
  }
}

export function buildChallengeUrl(
  challenge: MultiplayerChallenge,
  myResult?: MultiplayerScoreSummary
): string {
  const origin =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}`
      : 'http://localhost:5173/';

  const params = new URLSearchParams();
  params.set('ch', challenge.id);
  params.set('cat', challenge.category);
  params.set('diff', challenge.difficulty);
  params.set('mode', challenge.gameMode);
  if (challenge.hostName.trim()) {
    params.set('host', challenge.hostName.trim().slice(0, 20));
  }
  if (myResult) {
    params.set('opp', encodeResultToken(myResult));
  }

  return `${origin}?${params.toString()}`;
}

export function parseChallengeFromLocation(
  searchStr?: string
): { challenge: MultiplayerChallenge; opponentResult?: MultiplayerScoreSummary } | null {
  const query =
    searchStr !== undefined
      ? searchStr
      : typeof window !== 'undefined'
      ? window.location.search
      : '';

  if (!query) return null;

  const params = new URLSearchParams(query);
  const id = (params.get('ch') || '').trim().toUpperCase();
  if (!id || id.length < 4) return null;

  const rawCat = (params.get('cat') || 'music').toLowerCase() as Category;
  const rawDiff = (params.get('diff') || 'normal').toLowerCase() as Difficulty;
  const rawMode = (params.get('mode') || 'classic').toLowerCase() as GameMode;
  const hostName = (params.get('host') || 'Friend').trim().slice(0, 20) || 'Friend';

  const challenge: MultiplayerChallenge = {
    id,
    category: VALID_CATEGORIES.has(rawCat) ? rawCat : 'music',
    difficulty: VALID_DIFFICULTIES.has(rawDiff) ? rawDiff : 'normal',
    gameMode: VALID_MODES.has(rawMode) ? rawMode : 'classic',
    hostName,
  };

  const oppParam = params.get('opp');
  const opponentResult = oppParam ? decodeResultToken(oppParam) || undefined : undefined;

  return { challenge, opponentResult };
}

export function clearChallengeFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState({}, '', cleanUrl);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below
  }

  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    // Ignore copy failure
  }
  return false;
}

// ---------------- SAME-ORIGIN LIVE SYNC (2-TAB / LOCAL STORAGE + BROADCAST) ----------------

const STORAGE_PREFIX = 'whatchawhen_ch_scores_';

export function loadStoredChallengeScores(challengeId: string): MultiplayerScoreSummary[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${challengeId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function publishChallengeScore(
  challengeId: string,
  summary: MultiplayerScoreSummary
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = loadStoredChallengeScores(challengeId).filter(
        s => !(s.name === summary.name && s.finishedAt === summary.finishedAt)
      );
      const updated = [...existing, summary].slice(-10);
      localStorage.setItem(`${STORAGE_PREFIX}${challengeId}`, JSON.stringify(updated));
    }
  } catch {
    // Ignore storage errors
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(`whatchawhen_ch_${challengeId}`);
      ch.postMessage({ type: 'score', summary });
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }
}

export function subscribeChallengeChannel(
  challengeId: string,
  onScore: (summary: MultiplayerScoreSummary) => void
): () => void {
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(`whatchawhen_ch_${challengeId}`);
      bc.onmessage = ev => {
        if (ev.data?.type === 'score' && ev.data?.summary) {
          onScore(ev.data.summary as MultiplayerScoreSummary);
        }
      };
    }
  } catch {
    bc = null;
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === `${STORAGE_PREFIX}${challengeId}` && ev.newValue) {
      try {
        const list = JSON.parse(ev.newValue) as MultiplayerScoreSummary[];
        const latest = list[list.length - 1];
        if (latest) onScore(latest);
      } catch {
        // Ignore parse error
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    if (bc) bc.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

// ---------------- HEAD-TO-HEAD COMPARISON ----------------

export function compareChallengeResults(
  mine: MultiplayerScoreSummary,
  theirs: MultiplayerScoreSummary
): HeadToHeadOutcome {
  if (mine.gameMode === 'forever') {
    if (mine.survived !== theirs.survived) {
      const won = mine.survived > theirs.survived;
      return {
        outcome: won ? 'win' : 'loss',
        headline: won
          ? `🏆 YOU OUTLASTED ${theirs.name.toUpperCase()}!`
          : `💀 ${theirs.name.toUpperCase()} OUTLASTED YOU!`,
        subtext: `You survived ${mine.survived} rounds vs ${theirs.name}'s ${theirs.survived} rounds.`,
      };
    }
  }

  const diff = mine.score - theirs.score;
  if (diff > 0) {
    return {
      outcome: 'win',
      headline: `🏆 YOU BEAT ${theirs.name.toUpperCase()}!`,
      subtext: `Ahead by +${diff.toLocaleString()} pts (${mine.score.toLocaleString()} vs ${theirs.score.toLocaleString()}).`,
    };
  }
  if (diff < 0) {
    return {
      outcome: 'loss',
      headline: `💀 ${theirs.name.toUpperCase()} TAKES THIS ONE!`,
      subtext: `Behind by ${Math.abs(diff).toLocaleString()} pts (${mine.score.toLocaleString()} vs ${theirs.score.toLocaleString()}).`,
    };
  }
  return {
    outcome: 'tie',
    headline: '🤝 DEAD EVEN TIE!',
    subtext: `Both finished at ${mine.score.toLocaleString()} pts!`,
  };
}
