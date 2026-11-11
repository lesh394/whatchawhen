import { Category, Difficulty, GameMode, RoundResult, WorkCategory } from '../types';

export interface LockedRoundEntry {
  slug: string;
  title: string;
  creator: string;
  year: number;
  category: WorkCategory;
  image?: string;
  genre?: string;
}

export interface LockedDistractorEntry {
  category: WorkCategory;
  title: string;
  creator: string;
}

export interface MultiplayerChallenge {
  id: string;
  category: Category;
  difficulty: Difficulty;
  gameMode: GameMode;
  hostName: string;
  manifest?: LockedRoundEntry[];
  distractors?: LockedDistractorEntry[];
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
  playerId?: string;
}

export interface RoomStanding {
  outcome: 'win' | 'loss' | 'tie' | 'solo';
  rank: number;
  totalPlayers: number;
  headline: string;
  subtext: string;
}

export interface HeadToHeadOutcome {
  outcome: 'win' | 'loss' | 'tie';
  headline: string;
  subtext: string;
}

export interface RoomRunSnapshot {
  challengeId: string;
  playerName: string;
  finalHp: number;
  results: RoundResult[];
  savedAt: number;
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

// ---------------- CHALLENGE IDS & IMAGE COMPACTION ----------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateChallengeId(length: number = 8): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return id;
}

export function getOrCreateClientPlayerId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem('whatchawhen_client_id');
      if (existing && existing.length >= 6) return existing;
      const fresh = `p_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
      localStorage.setItem('whatchawhen_client_id', fresh);
      return fresh;
    }
  } catch {
    // Ignore storage unavailability
  }
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

const VALID_CATEGORIES = new Set<Category>(['music', 'books', 'art', 'everything']);
const VALID_DIFFICULTIES = new Set<Difficulty>(['easy', 'normal', 'hard']);
const VALID_MODES = new Set<GameMode>(['classic', 'forever']);

function catToCode(cat: WorkCategory): 'm' | 'b' | 'a' {
  return cat === 'music' ? 'm' : cat === 'books' ? 'b' : 'a';
}

function codeToCat(code: unknown): WorkCategory {
  if (code === 'b') return 'books';
  if (code === 'a') return 'art';
  return 'music';
}

function stripWikiUtmParams(url: string): string {
  return url.replace(/[?&]utm_[^&]+/g, m => (m.startsWith('?') ? '?' : '')).replace(/\?$/, '');
}

export function compactImageUrl(url: string): string {
  if (!url) return '';
  const clean = stripWikiUtmParams(url.trim());

  const olMatch = clean.match(/^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d+-[SML])\.jpg(?:\?default=false)?$/i);
  if (olMatch) return `ol:${olMatch[1]}`;

  const thumbMatch = clean.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/(commons|en)\/thumb\/([0-9a-f]+\/[0-9a-f]+)\/([^/]+)\/(\d+)px-\3$/i
  );
  if (thumbMatch) {
    const scope = thumbMatch[1] === 'commons' ? 'wm' : 'wn';
    return `${scope}:${thumbMatch[2]}:${thumbMatch[4]}:${thumbMatch[3]}`;
  }

  if (clean.startsWith('https://thumb.wikimedia.org/wikipedia/commons/thumb/')) {
    return `tc:${clean.slice('https://thumb.wikimedia.org/wikipedia/commons/thumb/'.length)}`;
  }
  if (clean.startsWith('https://upload.wikimedia.org/wikipedia/commons/thumb/')) {
    return `wt:${clean.slice('https://upload.wikimedia.org/wikipedia/commons/thumb/'.length)}`;
  }
  if (clean.startsWith('https://upload.wikimedia.org/wikipedia/commons/')) {
    return `wc:${clean.slice('https://upload.wikimedia.org/wikipedia/commons/'.length)}`;
  }
  if (clean.startsWith('https://upload.wikimedia.org/wikipedia/en/thumb/')) {
    return `we:${clean.slice('https://upload.wikimedia.org/wikipedia/en/thumb/'.length)}`;
  }
  if (clean.startsWith('https://upload.wikimedia.org/wikipedia/en/')) {
    return `wo:${clean.slice('https://upload.wikimedia.org/wikipedia/en/'.length)}`;
  }
  if (clean.startsWith('https://coverartarchive.org/')) {
    return `ca:${clean.slice('https://coverartarchive.org/'.length)}`;
  }
  return clean;
}

export function expandImageUrl(token: string): string {
  if (!token) return '';
  if (token.startsWith('ol:')) {
    return `https://covers.openlibrary.org/b/id/${token.slice(3)}.jpg?default=false`;
  }
  if (token.startsWith('wm:') || token.startsWith('wn:')) {
    const repo = token.startsWith('wm:') ? 'commons' : 'en';
    const rest = token.slice(3);
    const firstColon = rest.indexOf(':');
    const secondColon = firstColon >= 0 ? rest.indexOf(':', firstColon + 1) : -1;
    if (firstColon > 0 && secondColon > firstColon) {
      const dir = rest.slice(0, firstColon);
      const size = rest.slice(firstColon + 1, secondColon);
      const file = rest.slice(secondColon + 1);
      return `https://upload.wikimedia.org/wikipedia/${repo}/thumb/${dir}/${file}/${size}px-${file}`;
    }
  }
  if (token.startsWith('tc:')) {
    return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${token.slice(3)}`;
  }
  if (token.startsWith('wt:')) {
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${token.slice(3)}`;
  }
  if (token.startsWith('wc:')) {
    return `https://upload.wikimedia.org/wikipedia/commons/${token.slice(3)}`;
  }
  if (token.startsWith('we:')) {
    return `https://upload.wikimedia.org/wikipedia/en/thumb/${token.slice(3)}`;
  }
  if (token.startsWith('wo:')) {
    return `https://upload.wikimedia.org/wikipedia/en/${token.slice(3)}`;
  }
  if (token.startsWith('ca:')) {
    return `https://coverartarchive.org/${token.slice(3)}`;
  }
  return token;
}

// ---------------- BASE64URL & MANIFEST CODECS ----------------

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

export function encodeChallengeManifest(
  manifest: LockedRoundEntry[],
  distractors?: LockedDistractorEntry[]
): string {
  const rows = manifest.map(entry => {
    const tuple: (string | number)[] = [
      entry.slug,
      entry.creator,
      entry.year,
      catToCode(entry.category),
      entry.image ? compactImageUrl(entry.image) : '',
      entry.title !== entry.slug.replace(/_/g, ' ') ? entry.title : '',
    ];
    while (tuple.length > 4 && tuple[tuple.length - 1] === '') {
      tuple.pop();
    }
    return tuple;
  });

  const payload: {
    r: (string | number)[][];
    d?: [string, string, string][];
  } = { r: rows };

  if (distractors && distractors.length > 0) {
    payload.d = distractors.map(d => [catToCode(d.category), d.title, d.creator]);
  }

  return toBase64Url(JSON.stringify(payload));
}

export function decodeChallengeManifest(rawToken: string): {
  manifest?: LockedRoundEntry[];
  distractors?: LockedDistractorEntry[];
} {
  if (!rawToken || typeof rawToken !== 'string') return {};
  const json = fromBase64Url(rawToken.trim());
  if (!json) return {};

  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.r)) return {};

    const manifest: LockedRoundEntry[] = [];
    for (const row of parsed.r) {
      if (!Array.isArray(row) || row.length < 4) continue;
      const slug = String(row[0] || '').trim();
      const creator = String(row[1] || 'Acclaimed Creator').trim();
      const year = Math.max(1400, Math.min(2026, Math.round(Number(row[2]) || 1980)));
      const category = codeToCat(row[3]);
      const imageToken = row[4] ? String(row[4]) : '';
      const rawTitle = row[5] ? String(row[5]).trim() : '';
      const genre = row[6] ? String(row[6]).trim() : undefined;

      if (!slug) continue;
      manifest.push({
        slug,
        title: rawTitle || slug.replace(/_/g, ' '),
        creator,
        year,
        category,
        image: imageToken ? expandImageUrl(imageToken) : undefined,
        genre,
      });
    }

    const distractors: LockedDistractorEntry[] = [];
    if (Array.isArray(parsed.d)) {
      for (const row of parsed.d) {
        if (!Array.isArray(row) || row.length < 3) continue;
        const category = codeToCat(row[0]);
        const title = String(row[1] || '').trim();
        const creator = String(row[2] || '').trim();
        if (title && creator) {
          distractors.push({ category, title, creator });
        }
      }
    }

    return {
      manifest: manifest.length > 0 ? manifest : undefined,
      distractors: distractors.length > 0 ? distractors : undefined,
    };
  } catch {
    return {};
  }
}

// ---------------- SCORE TOKENS (WW1 SINGLE & WW2 MULTI-PLAYER) ----------------

function parseSingleCompactScore(
  data: any,
  fallbackChallengeId = ''
): MultiplayerScoreSummary | null {
  if (!data || typeof data !== 'object' || typeof data.s !== 'number') return null;
  return {
    challengeId: String(data.c || fallbackChallengeId || ''),
    name: String(data.n || 'Friend').slice(0, 20),
    score: Math.max(0, Math.round(data.s)),
    roundsCompleted: Math.max(0, Math.round(data.r ?? 0)),
    survived: Math.max(0, Math.round(data.v ?? data.r ?? 0)),
    died: Boolean(data.d),
    gameMode: data.m === 'f' ? 'forever' : 'classic',
    roundScores: Array.isArray(data.p)
      ? data.p.map((x: unknown) => Math.max(0, Number(x) || 0))
      : [],
    finishedAt: Number(data.t) || Date.now(),
    playerId: data.i ? String(data.i) : undefined,
  };
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
    ...(summary.playerId ? { i: summary.playerId } : {}),
  };
  return `WW1:${toBase64Url(JSON.stringify(compact))}`;
}

export function encodeLeaderboardToken(
  challengeId: string,
  scores: MultiplayerScoreSummary[]
): string {
  const unique = mergeChallengeScores(challengeId, scores).slice(0, 16);
  if (unique.length === 1) {
    return encodeResultToken(unique[0]);
  }
  const payload = {
    c: challengeId,
    l: unique.map(s => ({
      n: s.name.slice(0, 20),
      s: s.score,
      r: s.roundsCompleted,
      v: s.survived,
      d: s.died ? 1 : 0,
      m: s.gameMode === 'forever' ? 'f' : 'c',
      p: s.roundScores,
      t: s.finishedAt,
      ...(s.playerId ? { i: s.playerId } : {}),
    })),
  };
  return `WW2:${toBase64Url(JSON.stringify(payload))}`;
}

export function decodeScoreInput(rawInput: string): MultiplayerScoreSummary[] {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

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

  if (token.startsWith('WW2:')) {
    const decoded = fromBase64Url(token.slice(4));
    if (!decoded) return [];
    try {
      const data = JSON.parse(decoded);
      if (!data || !Array.isArray(data.l)) return [];
      const cid = String(data.c || '');
      const parsed: MultiplayerScoreSummary[] = [];
      for (const entry of data.l) {
        const s = parseSingleCompactScore(entry, cid);
        if (s) parsed.push(s);
      }
      return parsed;
    } catch {
      return [];
    }
  }

  if (token.startsWith('WW1:')) {
    token = token.slice(4);
  }

  const decoded = fromBase64Url(token);
  if (!decoded) return [];

  try {
    const data = JSON.parse(decoded);
    const single = parseSingleCompactScore(data);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

export function decodeResultToken(rawInput: string): MultiplayerScoreSummary | null {
  return decodeScoreInput(rawInput)[0] ?? null;
}

export function buildChallengeUrl(
  challenge: MultiplayerChallenge,
  myResultOrScores?: MultiplayerScoreSummary | MultiplayerScoreSummary[]
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
  if (challenge.manifest && challenge.manifest.length > 0) {
    params.set('m', encodeChallengeManifest(challenge.manifest, challenge.distractors));
  }

  if (myResultOrScores) {
    if (Array.isArray(myResultOrScores)) {
      if (myResultOrScores.length === 1) {
        params.set('opp', encodeResultToken(myResultOrScores[0]));
      } else if (myResultOrScores.length > 1) {
        params.set('opp', encodeLeaderboardToken(challenge.id, myResultOrScores));
      }
    } else {
      params.set('opp', encodeResultToken(myResultOrScores));
    }
  }

  return `${origin}?${params.toString()}`;
}

export function parseChallengeFromLocation(
  searchStr?: string
): {
  challenge: MultiplayerChallenge;
  opponentResults: MultiplayerScoreSummary[];
  opponentResult?: MultiplayerScoreSummary;
} | null {
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

  const manifestParam = params.get('m');
  const decodedManifest = manifestParam ? decodeChallengeManifest(manifestParam) : {};

  const challenge: MultiplayerChallenge = {
    id,
    category: VALID_CATEGORIES.has(rawCat) ? rawCat : 'music',
    difficulty: VALID_DIFFICULTIES.has(rawDiff) ? rawDiff : 'normal',
    gameMode: VALID_MODES.has(rawMode) ? rawMode : 'classic',
    hostName,
    manifest: decodedManifest.manifest,
    distractors: decodedManifest.distractors,
  };

  const oppParam = params.get('opp');
  const opponentResults = oppParam ? decodeScoreInput(oppParam) : [];

  return {
    challenge,
    opponentResults,
    opponentResult: opponentResults[0],
  };
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

// ---------------- SAME-ORIGIN LIVE SYNC & MULTI-PLAYER MERGING ----------------

const STORAGE_PREFIX = 'whatchawhen_ch_scores_';
const SNAPSHOT_PREFIX = 'whatchawhen_ch_run_';

export function isSameScoreIdentity(
  a: MultiplayerScoreSummary,
  b: MultiplayerScoreSummary
): boolean {
  if (a.playerId && b.playerId) {
    return a.playerId === b.playerId;
  }
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    a.finishedAt === b.finishedAt &&
    a.score === b.score
  );
}

export function mergeChallengeScores(
  challengeId: string,
  ...lists: (MultiplayerScoreSummary[] | undefined)[]
): MultiplayerScoreSummary[] {
  const out: MultiplayerScoreSummary[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      if (!item || (challengeId && item.challengeId && item.challengeId !== challengeId)) {
        continue;
      }
      const existingIdx = out.findIndex(existing => isSameScoreIdentity(existing, item));
      if (existingIdx >= 0) {
        // Keep the latest completed run for that player
        if (item.finishedAt >= out[existingIdx].finishedAt) {
          out[existingIdx] = item;
        }
      } else {
        out.push(item);
      }
    }
  }
  return out;
}

export function sortChallengeLeaderboard(
  scores: MultiplayerScoreSummary[],
  gameMode: GameMode
): MultiplayerScoreSummary[] {
  return [...scores].sort((a, b) => {
    if (gameMode === 'forever' && a.survived !== b.survived) {
      return b.survived - a.survived;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (b.roundsCompleted !== a.roundsCompleted) return b.roundsCompleted - a.roundsCompleted;
    return a.finishedAt - b.finishedAt;
  });
}

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

export function saveChallengeScoresToStorage(
  challengeId: string,
  scores: MultiplayerScoreSummary[]
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const merged = mergeChallengeScores(challengeId, loadStoredChallengeScores(challengeId), scores).slice(-20);
    localStorage.setItem(`${STORAGE_PREFIX}${challengeId}`, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

export function saveRoomRunSnapshot(snapshot: RoomRunSnapshot): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${SNAPSHOT_PREFIX}${snapshot.challengeId}`, JSON.stringify(snapshot));
  } catch {
    // Ignore quota errors
  }
}

export function loadRoomRunSnapshot(challengeId: string): RoomRunSnapshot | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${challengeId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomRunSnapshot;
    if (!parsed || parsed.challengeId !== challengeId || !Array.isArray(parsed.results)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function publishChallengeScore(
  challengeId: string,
  summary: MultiplayerScoreSummary
): void {
  saveChallengeScoresToStorage(challengeId, [summary]);

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
        for (const item of list) {
          if (item) onScore(item);
        }
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

// ---------------- RANKINGS & HEAD-TO-HEAD COMPARISON ----------------

export function evaluateRoomStanding(
  mine: MultiplayerScoreSummary,
  sortedLeaderboard: MultiplayerScoreSummary[]
): RoomStanding {
  const total = sortedLeaderboard.length;
  if (total <= 1) {
    return {
      outcome: 'solo',
      rank: 1,
      totalPlayers: 1,
      headline: '⏳ WAITING FOR FRIENDS',
      subtext: 'Send your Result Link so others can compare on this exact set.',
    };
  }

  const top = sortedLeaderboard[0];
  const isTiedWithTop =
    mine.gameMode === 'forever'
      ? mine.survived === top.survived && mine.score === top.score
      : mine.score === top.score;

  const topTiedPlayers = sortedLeaderboard.filter(p =>
    mine.gameMode === 'forever'
      ? p.survived === top.survived && p.score === top.score
      : p.score === top.score
  );

  const myIndex = sortedLeaderboard.findIndex(p => isSameScoreIdentity(p, mine));
  const rank = isTiedWithTop ? 1 : (myIndex >= 0 ? myIndex + 1 : total);

  if (total === 2) {
    const other = sortedLeaderboard.find(p => !isSameScoreIdentity(p, mine)) || sortedLeaderboard[1];
    const h2h = compareChallengeResults(mine, other);
    return {
      outcome: h2h.outcome,
      rank,
      totalPlayers: 2,
      headline: h2h.headline,
      subtext: h2h.subtext,
    };
  }

  if (isTiedWithTop && topTiedPlayers.length > 1) {
    return {
      outcome: 'tie',
      rank: 1,
      totalPlayers: total,
      headline: `🤝 TIED FOR #1 OUT OF ${total} PLAYERS!`,
      subtext: `Locked at ${mine.score.toLocaleString()} pts${
        mine.gameMode === 'forever' ? ` (${mine.survived} survived)` : ''
      }.`,
    };
  }

  if (rank === 1) {
    const runnerUp = sortedLeaderboard[1];
    if (mine.gameMode === 'forever' && mine.survived !== runnerUp.survived) {
      return {
        outcome: 'win',
        rank: 1,
        totalPlayers: total,
        headline: `🏆 #1 OF ${total} PLAYERS!`,
        subtext: `Outlasted everyone (${mine.survived} rounds vs ${runnerUp.name}'s ${runnerUp.survived}).`,
      };
    }
    const lead = mine.score - runnerUp.score;
    return {
      outcome: 'win',
      rank: 1,
      totalPlayers: total,
      headline: `🏆 #1 OF ${total} PLAYERS!`,
      subtext: `Ahead of ${runnerUp.name} by +${lead.toLocaleString()} pts!`,
    };
  }

  if (mine.gameMode === 'forever' && top.survived !== mine.survived) {
    return {
      outcome: 'loss',
      rank,
      totalPlayers: total,
      headline: `#${rank} OF ${total} PLAYERS`,
      subtext: `${top.name} leads (#1) with ${top.survived} rounds (${top.score.toLocaleString()} pts).`,
    };
  }

  const behind = top.score - mine.score;
  return {
    outcome: 'loss',
    rank,
    totalPlayers: total,
    headline: `#${rank} OF ${total} PLAYERS`,
    subtext: `Behind #1 (${top.name}) by ${behind.toLocaleString()} pts.`,
  };
}

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
