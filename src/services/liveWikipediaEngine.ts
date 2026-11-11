import { Category, WorkCategory, CulturalItem, GameMode } from '../types';
import { CULTURAL_ITEMS } from '../data/items';
import { resolveSafeBookCoverItem } from './bookCoverResolver';
import { resolveSafeMusicCoverItem } from './musicCoverResolver';
import { getBroadEraLabel, sanitizeWikiGenre, sanitizeWikiHint } from './choices';
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

// Curated 100%-verified high-yield Wikipedia categories (15-20 pictured works per batch)
const VERIFIED_ART_CATEGORIES: string[] = [
  'Category:Paintings_in_the_Metropolitan_Museum_of_Art',
  'Category:Paintings_in_the_Art_Institute_of_Chicago',
  'Category:Paintings_in_the_National_Gallery,_London',
  "Category:Paintings_in_the_Musée_d'Orsay",
  'Category:Renaissance_paintings',
  'Category:Baroque_paintings',
  'Category:Impressionist_paintings',
  'Category:Surrealist_paintings',
  'Category:Paintings_by_Vincent_van_Gogh',
  'Category:Paintings_by_Claude_Monet',
  'Category:Paintings_by_Rembrandt',
  'Category:Paintings_by_Pablo_Picasso',
  'Category:Paintings_by_Salvador_Dalí',
];

const VERIFIED_BOOK_LANDMARK_CATEGORIES: string[] = [
  'Category:Dystopian_novels',
  'Category:American_science_fiction_novels',
  'Category:British_science_fiction_novels',
  'Category:American_fantasy_novels',
  'Category:Historical_novels',
  'Category:1886_novels',
  'Category:1897_novels',
  'Category:1911_novels',
  'Category:1925_novels',
  'Category:1932_novels',
];

const SORT_PREFIXES = 'ABCDEFGHIJKLMNOPRSTW';

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

// Polite global queue so parallel Wikipedia requests never trigger HTTP 429
let wikiQueueTail: Promise<void> = Promise.resolve();
let lastWikiRequestAt = 0;

async function fetchJsonThrottled(url: string, retries: number = 2): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const run = wikiQueueTail.then(async () => {
      const waitMs = 115 - (Date.now() - lastWikiRequestAt);
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
        await new Promise(r => setTimeout(r, 380 * (attempt + 1)));
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 280 * (attempt + 1)));
      }
    }
  }
  return null;
}

// ---------------- WIKIPEDIA PARSING HELPERS ----------------

function extractCreator(desc: string, extract: string, category: WorkCategory): string {
  desc = (desc || '').trim();
  extract = (extract || '').trim();

  // Pattern 1: "... by <Creator>" in description
  const byMatch = desc.match(/\bby\s+([^,.(]+)/i);
  if (byMatch) {
    const candidate = byMatch[1].trim();
    if (candidate.length > 1 && candidate.length < 55) return candidate;
  }

  // Pattern 2: "<Year> <Author> novel" / "<Year> <Painter> painting" in description
  const prefixMatch = desc.match(
    /^(?:\d{4}\s+)?([A-Z][a-zA-ZÀ-ÿ\s.'-]+?)\s+(?:novel|novella|book|painting|album|single|work)\b/
  );
  if (prefixMatch) {
    const candidate = prefixMatch[1].trim();
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

  // Pattern 3: First sentence "<verb> by <Creator>"
  const firstSentence = extract.split(/[.?!]\s/)[0] || '';
  const extBy = firstSentence.match(
    /\b(?:written|painted|recorded|composed|created|executed|authored|sung|performed)\s+by\s+(?:the\s+)?([A-Z][a-zA-ZÀ-ÿ0-9\s&.'-]+?)(?:,|\s+in\s+|\s+on\s+|\s+for\s+|\s+from\s+|\s+and\s+(?:published|released)|\s*\(|$)/i
  );
  if (extBy) {
    const candidate = extBy[1].trim();
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
    /\b(?:art movement|literary genre|fictional universe|fictional character|television series|tv series|video game|board game|role-playing game|franchise|media franchise)\b/i.test(
      combined
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
}

function pickCategorySource(
  concreteCategory: WorkCategory,
  rng: () => number
): WikiCategorySource {
  if (concreteCategory === 'music') {
    const year = Math.floor(rng() * (2024 - 1958 + 1)) + 1958;
    return { categoryName: `Category:${year}_albums`, expectedYear: year };
  }
  if (concreteCategory === 'books') {
    if (rng() < 0.72) {
      const year = Math.floor(rng() * (2023 - 1915 + 1)) + 1915;
      return { categoryName: `Category:${year}_novels`, expectedYear: year };
    }
    const landmark =
      VERIFIED_BOOK_LANDMARK_CATEGORIES[
        Math.floor(rng() * VERIFIED_BOOK_LANDMARK_CATEGORIES.length)
      ];
    const yearFromCat = landmark.match(/(\d{4})_novels/);
    return {
      categoryName: landmark,
      expectedYear: yearFromCat ? parseInt(yearFromCat[1], 10) : undefined,
    };
  }
  const artCat =
    VERIFIED_ART_CATEGORIES[Math.floor(rng() * VERIFIED_ART_CATEGORIES.length)];
  return { categoryName: artCat };
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
  forceNoPrefix: boolean = false
): Promise<CulturalItem[]> {
  const source = pickCategorySource(concreteCategory, rng);
  const usePrefix = !forceNoPrefix && rng() < 0.75;
  const letter = SORT_PREFIXES[Math.floor(rng() * SORT_PREFIXES.length)];

  const prefixParam = usePrefix ? `&gcmstartsortkeyprefix=${letter}` : '';
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
  if (pages.length === 0) return [];

  const parsed: CulturalItem[] = [];
  for (const p of pages) {
    const item = parseWikiBatchPageToItem(p, concreteCategory, source.expectedYear);
    if (item) {
      parsed.push(item);
      pushToDistractorBank(item);
    }
  }

  return parsed;
}

function pushToDistractorBank(item: CulturalItem) {
  const bank = liveDistractorBank[item.category];
  if (bank.some(existing => existing.wikiSlug === item.wikiSlug)) return;
  bank.push(item);
  if (bank.length > 160) {
    bank.shift();
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

// ---------------- SOLO QUEUE & PREWARM ----------------

export async function refillLiveQueue(category: Category, minQueueSize: number = 8): Promise<void> {
  if (category === 'everything') {
    await Promise.all(WORK_CATEGORIES.map(cat => refillLiveQueue(cat, minQueueSize)));
    return;
  }

  if (liveQueue[category].length >= minQueueSize) return;
  if (inflightQueueRefills[category]) {
    await inflightQueueRefills[category];
    return;
  }

  const work = (async () => {
    const queuedSlugs = new Set(liveQueue[category].map(it => it.wikiSlug));
    for (let attempt = 0; attempt < 4 && liveQueue[category].length < minQueueSize; attempt++) {
      const batch = await fetchLiveBatch(category, Math.random, attempt >= 2);
      const fresh = batch
        .filter(it => !queuedSlugs.has(it.wikiSlug) && !seenSlugsSession.has(it.wikiSlug))
        .sort(() => Math.random() - 0.5);

      for (const item of fresh) {
        queuedSlugs.add(item.wikiSlug);
        liveQueue[category].push(item);
      }
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
  const concreteCategory = pickConcreteCategory(category);
  for (let attempt = 0; attempt < 4; attempt++) {
    const batch = await fetchLiveBatch(concreteCategory, Math.random, attempt >= 2);
    const eligible = batch.filter(
      it => !seenSlugs.has(it.wikiSlug) && !seenSlugs.has(it.id) && !seenSlugsSession.has(it.wikiSlug)
    );
    if (eligible.length > 0) {
      const picked = eligible[Math.floor(Math.random() * eligible.length)];
      seenSlugsSession.add(picked.wikiSlug);
      if (picked.category === 'books') return await resolveSafeBookCoverItem(picked);
      if (picked.category === 'music') return await resolveSafeMusicCoverItem(picked);
      return picked;
    }
  }
  return null;
}

/**
 * Returns the next Solo live round item.
 * Always prioritizes fresh live Wikipedia pools across retries before falling back to offline catalog.
 */
export async function getNextLiveRoundItem(
  category: Category,
  seenSlugs: Set<string> = new Set()
): Promise<CulturalItem> {
  const concreteCategory = pickConcreteCategory(category);

  // Pull immediately from buffered live queue if stocked
  while (liveQueue[concreteCategory].length > 0) {
    const buffered = liveQueue[concreteCategory].shift()!;
    if (!seenSlugs.has(buffered.id) && !seenSlugs.has(buffered.wikiSlug)) {
      seenSlugsSession.add(buffered.wikiSlug);
      setTimeout(() => refillLiveQueue(concreteCategory, 8).catch(() => {}), 300);
      if (buffered.category === 'books') return await resolveSafeBookCoverItem(buffered);
      if (buffered.category === 'music') return await resolveSafeMusicCoverItem(buffered);
      return buffered;
    }
  }

  // Refill live batch right now (stocks BOTH round queue AND distractor bank!)
  await refillLiveQueue(concreteCategory, 8);

  while (liveQueue[concreteCategory].length > 0) {
    const fetched = liveQueue[concreteCategory].shift()!;
    if (!seenSlugs.has(fetched.id) && !seenSlugs.has(fetched.wikiSlug)) {
      seenSlugsSession.add(fetched.wikiSlug);
      setTimeout(() => refillLiveQueue(concreteCategory, 8).catch(() => {}), 300);
      if (fetched.category === 'books') return await resolveSafeBookCoverItem(fetched);
      if (fetched.category === 'music') return await resolveSafeMusicCoverItem(fetched);
      return fetched;
    }
  }

  // Last-resort direct fetch before touching stored catalog
  const liveDirect = await fetchLiveRandomItem(concreteCategory, seenSlugs);
  if (liveDirect) {
    setTimeout(() => refillLiveQueue(concreteCategory, 8).catch(() => {}), 300);
    return liveDirect;
  }

  // Emergency offline fallback only if Wikipedia is unreachable
  const catItems = CULTURAL_ITEMS.filter(
    it => it.category === concreteCategory && !seenSlugs.has(it.id)
  );
  const pool = catItems.length > 0 ? catItems : CULTURAL_ITEMS.filter(it => it.category === concreteCategory);
  const fallback = pool[Math.floor(Math.random() * pool.length)];

  if (fallback.category === 'books') return await resolveSafeBookCoverItem(fallback);
  if (fallback.category === 'music') return await resolveSafeMusicCoverItem(fallback);
  return fallback;
}

export function prewarmLiveQueues() {
  WORK_CATEGORIES.forEach(cat => {
    refillLiveQueue(cat, 8).catch(() => {});
  });
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
  const targetDistractorCount = 8;
  const totalNeeded = targetRoundCount + targetDistractorCount;

  const pickedItems: CulturalItem[] = [];
  const usedSlugs = new Set<string>();

  const targetCats: WorkCategory[] =
    category === 'everything' ? ['music', 'books', 'art'] : [category];

  // Fetch fresh batches directly from live Wikipedia (never starting from stored CULTURAL_ITEMS!)
  const batchesPerCategory = category === 'everything' ? 2 : 4;
  for (let pass = 0; pass < batchesPerCategory && pickedItems.length < totalNeeded; pass++) {
    for (const workCat of targetCats) {
      if (pickedItems.length >= totalNeeded) break;
      const batch = await fetchLiveBatch(workCat, Math.random, pass >= batchesPerCategory - 1);
      const shuffled = [...batch].sort(() => Math.random() - 0.5);
      for (const item of shuffled) {
        if (usedSlugs.has(item.wikiSlug)) continue;
        usedSlugs.add(item.wikiSlug);
        pickedItems.push(item);
      }
    }
  }

  // Interleave categories evenly in Everything Mix before slicing rounds vs distractors
  let balancedPool: CulturalItem[] = pickedItems;
  if (category === 'everything') {
    const byCat: Record<WorkCategory, CulturalItem[]> = {
      music: pickedItems.filter(i => i.category === 'music').sort(() => Math.random() - 0.5),
      books: pickedItems.filter(i => i.category === 'books').sort(() => Math.random() - 0.5),
      art: pickedItems.filter(i => i.category === 'art').sort(() => Math.random() - 0.5),
    };
    const roundBuckets: CulturalItem[] = [];
    const offset = Math.floor(Math.random() * 3);
    for (let i = 0; roundBuckets.length < targetRoundCount; i++) {
      const cat = WORK_CATEGORIES[(i + offset) % 3];
      const next = byCat[cat].shift();
      if (next) {
        roundBuckets.push(next);
      } else if (!byCat.music.length && !byCat.books.length && !byCat.art.length) {
        break;
      }
    }
    const leftovers = [...byCat.music, ...byCat.books, ...byCat.art];
    balancedPool = [...roundBuckets, ...leftovers];
  } else {
    balancedPool = [...pickedItems].sort(() => Math.random() - 0.5);
  }

  // Offline emergency tail ONLY if Wikipedia failed to provide enough live rounds
  if (balancedPool.length < targetRoundCount) {
    const offlineTail = [...CULTURAL_ITEMS]
      .filter(it => (category === 'everything' || it.category === category) && !usedSlugs.has(it.wikiSlug))
      .sort(() => Math.random() - 0.5);
    for (const it of offlineTail) {
      if (balancedPool.length >= totalNeeded) break;
      usedSlugs.add(it.wikiSlug);
      balancedPool.push(it);
    }
  }

  const rawRoundItems = balancedPool.slice(0, targetRoundCount);
  const rawDistractorItems = balancedPool.slice(targetRoundCount, targetRoundCount + targetDistractorCount);

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

  const manifest: LockedRoundEntry[] = hydratedItems.map(item => ({
    slug: item.wikiSlug,
    title: item.title,
    creator: item.creator,
    year: item.year,
    category: item.category,
    image: item.image,
    genre: item.genreOrMovement,
  }));

  const distractors: LockedDistractorEntry[] = rawDistractorItems.map(item => ({
    category: item.category,
    title: item.title,
    creator: item.creator,
  }));

  return { manifest, distractors, hydratedItems };
}

/**
 * Hydrates full clue/summary metadata for a room's locked manifest in ONE batched Wikipedia call,
 * while strictly keeping the locked `title`, `creator`, `year`, and pinned `image` verbatim so
 * every friend on the room link gets 100% identical items, covers, and hints.
 */
export async function hydrateMultiplayerItems(
  challenge: MultiplayerChallenge
): Promise<CulturalItem[]> {
  const manifest = challenge.manifest || [];
  if (manifest.length === 0) return [];

  const baseItems = manifest.map((entry, idx) =>
    manifestEntryToBaseItem(entry, challenge.id, idx)
  );

  // One batched titles= query enriches extracts/hints cleanly for all locked rounds at once
  const titlesParam = manifest
    .slice(0, 20)
    .map(m => m.slug.replace(/_/g, ' '))
    .join('|');
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titlesParam)}` +
    `&prop=pageimages|extracts|description|info&piprop=thumbnail|original&pithumbsize=400` +
    `&pilicense=any&pilimit=20&exintro=1&explaintext=1&exsentences=3&exlimit=20` +
    `&inprop=canonicalurl&format=json&origin=*`;

  const data = await fetchJsonThrottled(url, 1);
  if (!data?.query) {
    return baseItems;
  }

  const pages = Object.values(data.query.pages || {}) as any[];
  const pageByNormTitle = new Map<string, any>();
  for (const p of pages) {
    if (p?.title) {
      pageByNormTitle.set(String(p.title).replace(/\s+/g, '_').toLowerCase(), p);
    }
  }
  // Also follow Wikipedia normalization map if titles differed slightly
  if (Array.isArray(data.query.normalized)) {
    for (const norm of data.query.normalized) {
      const targetPage = pageByNormTitle.get(String(norm.to).replace(/\s+/g, '_').toLowerCase());
      if (targetPage && norm.from) {
        pageByNormTitle.set(String(norm.from).replace(/\s+/g, '_').toLowerCase(), targetPage);
      }
    }
  }

  return baseItems.map((base, idx) => {
    const entry = manifest[idx];
    const page = pageByNormTitle.get(entry.slug.replace(/\s+/g, '_').toLowerCase());
    if (!page) return base;

    const extract = String(page.extract || '');
    const desc = String(page.description || '');
    const resolvedImage = entry.image || page.thumbnail?.source || base.image;

    return {
      ...base,
      image: resolvedImage,
      highResImage: entry.image || page.original?.source || resolvedImage,
      altCoverApplied: Boolean(resolvedImage),
      genreOrMovement: entry.genre || sanitizeWikiGenre(desc, entry.category, entry.year),
      hint1: sanitizeWikiHint({
        category: entry.category,
        title: entry.title,
        creator: entry.creator,
        year: entry.year,
        rawDescription: desc,
        wikiExtract: extract,
      }),
      trivia: extract ? extract.slice(0, 220) + (extract.length > 220 ? '...' : '') : base.trivia,
      wikiExtract: extract || base.wikiExtract,
    };
  });
}

/**
 * Deterministic challenge round resolver for any player on a Multiplayer room.
 * 1. Rounds inside `challenge.manifest` return exact locked live items (100% identical across all players).
 * 2. Deep Forever rounds past the pre-locked manifest (or bare legacy `?ch=` seeds)
 *    pull deterministically from canonically sorted verified Wikipedia batches with pinned thumbnails
 *    so clients never diverge on covers or race timeouts.
 */
export async function getSeededChallengeRoundItem(
  challenge: MultiplayerChallenge,
  roundIndex: number,
  hydratedManifest?: CulturalItem[]
): Promise<CulturalItem> {
  if (hydratedManifest && roundIndex < hydratedManifest.length) {
    return hydratedManifest[roundIndex];
  }
  if (challenge.manifest && roundIndex < challenge.manifest.length) {
    return manifestEntryToBaseItem(challenge.manifest[roundIndex], challenge.id, roundIndex);
  }

  const manifestSlugs = new Set((challenge.manifest || []).map(m => m.slug));
  const category = challenge.category;
  const challengeSeed = challenge.id;

  // Deterministic live Wikipedia fetch for Round 16+ in Forever Survival (or un-manifested legacy links)
  for (let probe = 0; probe < 5; probe++) {
    const probeRng = createSeededRng(`${challengeSeed}:live:${category}:${roundIndex}:p${probe}`);
    const concreteCategory = pickConcreteCategory(category, probeRng);
    const source = pickCategorySource(concreteCategory, probeRng);
    const letter = SORT_PREFIXES[Math.floor(probeRng() * SORT_PREFIXES.length)];
    const prefixParam = probe < 3 ? `&gcmstartsortkeyprefix=${letter}` : '';

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
      .filter((it): it is CulturalItem => Boolean(it && !manifestSlugs.has(it.wikiSlug)))
      .sort((a, b) => a.wikiSlug.localeCompare(b.wikiSlug));

    if (parsedCandidates.length > 0) {
      const ordered = seededShuffle(parsedCandidates, probeRng);
      const chosen = ordered[0];
      return {
        ...chosen,
        id: `ch-${challengeSeed}-${roundIndex}-${chosen.wikiSlug}`,
        // Keep Wikimedia cover directly so all players see the exact same thumbnail
        altCoverApplied: true,
      };
    }
  }

  // Deterministic wrap fallback strictly if completely offline
  if (hydratedManifest && hydratedManifest.length > 0) {
    return hydratedManifest[roundIndex % hydratedManifest.length];
  }
  const offlineDeck = seededShuffle(
    [...CULTURAL_ITEMS]
      .filter(it => category === 'everything' || it.category === category)
      .sort((a, b) => a.id.localeCompare(b.id)),
    createSeededRng(`${challengeSeed}:offline:${category}`)
  );
  const picked = offlineDeck[roundIndex % offlineDeck.length];
  return {
    ...picked,
    id: `ch-${challengeSeed}-${roundIndex}-${picked.wikiSlug || picked.id}`,
    altCoverApplied: true,
  };
}
