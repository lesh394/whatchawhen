import { Category, CulturalItem, WorkCategory } from '../types';
import { MUSIC_DISTRACTORS, BOOKS_DISTRACTORS, ART_DISTRACTORS } from './choices';

export const MIN_SUGGESTION_RAW_CHARS = 5;
export const MIN_SUGGESTION_MEANINGFUL_CHARS = 4;

export interface WikiSummaryResult {
  title: string;
  extract: string;
  thumbnail?: string;
  originalimage?: string;
  description?: string;
  url: string;
}

export interface AutocompleteOption {
  label: string;
  secondary?: string;
  type: 'creator' | 'title' | 'wiki';
}

export function getActiveSuggestionSegment(input: string): {
  prefix: string;
  segment: string;
  hasSeparator: boolean;
} {
  const sepMatch = input.match(/^(.*(?:\s-\s|\s\/\s|\sby\s))(.*)$/i);
  if (sepMatch) {
    return {
      prefix: sepMatch[1],
      segment: sepMatch[2],
      hasSeparator: true,
    };
  }
  return {
    prefix: '',
    segment: input,
    hasSeparator: false,
  };
}

function normalizeSuggestText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingArticle(str: string): string {
  return str.replace(/^(?:the|a|an)\s+/i, '').trim();
}

export function hasEnoughQueryForSuggestions(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SUGGESTION_RAW_CHARS) return false;
  const meaningful = stripLeadingArticle(normalizeSuggestText(trimmed));
  return meaningful.length >= MIN_SUGGESTION_MEANINGFUL_CHARS;
}

/**
 * Fetches Wikipedia article summary and images
 */
export async function fetchWikiSummary(slug: string): Promise<WikiSummaryResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    return {
      title: data.title || '',
      extract: data.extract || '',
      thumbnail: data.thumbnail?.source,
      originalimage: data.originalimage?.source,
      description: data.description,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
    };
  } catch (err) {
    console.warn(`Wikipedia summary fetch failed for ${slug}:`, err);
    return null;
  }
}

/**
 * Searches Wikipedia OpenSearch API for live article titles
 * Enforces the anti-spoiler minimum length threshold and strips year-tagged disambiguations.
 */
export async function searchWikipediaTitles(
  query: string,
  limit = 5,
  externalSignal?: AbortSignal
): Promise<string[]> {
  const clean = query.trim();
  if (!hasEnoughQueryForSuggestions(clean)) return [];

  try {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(clean)}&limit=${limit}&namespace=0&format=json&origin=*`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);

    if (!res.ok) return [];
    const data = await res.json();
    // OpenSearch format: [query, [titles], [descriptions], [urls]]
    const rawTitles: string[] = Array.isArray(data[1]) ? data[1] : [];
    return rawTitles
      .filter(title => !/\(\s*(?:c\.\s*)?(?:1[4-9]\d{2}|20[0-2]\d)\b/i.test(title))
      .map(title =>
        title
          .replace(/\s*\((?:album|novel|painting|single|book|song|EP|work|play)\)\s*$/i, '')
          .trim()
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

function matchCandidateScore(candidate: string, qFull: string, qNoArticle: string): number {
  const fullNorm = normalizeSuggestText(candidate);
  const noArticle = stripLeadingArticle(fullNorm);
  if (!fullNorm || !qNoArticle) return 0;

  if ((qFull.length >= 4 && fullNorm.startsWith(qFull)) || noArticle.startsWith(qNoArticle)) {
    return 3;
  }

  const words = noArticle.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const tailPhrase = words.slice(i).join(' ');
    if (tailPhrase.startsWith(qNoArticle)) {
      return 2;
    }
  }

  return 0;
}

const DISTRACTOR_POOLS_BY_CATEGORY: Record<
  WorkCategory,
  { entries: { title: string; creator: string }[]; itemType: string; creatorType: string }
> = {
  music: { entries: MUSIC_DISTRACTORS, itemType: 'Album', creatorType: 'Artist' },
  books: { entries: BOOKS_DISTRACTORS, itemType: 'Novel', creatorType: 'Author' },
  art: { entries: ART_DISTRACTORS, itemType: 'Painting', creatorType: 'Painter' },
};

/**
 * Generates non-spoiling autocomplete suggestions across the full library (curated + distractors):
 * - Requires at least 5 typed characters (and 4+ meaningful chars beyond leading articles)
 * - Matches only at string start or word boundaries (never arbitrary middle substrings)
 * - Never emits "Title - Creator", release years, or "by Creator" subtitles
 */
export function getLocalSuggestions(category: Category, query: string, items: CulturalItem[]): AutocompleteOption[] {
  if (!hasEnoughQueryForSuggestions(query)) return [];

  const qFull = normalizeSuggestText(query);
  const qNoArticle = stripLeadingArticle(qFull);
  if (!qNoArticle) return [];

  const scoredResults: (AutocompleteOption & { score: number })[] = [];
  const seen = new Set<string>();

  const considerCandidate = (
    label: string,
    secondary: string | undefined,
    type: AutocompleteOption['type']
  ) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    const dedupeKey = trimmedLabel.toLowerCase();
    if (seen.has(dedupeKey)) return;

    const score = matchCandidateScore(trimmedLabel, qFull, qNoArticle);
    if (score > 0) {
      seen.add(dedupeKey);
      scoredResults.push({ label: trimmedLabel, secondary, type, score });
    }
  };

  const categoryItems =
    category === 'everything' ? items : items.filter(it => it.category === category);

  for (const item of categoryItems) {
    considerCandidate(item.title, item.itemType, 'title');
    considerCandidate(item.creator, item.creatorType, 'creator');
    if (item.altCreators) {
      for (const alt of item.altCreators) {
        considerCandidate(alt, item.creatorType, 'creator');
      }
    }
  }

  const activeWorkCategories: WorkCategory[] =
    category === 'everything' ? ['music', 'books', 'art'] : [category];

  for (const workCat of activeWorkCategories) {
    const pool = DISTRACTOR_POOLS_BY_CATEGORY[workCat];
    for (const entry of pool.entries) {
      considerCandidate(entry.title, pool.itemType, 'title');
      considerCandidate(entry.creator, pool.creatorType, 'creator');
    }
  }

  scoredResults.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return scoredResults.slice(0, 6).map(({ label, secondary, type }) => ({
    label,
    secondary,
    type,
  }));
}
