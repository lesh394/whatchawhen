import { Category, WorkCategory, CulturalItem, GameMode, EasyDistractorMetadata } from '../types';
import { CULTURAL_ITEMS } from '../data/items';
import { resolveSafeBookCoverItem } from './bookCoverResolver';
import { resolveSafeMusicCoverItem } from './musicCoverResolver';
import {
  getBroadEraLabel,
  sanitizeWikiGenre,
  sanitizeWikiHint,
  toEasyOptionKey,
  EasyDistractorSource,
  MUSIC_DISTRACTORS,
  BOOKS_DISTRACTORS,
  ART_DISTRACTORS,
} from './choices';
import {
  LockedDistractorEntry,
  LockedRoundEntry,
  MultiplayerChallenge,
  createSeededRng,
  seededShuffle,
} from './multiplayer';

const USER_AGENT = 'WhatchaWhenGame/3.0 (education@whatchawhen.game; open-source-cultural-game)';

export const WORK_CATEGORIES: WorkCategory[] = ['music', 'books', 'art'];

function pickConcreteCategory(category: Category, rng: () => number = Math.random): WorkCategory {
  if (category === 'everything') {
    return WORK_CATEGORIES[Math.floor(rng() * WORK_CATEGORIES.length)];
  }
  return category;
}

// Museum & movement categories give broad creator variety for distractors
const VERIFIED_ART_GENERAL_CATEGORIES: string[] = [
  'Category:Paintings_in_the_Metropolitan_Museum_of_Art',
  'Category:Paintings_in_the_Art_Institute_of_Chicago',
  'Category:Paintings_in_the_National_Gallery,_London',
  "Category:Paintings_in_the_Musée_d'Orsay",
  'Category:Paintings_in_the_Uffizi',
  'Category:Paintings_in_the_Rijksmuseum',
  'Category:Paintings_in_the_Hermitage_Museum',
  'Category:Paintings_in_the_National_Gallery_of_Art',
  'Category:Paintings_in_the_Museum_of_Fine_Arts,_Boston',
  'Category:Paintings_in_the_Cleveland_Museum_of_Art',
  'Category:Paintings_in_the_Kunsthistorisches_Museum',
  'Category:Paintings_in_the_Philadelphia_Museum_of_Art',
  'Category:Paintings_in_the_Victoria_and_Albert_Museum',
  'Category:Paintings_in_the_Gemäldegalerie,_Berlin',
  'Category:Renaissance_paintings',
  'Category:Baroque_paintings',
  'Category:Impressionist_paintings',
  'Category:Surrealist_paintings',
  'Category:Dutch_Golden_Age_paintings',
  'Category:Romantic_paintings',
  'Category:Realist_paintings',
  'Category:Neoclassical_paintings',
  'Category:Symbolist_paintings',
  'Category:Cubist_paintings',
  'Category:Mannerist_paintings',
  'Category:16th-century_paintings',
  'Category:17th-century_paintings',
  'Category:18th-century_paintings',
  'Category:19th-century_paintings',
  'Category:20th-century_paintings',
];

const VERIFIED_ART_ARTIST_CATEGORIES: string[] = [
  'Category:Paintings_by_Vincent_van_Gogh',
  'Category:Paintings_by_Claude_Monet',
  'Category:Paintings_by_Rembrandt',
  'Category:Paintings_by_Pablo_Picasso',
  'Category:Paintings_by_Salvador_Dalí',
  'Category:Paintings_by_Paul_Cézanne',
  'Category:Paintings_by_Pierre-Auguste_Renoir',
  'Category:Paintings_by_Édouard_Manet',
  'Category:Paintings_by_Edgar_Degas',
  'Category:Paintings_by_Francisco_Goya',
  'Category:Paintings_by_Peter_Paul_Rubens',
  'Category:Paintings_by_Caravaggio',
  'Category:Paintings_by_J._M._W._Turner',
  'Category:Paintings_by_Henri_Matisse',
  'Category:Paintings_by_Edward_Hopper',
  'Category:Paintings_by_Gustav_Klimt',
  'Category:Paintings_by_Camille_Pissarro',
  'Category:Paintings_by_Paul_Gauguin',
  'Category:Paintings_by_John_Singer_Sargent',
];

const VERIFIED_BOOK_LANDMARK_CATEGORIES: string[] = [
  'Category:Dystopian_novels',
  'Category:American_science_fiction_novels',
  'Category:British_science_fiction_novels',
  'Category:American_fantasy_novels',
  'Category:British_fantasy_novels',
  'Category:Historical_novels',
  'Category:American_historical_novels',
  'Category:British_historical_novels',
  'Category:Satirical_novels',
  'Category:Post-apocalyptic_novels',
  'Category:War_novels',
  'Category:Philosophical_novels',
  'Category:Thriller_novels',
  'Category:Bildungsromans',
  'Category:Detective_novels',
  'Category:1886_novels',
  'Category:1897_novels',
  'Category:1901_novels',
  'Category:1908_novels',
  'Category:1911_novels',
  'Category:1925_novels',
  'Category:1932_novels',
];

const SORT_PREFIXES = 'ABCDEFGHIJKLMNOPRSTUVW';
const SORT_SUBPREFIXES = [
  'Ab', 'Al', 'An', 'Ar', 'As', 'At', 'Ba', 'Be', 'Bi', 'Bl', 'Bo', 'Br', 'Bu',
  'Ca', 'Ch', 'Ci', 'Cl', 'Co', 'Cr', 'Da', 'De', 'Di', 'Do', 'Dr', 'Ea', 'El',
  'Em', 'En', 'Es', 'Ev', 'Fa', 'Fe', 'Fi', 'Fl', 'Fo', 'Fr', 'Ga', 'Ge', 'Gi',
  'Go', 'Gr', 'Gu', 'Ha', 'He', 'Hi', 'Ho', 'Hu', 'Il', 'Im', 'In', 'It', 'Ja',
  'Je', 'Jo', 'Ju', 'Ka', 'Ke', 'Ki', 'Ko', 'La', 'Le', 'Li', 'Lo', 'Lu', 'Ma',
  'Me', 'Mi', 'Mo', 'Mu', 'My', 'Na', 'Ne', 'Ni', 'No', 'Nu', 'Ob', 'Od', 'Of',
  'Ol', 'On', 'Op', 'Or', 'Ou', 'Pa', 'Pe', 'Ph', 'Pi', 'Pl', 'Po', 'Pr', 'Pu',
  'Qu', 'Ra', 'Re', 'Ri', 'Ro', 'Ru', 'Sa', 'Sc', 'Se', 'Sh', 'Si', 'Sk', 'Sl',
  'Sm', 'So', 'Sp', 'St', 'Su', 'Sw', 'Sy', 'Ta', 'Te', 'Th', 'Ti', 'To', 'Tr',
  'Tu', 'Tw', 'Un', 'Va', 'Ve', 'Vi', 'Vo', 'Wa', 'We', 'Wh', 'Wi', 'Wo', 'Ye',
  'Yo',
];

const SOLO_SEEN_STORAGE_KEY = 'whatchawhen_solo_seen_v1';
const MAX_PERSISTED_SEEN_ENTRIES = 2500;

// In-memory live round queues + random distractor banks populated directly from Wikipedia
const liveQueue: Record<WorkCategory, CulturalItem[]> = {
  music: [],
  books: [],
  art: [],
};

const liveDistractorBank: Record<WorkCategory, CulturalItem[]> = {
  music: [],
  books: [],
  art: [],
};

const inflightQueueRefills: Partial<Record<WorkCategory, Promise<void>>> = {};
const seenSlugsSession = new Set<string>();
const seenPageIdsSession = new Set<number>();
const seenWorkKeysSession = new Set<string>();
const seenImageKeysSession = new Set<string>();
const persistedSeenRing: Array<{ s?: string; k?: string; p?: number; m?: string }> = [];
let seenStorageHydrated = false;

export type SeenWorkCandidate = {
  id?: string;
  category: WorkCategory;
  title: string;
  creator: string;
  wikiSlug?: string;
  slug?: string;
  wikiPageId?: number;
  pageId?: number;
  image?: string;
  highResImage?: string;
};

export function extractNormalizedImageKey(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim().split('?')[0];
  const wmMatch = clean.match(
    /^https?:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/(?:commons|en)\/(?:thumb\/[0-9a-f]+\/[0-9a-f]+\/([^/]+)\/[^/]+|[0-9a-f]+\/[0-9a-f]+\/([^/]+))$/i
  );
  const rawFile = wmMatch ? wmMatch[1] || wmMatch[2] : '';
  if (!rawFile) return '';
  let decoded = rawFile;
  try {
    decoded = decodeURIComponent(rawFile);
  } catch {
    // Keep raw filename segment if decoding fails
  }
  const norm = decoded
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toLowerCase();
  if (
    norm.length < 8 ||
    /^(?:cover|folder|front|artwork|album|book ?cover|image|photo|portrait|untitled|poster|default|placeholder|no ?cover|unknown)$/.test(
      norm
    )
  ) {
    return '';
  }
  return `wm:${norm}`;
}

function normalizeWorkPart(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toCanonicalWorkKey(
  category: WorkCategory,
  title: string,
  creator?: string
): string {
  const normTitle = normalizeWorkPart(title);
  const rawCreator = (creator || '').trim().toLowerCase();
  const isGeneric =
    !rawCreator ||
    rawCreator === 'acclaimed musician' ||
    rawCreator === 'acclaimed author' ||
    rawCreator === 'master painter' ||
    rawCreator === 'acclaimed creator';
  const normCreator = isGeneric ? '' : normalizeWorkPart(creator || '');
  return normCreator ? `${category}:${normTitle}::${normCreator}` : `${category}:${normTitle}`;
}

function hydrateSeenStorage() {
  if (seenStorageHydrated) return;
  seenStorageHydrated = true;
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(SOLO_SEEN_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const slug = typeof entry.s === 'string' ? entry.s : '';
      const key = typeof entry.k === 'string' ? entry.k : '';
      const pageId = typeof entry.p === 'number' && entry.p > 0 ? entry.p : 0;
      const imgKey = typeof entry.m === 'string' ? entry.m : '';
      if (slug) {
        seenSlugsSession.add(slug);
        seenSlugsSession.add(slug.toLowerCase());
      }
      if (key) seenWorkKeysSession.add(key);
      if (pageId > 0) seenPageIdsSession.add(pageId);
      if (imgKey) seenImageKeysSession.add(imgKey);
      persistedSeenRing.push({
        ...(slug ? { s: slug } : {}),
        ...(key ? { k: key } : {}),
        ...(pageId > 0 ? { p: pageId } : {}),
        ...(imgKey ? { m: imgKey } : {}),
      });
    }
  } catch {
    // Ignore malformed storage
  }
}

export function isWorkSeen(
  item: SeenWorkCandidate,
  extraSeenIds?: ReadonlySet<string>
): boolean {
  hydrateSeenStorage();
  const slug = (item.wikiSlug || item.slug || '').trim();
  const slugLower = slug.toLowerCase();
  const pageId = item.wikiPageId ?? item.pageId;
  const workKey = toCanonicalWorkKey(item.category, item.title, item.creator);
  const imgKey = extractNormalizedImageKey(item.image || item.highResImage);

  if (slug && (seenSlugsSession.has(slug) || seenSlugsSession.has(slugLower))) return true;
  if (pageId && seenPageIdsSession.has(pageId)) return true;
  if (workKey && seenWorkKeysSession.has(workKey)) return true;
  if (imgKey && seenImageKeysSession.has(imgKey)) return true;

  if (extraSeenIds) {
    if (item.id && extraSeenIds.has(item.id)) return true;
    if (slug && (extraSeenIds.has(slug) || extraSeenIds.has(slugLower))) return true;
    if (workKey && extraSeenIds.has(workKey)) return true;
    if (pageId && extraSeenIds.has(`pid:${pageId}`)) return true;
    if (imgKey && extraSeenIds.has(imgKey)) return true;
  }
  return false;
}

export function checkLiveDistractorSeen(entry: EasyDistractorSource): boolean {
  if (!entry.category) return false;
  return isWorkSeen({
    id: entry.id,
    category: entry.category,
    title: entry.title,
    creator: entry.creator,
    wikiSlug: entry.slug || entry.wikiSlug,
    wikiPageId: entry.pageId ?? entry.wikiPageId,
    image: entry.image,
  });
}

export function recordSeenWork(item: SeenWorkCandidate): void {
  hydrateSeenStorage();
  const slug = (item.wikiSlug || item.slug || '').trim();
  const slugLower = slug.toLowerCase();
  const pageId = item.wikiPageId ?? item.pageId;
  const workKey = toCanonicalWorkKey(item.category, item.title, item.creator);
  const imgKey = extractNormalizedImageKey(item.image || item.highResImage);

  const alreadyRecorded =
    (!slug || seenSlugsSession.has(slugLower)) &&
    seenWorkKeysSession.has(workKey) &&
    (!pageId || seenPageIdsSession.has(pageId)) &&
    (!imgKey || seenImageKeysSession.has(imgKey));

  if (slug) {
    seenSlugsSession.add(slug);
    seenSlugsSession.add(slugLower);
  }
  if (workKey) {
    seenWorkKeysSession.add(workKey);
  }
  if (pageId && pageId > 0) {
    seenPageIdsSession.add(pageId);
  }
  if (imgKey) {
    seenImageKeysSession.add(imgKey);
  }

  if (!alreadyRecorded) {
    persistedSeenRing.push({
      ...(slug ? { s: slug } : {}),
      ...(workKey ? { k: workKey } : {}),
      ...(pageId && pageId > 0 ? { p: pageId } : {}),
      ...(imgKey ? { m: imgKey } : {}),
    });
    if (persistedSeenRing.length > MAX_PERSISTED_SEEN_ENTRIES) {
      persistedSeenRing.splice(0, persistedSeenRing.length - MAX_PERSISTED_SEEN_ENTRIES);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SOLO_SEEN_STORAGE_KEY, JSON.stringify(persistedSeenRing));
      }
    } catch {
      // Ignore storage quota errors
    }
  }
}

// Polite global queue so parallel Wikipedia requests never trigger HTTP 429
let wikiQueueTail: Promise<void> = Promise.resolve();
let lastWikiRequestAt = 0;

async function fetchJsonThrottled(url: string, retries: number = 3): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const run = wikiQueueTail.then(async () => {
      const waitMs = 190 - (Date.now() - lastWikiRequestAt);
      if (waitMs > 0) {
        await new Promise(r => setTimeout(r, waitMs));
      }
      lastWikiRequestAt = Date.now();
      const init: RequestInit | undefined =
        typeof window === 'undefined' ? { headers: { 'User-Agent': USER_AGENT } } : undefined;
      return fetch(url, init);
    });
    wikiQueueTail = run.then(
      () => undefined,
      () => undefined
    );

    try {
      const res = await run;
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 550 * (attempt + 1)));
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  return null;
}

// ---------------- WIKIPEDIA PARSING HELPERS ----------------

function cleanCreatorCandidate(raw: string): string {
  let out = (raw || '').trim();
  // Strip verbose descriptor prefixes like "the Dutch writer Willem Frederik Hermans"
  out = out.replace(
    /^(?:the\s+)?(?:[A-Za-zÀ-ÿ-]+\s+){0,2}(?:author|writer|novelist|poet|painter|artist|sculptor|musician|singer(?:-songwriter)?|songwriter|rapper|composer|producer|dj|rock band|pop band|metal band|jazz band|indie band|folk band|band|group|duo|trio|ensemble)\s+(?=[A-ZÀ-Ý])/i,
    ''
  );
  // Normalize lowercase leading article like "the Mountain Goats" -> "The Mountain Goats"
  out = out.replace(/^the\s+/, 'The ');
  return out.trim();
}

function extractCreator(desc: string, extract: string, category: WorkCategory): string {
  desc = (desc || '').trim();
  extract = (extract || '').trim();

  // Pattern 1: "... by <Creator>" in description
  const byMatch = desc.match(/\bby\s+([^,.(]+)/i);
  if (byMatch) {
    const candidate = cleanCreatorCandidate(byMatch[1]);
    if (candidate.length > 1 && candidate.length < 55) return candidate;
  }

  // Pattern 2: "<Year> <Author> novel" / "<Year> <Painter> painting" in description
  const prefixMatch = desc.match(
    /^(?:\d{4}\s+)?([A-Z][a-zA-ZÀ-ÿ\s.'-]+?)\s+(?:novel|novella|book|painting|album|single|work)\b/
  );
  if (prefixMatch) {
    const candidate = cleanCreatorCandidate(prefixMatch[1]);
    if (
      candidate.length > 2 &&
      candidate.length < 55 &&
      !/^(?:studio|debut|live|soundtrack|compilation|self-titled|second|third|fourth|fifth|remix|greatest|oil|early|late|young|historical|science|dystopian|fantasy)$/i.test(
        candidate
      )
    ) {
      return candidate;
    }
  }

  // Pattern 3: First sentence "<verb/workNoun> by <Creator>"
  const firstSentence = extract.split(/[.?!]\s/)[0] || '';
  const extBy = firstSentence.match(
    /\b(?:written|painted|recorded|composed|created|executed|authored|sung|performed|novel|novella|book|album|single|song|ep|painting|portrait|fresco|mural|artwork|work)\s+by\s+(?:the\s+)?([A-Z][a-zA-ZÀ-ÿ0-9\s&.'-]+?)(?:,|\s+in\s+|\s+on\s+|\s+for\s+|\s+from\s+|\s+and\s+(?:published|released)|\s*\(|$)/i
  );
  if (extBy) {
    const candidate = cleanCreatorCandidate(extBy[1]);
    if (candidate.length > 2 && candidate.length < 55) return candidate;
  }

  // Pattern 4: Strip known filler words in description
  const cleaned = desc
    .replace(/\b\d{4}\b/g, '')
    .replace(
      /\b(?:studio album|debut studio album|novel|novella|painting|oil painting|oil on canvas|fresco|single|debut album|live album|book)\b/gi,
      ''
    )
    .trim();
  if (cleaned.length > 2 && cleaned.length < 40 && !/\b(?:album|book|painting|work)\b/i.test(cleaned)) {
    return cleaned;
  }

  return category === 'music'
    ? 'Acclaimed Musician'
    : category === 'books'
    ? 'Acclaimed Author'
    : 'Master Painter';
}

function cleanWikipediaTitle(title: string): string {
  return title
    .replace(
      /\s*\((?:[A-Za-zÀ-ÿ.'\s-]{0,30}\s)?(?:album|novel|novella|painting|single|book|play|EP|song|band|musician|artist|series|trilogy|Toorop|Dal[íi]|Monet)\)\s*$/i,
      ''
    )
    .trim();
}

function isBadThumbnailUrl(url: string): boolean {
  return /\.svg(?:\?|$)|flag_of|coat_of_arms|locator|map_of|commons-logo|question_book|ambox|wikibooks/i.test(
    url
  );
}

function isRelevantWorkPage(
  title: string,
  desc: string,
  extract: string,
  category: WorkCategory
): boolean {
  if (
    /^(?:Category:|File:|List of|History of|Timeline of|Index of|Outline of)/i.test(title) ||
    /\b(?:discography|bibliography|videography|filmography)\b/i.test(title)
  ) {
    return false;
  }

  const descLower = (desc || '').toLowerCase();
  const firstClause = (extract || '').split(/[.?!]\s/)[0]?.toLowerCase() || '';
  const combined = `${descLower} ${firstClause}`;

  // Reject biographies, movements, lists, TV/video-game/universe overview pages
  if (
    /\b(?:art movement|style of painting|artistic movement|literary movement|literary genre|music genre|fictional universe|fictional character|television series|tv series|video game|board game|role-playing game|franchise|media franchise)\b/i.test(
      combined
    )
  ) {
    return false;
  }

  if (
    category === 'art' &&
    /^(?:ancient|baroque|renaissance|impressionist|post-impressionist|dutch golden age|rococo|gothic|modern|contemporary|abstract|western|chinese|japanese|indian|persian|byzantine|flemish|romanesque|neoclassical)\s+painting$/i.test(
      title.trim()
    )
  ) {
    return false;
  }

  // Reject pure person biographies unless description explicitly refers to a creative work
  const hasWorkNoun = /\b(?:album|single|song|ep|mixtape|soundtrack|record|novel|novella|book|story|play|poem|painting|portrait|fresco|mural|triptych|diptych|polyptych|altarpiece|watercolor|artwork|canvas|panel)\b/i.test(
    descLower
  );
  const looksLikeBioDesc = /\b(?:born\s+\d|1[4-9]\d{2}\s*[-–]\s*(?:1[4-9]\d{2}|20\d{2})|\d{4}[-–]\d{4}|painter|sculptor|novelist|author|writer|poet|singer|musician|rapper|bandleader)\b/i.test(
    descLower
  );
  if (looksLikeBioDesc && !hasWorkNoun) {
    return false;
  }

  if (category === 'music') {
    return /\b(?:album|single|song|ep|mixtape|soundtrack|record|release|lp)\b/i.test(combined);
  }
  if (category === 'books') {
    if (
      /\bis (?:a|an) (?:\d{4}\s+)?(?:american|british|japanese|canadian|french|australian|animated)?\s*(?:film|movie|television|tv|video game|manga|comic book)\b/i.test(
        firstClause
      )
    ) {
      return false;
    }
    return /\b(?:novel|novella|book|short story|fiction|romance|thriller|mystery|trilogy)\b/i.test(
      combined
    );
  }
  // art
  return /\b(?:painting|oil on|portrait|fresco|mural|triptych|diptych|polyptych|altarpiece|watercolor|canvas|panel|painted|pastel|gouache|tempera|artwork)\b/i.test(
    combined
  );
}

function extractYearFromWikiPage(
  rawTitle: string,
  desc: string,
  extract: string,
  fallbackYear?: number
): number | null {
  const validYears = (text: string): number[] =>
    (text.match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/g) || [])
      .map(y => parseInt(y, 10))
      .filter(y => y >= 1400 && y <= 2026);

  // 1. Wikipedia short description usually starts with exact year ("1978 novel by ...")
  const descYears = validYears(desc || '');
  if (descYears.length > 0) {
    return descYears[0];
  }

  // 2. Strip title prefix & lifespan parentheticals from extract so e.g. "1985 is a novel... published in 1978" gets 1978
  const cleanTitle = cleanWikipediaTitle(rawTitle);
  let body = (extract || '').trim();
  if (cleanTitle && body.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    body = body.slice(cleanTitle.length);
  }
  // Remove lifespan ranges like "(1853–1890)"
  body = body.replace(/\(\s*(?:c\.\s*)?1[3-9]\d{2}\s*[-–—]\s*(?:1[3-9]\d{2}|20[0-2]\d)\s*\)/g, '');

  const explicitMatch = body.match(
    /\b(?:published|released|painted|completed|created|written|recorded|issued|executed|finished|dated|produced)\s+(?:in|around|c\.?|circa|ca\.?|on|during|between)?\s*(?:[A-Za-z]+\s+\d{0,2},?\s*)?\b(1[4-9]\d{2}|20[0-2]\d)\b/i
  );
  if (explicitMatch) {
    const yr = parseInt(explicitMatch[1], 10);
    if (yr >= 1400 && yr <= 2026) return yr;
  }

  const isYearMatch = body.match(/\bis\s+(?:a|an)\s+(?:c\.?\s*)?(1[4-9]\d{2}|20[0-2]\d)\b/i);
  if (isYearMatch) {
    const yr = parseInt(isYearMatch[1], 10);
    if (yr >= 1400 && yr <= 2026) return yr;
  }

  const bodyYears = validYears(body.slice(0, 260));
  if (bodyYears.length > 0) {
    return bodyYears[0];
  }

  return fallbackYear ?? null;
}

interface WikiCategorySource {
  categoryName: string;
  expectedYear?: number;
  allowPrefix: boolean;
  allowSubPrefix?: boolean;
}

function pickCategorySource(
  concreteCategory: WorkCategory,
  rng: () => number,
  preferDiverseArt: boolean = false
): WikiCategorySource {
  if (concreteCategory === 'music') {
    if (rng() < 0.72) {
      const year = Math.floor(rng() * (2024 - 1958 + 1)) + 1958;
      return {
        categoryName: `Category:${year}_albums`,
        expectedYear: year,
        allowPrefix: year >= 1965,
        allowSubPrefix: year >= 1972,
      };
    }
    const debutYear = Math.floor(rng() * (2023 - 1970 + 1)) + 1970;
    return {
      categoryName: `Category:${debutYear}_debut_albums`,
      expectedYear: debutYear,
      allowPrefix: true,
      allowSubPrefix: debutYear >= 1978,
    };
  }
  if (concreteCategory === 'books') {
    if (rng() < 0.7) {
      const year = Math.floor(rng() * (2023 - 1915 + 1)) + 1915;
      return {
        categoryName: `Category:${year}_novels`,
        expectedYear: year,
        allowPrefix: year >= 1960,
        allowSubPrefix: year >= 1975,
      };
    }
    const landmark =
      VERIFIED_BOOK_LANDMARK_CATEGORIES[
        Math.floor(rng() * VERIFIED_BOOK_LANDMARK_CATEGORIES.length)
      ];
    const yearFromCat = landmark.match(/(\d{4})_novels/);
    return {
      categoryName: landmark,
      expectedYear: yearFromCat ? parseInt(yearFromCat[1], 10) : undefined,
      allowPrefix: !yearFromCat,
      allowSubPrefix: !yearFromCat,
    };
  }
  const useGeneral = preferDiverseArt || rng() < 0.72;
  const pool = useGeneral ? VERIFIED_ART_GENERAL_CATEGORIES : VERIFIED_ART_ARTIST_CATEGORIES;
  const artCat = pool[Math.floor(rng() * pool.length)];
  return {
    categoryName: artCat,
    allowPrefix: true,
    allowSubPrefix: useGeneral,
  };
}

function pickSortPrefixParam(
  source: WikiCategorySource,
  rng: () => number,
  forceNoPrefix: boolean,
  prefixMode: 'auto' | 'letter' | 'sub' = 'auto'
): string {
  const letterIdx = Math.floor(rng() * SORT_PREFIXES.length);
  const subIdx = Math.floor(rng() * SORT_SUBPREFIXES.length);
  const modeRoll = rng();

  if (!source.allowPrefix || forceNoPrefix) {
    return '';
  }

  if (prefixMode === 'sub' || (prefixMode === 'auto' && source.allowSubPrefix && modeRoll < 0.42)) {
    return `&gcmstartsortkeyprefix=${SORT_SUBPREFIXES[subIdx]}`;
  }
  if (prefixMode === 'letter' || modeRoll < 0.94) {
    return `&gcmstartsortkeyprefix=${SORT_PREFIXES[letterIdx]}`;
  }
  return '';
}

function parseWikiBatchPageToItem(
  page: any,
  concreteCategory: WorkCategory,
  expectedYear?: number
): CulturalItem | null {
  if (!page || !page.title || !page.thumbnail?.source || !page.extract) return null;
  if (isBadThumbnailUrl(page.thumbnail.source)) return null;
  if (String(page.extract).trim().length < 35) return null;

  const rawTitle = String(page.title);
  const desc = String(page.description || '');
  const extract = String(page.extract || '');

  if (!isRelevantWorkPage(rawTitle, desc, extract, concreteCategory)) return null;

  const finalYear = extractYearFromWikiPage(rawTitle, desc, extract, expectedYear);
  if (finalYear === null) return null;

  const slug = rawTitle.replace(/\s+/g, '_');
  const title = cleanWikipediaTitle(rawTitle);
  const creator = extractCreator(desc, extract, concreteCategory);

  return {
    id: `wiki-live-${concreteCategory}-${slug}`,
    wikiPageId: typeof page.pageid === 'number' && page.pageid > 0 ? page.pageid : undefined,
    category: concreteCategory,
    title,
    creator,
    year: finalYear,
    wikiSlug: slug,
    image: page.thumbnail.source,
    highResImage: page.original?.source || page.thumbnail.source,
    genreOrMovement: sanitizeWikiGenre(desc, concreteCategory, finalYear),
    hint1: sanitizeWikiHint({
      category: concreteCategory,
      title,
      creator,
      year: finalYear,
      rawDescription: desc,
      wikiExtract: extract,
    }),
    hint2: `From the ${getBroadEraLabel(finalYear)}.`,
    creatorType:
      concreteCategory === 'music'
        ? 'Artist'
        : concreteCategory === 'books'
        ? 'Author'
        : 'Painter',
    itemType:
      concreteCategory === 'music'
        ? 'Album'
        : concreteCategory === 'books'
        ? 'Novel'
        : 'Painting',
    trivia: extract.slice(0, 220) + (extract.length > 220 ? '...' : ''),
    wikiExtract: extract,
    altTitles: Array.from(new Set([title, rawTitle])),
    altCreators: [creator],
  };
}

/**
 * Fetches up to 20 complete Wikipedia works in a single batched API request.
 */
async function fetchLiveBatch(
  concreteCategory: WorkCategory,
  rng: () => number = Math.random,
  forceNoPrefix: boolean = false,
  preferDiverseArt: boolean = false,
  prefixMode: 'auto' | 'letter' | 'sub' = 'auto',
  addToDistractorBank: boolean = true
): Promise<CulturalItem[]> {
  const source = pickCategorySource(concreteCategory, rng, preferDiverseArt);
  const prefixParam = pickSortPrefixParam(source, rng, forceNoPrefix, prefixMode);
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&generator=categorymembers` +
    `&gcmtitle=${encodeURIComponent(source.categoryName)}` +
    `&gcmtype=page&gcmlimit=20&gcmsort=sortkey${prefixParam}` +
    `&prop=pageimages|extracts|description|info` +
    `&piprop=thumbnail|original&pithumbsize=400&pilicense=any&pilimit=20` +
    `&exintro=1&explaintext=1&exsentences=3&exlimit=20` +
    `&inprop=canonicalurl&format=json&origin=*`;

  const data = await fetchJsonThrottled(url, 3);
  const pages = Object.values(data?.query?.pages || {}) as any[];
  if (pages.length === 0) return [];

  const parsed: CulturalItem[] = [];
  for (const p of pages) {
    const item = parseWikiBatchPageToItem(p, concreteCategory, source.expectedYear);
    if (item) {
      parsed.push(item);
      if (addToDistractorBank) {
        pushToDistractorBank(item);
      }
    }
  }

  return parsed;
}

const GENERIC_CREATORS = new Set([
  'acclaimed musician',
  'acclaimed author',
  'master painter',
]);

function isMeaningfulCreator(creator: string): boolean {
  const norm = (creator || '').trim().toLowerCase();
  return norm.length > 1 && !GENERIC_CREATORS.has(norm);
}

function countDistinctCreators(items: readonly CulturalItem[]): number {
  const creators = new Set<string>();
  for (const item of items) {
    if (isMeaningfulCreator(item.creator)) {
      creators.add(item.creator.trim().toLowerCase());
    }
  }
  return creators.size;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const MAX_DISTRACTOR_BANK_SIZE = 450;

function pushToDistractorBank(item: CulturalItem) {
  const bank = liveDistractorBank[item.category];
  const itemWorkKey = toCanonicalWorkKey(item.category, item.title, item.creator);
  if (
    bank.some(
      existing =>
        existing.wikiSlug === item.wikiSlug ||
        toCanonicalWorkKey(existing.category, existing.title, existing.creator) === itemWorkKey
    )
  ) {
    return;
  }
  bank.push(item);
  if (bank.length > MAX_DISTRACTOR_BANK_SIZE) {
    const seenIdx = bank.findIndex(existing => isWorkSeen(existing));
    bank.splice(seenIdx >= 0 ? seenIdx : 0, 1);
  }
}

/**
 * Returns live Wikipedia items accumulated for Easy distractors & hints
 * so choices always start from the live random pool rather than static options.
 */
export function getLivePoolDistractors(category: Category): CulturalItem[] {
  if (category === 'everything') {
    return [
      ...liveDistractorBank.music,
      ...liveDistractorBank.books,
      ...liveDistractorBank.art,
    ];
  }
  return [...liveDistractorBank[category]];
}

export function getQueuedLiveOptionKeys(category: Category): Set<string> {
  const cats = category === 'everything' ? WORK_CATEGORIES : [category];
  const keys = new Set<string>();
  for (const cat of cats) {
    for (const item of liveQueue[cat]) {
      keys.add(toEasyOptionKey(item.title, item.creator));
    }
  }
  return keys;
}

// ---------------- SOLO QUEUE & PREWARM ----------------

const MAX_QUEUE_ADD_PER_BATCH = 3;

export async function refillLiveQueue(
  category: Category,
  minQueueSize: number = 6,
  minDistinctCreators: number = 10,
  minBankSize: number = 20,
  extraSeenIds?: ReadonlySet<string>
): Promise<void> {
  hydrateSeenStorage();
  if (category === 'everything') {
    for (const cat of WORK_CATEGORIES) {
      await refillLiveQueue(cat, minQueueSize, minDistinctCreators, minBankSize, extraSeenIds);
    }
    return;
  }

  const needsQueue = () => liveQueue[category].length < minQueueSize;
  const needsCreators = () =>
    countDistinctCreators(liveDistractorBank[category]) < minDistinctCreators ||
    liveDistractorBank[category].length < minBankSize;

  if (!needsQueue() && !needsCreators()) return;

  while (inflightQueueRefills[category]) {
    await inflightQueueRefills[category];
  }

  if (!needsQueue() && !needsCreators()) return;

  const work = (async () => {
    const queuedSlugs = new Set(liveQueue[category].map(it => it.wikiSlug.toLowerCase()));
    const queuedWorkKeys = new Set(
      liveQueue[category].map(it => toCanonicalWorkKey(it.category, it.title, it.creator))
    );
    const queuedImgKeys = new Set(
      liveQueue[category]
        .map(it => extractNormalizedImageKey(it.image || it.highResImage))
        .filter(Boolean)
    );
    const queuedCreators = new Set(
      liveQueue[category].map(it => it.creator.trim().toLowerCase())
    );

    for (let attempt = 0; attempt < 10 && (needsQueue() || needsCreators()); attempt++) {
      const preferDiverseArt = needsCreators();
      const forceNoPrefix = attempt >= 8;
      const prefixMode = attempt >= 6 ? 'letter' : 'auto';
      const batch = await fetchLiveBatch(category, Math.random, forceNoPrefix, preferDiverseArt, prefixMode);
      const fresh = shuffleInPlace(
        batch.filter(it => {
          const slugLower = it.wikiSlug.toLowerCase();
          const workKey = toCanonicalWorkKey(it.category, it.title, it.creator);
          const imgKey = extractNormalizedImageKey(it.image || it.highResImage);
          return (
            !queuedSlugs.has(slugLower) &&
            !queuedWorkKeys.has(workKey) &&
            (!imgKey || !queuedImgKeys.has(imgKey)) &&
            !isWorkSeen(it, extraSeenIds)
          );
        })
      );

      // Prefer unseen creators first and cap intake per batch so consecutive Solo rounds span eras/creators
      const distinctCreatorItems: CulturalItem[] = [];
      const sameCreatorItems: CulturalItem[] = [];
      for (const item of fresh) {
        const cKey = item.creator.trim().toLowerCase();
        if (!queuedCreators.has(cKey)) {
          distinctCreatorItems.push(item);
        } else {
          sameCreatorItems.push(item);
        }
      }
      const prioritized = [...distinctCreatorItems, ...sameCreatorItems];

      let addedFromBatch = 0;
      for (const item of prioritized) {
        if (addedFromBatch >= MAX_QUEUE_ADD_PER_BATCH) break;
        const slugLower = item.wikiSlug.toLowerCase();
        const workKey = toCanonicalWorkKey(item.category, item.title, item.creator);
        const imgKey = extractNormalizedImageKey(item.image || item.highResImage);
        queuedSlugs.add(slugLower);
        queuedWorkKeys.add(workKey);
        if (imgKey) queuedImgKeys.add(imgKey);
        queuedCreators.add(item.creator.trim().toLowerCase());
        liveQueue[category].push(item);
        addedFromBatch++;
      }
    }

    if (liveQueue[category].length > 1) {
      shuffleInPlace(liveQueue[category]);
    }
  })().finally(() => {
    delete inflightQueueRefills[category];
  });

  inflightQueueRefills[category] = work;
  await work;
}

/**
 * Fetches a single random item directly from Wikipedia (used if live queue needs an on-demand pull).
 */
export async function fetchLiveRandomItem(
  category: Category,
  seenSlugs: Set<string> = new Set()
): Promise<CulturalItem | null> {
  hydrateSeenStorage();
  const concreteCategory = pickConcreteCategory(category);
  for (let attempt = 0; attempt < 16; attempt++) {
    const forceNoPrefix = attempt >= 11;
    const prefixMode = attempt >= 7 ? 'letter' : 'auto';
    const batch = await fetchLiveBatch(concreteCategory, Math.random, forceNoPrefix, attempt >= 1, prefixMode);
    const eligible = batch.filter(it => !isWorkSeen(it, seenSlugs));
    if (eligible.length > 0) {
      const picked = eligible[Math.floor(Math.random() * eligible.length)];
      let resolved = picked;
      if (picked.category === 'books') resolved = await resolveSafeBookCoverItem(picked);
      else if (picked.category === 'music') resolved = await resolveSafeMusicCoverItem(picked);
      recordSeenWork(resolved);
      return resolved;
    }
  }
  return null;
}

export interface LiveRoundFetchOptions {
  minUnusedDistractors?: number;
  usedDistractorKeys?: ReadonlySet<string>;
}

function countUnusedLiveDistractors(
  cat: WorkCategory,
  seenSlugs: ReadonlySet<string>,
  usedDistractorKeys?: ReadonlySet<string>,
  excludeTargetKey?: string,
  excludeTargetCreator?: string
): { count: number; distinctCreators: number } {
  const queuedKeys = new Set(
    liveQueue[cat].map(it => toEasyOptionKey(it.title, it.creator))
  );
  const targetCreatorLower = (excludeTargetCreator || '').trim().toLowerCase();
  const seenOptKeys = new Set<string>();
  const creators = new Set<string>();

  for (const it of liveDistractorBank[cat]) {
    if (isWorkSeen(it, seenSlugs)) continue;
    const optKey = toEasyOptionKey(it.title, it.creator);
    if (excludeTargetKey && optKey === excludeTargetKey) continue;
    if (queuedKeys.has(optKey)) continue;
    if (usedDistractorKeys?.has(optKey)) continue;
    if (!seenOptKeys.has(optKey)) {
      seenOptKeys.add(optKey);
      const cLower = it.creator.trim().toLowerCase();
      if (cLower !== targetCreatorLower && isMeaningfulCreator(it.creator)) {
        creators.add(cLower);
      }
    }
  }
  return { count: seenOptKeys.size, distinctCreators: creators.size };
}

async function ensureUnusedLiveDistractors(
  cat: WorkCategory,
  seenSlugs: ReadonlySet<string>,
  minUnused: number,
  usedDistractorKeys?: ReadonlySet<string>,
  excludeTargetKey?: string,
  excludeTargetCreator?: string
): Promise<void> {
  for (let attempt = 0; attempt < 7; attempt++) {
    const stats = countUnusedLiveDistractors(
      cat,
      seenSlugs,
      usedDistractorKeys,
      excludeTargetKey,
      excludeTargetCreator
    );
    if (stats.count >= minUnused && stats.distinctCreators >= 4) return;
    await fetchLiveBatch(
      cat,
      Math.random,
      attempt >= 5,
      true,
      attempt >= 3 ? 'letter' : 'auto',
      true
    );
  }
}

/**
 * Returns the next Solo live round item.
 * Ensures both the live queue AND enough unused, non-queued, diverse live distractors
 * are stocked BEFORE returning each round so Easy choices never repeat or fall back to stored lists.
 */
export async function getNextLiveRoundItem(
  category: Category,
  seenSlugs: Set<string> = new Set(),
  options?: LiveRoundFetchOptions
): Promise<CulturalItem> {
  hydrateSeenStorage();
  const concreteCategory = pickConcreteCategory(category);
  const minUnusedTarget = options?.minUnusedDistractors ?? 0;

  liveQueue[concreteCategory] = liveQueue[concreteCategory].filter(
    it => !isWorkSeen(it, seenSlugs)
  );

  if (
    liveQueue[concreteCategory].length === 0 ||
    countDistinctCreators(liveDistractorBank[concreteCategory]) < 10 ||
    liveDistractorBank[concreteCategory].length < 20
  ) {
    await refillLiveQueue(concreteCategory, 6, 10, 20, seenSlugs);
  }

  let resolved: CulturalItem | null = null;
  let shouldPrewarmBackground = false;

  while (liveQueue[concreteCategory].length > 0) {
    const fetched = liveQueue[concreteCategory].shift()!;
    if (!isWorkSeen(fetched, seenSlugs)) {
      recordSeenWork(fetched);
      if (
        liveQueue[concreteCategory].length < 4 ||
        liveDistractorBank[concreteCategory].length < 26 ||
        countDistinctCreators(liveDistractorBank[concreteCategory]) < 12
      ) {
        shouldPrewarmBackground = true;
      }
      let nextItem = fetched;
      if (fetched.category === 'books') nextItem = await resolveSafeBookCoverItem(fetched);
      else if (fetched.category === 'music') nextItem = await resolveSafeMusicCoverItem(fetched);
      recordSeenWork(nextItem);
      resolved = nextItem;
      break;
    }
  }

  // Last-resort direct fetch before touching stored catalog
  if (!resolved) {
    const liveDirect = await fetchLiveRandomItem(concreteCategory, seenSlugs);
    if (liveDirect) {
      shouldPrewarmBackground = true;
      resolved = liveDirect;
    }
  }

  // Emergency offline fallback only if Wikipedia is unreachable
  if (!resolved) {
    const unseenSameCat = CULTURAL_ITEMS.filter(
      it => it.category === concreteCategory && !isWorkSeen(it, seenSlugs)
    );
    const unseenAnyCat =
      category === 'everything'
        ? CULTURAL_ITEMS.filter(it => !isWorkSeen(it, seenSlugs))
        : [];
    const pool =
      unseenSameCat.length > 0
        ? unseenSameCat
        : unseenAnyCat.length > 0
        ? unseenAnyCat
        : CULTURAL_ITEMS.filter(it => it.category === concreteCategory);
    const fallback = pool[Math.floor(Math.random() * pool.length)];

    let resolvedFallback = fallback;
    if (fallback.category === 'books') resolvedFallback = await resolveSafeBookCoverItem(fallback);
    else if (fallback.category === 'music') resolvedFallback = await resolveSafeMusicCoverItem(fallback);
    recordSeenWork(resolvedFallback);
    resolved = resolvedFallback;
  }

  if (minUnusedTarget > 0) {
    const targetKey = toEasyOptionKey(resolved.title, resolved.creator);
    await ensureUnusedLiveDistractors(
      resolved.category,
      seenSlugs,
      minUnusedTarget,
      options?.usedDistractorKeys,
      targetKey,
      resolved.creator
    );
  }

  if (shouldPrewarmBackground) {
    setTimeout(
      () => refillLiveQueue(resolved.category, 6, 12, 26, seenSlugs).catch(() => {}),
      320
    );
  }

  return resolved;
}

let prewarmRunning = false;
let preferredPrewarmCategory: WorkCategory | null = null;

export function prewarmLiveQueues(priorityCategory?: Category) {
  if (priorityCategory && priorityCategory !== 'everything') {
    preferredPrewarmCategory = priorityCategory;
  }
  if (prewarmRunning) return;
  prewarmRunning = true;

  (async () => {
    try {
      const visited = new Set<WorkCategory>();
      const nextTarget = (): WorkCategory | null => {
        if (preferredPrewarmCategory && !visited.has(preferredPrewarmCategory)) {
          const picked = preferredPrewarmCategory;
          visited.add(picked);
          return picked;
        }
        for (const cat of WORK_CATEGORIES) {
          if (!visited.has(cat)) {
            visited.add(cat);
            return cat;
          }
        }
        return null;
      };

      let cat: WorkCategory | null;
      while ((cat = nextTarget()) !== null) {
        const needsWarm =
          liveQueue[cat].length < 4 ||
          countDistinctCreators(liveDistractorBank[cat]) < 10 ||
          liveDistractorBank[cat].length < 22;
        if (needsWarm) {
          await refillLiveQueue(cat, 6, 10, 22).catch(() => {});
          await new Promise(r => setTimeout(r, 320));
        }
      }
    } finally {
      prewarmRunning = false;
    }
  })();
}

// ---------------- MULTIPLAYER ZERO-DRIFT ROOM ENGINE ----------------

export function manifestEntryToBaseItem(
  entry: LockedRoundEntry,
  challengeId: string,
  roundIndex: number
): CulturalItem {
  const safeImage = entry.image || '';
  return {
    id: `ch-${challengeId}-${roundIndex}-${entry.slug}`,
    category: entry.category,
    title: entry.title,
    creator: entry.creator,
    year: entry.year,
    wikiSlug: entry.slug,
    image: safeImage,
    highResImage: safeImage,
    altCoverApplied: Boolean(entry.image),
    genreOrMovement:
      entry.genre ||
      sanitizeWikiGenre(undefined, entry.category, entry.year),
    hint1: sanitizeWikiHint({
      category: entry.category,
      title: entry.title,
      creator: entry.creator,
      year: entry.year,
    }),
    hint2: `From the ${getBroadEraLabel(entry.year)}.`,
    creatorType:
      entry.category === 'music'
        ? 'Artist'
        : entry.category === 'books'
        ? 'Author'
        : 'Painter',
    itemType:
      entry.category === 'music'
        ? 'Album'
        : entry.category === 'books'
        ? 'Novel'
        : 'Painting',
    trivia: `${entry.title} by ${entry.creator} (${entry.year}).`,
    altTitles: [entry.title, entry.slug.replace(/_/g, ' ')],
    altCreators: [entry.creator],
  };
}

/**
 * Generates a fresh randomized live room pool from Wikipedia for Multiplayer,
 * resolves/pins book & music covers once on the Host, and returns the exact
 * lockable manifest + live distractors + pre-hydrated CulturalItems.
 */
export async function buildMultiplayerLiveRoomPool(
  category: Category,
  gameMode: GameMode
): Promise<{
  manifest: LockedRoundEntry[];
  distractors: LockedDistractorEntry[];
  hydratedItems: CulturalItem[];
}> {
  const targetRoundCount = gameMode === 'forever' ? 10 : 5;
  const targetDistractorCount = gameMode === 'forever' ? 10 : 15;
  const totalNeeded = targetRoundCount + targetDistractorCount;

  hydrateSeenStorage();
  const pickedItems: CulturalItem[] = [];
  const usedSlugs = new Set<string>();
  const usedPageIds = new Set<number>();
  const usedWorkKeys = new Set<string>();
  const usedImageKeys = new Set<string>();
  const creatorCounts = new Map<string, number>();

  const targetCats: WorkCategory[] =
    category === 'everything' ? ['music', 'books', 'art'] : [category];

  // Fetch fresh batches directly from live Wikipedia (never starting from stored CULTURAL_ITEMS!)
  // Ensure every active category reaches diverse creators and works from different batches
  const targetPerCat =
    category === 'everything' ? (gameMode === 'forever' ? 8 : 9) : totalNeeded;
  const minCreatorsPerCat = category === 'everything' ? 5 : 8;
  const maxPasses = category === 'everything' ? 10 : 12;
  const maxFromSingleBatch = 6;

  for (let pass = 0; pass < maxPasses; pass++) {
    let allSatisfied = true;
    const allowSessionSeen = pass >= maxPasses - 1;
    for (const workCat of targetCats) {
      const catItems = pickedItems.filter(it => it.category === workCat);
      const needsMore =
        catItems.length < targetPerCat || countDistinctCreators(catItems) < minCreatorsPerCat;
      if (!needsMore) continue;

      allSatisfied = false;
      const batch = await fetchLiveBatch(
        workCat,
        Math.random,
        pass >= maxPasses - 2,
        pass >= 1,
        pass >= maxPasses - 4 ? 'letter' : 'auto',
        false
      );
      const shuffled = shuffleInPlace([...batch]);
      let addedThisBatch = 0;
      for (const item of shuffled) {
        const slugLower = item.wikiSlug.toLowerCase();
        const workKey = toCanonicalWorkKey(item.category, item.title, item.creator);
        const imgKey = extractNormalizedImageKey(item.image || item.highResImage);
        if (usedSlugs.has(slugLower)) continue;
        if (item.wikiPageId && usedPageIds.has(item.wikiPageId)) continue;
        if (usedWorkKeys.has(workKey)) continue;
        if (imgKey && usedImageKeys.has(imgKey)) continue;
        if (!allowSessionSeen && isWorkSeen(item)) continue;

        const cKey = item.creator.trim().toLowerCase();
        const existingCount = creatorCounts.get(cKey) || 0;
        if (pass < maxPasses - 2 && existingCount >= 2) continue;

        usedSlugs.add(item.wikiSlug);
        usedSlugs.add(slugLower);
        if (item.wikiPageId) usedPageIds.add(item.wikiPageId);
        usedWorkKeys.add(workKey);
        if (imgKey) usedImageKeys.add(imgKey);
        creatorCounts.set(cKey, existingCount + 1);
        pickedItems.push(item);
        addedThisBatch++;
        if (addedThisBatch >= maxFromSingleBatch) break;
      }
    }
    if (allSatisfied) break;
  }

  // Interleave categories evenly in Everything Mix before slicing rounds vs distractors
  let rawRoundItems: CulturalItem[] = [];
  let rawDistractorItems: CulturalItem[] = [];

  if (category === 'everything') {
    const byCat: Record<WorkCategory, CulturalItem[]> = {
      music: shuffleInPlace(pickedItems.filter(i => i.category === 'music')),
      books: shuffleInPlace(pickedItems.filter(i => i.category === 'books')),
      art: shuffleInPlace(pickedItems.filter(i => i.category === 'art')),
    };
    const roundCounts: Record<WorkCategory, number> = { music: 0, books: 0, art: 0 };
    const distractorCounts: Record<WorkCategory, number> = { music: 0, books: 0, art: 0 };
    const seenCreatorsByCat: Record<WorkCategory, Set<string>> = {
      music: new Set(),
      books: new Set(),
      art: new Set(),
    };
    const offset = Math.floor(Math.random() * 3);
    for (let i = 0; rawRoundItems.length < targetRoundCount; i++) {
      const cat = WORK_CATEGORIES[(i + offset) % 3];
      const pool = byCat[cat];
      if (pool.length > 0) {
        const distinctIdx = pool.findIndex(
          it => !seenCreatorsByCat[cat].has(it.creator.trim().toLowerCase())
        );
        const next = pool.splice(distinctIdx >= 0 ? distinctIdx : 0, 1)[0];
        rawRoundItems.push(next);
        roundCounts[cat]++;
        seenCreatorsByCat[cat].add(next.creator.trim().toLowerCase());
      } else if (!byCat.music.length && !byCat.books.length && !byCat.art.length) {
        break;
      }
    }

    // Balance distractors so every category has >= 3 distractors first, then matches 3x round demand
    while (
      rawDistractorItems.length < targetDistractorCount &&
      (byCat.music.length || byCat.books.length || byCat.art.length)
    ) {
      const availableCats = WORK_CATEGORIES.filter(c => byCat[c].length > 0);
      availableCats.sort((a, b) => {
        const aNeedsBase = roundCounts[a] > 0 && distractorCounts[a] < 3 ? 1 : 0;
        const bNeedsBase = roundCounts[b] > 0 && distractorCounts[b] < 3 ? 1 : 0;
        if (aNeedsBase !== bNeedsBase) return bNeedsBase - aNeedsBase;
        if (aNeedsBase && distractorCounts[a] !== distractorCounts[b]) {
          return distractorCounts[a] - distractorCounts[b];
        }
        const aDeficit = roundCounts[a] * 3 - distractorCounts[a];
        const bDeficit = roundCounts[b] * 3 - distractorCounts[b];
        return bDeficit - aDeficit;
      });
      const chosenCat = availableCats[0];
      const pool = byCat[chosenCat];
      const distinctIdx = pool.findIndex(
        it => !seenCreatorsByCat[chosenCat].has(it.creator.trim().toLowerCase())
      );
      const picked = pool.splice(distinctIdx >= 0 ? distinctIdx : 0, 1)[0];
      rawDistractorItems.push(picked);
      distractorCounts[chosenCat]++;
      seenCreatorsByCat[chosenCat].add(picked.creator.trim().toLowerCase());
    }
  } else {
    const shuffled = shuffleInPlace([...pickedItems]);
    const roundCreators = new Set<string>();
    const remaining: CulturalItem[] = [];
    for (const item of shuffled) {
      const cKey = item.creator.trim().toLowerCase();
      if (rawRoundItems.length < targetRoundCount && !roundCreators.has(cKey)) {
        roundCreators.add(cKey);
        rawRoundItems.push(item);
      } else {
        remaining.push(item);
      }
    }
    while (rawRoundItems.length < targetRoundCount && remaining.length > 0) {
      rawRoundItems.push(remaining.shift()!);
    }
    rawDistractorItems = remaining.slice(0, targetDistractorCount);
  }

  // Offline emergency tail ONLY if Wikipedia failed to provide enough live rounds
  if (rawRoundItems.length < targetRoundCount) {
    const offlineTail = [...CULTURAL_ITEMS]
      .filter(it => {
        if (category !== 'everything' && it.category !== category) return false;
        const slugLower = it.wikiSlug.toLowerCase();
        const workKey = toCanonicalWorkKey(it.category, it.title, it.creator);
        return !usedSlugs.has(it.wikiSlug) && !usedSlugs.has(slugLower) && !usedWorkKeys.has(workKey);
      })
      .sort(() => Math.random() - 0.5);
    for (const it of offlineTail) {
      const workKey = toCanonicalWorkKey(it.category, it.title, it.creator);
      if (rawRoundItems.length < targetRoundCount) {
        usedSlugs.add(it.wikiSlug);
        usedSlugs.add(it.wikiSlug.toLowerCase());
        usedWorkKeys.add(workKey);
        rawRoundItems.push(it);
      } else if (rawDistractorItems.length < targetDistractorCount) {
        usedSlugs.add(it.wikiSlug);
        usedSlugs.add(it.wikiSlug.toLowerCase());
        usedWorkKeys.add(workKey);
        rawDistractorItems.push(it);
      } else {
        break;
      }
    }
  }

  // Snapshot original Wikipedia thumbnails before cover spoiler checks so untouched URLs encode as 0 bytes
  const origImageById = new Map<string, string>();
  for (const it of rawRoundItems) {
    origImageById.set(it.id, it.image);
  }

  // Resolve spoiler covers ONCE on Host (bounded per-chunk timeout so Classic takes ~1-2s & Forever ~2-3s)
  const resolveWithBudget = async (item: CulturalItem, budgetMs: number): Promise<CulturalItem> => {
    const fallbackItem: CulturalItem = { ...item, altCoverApplied: true };
    if (typeof document === 'undefined') return fallbackItem;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const resolveTask =
        item.category === 'books'
          ? resolveSafeBookCoverItem(item)
          : item.category === 'music'
          ? resolveSafeMusicCoverItem(item)
          : Promise.resolve(item);

      const resolved = await Promise.race([
        resolveTask.then(res => ({ ...res, altCoverApplied: true })),
        new Promise<CulturalItem>(resolve => {
          timer = setTimeout(() => resolve(fallbackItem), budgetMs);
        }),
      ]);
      return resolved;
    } catch {
      return fallbackItem;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // Resolve rounds 0..4 with full quality budget, and any rounds 5+ with quick budget
  const hydratedItems: CulturalItem[] = [];
  for (let i = 0; i < rawRoundItems.length; i += 5) {
    const chunk = rawRoundItems.slice(i, i + 5);
    const budget = i === 0 ? 3500 : 1800;
    const resolvedChunk = await Promise.all(chunk.map(it => resolveWithBudget(it, budget)));
    hydratedItems.push(...resolvedChunk);
  }

  const manifest: LockedRoundEntry[] = hydratedItems.map(item => {
    const origUrl = origImageById.get(item.id) || '';
    const coverChanged = Boolean(item.image && origUrl && item.image !== origUrl);
    return {
      slug: item.wikiSlug,
      title: item.title,
      creator: item.creator,
      year: item.year,
      category: item.category,
      pageId: item.wikiPageId,
      image: item.image,
      coverChanged,
      genre: item.genreOrMovement,
    };
  });

  const distractors: LockedDistractorEntry[] = rawDistractorItems.map(item => ({
    category: item.category,
    title: item.title,
    creator: item.creator,
    pageId: item.wikiPageId,
  }));

  return { manifest, distractors, hydratedItems };
}

/**
 * Hydrates full metadata for both a room's locked `manifest` and its `distractors` using batched
 * Wikipedia `pageids=` (or legacy `titles=`) lookups, while preserving locked years & swapped covers.
 */
export async function hydrateMultiplayerChallenge(
  challenge: MultiplayerChallenge
): Promise<{ challenge: MultiplayerChallenge; items: CulturalItem[] }> {
  const manifest = challenge.manifest || [];
  const distractors = challenge.distractors || [];
  if (manifest.length === 0 && distractors.length === 0) {
    return { challenge, items: [] };
  }

  const pageIdSet = new Set<number>();
  for (const m of manifest) {
    if (m.pageId && m.pageId > 0) pageIdSet.add(m.pageId);
  }
  for (const d of distractors) {
    if (d.pageId && d.pageId > 0) pageIdSet.add(d.pageId);
  }

  const legacyTitleSet = new Set<string>();
  for (const m of manifest) {
    if (!m.pageId && m.slug) {
      legacyTitleSet.add(m.slug.replace(/_/g, ' '));
    }
  }

  const pageById = new Map<number, any>();
  const pageByNormTitle = new Map<string, any>();

  const storeQueryResult = (data: any) => {
    if (!data?.query) return;
    const pages = Object.values(data.query.pages || {}) as any[];
    for (const p of pages) {
      if (typeof p?.pageid === 'number' && p.pageid > 0) {
        pageById.set(p.pageid, p);
      }
      if (p?.title) {
        pageByNormTitle.set(String(p.title).replace(/\s+/g, '_').toLowerCase(), p);
      }
    }
    if (Array.isArray(data.query.normalized)) {
      for (const norm of data.query.normalized) {
        const targetPage = pageByNormTitle.get(String(norm.to).replace(/\s+/g, '_').toLowerCase());
        if (targetPage && norm.from) {
          pageByNormTitle.set(String(norm.from).replace(/\s+/g, '_').toLowerCase(), targetPage);
        }
      }
    }
  };

  const uniqueIds = Array.from(pageIdSet);
  for (let i = 0; i < uniqueIds.length; i += 20) {
    const chunk = uniqueIds.slice(i, i + 20);
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&pageids=${chunk.join('|')}` +
      `&prop=pageimages|extracts|description|info&piprop=thumbnail|original&pithumbsize=400` +
      `&pilicense=any&pilimit=20&exintro=1&explaintext=1&exsentences=3&exlimit=20` +
      `&inprop=canonicalurl&format=json&origin=*`;
    const data = await fetchJsonThrottled(url, 3);
    storeQueryResult(data);
  }

  const uniqueLegacyTitles = Array.from(legacyTitleSet);
  for (let i = 0; i < uniqueLegacyTitles.length; i += 20) {
    const chunk = uniqueLegacyTitles.slice(i, i + 20);
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(chunk.join('|'))}` +
      `&prop=pageimages|extracts|description|info&piprop=thumbnail|original&pithumbsize=400` +
      `&pilicense=any&pilimit=20&exintro=1&explaintext=1&exsentences=3&exlimit=20` +
      `&inprop=canonicalurl&format=json&origin=*`;
    const data = await fetchJsonThrottled(url, 2);
    storeQueryResult(data);
  }

  const hydratedItems: CulturalItem[] = [];
  const nextManifest: LockedRoundEntry[] = manifest.map((entry, idx) => {
    const page =
      (entry.pageId ? pageById.get(entry.pageId) : undefined) ||
      (entry.slug ? pageByNormTitle.get(entry.slug.replace(/\s+/g, '_').toLowerCase()) : undefined);

    const pageTitle = page?.title ? String(page.title) : '';
    const desc = String(page?.description || '');
    const extract = String(page?.extract || '');
    const slug =
      entry.slug ||
      (pageTitle ? pageTitle.replace(/\s+/g, '_') : `wiki_${entry.pageId || idx}`);
    const title =
      entry.title ||
      (pageTitle ? cleanWikipediaTitle(pageTitle) : slug.replace(/_/g, ' '));
    const creator =
      entry.creator ||
      (page
        ? extractCreator(desc, extract, entry.category)
        : entry.category === 'music'
        ? 'Acclaimed Musician'
        : entry.category === 'books'
        ? 'Acclaimed Author'
        : 'Master Painter');

    const coverChanged = Boolean(entry.coverChanged && entry.image);
    const resolvedImage = coverChanged
      ? entry.image || ''
      : entry.image || page?.thumbnail?.source || '';
    const highResImage = coverChanged
      ? resolvedImage
      : entry.image || page?.original?.source || resolvedImage;
    const genre = entry.genre || sanitizeWikiGenre(desc, entry.category, entry.year);
    const resolvedPageId =
      entry.pageId || (typeof page?.pageid === 'number' && page.pageid > 0 ? page.pageid : undefined);

    const hydratedEntry: LockedRoundEntry = {
      slug,
      title,
      creator,
      year: entry.year,
      category: entry.category,
      pageId: resolvedPageId,
      image: resolvedImage || undefined,
      coverChanged,
      genre,
    };

    const base = manifestEntryToBaseItem(hydratedEntry, challenge.id, idx);
    const altTitles = Array.from(
      new Set([title, pageTitle, slug.replace(/_/g, ' ')].filter(Boolean))
    );
    hydratedItems.push({
      ...base,
      wikiPageId: resolvedPageId,
      image: resolvedImage || base.image,
      highResImage: highResImage || base.image,
      altCoverApplied: Boolean(resolvedImage),
      genreOrMovement: genre,
      hint1: sanitizeWikiHint({
        category: entry.category,
        title,
        creator,
        year: entry.year,
        rawDescription: desc,
        wikiExtract: extract,
      }),
      trivia: extract
        ? extract.slice(0, 220) + (extract.length > 220 ? '...' : '')
        : base.trivia,
      wikiExtract: extract || base.wikiExtract,
      altTitles,
      altCreators: [creator],
    });

    return hydratedEntry;
  });

  const nextDistractors: LockedDistractorEntry[] = distractors
    .map(d => {
      if (d.title && d.creator) return d;
      const page = d.pageId ? pageById.get(d.pageId) : undefined;
      if (!page?.title) return d;
      const pageTitle = String(page.title);
      const desc = String(page.description || '');
      const extract = String(page.extract || '');
      return {
        category: d.category,
        pageId: d.pageId,
        title: d.title || cleanWikipediaTitle(pageTitle),
        creator: d.creator || extractCreator(desc, extract, d.category),
      };
    })
    .filter(d => Boolean(d.title && d.creator));

  return {
    challenge: {
      ...challenge,
      manifest: nextManifest.length > 0 ? nextManifest : undefined,
      distractors: nextDistractors.length > 0 ? nextDistractors : undefined,
    },
    items: hydratedItems,
  };
}

export async function hydrateMultiplayerItems(
  challenge: MultiplayerChallenge
): Promise<CulturalItem[]> {
  const res = await hydrateMultiplayerChallenge(challenge);
  return res.items;
}

const mpDistractorBatchCache = new Map<string, CulturalItem[]>();
const MAX_MP_DIST_BATCHES = 90;

export function clearMultiplayerDistractorCacheForTest(): void {
  mpDistractorBatchCache.clear();
}

async function getMpDistractorBatch(
  challengeId: string,
  workCat: WorkCategory,
  batchIdx: number
): Promise<CulturalItem[]> {
  const cacheKey = `${challengeId}:mp-dist:${workCat}:b${batchIdx}`;
  const cached = mpDistractorBatchCache.get(cacheKey);
  if (cached) return cached;

  const srcRng = createSeededRng(`${cacheKey}:src`);
  const forceNoPrefix = batchIdx >= 10 && batchIdx % 3 === 2;
  const prefixMode = batchIdx % 4 === 3 ? 'letter' : 'auto';
  const raw = await fetchLiveBatch(workCat, srcRng, forceNoPrefix, true, prefixMode, false);

  const dedupedBySlug = new Map<string, CulturalItem>();
  for (const it of raw) {
    const k = it.wikiSlug.toLowerCase();
    if (!dedupedBySlug.has(k)) dedupedBySlug.set(k, it);
  }
  const sorted = Array.from(dedupedBySlug.values()).sort((a, b) =>
    a.wikiSlug.localeCompare(b.wikiSlug)
  );
  const ordered = seededShuffle(sorted, createSeededRng(`${cacheKey}:order`));
  mpDistractorBatchCache.set(cacheKey, ordered);
  return ordered;
}

async function resolveDeterministicMpDistractors(
  baseItem: CulturalItem,
  challenge: MultiplayerChallenge,
  roundIndex: number,
  hydratedManifest: CulturalItem[] | undefined,
  priorItems: readonly CulturalItem[]
): Promise<EasyDistractorMetadata[]> {
  const workCat = baseItem.category;
  const targetCreatorLower = baseItem.creator.trim().toLowerCase();

  const questionOptionKeys = new Set<string>();
  const questionSlugs = new Set<string>();
  const questionPageIds = new Set<number>();
  const questionWorkKeys = new Set<string>();
  const questionImgKeys = new Set<string>();

  const registerQuestion = (
    cat: WorkCategory,
    slug?: string,
    title?: string,
    creator?: string,
    pageId?: number,
    img?: string
  ) => {
    if (slug) {
      questionSlugs.add(slug);
      questionSlugs.add(slug.toLowerCase());
    }
    if (pageId && pageId > 0) questionPageIds.add(pageId);
    if (title) {
      questionWorkKeys.add(toCanonicalWorkKey(cat, title, creator));
      if (creator) questionOptionKeys.add(toEasyOptionKey(title, creator));
    }
    const imgKey = extractNormalizedImageKey(img);
    if (imgKey) questionImgKeys.add(imgKey);
  };

  registerQuestion(
    baseItem.category,
    baseItem.wikiSlug,
    baseItem.title,
    baseItem.creator,
    baseItem.wikiPageId,
    baseItem.image || baseItem.highResImage
  );
  for (const m of challenge.manifest || []) {
    registerQuestion(m.category, m.slug, m.title, m.creator, m.pageId, m.image);
  }
  for (const h of hydratedManifest || []) {
    registerQuestion(
      h.category,
      h.wikiSlug,
      h.title,
      h.creator,
      h.wikiPageId,
      h.image || h.highResImage
    );
  }

  const usedOptionKeys = new Set<string>();
  const usedSlugs = new Set<string>();
  const usedPageIds = new Set<number>();
  const usedWorkKeys = new Set<string>();
  const usedImgKeys = new Set<string>();

  for (const prev of priorItems) {
    registerQuestion(
      prev.category,
      prev.wikiSlug,
      prev.title,
      prev.creator,
      prev.wikiPageId,
      prev.image || prev.highResImage
    );
    for (const d of prev.mpDistractors || []) {
      if (d.slug) {
        usedSlugs.add(d.slug);
        usedSlugs.add(d.slug.toLowerCase());
      }
      if (d.pageId && d.pageId > 0) usedPageIds.add(d.pageId);
      usedWorkKeys.add(toCanonicalWorkKey(d.category, d.title, d.creator));
      usedOptionKeys.add(toEasyOptionKey(d.title, d.creator));
      const imgKey = extractNormalizedImageKey(d.image);
      if (imgKey) usedImgKeys.add(imgKey);
    }
  }

  const reservedLockedDistKeys = new Set<string>();
  const reservedLockedPageIds = new Set<number>();
  for (const ld of challenge.distractors || []) {
    if (ld.title && ld.creator) {
      reservedLockedDistKeys.add(toEasyOptionKey(ld.title, ld.creator));
    }
    if (ld.pageId && ld.pageId > 0) {
      reservedLockedPageIds.add(ld.pageId);
    }
  }

  const picked: EasyDistractorMetadata[] = [];
  const pickedOptionKeys = new Set<string>();
  const pickedWorkKeys = new Set<string>();
  const pickedCreators = new Set<string>();

  const canPickCandidate = (
    cand: {
      category: WorkCategory;
      title: string;
      creator: string;
      slug?: string;
      pageId?: number;
      image?: string;
    },
    allowSameCreator: boolean,
    allowSameRoundCreator: boolean,
    skipLockedReserved: boolean
  ): boolean => {
    if (cand.category !== workCat) return false;
    const tClean = (cand.title || '').trim();
    const cClean = (cand.creator || '').trim();
    if (!tClean || !cClean) return false;
    if (tClean.toLowerCase() === baseItem.title.trim().toLowerCase()) return false;

    const optKey = toEasyOptionKey(tClean, cClean);
    const workKey = toCanonicalWorkKey(cand.category, tClean, cClean);
    const slugLower = (cand.slug || '').trim().toLowerCase();
    const imgKey = extractNormalizedImageKey(cand.image);

    if (pickedOptionKeys.has(optKey) || pickedWorkKeys.has(workKey)) return false;
    if (questionOptionKeys.has(optKey) || questionWorkKeys.has(workKey)) return false;
    if (usedOptionKeys.has(optKey) || usedWorkKeys.has(workKey)) return false;
    if (cand.pageId && (questionPageIds.has(cand.pageId) || usedPageIds.has(cand.pageId))) {
      return false;
    }
    if (
      slugLower &&
      (questionSlugs.has(slugLower) || usedSlugs.has(slugLower))
    ) {
      return false;
    }
    if (imgKey && (questionImgKeys.has(imgKey) || usedImgKeys.has(imgKey))) return false;
    if (
      skipLockedReserved &&
      (reservedLockedDistKeys.has(optKey) ||
        (cand.pageId && reservedLockedPageIds.has(cand.pageId)))
    ) {
      return false;
    }

    const cLower = cClean.toLowerCase();
    if (!allowSameCreator && cLower === targetCreatorLower) return false;
    if (!allowSameRoundCreator && pickedCreators.has(cLower)) return false;
    return true;
  };

  const commitCandidate = (cand: EasyDistractorMetadata) => {
    const optKey = toEasyOptionKey(cand.title, cand.creator);
    pickedOptionKeys.add(optKey);
    pickedWorkKeys.add(toCanonicalWorkKey(cand.category, cand.title, cand.creator));
    pickedCreators.add(cand.creator.trim().toLowerCase());
    picked.push(cand);
  };

  // Priority 1: Unused locked URL distractors matching this category
  const lockedSorted = (challenge.distractors || [])
    .filter(d => d.category === workCat && d.title && d.creator)
    .map(d => ({
      category: d.category,
      title: d.title.trim(),
      creator: d.creator.trim(),
      ...(d.pageId ? { pageId: d.pageId } : {}),
    }))
    .sort((a, b) =>
      `${a.title}--${a.creator}--${a.pageId || 0}`.localeCompare(
        `${b.title}--${b.creator}--${b.pageId || 0}`
      )
    );
  const lockedOrdered = seededShuffle(
    lockedSorted,
    createSeededRng(`${challenge.id}:mp-dist-locked:${workCat}:r${roundIndex}`)
  );

  for (const cand of lockedOrdered) {
    if (picked.length >= 3) break;
    if (canPickCandidate(cand, false, false, false)) {
      commitCandidate(cand);
    }
  }

  // Priority 2: Deterministic room-seeded live Wikipedia batches (cached statelessly per batchIdx)
  const fetchedBatches: CulturalItem[][] = [];
  for (let batchIdx = 0; batchIdx < MAX_MP_DIST_BATCHES && picked.length < 3; batchIdx++) {
    const batch = await getMpDistractorBatch(challenge.id, workCat, batchIdx);
    fetchedBatches.push(batch);
    for (const it of batch) {
      if (picked.length >= 3) break;
      const cand: EasyDistractorMetadata = {
        category: it.category,
        title: it.title,
        creator: it.creator,
        slug: it.wikiSlug,
        ...(it.wikiPageId ? { pageId: it.wikiPageId } : {}),
        ...(it.image ? { image: it.image } : {}),
      };
      if (canPickCandidate(cand, false, false, true)) {
        commitCandidate(cand);
      }
    }
  }

  // Pass B: Relax creator uniqueness using already-available locked + fetched batches if still < 3
  for (const allowSameCreator of [false, true]) {
    if (picked.length >= 3) break;
    for (const cand of lockedOrdered) {
      if (picked.length >= 3) break;
      if (canPickCandidate(cand, allowSameCreator, true, false)) {
        commitCandidate(cand);
      }
    }
    for (const batch of fetchedBatches) {
      if (picked.length >= 3) break;
      for (const it of batch) {
        if (picked.length >= 3) break;
        const cand: EasyDistractorMetadata = {
          category: it.category,
          title: it.title,
          creator: it.creator,
          slug: it.wikiSlug,
          ...(it.wikiPageId ? { pageId: it.wikiPageId } : {}),
          ...(it.image ? { image: it.image } : {}),
        };
        if (canPickCandidate(cand, allowSameCreator, true, true)) {
          commitCandidate(cand);
        }
      }
    }
  }

  // Pass C: Emergency deterministic offline fallback ONLY if live Wikipedia could not deliver 3 distractors
  if (picked.length < 3) {
    const staticList =
      workCat === 'music'
        ? MUSIC_DISTRACTORS
        : workCat === 'books'
        ? BOOKS_DISTRACTORS
        : ART_DISTRACTORS;
    const offlineCombined: EasyDistractorMetadata[] = [
      ...CULTURAL_ITEMS.filter(it => it.category === workCat).map(it => ({
        category: it.category,
        title: it.title,
        creator: it.creator,
        slug: it.wikiSlug,
        pageId: it.wikiPageId,
        image: it.image,
      })),
      ...staticList.map(s => ({ category: workCat, title: s.title, creator: s.creator })),
    ].sort((a, b) => `${a.title}--${a.creator}`.localeCompare(`${b.title}--${b.creator}`));

    const offlineOrdered = seededShuffle(
      offlineCombined,
      createSeededRng(`${challenge.id}:mp-dist-fallback:${workCat}:r${roundIndex}`)
    );
    for (const allowSameCreator of [false, true]) {
      for (const cand of offlineOrdered) {
        if (picked.length >= 3) break;
        if (canPickCandidate(cand, allowSameCreator, true, false)) {
          commitCandidate(cand);
        }
      }
    }
  }

  return picked.slice(0, 3);
}

async function resolveChallengeRoundSingle(
  challenge: MultiplayerChallenge,
  roundIndex: number,
  hydratedManifest: CulturalItem[] | undefined,
  priorItems: readonly CulturalItem[]
): Promise<CulturalItem> {
  let baseItem: CulturalItem | null = null;

  if (hydratedManifest && roundIndex < hydratedManifest.length) {
    baseItem = hydratedManifest[roundIndex];
  } else if (challenge.manifest && roundIndex < challenge.manifest.length) {
    baseItem = manifestEntryToBaseItem(challenge.manifest[roundIndex], challenge.id, roundIndex);
  }

  if (!baseItem) {
    const excludeSlugs = new Set<string>();
    const excludePageIds = new Set<number>();
    const excludeWorkKeys = new Set<string>();
    const excludeImgKeys = new Set<string>();

    const registerExcludedEntry = (
      cat: WorkCategory,
      slug?: string,
      title?: string,
      creator?: string,
      pageId?: number,
      image?: string
    ) => {
      if (slug) {
        excludeSlugs.add(slug);
        excludeSlugs.add(slug.toLowerCase());
      }
      if (pageId && pageId > 0) {
        excludePageIds.add(pageId);
      }
      if (title) {
        excludeWorkKeys.add(toCanonicalWorkKey(cat, title, creator));
      }
      const imgKey = extractNormalizedImageKey(image);
      if (imgKey) {
        excludeImgKeys.add(imgKey);
      }
    };

    for (const m of challenge.manifest || []) {
      registerExcludedEntry(m.category, m.slug, m.title, m.creator, m.pageId, m.image);
    }
    for (const h of hydratedManifest || []) {
      registerExcludedEntry(
        h.category,
        h.wikiSlug,
        h.title,
        h.creator,
        h.wikiPageId,
        h.image || h.highResImage
      );
    }
    if (challenge.difficulty === 'easy') {
      for (const d of challenge.distractors || []) {
        registerExcludedEntry(d.category, undefined, d.title, d.creator, d.pageId);
      }
    }
    for (const prev of priorItems) {
      registerExcludedEntry(
        prev.category,
        prev.wikiSlug,
        prev.title,
        prev.creator,
        prev.wikiPageId,
        prev.image || prev.highResImage
      );
      for (const dist of prev.mpDistractors || []) {
        registerExcludedEntry(
          dist.category,
          dist.slug,
          dist.title,
          dist.creator,
          dist.pageId,
          dist.image
        );
      }
    }

    const isExcludedItem = (item: CulturalItem): boolean => {
      const slugLower = item.wikiSlug.toLowerCase();
      if (excludeSlugs.has(item.wikiSlug) || excludeSlugs.has(slugLower)) return true;
      if (item.wikiPageId && excludePageIds.has(item.wikiPageId)) return true;
      const workKey = toCanonicalWorkKey(item.category, item.title, item.creator);
      if (excludeWorkKeys.has(workKey)) return true;
      const imgKey = extractNormalizedImageKey(item.image || item.highResImage);
      if (imgKey && excludeImgKeys.has(imgKey)) return true;
      return false;
    };

    const category = challenge.category;
    const challengeSeed = challenge.id;

    // Deterministic live Wikipedia fetch for Round 11+ in Forever Survival (or un-manifested legacy links)
    for (let probe = 0; probe < 20; probe++) {
      const probeRng = createSeededRng(`${challengeSeed}:live:${category}:${roundIndex}:p${probe}`);
      const concreteCategory = pickConcreteCategory(category, probeRng);
      const source = pickCategorySource(concreteCategory, probeRng, probe < 12);
      const forceNoPrefix = probe >= 14;
      const prefixMode = probe >= 10 ? 'letter' : 'auto';
      const prefixParam = pickSortPrefixParam(source, probeRng, forceNoPrefix, prefixMode);

      const url =
        `https://en.wikipedia.org/w/api.php?action=query&generator=categorymembers` +
        `&gcmtitle=${encodeURIComponent(source.categoryName)}` +
        `&gcmtype=page&gcmlimit=20&gcmsort=sortkey${prefixParam}` +
        `&prop=pageimages|extracts|description|info` +
        `&piprop=thumbnail|original&pithumbsize=400&pilicense=any&pilimit=20` +
        `&exintro=1&explaintext=1&exsentences=3&exlimit=20` +
        `&inprop=canonicalurl&format=json&origin=*`;

      const data = await fetchJsonThrottled(url, 2);
      const pages = Object.values(data?.query?.pages || {}) as any[];
      if (pages.length === 0) continue;

      // Canonical alphabetical sort BEFORE seeded shuffle guarantees every client picks the exact same item
      const parsedCandidates = pages
        .map(p => parseWikiBatchPageToItem(p, concreteCategory, source.expectedYear))
        .filter((it): it is CulturalItem => Boolean(it && !isExcludedItem(it)))
        .sort((a, b) => a.wikiSlug.localeCompare(b.wikiSlug));

      if (parsedCandidates.length > 0) {
        const ordered = seededShuffle(parsedCandidates, probeRng);
        for (const chosen of ordered) {
          if (!isExcludedItem(chosen)) {
            baseItem = {
              ...chosen,
              id: `ch-${challengeSeed}-${roundIndex}-${chosen.wikiSlug}`,
              // Keep Wikimedia cover directly so all players see the exact same thumbnail
              altCoverApplied: true,
            };
            break;
          }
        }
        if (baseItem) break;
      }
    }

    // Deterministic unseen offline fallback strictly if live Wikipedia probes all failed
    if (!baseItem) {
      const offlineDeck = seededShuffle(
        [...CULTURAL_ITEMS]
          .filter(it => category === 'everything' || it.category === category)
          .sort((a, b) => a.id.localeCompare(b.id)),
        createSeededRng(`${challengeSeed}:offline:${category}`)
      );
      const unseenOffline = offlineDeck.filter(it => !isExcludedItem(it));
      const picked =
        unseenOffline.length > 0
          ? unseenOffline[0]
          : offlineDeck[roundIndex % offlineDeck.length];
      baseItem = {
        ...picked,
        id: `ch-${challengeSeed}-${roundIndex}-${picked.wikiSlug || picked.id}`,
        altCoverApplied: true,
      };
    }
  }

  if (challenge.difficulty === 'easy') {
    const catRoundCount = Math.max(
      1,
      (challenge.manifest || []).filter(m => m.category === baseItem!.category).length
    );
    const catDistCount = new Set(
      (challenge.distractors || [])
        .filter(d => d.category === baseItem!.category && d.title && d.creator)
        .map(d => toEasyOptionKey(d.title, d.creator))
    ).size;

    const needsMpDistractors =
      challenge.gameMode === 'forever' || catDistCount < catRoundCount * 3;

    if (needsMpDistractors) {
      const mpDistractors = await resolveDeterministicMpDistractors(
        baseItem,
        challenge,
        roundIndex,
        hydratedManifest,
        priorItems
      );
      return {
        ...baseItem,
        mpDistractors,
      };
    }
  }

  return baseItem;
}

/**
 * Deterministic challenge round resolver for any player on a Multiplayer room.
 * 1. Rounds inside `challenge.manifest` return exact locked live items (100% identical across all players).
 * 2. Deep Forever rounds past the pre-locked manifest (or bare legacy `?ch=` seeds)
 *    pull deterministically from canonically sorted verified Wikipedia batches with pinned thumbnails
 *    so clients never diverge on covers or race timeouts, while excluding EVERY prior round & distractor in the room.
 * 3. Easy Forever (and sparse Classic fallback) attaches 3 deterministic non-repeating `mpDistractors`.
 */
export async function getSeededChallengeRoundItem(
  challenge: MultiplayerChallenge,
  roundIndex: number,
  hydratedManifest?: CulturalItem[],
  priorItems: readonly CulturalItem[] = []
): Promise<CulturalItem> {
  const manifestLen = hydratedManifest?.length || challenge.manifest?.length || 0;
  const needsPriorHistory = challenge.difficulty === 'easy' || roundIndex >= manifestLen;

  if (needsPriorHistory && priorItems.length < roundIndex && roundIndex - priorItems.length <= 25) {
    const resolvedPrior: CulturalItem[] = [...priorItems];
    for (let k = priorItems.length; k < roundIndex; k++) {
      const prevStep = await resolveChallengeRoundSingle(
        challenge,
        k,
        hydratedManifest,
        resolvedPrior
      );
      resolvedPrior.push(prevStep);
    }
    return resolveChallengeRoundSingle(challenge, roundIndex, hydratedManifest, resolvedPrior);
  }

  return resolveChallengeRoundSingle(challenge, roundIndex, hydratedManifest, priorItems);
}
