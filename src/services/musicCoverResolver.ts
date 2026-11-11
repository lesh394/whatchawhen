import { CulturalItem } from '../types';
import {
  analyzeBookCover,
  BookCoverAnalysis,
  extractFilenameSlug,
  isRelevantTitleMatch,
  normalizeMatchText,
  normalizeUrlProtocol,
  normalizeWikiSlugForApi,
} from './bookCoverResolver';

interface CachedMusicCoverEntry {
  url: string;
  altApplied: boolean;
  ts: number;
  cacheable?: boolean;
}

const CACHE_STORAGE_KEY = 'whatchawhen_safe_music_covers_v6';
const MAX_CACHE_ENTRIES = 250;

const memoryCache = new Map<string, CachedMusicCoverEntry>();
const inflightRequests = new Map<string, Promise<CachedMusicCoverEntry>>();

let storageHydrated = false;
let mbLastRequestAt = 0;
let mbQueueTail: Promise<void> = Promise.resolve();

function hydrateCacheFromStorage() {
  if (storageHydrated) return;
  storageHydrated = true;
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedMusicCoverEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.url === 'string') {
        memoryCache.set(k, v);
      }
    }
  } catch {
    // Ignore malformed localStorage cache
  }
}

function persistCacheToStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (memoryCache.size > MAX_CACHE_ENTRIES) {
      const entries = Array.from(memoryCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
      const excess = entries.length - MAX_CACHE_ENTRIES;
      for (let i = 0; i < excess; i++) {
        memoryCache.delete(entries[i][0]);
      }
    }
    const obj: Record<string, CachedMusicCoverEntry> = {};
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

function isUrlMusicSpoiler(url: string): boolean {
  return /title[-_ %20]?page|titlepage|sheet[-_ ]?music|logotype|wordmark/i.test(url);
}

/**
 * Ensures polite >= 950ms spacing between MusicBrainz search calls to stay under its 1 req/s anonymous limit.
 */
function scheduleMusicBrainzQuery(fn: () => Promise<any>): Promise<any> {
  const run = mbQueueTail.then(async () => {
    const elapsed = Date.now() - mbLastRequestAt;
    if (elapsed < 950) {
      await new Promise((r) => setTimeout(r, 950 - elapsed));
    }
    mbLastRequestAt = Date.now();
    return fn();
  });
  mbQueueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const BAD_MUSIC_RELEASE_PATTERN =
  /\b(karaoke|tribute to|tribute|instrumental version|made famous by|8-bit|lullaby|piano version|string quartet tribute|cover version|ringtone|megamix|interview|sampler|promo|promotional|snippet)\b/i;

async function fetchWikiMusicCoverCandidates(
  wikiSlug: string,
  originalUrl: string,
  creator: string
): Promise<string[]> {
  if (!wikiSlug) return [];
  try {
    const cleanSlug = normalizeWikiSlugForApi(wikiSlug);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2400);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(cleanSlug)}`,
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const origName = extractFilenameSlug(originalUrl);
    const creatorLast = creator.trim().split(/\s+/).pop()?.toLowerCase() || '';

    const rejectPattern =
      /logotype|wordmark|signature|autograph|portrait|live|concert|stage|tour|festival|performing|interview|press[-_ ]?photo|building|studio|hotel|museum|plaque|grave|tomb|statue|chart|map|flag|ticket|setlist|instrument|guitar|bass|drum|keyboard|synth|turntable|back[-_ ]?cover|rear[-_ ]?cover|track[-_ ]?list|booklet|liner|cd[-_ ]?disc|compact[-_ ]?disc|cd[-_ ]?reissue|jazz[-_ ]?masterpieces|sheet[-_ ]?music|title[-_ ]?page|titlepage|marquee|cinema|poster|flag_of|parody|homage|tribute|mimic|recreat|spoof|cassini|staff|team|fans|japan|japanese|obi|sticker/i;
    const positiveCoverPattern =
      /cover|artwork|sleeve|edition|reissue|deluxe|alternate|alt[-_ ]?cover|vinyl|picture[-_ ]?disc|gatefold|us[-_ ]?cover|uk[-_ ]?cover|international|french|album[-_ ]?art|single[-_ ]?art/i;

    const urls: string[] = [];
    const seen = new Set<string>();

    for (const entry of items) {
      if (entry?.type !== 'image' || !Array.isArray(entry.srcset) || entry.srcset.length === 0) {
        continue;
      }

      const rawTitle = String(entry.title || '');
      const caption = String(entry.caption?.text || '');
      const combined = `${rawTitle} ${caption}`;

      if (/\.(svg|pdf|ogg|ogv|webm|wav|flac)$/i.test(rawTitle)) continue;
      if (rejectPattern.test(combined)) continue;
      if (!positiveCoverPattern.test(combined)) continue;
      if (creatorLast.length > 3 && combined.toLowerCase().includes(`portrait of ${creatorLast}`)) {
        continue;
      }

      let chosenSrc = normalizeUrlProtocol(entry.srcset[0].src || '');
      let bestDist = Infinity;
      for (const s of entry.srcset) {
        const scale = parseFloat(String(s.scale || '1').replace('x', '')) || 1;
        const estWidth = scale * 320;
        const dist = Math.abs(estWidth - 400);
        if (s.src && dist < bestDist) {
          bestDist = dist;
          chosenSrc = normalizeUrlProtocol(s.src);
        }
      }

      if (!chosenSrc || seen.has(chosenSrc)) continue;
      const candFile = extractFilenameSlug(chosenSrc);
      if (
        origName &&
        (candFile === origName || candFile.startsWith(origName + '.') || origName.startsWith(candFile + '.'))
      ) {
        continue;
      }

      seen.add(chosenSrc);
      urls.push(chosenSrc);
    }

    return urls.slice(0, 6);
  } catch {
    return [];
  }
}

function mbArtistMatches(rg: any, creator: string): boolean {
  const cleanCreator = normalizeMatchText(creator || '').trim();
  if (!cleanCreator || /acclaimed musician|various artists|unknown/i.test(cleanCreator)) {
    return true;
  }

  const credits: any[] = Array.isArray(rg?.['artist-credit']) ? rg['artist-credit'] : [];
  if (credits.length === 0) return false;

  const creditText = credits
    .map((c) => `${c?.name || ''} ${c?.artist?.name || ''}`)
    .join(' ');
  const normCredit = normalizeMatchText(creditText);

  const primaryPart = cleanCreator
    .replace(/^the\s+/i, '')
    .split(/\s+(?:and|&|feat\.?|featuring)\s+/i)[0]
    .trim();
  if (primaryPart && normCredit.includes(primaryPart)) return true;

  const lastToken = primaryPart.split(/\s+/).pop() || '';
  return lastToken.length >= 3 && normCredit.includes(lastToken);
}

async function fetchCoverArtArchiveCandidates(item: CulturalItem): Promise<string[]> {
  try {
    const cleanTitle = item.title.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    const cleanLower = normalizeMatchText(cleanTitle);
    const trimmedCreator = (item.creator || '').trim();
    const hasGenericArtist =
      trimmedCreator.length < 2 ||
      /^(?:acclaimed musician|various(?:\s+artists)?|unknown|studio|debut|live|soundtrack|compilation|self-titled|remix|untitled)$/i.test(
        trimmedCreator
      );
    // Avoid MusicBrainz title-only queries when creator is missing/generic to prevent matching unrelated artists
    if (hasGenericArtist) {
      return [];
    }
    const cleanArtist = trimmedCreator.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    const shortArtist = cleanArtist.split(/\s+(?:and|&)\s+/i)[0].trim();

    const runMbSearch = (queryStr: string): Promise<any[]> =>
      scheduleMusicBrainzQuery(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await fetch(
            `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(queryStr)}&fmt=json&limit=8`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data?.['release-groups']) ? data['release-groups'] : [];
        } catch {
          clearTimeout(timeout);
          return [];
        }
      });

    const filterRgs = (rgs: any[]) =>
      rgs.filter((rg) => {
        const rgTitle = String(rg?.title || '');
        const normRg = normalizeMatchText(rgTitle);
        if (BAD_MUSIC_RELEASE_PATTERN.test(normRg) && !BAD_MUSIC_RELEASE_PATTERN.test(cleanLower)) {
          return false;
        }
        if (!isRelevantTitleMatch(rgTitle, cleanTitle, item.altTitles)) {
          return false;
        }
        return mbArtistMatches(rg, cleanArtist);
      });

    let matches: any[] = [];
    if (cleanArtist) {
      matches = filterRgs(
        await runMbSearch(`releasegroup:"${cleanTitle}" AND artist:"${cleanArtist}"`)
      );
      if (matches.length === 0 && shortArtist && shortArtist !== cleanArtist) {
        matches = filterRgs(
          await runMbSearch(`releasegroup:"${cleanTitle}" AND artist:"${shortArtist}"`)
        );
      }
    }
    if (matches.length === 0) {
      matches = filterRgs(await runMbSearch(`releasegroup:"${cleanTitle}"`));
    }
    if (matches.length === 0) return [];

    const wantSingle = item.itemType === 'Single';
    matches.sort((a, b) => {
      const aTypeOk = wantSingle
        ? a?.['primary-type'] === 'Single' || a?.['primary-type'] === 'EP'
          ? 1
          : 0
        : a?.['primary-type'] === 'Album'
        ? 1
        : 0;
      const bTypeOk = wantSingle
        ? b?.['primary-type'] === 'Single' || b?.['primary-type'] === 'EP'
          ? 1
          : 0
        : b?.['primary-type'] === 'Album'
        ? 1
        : 0;
      if (aTypeOk !== bTypeOk) return bTypeOk - aTypeOk;

      const aExact = normalizeMatchText(String(a?.title || '')) === cleanLower ? 1 : 0;
      const bExact = normalizeMatchText(String(b?.title || '')) === cleanLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      return (b?.releases?.length || 0) - (a?.releases?.length || 0);
    });

    const topRg = matches[0];
    const releases: any[] = Array.isArray(topRg?.releases)
      ? topRg.releases.filter((rel: any) => {
          if (!rel?.id) return false;
          if (rel.status === 'Bootleg') return false;
          const relTitleStr = String(rel.title || '');
          const rTitle = normalizeMatchText(relTitleStr);
          if (BAD_MUSIC_RELEASE_PATTERN.test(rTitle) && !BAD_MUSIC_RELEASE_PATTERN.test(cleanLower)) {
            return false;
          }
          if (relTitleStr && !isRelevantTitleMatch(relTitleStr, cleanTitle, item.altTitles)) {
            return false;
          }
          return true;
        })
      : [];

    // Spread-pick up to 8 diverse releases across the release group plus the release-group canonical cover
    const pickedReleases: any[] = [];
    if (releases.length <= 8) {
      pickedReleases.push(...releases);
    } else {
      const step = (releases.length - 1) / 7;
      for (let i = 0; i < 8; i++) {
        pickedReleases.push(releases[Math.round(i * step)]);
      }
    }

    const caaEndpoints = [
      ...pickedReleases.map((r) => `https://coverartarchive.org/release/${r.id}`),
      ...(topRg?.id ? [`https://coverartarchive.org/release-group/${topRg.id}`] : []),
    ];

    const caaResponses = await Promise.all(
      caaEndpoints.map(async (endpoint) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(endpoint, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          clearTimeout(timeout);
          return null;
        }
      })
    );

    const coverUrls: string[] = [];
    const seenIds = new Set<string>();

    for (const caaData of caaResponses) {
      if (!Array.isArray(caaData?.images)) continue;

      for (const im of caaData.images) {
        if (im?.front !== true || im?.back === true) continue;
        const types: string[] = Array.isArray(im?.types) ? im.types : [];
        const hasNonFrontType = types.some((t) =>
          ['Back', 'Tray', 'Matrix/Runout', 'Obi', 'Booklet', 'Medium', 'Spine', 'Track', 'Sticker', 'Poster', 'Liner'].includes(
            t
          )
        );
        if (hasNonFrontType) continue;
        const comment = String(im?.comment || '');
        if (/\b(back|rear|tray|disc|cd|vinyl|label|booklet|insert|liner|obi|sticker|spine|tracklist)\b/i.test(comment)) {
          continue;
        }

        const rawThumb =
          im?.thumbnails?.['500'] ||
          im?.thumbnails?.large ||
          im?.thumbnails?.['250'] ||
          im?.thumbnails?.small ||
          im?.image ||
          '';
        const thumbUrl = normalizeUrlProtocol(String(rawThumb));
        if (!thumbUrl) continue;

        const fileKey = extractFilenameSlug(thumbUrl).replace(/-\d+\.jpg$/, '.jpg');
        if (seenIds.has(fileKey)) continue;
        seenIds.add(fileKey);
        coverUrls.push(thumbUrl);
      }
    }

    return coverUrls.slice(0, 12);
  } catch {
    return [];
  }
}

function maxVisualSimilarity(a?: number[], b?: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA * normB);
  let best = denom > 0 ? dot / denom : 0;

  // Check central region with +/-2 grid-cell shift tolerance on 24x24 luma grids
  const side = Math.round(Math.sqrt(a.length));
  if (side === 24 && side * side === a.length) {
    const cStart = 3;
    const cEnd = 20;
    const count = (cEnd - cStart + 1) * (cEnd - cStart + 1);
    let sumA = 0;
    for (let y = cStart; y <= cEnd; y++) {
      for (let x = cStart; x <= cEnd; x++) {
        sumA += a[y * side + x];
      }
    }
    const meanA = sumA / count;
    let varA = 0;
    for (let y = cStart; y <= cEnd; y++) {
      for (let x = cStart; x <= cEnd; x++) {
        const da = a[y * side + x] - meanA;
        varA += da * da;
      }
    }
    if (varA > 0) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          let sumB = 0;
          for (let y = cStart; y <= cEnd; y++) {
            for (let x = cStart; x <= cEnd; x++) {
              sumB += b[(y + dy) * side + (x + dx)];
            }
          }
          const meanB = sumB / count;
          let dotC = 0;
          let varB = 0;
          for (let y = cStart; y <= cEnd; y++) {
            for (let x = cStart; x <= cEnd; x++) {
              const da = a[y * side + x] - meanA;
              const db = b[(y + dy) * side + (x + dx)] - meanB;
              dotC += da * db;
              varB += db * db;
            }
          }
          const denomC = Math.sqrt(varA * varB);
          if (denomC > 0) {
            const sim = dotC / denomC;
            if (sim > best) best = sim;
          }
        }
      }
    }
  }

  return best;
}

async function resolveMusicCoverInternal(item: CulturalItem): Promise<CachedMusicCoverEntry> {
  const origUrl = item.image;
  if (!origUrl) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: false };
  }

  // 1. Inspect the primary cover first with music typography heuristics
  const origAnalysis = await analyzeBookCover(origUrl, { timeoutMs: 2400, coverType: 'music' });
  const origFlaggedByUrl = isUrlMusicSpoiler(origUrl);

  if (origAnalysis && !origAnalysis.hasBigTitle && !origFlaggedByUrl) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: true };
  }

  const origScore = origAnalysis ? origAnalysis.spoilerScore : origFlaggedByUrl ? 120 : 60;
  const origAspect = origAnalysis ? origAnalysis.height / (origAnalysis.width || 1) : 1;

  // 2. Fetch alternate cover versions from Wikipedia media-list and Cover Art Archive
  const [wikiCands, caaCands] = await Promise.all([
    fetchWikiMusicCoverCandidates(item.wikiSlug, origUrl, item.creator),
    fetchCoverArtArchiveCandidates(item),
  ]);

  const candidates: string[] = [];
  const seenUrls = new Set<string>([origUrl]);
  const maxLen = Math.max(wikiCands.length, caaCands.length);
  for (let i = 0; i < maxLen; i++) {
    if (wikiCands[i] && !seenUrls.has(wikiCands[i])) {
      seenUrls.add(wikiCands[i]);
      candidates.push(wikiCands[i]);
    }
    if (caaCands[i] && !seenUrls.has(caaCands[i])) {
      seenUrls.add(caaCands[i]);
      candidates.push(caaCands[i]);
    }
  }

  if (candidates.length === 0) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: origAnalysis !== null };
  }

  // 3. Evaluate candidate covers in parallel batches within a 5.5s total budget
  const deadline = Date.now() + 5500;
  let bestCandidate: { url: string; analysis: BookCoverAnalysis } | null = null;

  for (let i = 0; i < candidates.length; i += 4) {
    if (Date.now() >= deadline) break;
    const batch = candidates.slice(i, i + 4);
    const remainingMs = Math.max(1000, deadline - Date.now());

    const analyses = await Promise.all(
      batch.map(async (url) => ({
        url,
        analysis: await analyzeBookCover(url, {
          timeoutMs: Math.min(3200, remainingMs),
          coverType: 'music',
          strictCandidateMode: true,
        }),
      }))
    );

    for (const res of analyses) {
      const a = res.analysis;
      if (!a) continue;
      if (
        a.hasBigTitle ||
        a.isTitlePage ||
        a.maxLineHeightRatio > 0.062 ||
        (a.blankRowsRatio >= 0.52 && a.richColors <= 6) ||
        isUrlMusicSpoiler(res.url)
      ) {
        continue;
      }
      if (a.hasSideBanner) continue;

      const candAspect = a.height / (a.width || 1);
      if (origAspect >= 0.8 && origAspect <= 1.25 && (candAspect < 0.78 || candAspect > 1.28)) {
        continue;
      }

      // Reject identical artwork variants / re-crops / shifted-banner pressings unless clearing an explicit title-page/logotype
      const sim = maxVisualSimilarity(origAnalysis?.lumaThumb, a.lumaThumb);
      const allowsSparseClear =
        Boolean(origAnalysis?.isTitlePage) && !a.hasBigTitle && !a.isTitlePage && a.maxLineHeightRatio <= 0.045 && sim < 0.78;
      if (!origFlaggedByUrl && sim >= 0.62 && !allowsSparseClear) {
        continue;
      }

      if (!bestCandidate || a.spoilerScore < bestCandidate.analysis.spoilerScore) {
        bestCandidate = { url: res.url, analysis: a };
      }
    }

    if (bestCandidate && bestCandidate.analysis.spoilerScore <= 8) {
      break;
    }
  }

  const candidateClean =
    bestCandidate &&
    !bestCandidate.analysis.isTitlePage &&
    !bestCandidate.analysis.hasBigTitle &&
    bestCandidate.analysis.spoilerScore < origScore - 18;

  if (bestCandidate && candidateClean) {
    return {
      url: bestCandidate.url,
      altApplied: true,
      ts: Date.now(),
      cacheable: true,
    };
  }

  return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: origAnalysis !== null };
}

/**
 * Checks if a music release's primary cover displays prominent spoiler lettering or title graphics,
 * and if so discovers and substitutes an alternate cover version from Wikipedia or Cover Art Archive
 * that avoids giving away the title.
 */
export async function resolveSafeMusicCoverItem(item: CulturalItem): Promise<CulturalItem> {
  if (item.category !== 'music' || !item.image || typeof document === 'undefined') {
    return item;
  }

  hydrateCacheFromStorage();
  const cacheKey = item.wikiSlug || item.id;

  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return cached.altApplied
      ? { ...item, image: cached.url, highResImage: cached.url, altCoverApplied: true }
      : item;
  }

  let promise = inflightRequests.get(cacheKey);
  if (!promise) {
    promise = resolveMusicCoverInternal(item)
      .then((res) => {
        if (res.cacheable !== false) {
          const entry: CachedMusicCoverEntry = { url: res.url, altApplied: res.altApplied, ts: res.ts };
          memoryCache.set(cacheKey, entry);
          persistCacheToStorage();
        }
        return res;
      })
      .finally(() => {
        inflightRequests.delete(cacheKey);
      });
    inflightRequests.set(cacheKey, promise);
  }

  const resolved = await promise;
  if (resolved.altApplied && resolved.url !== item.image) {
    return {
      ...item,
      image: resolved.url,
      highResImage: resolved.url,
      altCoverApplied: true,
    };
  }
  return item;
}
