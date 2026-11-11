import { Category, Difficulty, GameMode, RoundResult, WorkCategory } from '../types';

export interface LockedRoundEntry {
  slug: string;
  title: string;
  creator: string;
  year: number;
  category: WorkCategory;
  pageId?: number;
  image?: string;
  coverChanged?: boolean;
  genre?: string;
}

export interface LockedDistractorEntry {
  category: WorkCategory;
  title: string;
  creator: string;
  pageId?: number;
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

// ---------------- COMPACT BINARY URL & SCORE CODECS ----------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(token: string): Uint8Array | null {
  try {
    const clean = token.trim();
    const padded = clean.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((clean.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function toBase64Url(jsonText: string): string {
  return bytesToBase64Url(new TextEncoder().encode(jsonText));
}

function fromBase64Url(token: string): string | null {
  const bytes = base64UrlToBytes(token);
  if (!bytes) return null;
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

class ByteWriter {
  bytes: number[] = [];

  u8(v: number) {
    this.bytes.push(v & 0xff);
  }

  u16(v: number) {
    this.bytes.push((v >>> 8) & 0xff, v & 0xff);
  }

  raw(arr: Uint8Array | number[]) {
    for (let i = 0; i < arr.length; i++) {
      this.bytes.push(arr[i] & 0xff);
    }
  }

  varuint(v: number | bigint) {
    let n = typeof v === 'bigint' ? v : BigInt(Math.max(0, Math.floor(v)));
    if (n < 0n) n = 0n;
    while (n >= 0x80n) {
      this.bytes.push(Number(n & 0x7fn) | 0x80);
      n >>= 7n;
    }
    this.bytes.push(Number(n));
  }

  str(s: string) {
    const utf8 = new TextEncoder().encode(s);
    this.varuint(utf8.length);
    this.raw(utf8);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

class ByteReader {
  pos = 0;
  constructor(public readonly buf: Uint8Array) {}

  get hasMore(): boolean {
    return this.pos < this.buf.length;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new Error('EOF');
    return this.buf[this.pos++];
  }

  u16(): number {
    const hi = this.u8();
    const lo = this.u8();
    return (hi << 8) | lo;
  }

  slice(len: number): Uint8Array {
    if (len < 0 || this.pos + len > this.buf.length) throw new Error('EOF');
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  varuint(): bigint {
    let res = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      const b = this.u8();
      res |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return res;
      shift += 7n;
    }
    throw new Error('Malformed varint');
  }

  varnum(): number {
    return Number(this.varuint());
  }

  str(): string {
    const len = this.varnum();
    const bytes = this.slice(len);
    return new TextDecoder().decode(bytes);
  }
}

const CAT_LIST: Category[] = ['music', 'books', 'art', 'everything'];
const DIFF_LIST: Difficulty[] = ['normal', 'easy', 'hard'];
const OL_SIZES = ['M', 'L', 'S'] as const;
const CAA_SIZES = ['500', '250', '1200', ''] as const;
const TIME_EPOCH_MS = 1700000000000;

function catToNum(cat: Category): number {
  const idx = CAT_LIST.indexOf(cat);
  return idx >= 0 ? idx : 0;
}

function numToWorkCat(n: number): WorkCategory {
  if (n === 1) return 'books';
  if (n === 2) return 'art';
  return 'music';
}

function tryPackRoomId8(id: string): Uint8Array | null {
  if (id.length !== 8) return null;
  let acc = 0n;
  for (let i = 0; i < 8; i++) {
    const idx = CODE_ALPHABET.indexOf(id[i]);
    if (idx < 0) return null;
    acc = (acc << 5n) | BigInt(idx);
  }
  return new Uint8Array([
    Number((acc >> 32n) & 0xffn),
    Number((acc >> 24n) & 0xffn),
    Number((acc >> 16n) & 0xffn),
    Number((acc >> 8n) & 0xffn),
    Number(acc & 0xffn),
  ]);
}

function unpackRoomId8(bytes: Uint8Array): string {
  let acc = 0n;
  for (let i = 0; i < 5; i++) {
    acc = (acc << 8n) | BigInt(bytes[i]);
  }
  let out = '';
  for (let shift = 35n; shift >= 0n; shift -= 5n) {
    const idx = Number((acc >> shift) & 31n);
    out += CODE_ALPHABET[idx];
  }
  return out;
}

function writeRoomId(w: ByteWriter, rawId: string): boolean {
  const id = rawId.trim().toUpperCase();
  const packed = tryPackRoomId8(id);
  if (packed) {
    w.raw(packed);
    return true;
  }
  w.str(id);
  return false;
}

function readRoomId(r: ByteReader, isPacked: boolean): string {
  return isPacked ? unpackRoomId8(r.slice(5)) : r.str();
}

function hexUuidToBytes(uuid: string): Uint8Array | null {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHexUuid(bytes: Uint8Array): string {
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Encodes a Multiplayer room into a single compact URL token (`r=`).
 * Live Wikipedia rounds encode purely as varint pageIds + 10-bit years + cover delta (~95-175 char links).
 */
export function encodeChallengeToken(challenge: MultiplayerChallenge): string {
  const w = new ByteWriter();
  const cleanId = challenge.id.trim().toUpperCase();
  const idPacked = tryPackRoomId8(cleanId) !== null;
  const isForever = challenge.gameMode === 'forever' ? 1 : 0;
  const diffCode = Math.max(0, DIFF_LIST.indexOf(challenge.difficulty));
  const catCode = catToNum(challenge.category);

  // Byte 0: version(2b=1) | isForever(1b) | diff(2b) | cat(2b) | idPacked(1b)
  w.u8((1 << 6) | (isForever << 5) | (diffCode << 3) | (catCode << 1) | (idPacked ? 1 : 0));
  writeRoomId(w, cleanId);

  const hostTrim = (challenge.hostName || '').trim().slice(0, 20);
  const hasHost = hostTrim.length > 0 && hostTrim !== 'Player 1';
  const manifest = challenge.manifest || [];
  const distractors =
    challenge.difficulty === 'easy' && challenge.distractors ? challenge.distractors : [];
  const hasDistractors = distractors.length > 0;

  w.u8((hasHost ? 0x80 : 0) | (hasDistractors ? 0x40 : 0) | (manifest.length & 0x3f));
  if (hasHost) w.str(hostTrim);

  for (const entry of manifest) {
    const catN = catToNum(entry.category) & 0x3;
    const yearOff = Math.max(0, Math.min(1023, Math.round((entry.year || 1980) - 1400)));

    if (entry.pageId && entry.pageId > 0) {
      let coverKind = 0;
      let coverPayload: (() => void) | null = null;

      if (entry.coverChanged && entry.image) {
        const compacted = compactImageUrl(entry.image);
        const olMatch = compacted.match(/^ol:(\d+)-([MLS])$/i);
        const caMatch = compacted.match(
          /^ca:(release(?:-group)?)\/([0-9a-f-]{36})\/(\d+)(?:-(\d+))?\.(jpg|png)$/i
        );
        if (olMatch) {
          coverKind = 1;
          const olId = BigInt(olMatch[1]);
          const sizeIdx = BigInt(Math.max(0, OL_SIZES.indexOf(olMatch[2].toUpperCase() as 'M' | 'L' | 'S')));
          coverPayload = () => w.varuint(olId * 4n + sizeIdx);
        } else if (caMatch) {
          const uuidBytes = hexUuidToBytes(caMatch[2]);
          if (uuidBytes) {
            coverKind = 2;
            const isGroup = caMatch[1].toLowerCase() === 'release-group' ? 1 : 0;
            const caaSizeIdx = Math.max(0, CAA_SIZES.indexOf((caMatch[4] || '') as typeof CAA_SIZES[number]));
            const isPng = caMatch[5].toLowerCase() === 'png' ? 1 : 0;
            const imgId = BigInt(caMatch[3]);
            coverPayload = () => {
              w.u8((isGroup << 3) | (caaSizeIdx << 1) | isPng);
              w.raw(uuidBytes);
              w.varuint(imgId);
            };
          } else {
            coverKind = 3;
            coverPayload = () => w.str(compacted);
          }
        } else {
          coverKind = 3;
          coverPayload = () => w.str(compacted);
        }
      }

      // 16 bits: [isPageId:1][cat:2][coverKind:2][unused:1][yearOffset:10]
      w.u16((1 << 15) | (catN << 13) | (coverKind << 11) | yearOff);
      w.varuint(entry.pageId);
      if (coverPayload) coverPayload();
    } else {
      // Offline/legacy fallback entry without pageId
      w.u16((catN << 13) | yearOff);
      w.str(entry.slug);
      w.str(entry.creator);
      w.str(entry.title !== entry.slug.replace(/_/g, ' ') ? entry.title : '');
      w.str(entry.image ? compactImageUrl(entry.image) : '');
    }
  }

  if (hasDistractors) {
    w.u8(distractors.length);
    for (const d of distractors) {
      const catN = BigInt(catToNum(d.category) & 0x3);
      if (d.pageId && d.pageId > 0) {
        w.varuint((BigInt(d.pageId) << 3n) | (catN << 1n) | 1n);
      } else {
        w.varuint(catN << 1n);
        w.str(d.title);
        w.str(d.creator);
      }
    }
  }

  return bytesToBase64Url(w.toUint8Array());
}

export function decodeChallengeToken(rawToken: string): MultiplayerChallenge | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const bytes = base64UrlToBytes(rawToken);
  if (!bytes || bytes.length < 7) return null;

  try {
    const r = new ByteReader(bytes);
    const meta1 = r.u8();
    const version = (meta1 >>> 6) & 0x3;
    if (version !== 1) return null;

    const isForever = ((meta1 >>> 5) & 0x1) === 1;
    const diffCode = (meta1 >>> 3) & 0x3;
    const catCode = (meta1 >>> 1) & 0x3;
    const idPacked = (meta1 & 0x1) === 1;

    const id = readRoomId(r, idPacked);
    if (!id || id.length < 4) return null;

    const meta2 = r.u8();
    const hasHost = (meta2 & 0x80) !== 0;
    const hasDistractors = (meta2 & 0x40) !== 0;
    const roundCount = meta2 & 0x3f;
    const hostName = hasHost ? r.str() || 'Player 1' : 'Player 1';

    const manifest: LockedRoundEntry[] = [];
    for (let i = 0; i < roundCount; i++) {
      const head = r.u16();
      const isPageId = (head & 0x8000) !== 0;
      const catN = (head >>> 13) & 0x3;
      const coverKind = (head >>> 11) & 0x3;
      const year = 1400 + (head & 0x3ff);
      const entryCat = numToWorkCat(catN);

      if (isPageId) {
        const pageId = r.varnum();
        let image: string | undefined;
        let coverChanged = false;

        if (coverKind === 1) {
          const packedOl = r.varuint();
          const olSize = OL_SIZES[Number(packedOl % 4n)] || 'M';
          const olId = packedOl / 4n;
          image = expandImageUrl(`ol:${olId}-${olSize}`);
          coverChanged = true;
        } else if (coverKind === 2) {
          const caaMeta = r.u8();
          const isGroup = ((caaMeta >>> 3) & 0x1) === 1;
          const sizeStr = CAA_SIZES[(caaMeta >>> 1) & 0x3] || '';
          const ext = (caaMeta & 0x1) === 1 ? 'png' : 'jpg';
          const uuid = bytesToHexUuid(r.slice(16));
          const imgId = r.varuint();
          const kindPath = isGroup ? 'release-group' : 'release';
          const suffix = sizeStr ? `-${sizeStr}` : '';
          image = `https://coverartarchive.org/${kindPath}/${uuid}/${imgId}${suffix}.${ext}`;
          coverChanged = true;
        } else if (coverKind === 3) {
          const tok = r.str();
          image = tok ? expandImageUrl(tok) : undefined;
          coverChanged = Boolean(image);
        }

        manifest.push({
          pageId,
          slug: '',
          title: '',
          creator: '',
          year,
          category: entryCat,
          image,
          coverChanged,
        });
      } else {
        const slug = r.str();
        const creator = r.str();
        const rawTitle = r.str();
        const imgTok = r.str();
        manifest.push({
          slug,
          title: rawTitle || slug.replace(/_/g, ' '),
          creator: creator || 'Acclaimed Creator',
          year,
          category: entryCat,
          image: imgTok ? expandImageUrl(imgTok) : undefined,
          coverChanged: Boolean(imgTok),
        });
      }
    }

    const distractors: LockedDistractorEntry[] = [];
    if (hasDistractors && r.hasMore) {
      const distCount = r.u8();
      for (let i = 0; i < distCount; i++) {
        const tag = r.varuint();
        const isPageId = (tag & 1n) === 1n;
        const entryCat = numToWorkCat(Number((tag >> 1n) & 3n));
        if (isPageId) {
          const pageId = Number(tag >> 3n);
          distractors.push({ category: entryCat, pageId, title: '', creator: '' });
        } else {
          const title = r.str();
          const creator = r.str();
          if (title && creator) {
            distractors.push({ category: entryCat, title, creator });
          }
        }
      }
    }

    return {
      id,
      category: CAT_LIST[catCode] || 'music',
      difficulty: DIFF_LIST[diffCode] || 'normal',
      gameMode: isForever ? 'forever' : 'classic',
      hostName,
      manifest: manifest.length > 0 ? manifest : undefined,
      distractors: distractors.length > 0 ? distractors : undefined,
    };
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
        coverChanged: Boolean(imageToken),
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

// ---------------- COMPACT SCORE TOKENS (W3 BINARY + LEGACY WW1/WW2) ----------------

function encodeCompactScoresBytes(
  scores: MultiplayerScoreSummary[],
  embeddedChallengeId?: string
): Uint8Array {
  const w = new ByteWriter();
  const hasId = Boolean(embeddedChallengeId && embeddedChallengeId.trim().length > 0);
  const cleanId = (embeddedChallengeId || '').trim().toUpperCase();
  const idPacked = hasId && tryPackRoomId8(cleanId) !== null;
  const list = scores.slice(0, 15);

  // Header: version(2b=1) | hasId(1b) | idPacked(1b) | count(4b)
  w.u8((1 << 6) | (hasId ? 0x20 : 0) | (idPacked ? 0x10 : 0) | (list.length & 0xf));
  if (hasId) {
    writeRoomId(w, cleanId);
  }

  for (const s of list) {
    const rLen = s.roundScores.length;
    const inlineLen = Math.min(31, rLen);
    const sameSurvived = s.survived === s.roundsCompleted;
    const flags =
      (s.died ? 0x80 : 0) |
      (s.gameMode === 'forever' ? 0x40 : 0) |
      (sameSurvived ? 0x20 : 0) |
      (inlineLen & 0x1f);
    w.u8(flags);
    if (rLen >= 31) w.varuint(rLen);

    w.str(s.name.slice(0, 20));
    w.str(s.playerId || '');
    w.varuint(s.score);
    w.varuint(s.roundsCompleted);
    if (!sameSurvived) w.varuint(s.survived);
    w.varuint(Math.max(0, Math.round((s.finishedAt || Date.now()) - TIME_EPOCH_MS)));

    for (const pts of s.roundScores) {
      w.varuint(Math.max(0, Math.round(pts)));
    }
  }

  return w.toUint8Array();
}

function decodeCompactScoresBytes(
  bytes: Uint8Array,
  fallbackChallengeId = ''
): MultiplayerScoreSummary[] {
  try {
    const r = new ByteReader(bytes);
    const header = r.u8();
    const version = (header >>> 6) & 0x3;
    if (version !== 1) return [];

    const hasId = (header & 0x20) !== 0;
    const idPacked = (header & 0x10) !== 0;
    const count = header & 0xf;
    const challengeId = hasId ? readRoomId(r, idPacked) : fallbackChallengeId;

    const out: MultiplayerScoreSummary[] = [];
    for (let i = 0; i < count; i++) {
      const flags = r.u8();
      const died = (flags & 0x80) !== 0;
      const gameMode: GameMode = (flags & 0x40) !== 0 ? 'forever' : 'classic';
      const sameSurvived = (flags & 0x20) !== 0;
      const inlineLen = flags & 0x1f;
      const roundScoresLen = inlineLen >= 31 ? r.varnum() : inlineLen;

      const name = r.str() || 'Friend';
      const rawPid = r.str();
      const score = r.varnum();
      const roundsCompleted = r.varnum();
      const survived = sameSurvived ? roundsCompleted : r.varnum();
      const finishedAt = TIME_EPOCH_MS + r.varnum();

      const roundScores: number[] = [];
      for (let k = 0; k < roundScoresLen; k++) {
        roundScores.push(r.varnum());
      }

      out.push({
        challengeId,
        name,
        score,
        roundsCompleted,
        survived,
        died,
        gameMode,
        roundScores,
        finishedAt,
        playerId: rawPid || undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

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
  return encodeLeaderboardToken(summary.challengeId, [summary]);
}

export function encodeLeaderboardToken(
  challengeId: string,
  scores: MultiplayerScoreSummary[]
): string {
  const unique = mergeChallengeScores(challengeId, scores).slice(0, 15);
  return `W3:${bytesToBase64Url(encodeCompactScoresBytes(unique, challengeId))}`;
}

export function decodeScoreInput(rawInput: string): MultiplayerScoreSummary[] {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  let candidate = trimmed;
  if (/\s/.test(trimmed)) {
    const urls = trimmed.match(/https?:\/\/\S+/gi) || [];
    const scoreUrl = urls.find(u => /[?&](?:s|opp)=/i.test(u));
    if (scoreUrl) {
      candidate = scoreUrl.replace(/[),.;!?]+$/, '');
    } else {
      const codeMatch = trimmed.match(/\b(?:W3|WW[12]):[A-Za-z0-9_-]+/);
      if (codeMatch) {
        candidate = codeMatch[0];
      } else if (urls[0]) {
        candidate = urls[0].replace(/[),.;!?]+$/, '');
      }
    }
  }

  let token = candidate;
  let urlChallengeId = '';
  if (candidate.includes('r=') || candidate.includes('s=') || candidate.includes('opp=')) {
    try {
      const url = candidate.startsWith('http')
        ? new URL(candidate)
        : new URL(candidate, 'http://localhost');
      const rParam = url.searchParams.get('r');
      if (rParam) {
        urlChallengeId = decodeChallengeToken(rParam)?.id || '';
      } else {
        urlChallengeId = (url.searchParams.get('ch') || '').trim().toUpperCase();
      }
      const sParam = url.searchParams.get('s');
      const oppParam = url.searchParams.get('opp');
      if (sParam) {
        token = `W3URL:${sParam}`;
      } else if (oppParam) {
        token = oppParam;
      }
    } catch {
      const sM = candidate.match(/[?&]s=([^&\s]+)/);
      const rM = candidate.match(/[?&]r=([^&\s]+)/);
      if (rM) urlChallengeId = decodeChallengeToken(decodeURIComponent(rM[1]))?.id || '';
      if (sM) {
        token = `W3URL:${decodeURIComponent(sM[1])}`;
      } else {
        const oppM = candidate.match(/[?&]opp=([^&\s]+)/);
        if (oppM) token = decodeURIComponent(oppM[1]);
      }
    }
  }

  if (token.startsWith('W3URL:')) {
    const bytes = base64UrlToBytes(token.slice(6));
    return bytes ? decodeCompactScoresBytes(bytes, urlChallengeId) : [];
  }

  if (token.startsWith('W3:')) {
    const bytes = base64UrlToBytes(token.slice(3));
    return bytes ? decodeCompactScoresBytes(bytes, urlChallengeId) : [];
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
    const single = parseSingleCompactScore(data, urlChallengeId);
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

  const roomToken = encodeChallengeToken(challenge);
  let url = `${origin}?r=${roomToken}`;

  if (myResultOrScores) {
    const rawList = Array.isArray(myResultOrScores) ? myResultOrScores : [myResultOrScores];
    const unique = mergeChallengeScores(challenge.id, rawList).slice(0, 15);
    if (unique.length > 0) {
      const scoreParam = bytesToBase64Url(encodeCompactScoresBytes(unique));
      url += `&s=${scoreParam}`;
    }
  }

  return url;
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

  // 1. New compact binary link (?r=...&s=...)
  const rParam = params.get('r');
  if (rParam) {
    const decodedChallenge = decodeChallengeToken(rParam);
    if (decodedChallenge) {
      const sParam = params.get('s');
      const oppParam = params.get('opp');
      let opponentResults: MultiplayerScoreSummary[] = [];
      if (sParam) {
        const bytes = base64UrlToBytes(sParam);
        if (bytes) {
          opponentResults = decodeCompactScoresBytes(bytes, decodedChallenge.id);
        }
      } else if (oppParam) {
        opponentResults = decodeScoreInput(oppParam);
      }
      return {
        challenge: decodedChallenge,
        opponentResults,
        opponentResult: opponentResults[0],
      };
    }
  }

  // 2. Legacy query format (?ch=...&cat=...&m=...&opp=...)
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
