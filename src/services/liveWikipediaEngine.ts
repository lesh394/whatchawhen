import { Category, WorkCategory, CulturalItem } from '../types';
import { CULTURAL_ITEMS } from '../data/items';
import { resolveSafeBookCoverItem } from './bookCoverResolver';
import { resolveSafeMusicCoverItem } from './musicCoverResolver';
import { getBroadEraLabel, sanitizeWikiGenre, sanitizeWikiHint } from './choices';
import { createSeededRng, seededShuffle } from './multiplayer';

const USER_AGENT = 'WhatchaWhenGame/3.0 (education@whatchawhen.game; open-source-cultural-game)';

export const WORK_CATEGORIES: WorkCategory[] = ['music', 'books', 'art'];

function pickConcreteCategory(category: Category): WorkCategory {
  if (category === 'everything') {
    return WORK_CATEGORIES[Math.floor(Math.random() * WORK_CATEGORIES.length)];
  }
  return category;
}

// Historical year spans for each category on Wikipedia
const CATEGORY_YEAR_RANGES: Record<WorkCategory, { min: number; max: number; type: string }> = {
  music: { min: 1955, max: 2024, type: 'albums' },
  books: { min: 1800, max: 2023, type: 'novels' },
  art: { min: 1420, max: 2020, type: 'paintings' }
};

// Curated high-yield Wikipedia categories featuring celebrated cultural works
const LANDMARK_CATEGORIES: Record<WorkCategory, string[]> = {
  music: [
    'Category:Grammy_Award_for_Album_of_the_Year_winners',
    'Category:Billboard_Hot_100_number-one_singles_of_the_2020s',
    'Category:1970s_rock_albums',
    'Category:1980s_pop_albums',
    'Category:1990s_alternative_rock_albums',
    'Category:2000s_indie_rock_albums',
    'Category:2010s_pop_albums',
    'Category:Mercury_Prize-winning_albums',
    'Category:Brit_Award_for_British_Album_of_the_Year_winners',
  ],
  books: [
    'Category:Pulitzer_Prize_for_Fiction_winners',
    'Category:Booker_Prize-winning_novels',
    'Category:Hugo_Award-winning_novels',
    'Category:Nebula_Award-winning_novels',
    'Category:Dystopian_novels',
    'Category:19th-century_novels',
    'Category:20th-century_novels',
    'Category:21st-century_novels',
  ],
  art: [
    'Category:Paintings_in_the_Louvre',
    'Category:Paintings_in_the_Musée_d\'Orsay',
    'Category:Paintings_in_the_Museum_of_Modern_Art_(New_York)',
    'Category:Paintings_in_the_National_Gallery,_London',
    'Category:Renaissance_paintings',
    'Category:Impressionist_paintings',
    'Category:Paintings_by_Vincent_van_Gogh',
    'Category:Paintings_by_Claude_Monet',
    'Category:Paintings_by_Salvador_Dalí',
  ]
};

// In-memory pre-fetched queue buffer so round transitions have ZERO loading delay
const liveQueue: Record<WorkCategory, CulturalItem[]> = {
  music: [],
  books: [],
  art: []
};

// Active fetching locks to avoid redundant parallel requests
const isFetchingQueue: Record<WorkCategory, boolean> = {
  music: false,
  books: false,
  art: false
};

// Persistent session tracker of seen slugs
const seenSlugsSession = new Set<string>();

/**
 * Extracts author, artist or painter cleanly from Wikipedia summary text
 */
function extractCreator(desc: string, extract: string, category: WorkCategory): string {
  desc = (desc || '').trim();
  extract = (extract || '').trim();

  // Pattern 1: "... by <Creator>" in description
  const byMatch = desc.match(/\bby\s+([^,.(]+)/i);
  if (byMatch) {
    const candidate = byMatch[1].trim();
    if (candidate.length > 1 && candidate.length < 50) return candidate;
  }

  // Pattern 2: "<Year> <Author> novel" / "<Year> <Painter> painting" in description
  const prefixMatch = desc.match(
    /^(?:\d{4}\s+)?([A-Z][a-zA-Z\s.'-]+?)\s+(?:novel|book|painting|album|single|work)\b/
  );
  if (prefixMatch) {
    const candidate = prefixMatch[1].trim();
    if (
      candidate.length > 2 &&
      candidate.length < 50 &&
      !/^(?:studio|debut|live|soundtrack|compilation|self-titled|second|third|fourth|fifth|remix|greatest)$/i.test(
        candidate
      )
    ) {
      return candidate;
    }
  }

  // Pattern 3: In first sentence of extract: "... by <Creator>"
  const firstSentence = extract.split(/[.?!]\s/)[0] || '';
  const extBy = firstSentence.match(/\b(?:written|painted|recorded|composed|created|directed|authored)\s+by\s+(?:the\s+)?([A-Z][a-zA-Z0-9\s&.'-]+?)(?:,|\s+in\s+|\s+on\s+|\s+for\s+|$)/i);
  if (extBy) {
    const candidate = extBy[1].trim();
    if (candidate.length > 2 && candidate.length < 50) return candidate;
  }

  // Pattern 4: Strip known filler words
  const cleaned = desc
    .replace(/\b\d{4}\b/g, '')
    .replace(/\b(?:studio album|novel|painting|oil on canvas|fresco|single|debut album|live album)\b/gi, '')
    .trim();
  if (cleaned.length > 2 && cleaned.length < 40) return cleaned;

  return category === 'music' ? 'Acclaimed Musician' : category === 'books' ? 'Acclaimed Author' : 'Master Painter';
}

/**
 * Strips disambiguation tags from Wikipedia title (e.g. "Abbey Road (album)" -> "Abbey Road")
 */
function cleanWikipediaTitle(title: string): string {
  return title
    .replace(/\s*\((album|novel|painting|single|book|play|EP|song|band|musician|artist)\)\s*$/i, '')
    .trim();
}

/**
 * Safely fetches a single random item live from Wikipedia
 */
export async function fetchLiveRandomItem(
  category: Category, 
  seenSlugs: Set<string> = new Set()
): Promise<CulturalItem | null> {
  const concreteCategory = pickConcreteCategory(category);
  const range = CATEGORY_YEAR_RANGES[concreteCategory];
  
  // 65% chance to pick random year category, 35% chance to pick curated landmark category
  const useYearCategory = Math.random() < 0.65;
  let targetCategory = '';
  let expectedYear = 1980;

  if (useYearCategory) {
    expectedYear = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    targetCategory = `Category:${expectedYear}_${range.type}`;
  } else {
    const landmarks = LANDMARK_CATEGORIES[concreteCategory];
    targetCategory = landmarks[Math.floor(Math.random() * landmarks.length)];
  }

  // Pick random alphabetical sortkey prefix to sample from different parts of Wikipedia's index
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];

  const catUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(
    targetCategory
  )}&cmtype=page&cmlimit=20&cmsort=sortkey&cmstartsortkeyprefix=${randomLetter}&format=json&origin=*`;

  try {
    const res = await fetch(catUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;

    const data = await res.json();
    const members = (data.query?.categorymembers || []).filter(
      (m: any) => 
        !m.title.startsWith('Category:') && 
        !m.title.startsWith('File:') && 
        !m.title.startsWith('List of') &&
        !seenSlugs.has(m.title) &&
        !seenSlugsSession.has(m.title)
    );

    if (members.length === 0) return null;

    // Shuffle returned members to maximize randomness
    const shuffledMembers = [...members].sort(() => Math.random() - 0.5);

    // Test candidates until we find one with a valid lead image
    for (const candidate of shuffledMembers.slice(0, 5)) {
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate.title)}`;
      const sumRes = await fetch(sumUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!sumRes.ok) continue;

      const sum = await sumRes.json();
      if (!sum.thumbnail?.source || !sum.extract) continue;

      // Found a valid article with image!
      const slug = sum.titles?.canonical || candidate.title;
      seenSlugsSession.add(slug);

      // Determine year
      let finalYear = expectedYear;
      if (!useYearCategory) {
        const yearMatches = (sum.description + ' ' + sum.extract.slice(0, 160)).match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/g);
        if (yearMatches && yearMatches.length > 0) {
          const parsed = yearMatches.map(y => parseInt(y, 10)).filter(y => y >= 1400 && y <= 2026);
          if (parsed.length > 0) finalYear = parsed[0];
        }
      }

      const creator = extractCreator(sum.description || '', sum.extract, concreteCategory);
      const title = cleanWikipediaTitle(sum.title);

      const newItem: CulturalItem = {
        id: `wiki-live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        category: concreteCategory,
        title,
        creator,
        year: finalYear,
        wikiSlug: slug,
        image: sum.thumbnail.source,
        highResImage: sum.originalimage?.source || sum.thumbnail.source,
        genreOrMovement: sanitizeWikiGenre(sum.description, concreteCategory, finalYear),
        hint1: sanitizeWikiHint({
          category: concreteCategory,
          title,
          creator,
          year: finalYear,
          rawDescription: sum.description,
          wikiExtract: sum.extract,
        }),
        hint2: `From the ${getBroadEraLabel(finalYear)}.`,
        creatorType: concreteCategory === 'music' ? 'Artist' : concreteCategory === 'books' ? 'Author' : 'Painter',
        itemType: concreteCategory === 'music' ? 'Album' : concreteCategory === 'books' ? 'Novel' : 'Painting',
        trivia: sum.extract.slice(0, 220) + '...',
        wikiExtract: sum.extract,
        altTitles: [title, sum.title],
        altCreators: [creator],
      };

      if (concreteCategory === 'books') {
        return await resolveSafeBookCoverItem(newItem);
      }
      if (concreteCategory === 'music') {
        return await resolveSafeMusicCoverItem(newItem);
      }

      return newItem;
    }

    return null;
  } catch (err) {
    console.warn('[Live Wikipedia Engine] Fetch error:', err);
    return null;
  }
}

/**
 * Quietly refills the pre-fetch buffer queue for a category in the background
 */
export async function refillLiveQueue(category: Category) {
  if (category === 'everything') {
    await Promise.all(WORK_CATEGORIES.map(cat => refillLiveQueue(cat)));
    return;
  }

  if (isFetchingQueue[category]) return;
  if (liveQueue[category].length >= 3) return; // Buffer is already satisfied

  isFetchingQueue[category] = true;
  try {
    const item = await fetchLiveRandomItem(category);
    if (item) {
      liveQueue[category].push(item);
    }
  } finally {
    isFetchingQueue[category] = false;
  }
}

/**
 * Returns the next live round item.
 * 1. Takes immediately from pre-fetched queue if available (0ms delay).
 * 2. Fetches live from Wikipedia on demand if queue is empty.
 * 3. Falls back gracefully to high-quality curated item if network is unavailable.
 */
export async function getNextLiveRoundItem(
  category: Category,
  seenSlugs: Set<string> = new Set()
): Promise<CulturalItem> {
  const concreteCategory = pickConcreteCategory(category);

  // Always trigger background replenishment
  refillLiveQueue(category === 'everything' ? 'everything' : concreteCategory).catch(() => {});

  // 1. Check if buffer queue has an unseen item ready
  while (liveQueue[concreteCategory].length > 0) {
    const buffered = liveQueue[concreteCategory].shift()!;
    if (!seenSlugs.has(buffered.id) && !seenSlugs.has(buffered.wikiSlug)) {
      // Kick off another background fetch to keep buffer filled
      setTimeout(() => refillLiveQueue(concreteCategory), 500);
      return buffered;
    }
  }

  // 2. Fetch live right now
  const liveItem = await fetchLiveRandomItem(concreteCategory, seenSlugs);
  if (liveItem) {
    setTimeout(() => refillLiveQueue(concreteCategory), 500);
    return liveItem;
  }

  // 3. Fallback: Curated catalog item matching chosen concreteCategory
  const catItems = CULTURAL_ITEMS.filter(it => it.category === concreteCategory && !seenSlugs.has(it.id));
  const fallback = catItems.length > 0 
    ? catItems[Math.floor(Math.random() * catItems.length)]
    : CULTURAL_ITEMS.filter(it => it.category === concreteCategory)[0];

  if (fallback.category === 'books') {
    return await resolveSafeBookCoverItem(fallback);
  }
  if (fallback.category === 'music') {
    return await resolveSafeMusicCoverItem(fallback);
  }

  return fallback;
}

/**
 * Pre-warms the live queue across categories when the app opens
 */
export function prewarmLiveQueues() {
  WORK_CATEGORIES.forEach(cat => {
    refillLiveQueue(cat).catch(() => {});
  });
}

async function fetchJsonWithRetry(url: string, retries: number = 2): Promise<any | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) return await res.json();
    } catch {
      // retry transient blip
    }
    if (i < retries) {
      await new Promise(r => setTimeout(r, 250 * (i + 1)));
    }
  }
  return null;
}

async function resolveDeterministicItem(baseItem: CulturalItem, challengeId: string, roundIndex: number): Promise<CulturalItem> {
  const cloned: CulturalItem = {
    ...baseItem,
    id: `ch-${challengeId}-${roundIndex}-${baseItem.wikiSlug || baseItem.id}`,
  };
  if (cloned.category === 'books') {
    return await resolveSafeBookCoverItem(cloned);
  }
  if (cloned.category === 'music') {
    return await resolveSafeMusicCoverItem(cloned);
  }
  return cloned;
}

/**
 * Deterministic challenge round generator shared between friends on the same URL seed.
 * Draws identically from the shuffled canonical catalog first (guaranteed 100% match across
 * devices with zero API drift), then continues endlessly into seeded Wikipedia lookups if a
 * Forever Survival run surpasses the full curated deck.
 */
export async function getSeededChallengeRoundItem(
  category: Category,
  challengeSeed: string,
  roundIndex: number,
  usedChallengeSlugs: Set<string> = new Set()
): Promise<CulturalItem> {
  const canonicalPool = [...CULTURAL_ITEMS]
    .filter(it => category === 'everything' || it.category === category)
    .sort((a, b) => a.id.localeCompare(b.id));

  const deck = seededShuffle(canonicalPool, createSeededRng(`${challengeSeed}:deck:${category}`));

  if (roundIndex < deck.length) {
    return await resolveDeterministicItem(deck[roundIndex], challengeSeed, roundIndex);
  }

  // Deep Forever continuation beyond curated deck (Round 35+ single-cat or 103+ Everything)
  const rng = createSeededRng(`${challengeSeed}:live:${category}:${roundIndex}`);
  const concreteCategory: WorkCategory =
    category === 'everything'
      ? WORK_CATEGORIES[Math.floor(rng() * WORK_CATEGORIES.length)]
      : category;

  const landmarks = LANDMARK_CATEGORIES[concreteCategory];
  const letters = 'ABCDEFGHIJKLMNOPRSTW';

  for (let probe = 0; probe < 5; probe++) {
    const probeRng = createSeededRng(`${challengeSeed}:live:${category}:${roundIndex}:p${probe}`);
    const targetCat = landmarks[Math.floor(probeRng() * landmarks.length)];
    const startLetter = letters[Math.floor(probeRng() * letters.length)];
    const catUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(
      targetCat
    )}&cmtype=page&cmlimit=20&cmsort=sortkey&cmstartsortkeyprefix=${startLetter}&format=json&origin=*`;

    const data = await fetchJsonWithRetry(catUrl, 1);
    const members = (data?.query?.categorymembers || []).filter(
      (m: any) =>
        !m.title.startsWith('Category:') &&
        !m.title.startsWith('File:') &&
        !m.title.startsWith('List of') &&
        !usedChallengeSlugs.has(m.title)
    );
    if (members.length === 0) continue;

    const sortedMembers = [...members].sort((a: any, b: any) => a.title.localeCompare(b.title));
    const orderedCandidates = seededShuffle(sortedMembers, probeRng);

    for (const candidate of orderedCandidates.slice(0, 5)) {
      const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate.title)}`;
      const sum = await fetchJsonWithRetry(sumUrl, 1);
      if (!sum?.thumbnail?.source || !sum?.extract) continue;

      const slug = sum.titles?.canonical || candidate.title;
      if (usedChallengeSlugs.has(slug)) continue;

      const yearMatches = `${sum.description || ''} ${sum.extract.slice(0, 180)}`.match(
        /\b(1[4-9]\d{2}|20[0-2]\d)\b/g
      );
      const parsedYears = (yearMatches || [])
        .map(y => parseInt(y, 10))
        .filter(y => y >= 1400 && y <= 2026);
      const finalYear =
        parsedYears.length > 0
          ? parsedYears[0]
          : concreteCategory === 'music'
          ? 1985
          : concreteCategory === 'books'
          ? 1920
          : 1850;

      const creator = extractCreator(sum.description || '', sum.extract, concreteCategory);
      const title = cleanWikipediaTitle(sum.title);

      const liveItem: CulturalItem = {
        id: `ch-${challengeSeed}-${roundIndex}-${slug}`,
        category: concreteCategory,
        title,
        creator,
        year: finalYear,
        wikiSlug: slug,
        image: sum.thumbnail.source,
        highResImage: sum.originalimage?.source || sum.thumbnail.source,
        genreOrMovement: sanitizeWikiGenre(sum.description, concreteCategory, finalYear),
        hint1: sanitizeWikiHint({
          category: concreteCategory,
          title,
          creator,
          year: finalYear,
          rawDescription: sum.description,
          wikiExtract: sum.extract,
        }),
        hint2: `From the ${getBroadEraLabel(finalYear)}.`,
        creatorType: concreteCategory === 'music' ? 'Artist' : concreteCategory === 'books' ? 'Author' : 'Painter',
        itemType: concreteCategory === 'music' ? 'Album' : concreteCategory === 'books' ? 'Novel' : 'Painting',
        trivia: sum.extract.slice(0, 220) + '...',
        wikiExtract: sum.extract,
        altTitles: [title, sum.title],
        altCreators: [creator],
      };

      return await resolveDeterministicItem(liveItem, challengeSeed, roundIndex);
    }
  }

  // Deterministic wrap fallback if offline beyond curated deck
  return await resolveDeterministicItem(deck[roundIndex % deck.length], challengeSeed, roundIndex);
}
