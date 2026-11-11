import { Category, WorkCategory, CulturalItem } from '../types';
import { CULTURAL_ITEMS } from '../data/items';
import { getBroadEraLabel, sanitizeWikiGenre, sanitizeWikiHint } from './choices';

const STORAGE_KEY = 'whatchawhen_infinite_pool';

// Load any previously discovered items from localStorage to persist endless growth
function loadPersistedDiscoveredItems(): CulturalItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePersistedDiscoveredItems(items: CulturalItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

// Runtime dynamic pool combining pre-loaded items and discovered items
let runtimeDiscoveredPool: CulturalItem[] = loadPersistedDiscoveredItems();

// Throttle timestamp to respect Wikipedia REST API guidelines
let lastFetchTimestamp = 0;

/**
 * Returns all known cultural items (base catalog + dynamically discovered items)
 */
export function getAllKnownItems(): CulturalItem[] {
  return [...CULTURAL_ITEMS, ...runtimeDiscoveredPool];
}

/**
 * Returns the count of dynamically discovered items during player sessions
 */
export function getDiscoveredCount(): number {
  return runtimeDiscoveredPool.length;
}

/**
 * Gets a completely randomized, non-repeating stream of cultural items for a category
 */
export function getShuffledPool(
  category: Category, 
  excludeIds: Set<string> = new Set()
): CulturalItem[] {
  const allForCategory = category === 'everything'
    ? getAllKnownItems()
    : getAllKnownItems().filter(it => it.category === category);
  
  // Pick unseen items first so every game is a fresh experience
  let eligible = allForCategory.filter(it => !excludeIds.has(it.id));
  
  if (eligible.length < 5) {
    // If the player has played through everything, refresh the pool with fresh random permutations
    eligible = allForCategory;
  }

  // Fisher-Yates high-entropy shuffle
  const array = [...eligible];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

/**
 * Appends fresh unseen items to round items for Endless / Forever Survival Mode
 */
export function getMoreItemsForEndless(
  category: Category,
  seenIds: Set<string>,
  count: number = 5
): CulturalItem[] {
  const fresh = getShuffledPool(category, seenIds);
  return fresh.slice(0, count);
}

// High-interest Wikipedia query targets across wide time horizons (ancient to modern)
const DISCOVERY_TARGETS: Record<WorkCategory, string[]> = {
  music: [
    'Category:1970s_rock_albums',
    'Category:1980s_pop_albums',
    'Category:1990s_alternative_rock_albums',
    'Category:2000s_indie_rock_albums',
    'Category:2010s_pop_albums',
    'Category:2020s_singles',
    'Category:Grammy_Award_for_Album_of_the_Year_winners',
    'Category:Billboard_Hot_100_number-one_singles_of_the_2020s',
  ],
  books: [
    'Category:19th-century_novels',
    'Category:20th-century_novels',
    'Category:21st-century_novels',
    'Category:Pulitzer_Prize_for_Fiction_winners',
    'Category:Booker_Prize-winning_novels',
    'Category:Dystopian_novels',
  ],
  art: [
    'Category:Renaissance_paintings',
    'Category:Impressionist_paintings',
    'Category:Paintings_by_Vincent_van_Gogh',
    'Category:Paintings_by_Claude_Monet',
    'Category:Paintings_in_the_Louvre',
    'Category:Paintings_in_the_Museum_of_Modern_Art_(New_York)',
  ],
};

/**
 * Dynamically queries Wikipedia REST API for a random cultural item to expand the pool infinitely.
 * Safe rate-limited with fallback.
 */
export async function fetchLiveWikipediaCulturalItem(category: Category): Promise<CulturalItem | null> {
  const now = Date.now();
  if (now - lastFetchTimestamp < 8000) {
    // Throttled: at most 1 query per 8 seconds
    return null;
  }
  lastFetchTimestamp = now;

  const resolvedCategory: WorkCategory = category === 'everything'
    ? (['music', 'books', 'art'] as WorkCategory[])[Math.floor(Math.random() * 3)]
    : category;

  try {
    const targets = DISCOVERY_TARGETS[resolvedCategory];
    const chosenTarget = targets[Math.floor(Math.random() * targets.length)];

    const catUrl = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(
      chosenTarget
    )}&cmlimit=25&format=json&origin=*`;

    const res = await fetch(catUrl, {
      headers: { 'User-Agent': 'WhatchaWhenGame/2.0 (education@whatchawhen.game)' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const members = (data.query?.categorymembers || []).filter(
      (m: any) => !m.title.startsWith('Category:') && !m.title.startsWith('File:') && !m.title.startsWith('List of')
    );

    if (members.length === 0) return null;

    const randomMember = members[Math.floor(Math.random() * members.length)];

    // Fetch REST summary
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(randomMember.title)}`;
    const sumRes = await fetch(sumUrl, {
      headers: { 'User-Agent': 'WhatchaWhenGame/2.0 (education@whatchawhen.game)' },
    });
    if (!sumRes.ok) return null;

    const summary = await sumRes.json();
    if (!summary.thumbnail?.source || !summary.extract) return null;

    // Check if already in pool
    const existing = getAllKnownItems().some(
      it => it.title.toLowerCase() === summary.title.toLowerCase()
    );
    if (existing) return null;

    // Extract year from summary text or description
    const fullText = `${summary.description || ''} ${summary.extract || ''}`;
    const yearMatches = fullText.match(/\b(1[4-9]\d{2}|20[0-2]\d)\b/g);
    let year = 1990;
    if (yearMatches && yearMatches.length > 0) {
      // Pick the earliest plausible year mentioned (often creation/release year)
      const parsedYears = yearMatches.map(y => parseInt(y, 10)).filter(y => y >= 1400 && y <= 2026);
      if (parsedYears.length > 0) {
        year = parsedYears[0];
      }
    }

    const creator = summary.description 
      ? summary.description.replace(/\b(1[4-9]\d{2}|20[0-2]\d)\b/g, '').replace(/by\s+/i, '').trim()
      : 'Famous Master';

    const resolvedCreator = creator.length > 3 ? creator : 'Acclaimed Creator';

    const newItem: CulturalItem = {
      id: `${resolvedCategory}-dyn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      category: resolvedCategory,
      title: summary.title,
      creator: resolvedCreator,
      year,
      wikiSlug: summary.titles?.canonical || summary.title,
      image: summary.thumbnail.source,
      highResImage: summary.originalimage?.source || summary.thumbnail.source,
      genreOrMovement: sanitizeWikiGenre(summary.description, resolvedCategory, year),
      hint1: sanitizeWikiHint({
        category: resolvedCategory,
        title: summary.title,
        creator: resolvedCreator,
        year,
        rawDescription: summary.description,
        wikiExtract: summary.extract,
      }),
      hint2: `From the ${getBroadEraLabel(year)}.`,
      creatorType: resolvedCategory === 'music' ? 'Artist' : resolvedCategory === 'books' ? 'Author' : 'Painter',
      itemType: resolvedCategory === 'music' ? 'Album' : resolvedCategory === 'books' ? 'Novel' : 'Painting',
      trivia: summary.extract.slice(0, 200) + '...',
      wikiExtract: summary.extract,
      altTitles: [summary.title],
      altCreators: [resolvedCreator],
    };

    runtimeDiscoveredPool.push(newItem);
    savePersistedDiscoveredItems(runtimeDiscoveredPool);
    console.log(`[Infinite Pool] Discovered new live item: "${newItem.title}" (${newItem.year}) for ${resolvedCategory}`);
    return newItem;
  } catch (err) {
    return null;
  }
}

/**
 * Triggers a non-blocking background discovery query to quietly grow the pool
 */
export function triggerBackgroundDiscovery(category: Category) {
  setTimeout(() => {
    fetchLiveWikipediaCulturalItem(category).catch(() => {});
  }, 1000);
}
