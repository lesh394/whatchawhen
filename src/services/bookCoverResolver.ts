import { CulturalItem } from '../types';

export interface BookCoverAnalysis {
  isTitlePage: boolean;
  hasBigTitle: boolean;
  maxLineHeightRatio: number;
  totalBigTextRatio: number;
  blankRowsRatio: number;
  intBlankRatio: number;
  richColors: number;
  spoilerScore: number;
  width: number;
  height: number;
  hasSideBanner?: boolean;
  lumaThumb?: number[];
}

interface CandidateCover {
  url: string;
  isWikiIllustration: boolean;
}

interface CachedCoverEntry {
  url: string;
  altApplied: boolean;
  ts: number;
  cacheable?: boolean;
}

const CACHE_STORAGE_KEY = 'whatchawhen_safe_book_covers_v6';
const MAX_CACHE_ENTRIES = 250;
const ANALYSIS_WIDTH = 120;

const memoryCache = new Map<string, CachedCoverEntry>();
const inflightRequests = new Map<string, Promise<CachedCoverEntry>>();

let storageHydrated = false;

function hydrateCacheFromStorage() {
  if (storageHydrated) return;
  storageHydrated = true;
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedCoverEntry>;
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
    const obj: Record<string, CachedCoverEntry> = {};
    for (const [k, v] of memoryCache.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

function isUrlTitlePage(url: string): boolean {
  return /title[-_ %20]?page|titlepage|half[-_ ]?title|frontispiece_?title|manuscript|draft/i.test(url);
}

interface GlyphBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bw: number;
  bh: number;
  hRatio: number;
  wRatio: number;
}

function runConnectedGlyphPass(
  rArr: Uint8Array,
  gArr: Uint8Array,
  bArr: Uint8Array,
  w: number,
  h: number,
  useOuterMargins: boolean,
  minMembers = 3,
  detectWideWordBlobs = false,
  xRange?: [number, number],
  antiSeamQuant = false
): { maxLineHeightRatio: number; totalBigTextRatio: number; denseDoubleTitle: boolean; wideWordHeightRatio: number } {
  const fg = new Uint8Array(w * h);

  // Sample local 3-row horizontal bands to isolate foreground strokes against uniform band color
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);

    const xStart = xRange ? xRange[0] : useOuterMargins ? 3 : 0;
    const xEnd = xRange ? xRange[1] : useOuterMargins ? w - 3 : w;

    const findBestBg = (offset: number) => {
      const binCounts = new Map<number, number>();
      const sumR = new Map<number, number>();
      const sumG = new Map<number, number>();
      const sumB = new Map<number, number>();
      let sampleCount = 0;

      for (let yy = y0; yy <= y1; yy++) {
        for (let x = xStart; x < xEnd; x++) {
          if (!xRange && useOuterMargins && x >= 15 && x <= w - 16) continue;
          const i = yy * w + x;
          const rk = Math.min(5, ((rArr[i] + offset) / 48) | 0);
          const gk = Math.min(5, ((gArr[i] + offset) / 48) | 0);
          const bk = Math.min(5, ((bArr[i] + offset) / 48) | 0);
          const k = rk * 10000 + gk * 100 + bk;
          binCounts.set(k, (binCounts.get(k) || 0) + 1);
          sumR.set(k, (sumR.get(k) || 0) + rArr[i]);
          sumG.set(k, (sumG.get(k) || 0) + gArr[i]);
          sumB.set(k, (sumB.get(k) || 0) + bArr[i]);
          sampleCount++;
        }
      }

      let bestKey = -1;
      let bestCount = 0;
      for (const [k, count] of binCounts.entries()) {
        if (count > bestCount) {
          bestCount = count;
          bestKey = k;
        }
      }
      if (bestKey === -1 || sampleCount === 0) {
        return { share: 0, bgR: 0, bgG: 0, bgB: 0 };
      }
      return {
        share: bestCount / sampleCount,
        bgR: (sumR.get(bestKey) || 0) / bestCount,
        bgG: (sumG.get(bestKey) || 0) / bestCount,
        bgB: (sumB.get(bestKey) || 0) / bestCount,
      };
    };

    let bg = findBestBg(0);
    if (antiSeamQuant) {
      const shifted = findBestBg(24);
      if (shifted.share > bg.share) {
        bg = shifted;
      }
    }

    if (bg.share < 0.36) continue;

    const fillStart = xRange ? xRange[0] : useOuterMargins ? 3 : 0;
    const fillEnd = xRange ? xRange[1] : useOuterMargins ? w - 3 : w;

    for (let x = fillStart; x < fillEnd; x++) {
      const i = y * w + x;
      const dist =
        Math.abs(rArr[i] - bg.bgR) +
        Math.abs(gArr[i] - bg.bgG) +
        Math.abs(bArr[i] - bg.bgB);
      if (dist >= 90) {
        fg[i] = 1;
      }
    }
  }

  // Iterative 8-connected BFS on foreground mask
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const glyphs: GlyphBox[] = [];
  let wideWordHeightRatio = 0;

  const scanStart = xRange ? xRange[0] : useOuterMargins ? 3 : 0;
  const scanEnd = xRange ? xRange[1] : useOuterMargins ? w - 3 : w;

  for (let sy = 0; sy < h; sy++) {
    for (let sx = scanStart; sx < scanEnd; sx++) {
      const si = sy * w + sx;
      if (fg[si] === 1 && visited[si] === 0) {
        let head = 0;
        let tail = 0;
        queue[tail++] = si;
        visited[si] = 1;

        let minX = sx;
        let maxX = sx;
        let minY = sy;
        let maxY = sy;
        let area = 0;

        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % w;
          const cy = (cur - cx) / w;
          area++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = cx + dx;
              if (nx < scanStart || nx >= scanEnd) continue;
              const ni = ny * w + nx;
              if (fg[ni] === 1 && visited[ni] === 0) {
                visited[ni] = 1;
                queue[tail++] = ni;
              }
            }
          }
        }

        const bw = maxX - minX + 1;
        const bh = maxY - minY + 1;
        const hRatio = bh / h;
        const wRatio = bw / w;
        const fill = area / (bw * bh);

        if (
          hRatio >= 0.045 &&
          hRatio <= 0.36 &&
          bw >= 2 &&
          wRatio <= 0.42 &&
          fill >= 0.14 &&
          fill <= 0.94 &&
          (bw / bh >= 0.17 || bh < 12)
        ) {
          glyphs.push({ minX, maxX, minY, maxY, bw, bh, hRatio, wRatio });
        } else if (
          detectWideWordBlobs &&
          hRatio >= 0.068 &&
          hRatio <= 0.44 &&
          wRatio >= 0.28 &&
          wRatio <= 1.0 &&
          fill >= 0.16 &&
          fill <= 0.72
        ) {
          // Check horizontal stroke count inside connected cursive/bubble display words or massive logos
          const yStart = minY + Math.floor(bh * 0.2);
          const yEnd = maxY - Math.floor(bh * 0.2);
          const minRuns = hRatio > 0.28 || wRatio > 0.94 ? 6 : 5;
          const minMultiRatio = hRatio > 0.28 ? 0.5 : 0.4;
          let multiStrokeRows = 0;
          let sampledRows = 0;
          for (let ry = yStart; ry <= yEnd; ry++) {
            let runs = 0;
            let inFg = false;
            for (let rx = minX; rx <= maxX; rx++) {
              const on = fg[ry * w + rx] === 1;
              if (on && !inFg) runs++;
              inFg = on;
            }
            sampledRows++;
            if (runs >= minRuns) multiStrokeRows++;
          }
          if (sampledRows > 0 && multiStrokeRows / sampledRows >= minMultiRatio && hRatio > wideWordHeightRatio) {
            wideWordHeightRatio = hRatio;
          }
        }
      }
    }
  }

  // Group horizontally aligned, non-X-overlapping glyphs of matching height into title lines
  let maxLineHeightRatio = 0;
  const lineBands = new Map<number, number>();
  const denseBands = new Set<number>();

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const cy = (g.minY + g.maxY) * 0.5;

    const rawMembers: GlyphBox[] = [];
    for (let j = 0; j < glyphs.length; j++) {
      const o = glyphs[j];
      const ocy = (o.minY + o.maxY) * 0.5;
      const maxBh = Math.max(g.bh, o.bh);
      const minBh = Math.min(g.bh, o.bh);
      if (Math.abs(ocy - cy) <= maxBh * 0.42 && minBh / maxBh >= 0.5) {
        rawMembers.push(o);
      }
    }

    rawMembers.sort((a, b) => a.minX - b.minX);
    const members: GlyphBox[] = [];
    for (const m of rawMembers) {
      const overlaps = members.some((k) => {
        const ov = Math.min(k.maxX, m.maxX) - Math.max(k.minX, m.minX) + 1;
        return ov > 0 && ov >= 0.45 * Math.min(k.bw, m.bw);
      });
      if (!overlaps) {
        members.push(m);
      }
    }

    const wideCount = members.filter((m) => m.wRatio > 0.24).length;

    if (members.length >= minMembers && (wideCount <= 1 || (detectWideWordBlobs && wideCount <= 2))) {
      let minLineX = w;
      let maxLineX = 0;
      let sumWR = 0;
      let sumHR = 0;
      for (const m of members) {
        if (m.minX < minLineX) minLineX = m.minX;
        if (m.maxX > maxLineX) maxLineX = m.maxX;
        sumWR += m.wRatio;
        sumHR += m.hRatio;
      }

      const avgW = sumWR / members.length;
      const avgH = sumHR / members.length;
      const spanW = (maxLineX - minLineX + 1) / w;

      if (avgW <= 0.24 && spanW >= (xRange ? 0.16 : 0.2)) {
        if (avgH > maxLineHeightRatio) {
          maxLineHeightRatio = avgH;
        }
        const bandKey = Math.floor(cy / 10);
        const existing = lineBands.get(bandKey) || 0;
        if (avgH > existing) {
          lineBands.set(bandKey, avgH);
        }
        if (members.length >= 5 && avgH >= 0.083 && spanW >= 0.8) {
          denseBands.add(bandKey);
        }
      }
    }
  }

  let totalBigTextRatio = 0;
  for (const val of lineBands.values()) {
    totalBigTextRatio += val;
  }

  return { maxLineHeightRatio, totalBigTextRatio, denseDoubleTitle: denseBands.size >= 2, wideWordHeightRatio };
}

/**
 * Inspects an image on an offscreen HTML5 canvas to detect big-letter cover typography or plain title pages.
 */
export async function analyzeBookCover(
  imageUrl: string,
  options: { isWikiIllustration?: boolean; timeoutMs?: number; coverType?: 'book' | 'music'; strictCandidateMode?: boolean } = {}
): Promise<BookCoverAnalysis | null> {
  if (typeof document === 'undefined' || !imageUrl) {
    return null;
  }

  const {
    isWikiIllustration = false,
    timeoutMs = 2400,
    coverType = 'book',
    strictCandidateMode = false,
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: BookCoverAnalysis | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (settled) return;
      const natW = img.naturalWidth || 0;
      const natH = img.naturalHeight || 0;

      // Reject broken/placeholder tiny images and awkward non-book panoramic banners
      if (natW < 70 || natH < 90) {
        finish(null);
        return;
      }
      const aspect = natH / natW;
      if (aspect < 0.62 || aspect > 2.35) {
        finish(null);
        return;
      }

      const w = ANALYSIS_WIDTH;
      const h = Math.max(40, Math.round((w * natH) / natW));

      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          finish(null);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;

        const rArr = new Uint8Array(w * h);
        const gArr = new Uint8Array(w * h);
        const bArr = new Uint8Array(w * h);
        const globalBins = new Map<number, number>();
        let blankRows = 0;
        let intBlankRows = 0;
        const intX0 = Math.floor(w * 0.18);
        const intX1 = Math.ceil(w * 0.82);

        for (let y = 0; y < h; y++) {
          let rowEdges = 0;
          let intRowEdges = 0;
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const p = i * 4;
            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];

            rArr[i] = r;
            gArr[i] = g;
            bArr[i] = b;

            const gk = ((r / 44) | 0) * 10000 + ((g / 44) | 0) * 100 + ((b / 44) | 0);
            globalBins.set(gk, (globalBins.get(gk) || 0) + 1);

            if (x > 0) {
              const prev = i - 1;
              const grad =
                Math.abs(r - rArr[prev]) +
                Math.abs(g - gArr[prev]) +
                Math.abs(b - bArr[prev]);
              if (grad > 70) {
                rowEdges++;
                if (x >= intX0 && x <= intX1) {
                  intRowEdges++;
                }
              }
            }
          }
          if (rowEdges <= 3) {
            blankRows++;
          }
          if (intRowEdges <= 2) {
            intBlankRows++;
          }
        }

        const blankRowsRatio = blankRows / h;
        const intBlankRatio = intBlankRows / h;
        const minColorThreshold = w * h * 0.01;
        let richColors = 0;
        for (const count of globalBins.values()) {
          if (count > minColorThreshold) {
            richColors++;
          }
        }

        const isMusic = coverType === 'music';
        const allowOuterMusicPass = isMusic ? blankRowsRatio >= 0.45 && richColors <= 6 : true;
        const detectWideWords = isMusic && strictCandidateMode;
        const pass1 = runConnectedGlyphPass(
          rArr,
          gArr,
          bArr,
          w,
          h,
          false,
          isMusic ? 4 : 3,
          detectWideWords,
          undefined,
          detectWideWords
        );
        const pass2 = allowOuterMusicPass
          ? runConnectedGlyphPass(
              rArr,
              gArr,
              bArr,
              w,
              h,
              true,
              isMusic ? 4 : 3,
              detectWideWords,
              undefined,
              detectWideWords
            )
          : { maxLineHeightRatio: 0, totalBigTextRatio: 0, denseDoubleTitle: false, wideWordHeightRatio: 0 };
        const passCenter =
          isMusic && strictCandidateMode
            ? runConnectedGlyphPass(
                rArr,
                gArr,
                bArr,
                w,
                h,
                false,
                4,
                true,
                [Math.floor(w * 0.14), Math.ceil(w * 0.86)],
                true
              )
            : { maxLineHeightRatio: 0, totalBigTextRatio: 0, denseDoubleTitle: false, wideWordHeightRatio: 0 };
        const passLeft =
          isMusic && strictCandidateMode
            ? runConnectedGlyphPass(
                rArr,
                gArr,
                bArr,
                w,
                h,
                false,
                4,
                true,
                [Math.floor(w * 0.06), Math.ceil(w * 0.62)],
                true
              )
            : { maxLineHeightRatio: 0, totalBigTextRatio: 0, denseDoubleTitle: false, wideWordHeightRatio: 0 };

        const maxLineHeightRatio = Math.max(
          pass1.maxLineHeightRatio,
          pass2.maxLineHeightRatio,
          passCenter.maxLineHeightRatio,
          passLeft.maxLineHeightRatio,
          detectWideWords
            ? Math.max(
                pass1.wideWordHeightRatio,
                pass2.wideWordHeightRatio,
                passCenter.wideWordHeightRatio,
                passLeft.wideWordHeightRatio
              )
            : 0
        );
        const totalBigTextRatio = Math.max(
          pass1.totalBigTextRatio,
          pass2.totalBigTextRatio,
          passCenter.totalBigTextRatio,
          passLeft.totalBigTextRatio
        );

        let hasSideBanner = false;
        let lumaThumb: number[] | undefined;
        if (isMusic) {
          // Detect solid vertical edition / jewel-case spines on left edge (cols 4..15)
          for (let col = 4; col <= 15 && !hasSideBanner; col++) {
            let jumpRows = 0;
            let rowCount = 0;
            for (let y = 4; y < h - 4; y++) {
              rowCount++;
              const cIdx = y * w + col;
              const pIdx = cIdx - 2;
              const diff =
                Math.abs(rArr[cIdx] - rArr[pIdx]) +
                Math.abs(gArr[cIdx] - gArr[pIdx]) +
                Math.abs(bArr[cIdx] - bArr[pIdx]);
              if (diff >= 55) jumpRows++;
            }
            if (rowCount > 0 && jumpRows / rowCount >= 0.72) {
              hasSideBanner = true;
            }
          }

          // Compute normalized 24x24 luma grid for shift-tolerant duplicate-artwork suppression
          const vec: number[] = [];
          let sum = 0;
          for (let gy = 0; gy < 24; gy++) {
            const py = Math.min(h - 1, Math.floor(((gy + 0.5) / 24) * h));
            for (let gx = 0; gx < 24; gx++) {
              const px = Math.min(w - 1, Math.floor(((gx + 0.5) / 24) * w));
              const idx = py * w + px;
              const lum = 0.299 * rArr[idx] + 0.587 * gArr[idx] + 0.114 * bArr[idx];
              vec.push(lum);
              sum += lum;
            }
          }
          const mean = sum / vec.length;
          lumaThumb = vec.map((v) => v - mean);
        }

        const isTitlePage = isMusic
          ? /title[-_ %20]?page|titlepage|sheet[-_ ]?music|logotype|wordmark/i.test(imageUrl) ||
            (maxLineHeightRatio >= 0.07 && blankRowsRatio >= 0.62 && richColors <= 6)
          : isUrlTitlePage(imageUrl) ||
            (blankRowsRatio >= 0.5 && richColors <= 7) ||
            (blankRowsRatio >= 0.62 && richColors <= 10) ||
            (intBlankRatio >= 0.74 && richColors <= 11);
        const hasBigTitle = isMusic
          ? isTitlePage ||
            maxLineHeightRatio >= 0.095 ||
            pass1.denseDoubleTitle ||
            pass2.denseDoubleTitle ||
            passCenter.denseDoubleTitle ||
            passLeft.denseDoubleTitle ||
            (totalBigTextRatio >= 0.16 && maxLineHeightRatio >= 0.075)
          : isTitlePage ||
            maxLineHeightRatio >= 0.092 ||
            pass1.denseDoubleTitle ||
            pass2.denseDoubleTitle ||
            (totalBigTextRatio >= 0.18 && blankRowsRatio >= 0.35);

        const spoilerScore =
          (isTitlePage ? 95 : 0) +
          maxLineHeightRatio * 260 +
          totalBigTextRatio * 95 +
          (blankRowsRatio >= 0.55 && !isMusic
            ? 35
            : blankRowsRatio * (isMusic ? 12 : 20)) -
          Math.min(isMusic ? 8 : 18, richColors * 0.9) -
          (isWikiIllustration && blankRowsRatio < 0.35 ? 18 : 0);

        finish({
          isTitlePage,
          hasBigTitle,
          maxLineHeightRatio,
          totalBigTextRatio,
          blankRowsRatio,
          intBlankRatio,
          richColors,
          spoilerScore,
          width: natW,
          height: natH,
          hasSideBanner,
          lumaThumb,
        });
      } catch {
        // Canvas tainted (missing CORS) -> treat url check as fallback
        const urlFlag = isUrlTitlePage(imageUrl);
        finish(
          urlFlag
            ? {
                isTitlePage: true,
                hasBigTitle: true,
                maxLineHeightRatio: 0.2,
                totalBigTextRatio: 0.3,
                blankRowsRatio: 0.7,
                intBlankRatio: 0.75,
                richColors: 3,
                spoilerScore: 130,
                width: natW,
                height: natH,
              }
            : null
        );
      }
    };

    img.onerror = () => finish(null);
    img.src = imageUrl;
  });
}

export function normalizeUrlProtocol(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://coverartarchive.org/')) return url.replace('http://', 'https://');
  return url;
}

export function extractFilenameSlug(url: string): string {
  try {
    const clean = url.split('?')[0];
    const parts = clean.split('/');
    return decodeURIComponent(parts[parts.length - 1] || '')
      .toLowerCase()
      .replace(/^(?:lossy-)?(?:page\d+-)?\d+px-/, '');
  } catch {
    return url.toLowerCase();
  }
}

export function normalizeWikiSlugForApi(wikiSlug: string): string {
  try {
    return decodeURIComponent(wikiSlug).replace(/\s+/g, '_');
  } catch {
    return wikiSlug.replace(/\s+/g, '_');
  }
}

async function fetchWikiMediaCandidates(
  wikiSlug: string,
  originalUrl: string,
  creator: string,
  title: string
): Promise<CandidateCover[]> {
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
    const titleLower = title.toLowerCase();

    const rejectPattern =
      /manuscript|draft|handwritten|signature|autograph|grave|tomb|statue|monument|plaque|bust|family_tree|character_map|title[-_ ]?page|titlepage|half[-_ ]?title|portal|icon|logo|flag|diagram|timeline|map_of|hotel|farmhouse|house_in|pub_in|graffiti|stage_play|marquee|cinema|medal|award|adaptation|film[-_ ]?poster|movie[-_ ]?poster|film[-_ ]?still|movie[-_ ]?still|christopher_lee|trotsky|stalin|lenin|hitler|churchill|mussolini/i;
    const positivePattern =
      /illustration|illustrated|frontispiece|engraving|etching|woodcut|plate|cover|edition|jacket|painting|scene|watercolor|lithograph|sketch|drawing|artwork/i;
    const portraitPhotoPattern = /\b(photo|photograph|portrait)\b/i;

    const results: { cand: CandidateCover; priority: number }[] = [];
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
      if (!titleLower.includes('revisited') && /revisited/i.test(combined)) continue;
      if (!titleLower.includes('sequel') && /sequel/i.test(combined)) continue;
      if (!titleLower.includes('prequel') && /prequel/i.test(combined)) continue;
      if (!titleLower.includes('poster') && /poster/i.test(combined)) continue;

      // Reject author portraits/photographs and unrelated non-cover article photos
      const isIllustrationText = positivePattern.test(combined);
      if (
        !isIllustrationText ||
        portraitPhotoPattern.test(combined) ||
        (creatorLast.length > 3 && combined.toLowerCase().includes(`portrait of ${creatorLast}`))
      ) {
        continue;
      }

      // Pick srcset closest to 330px–500px
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
      results.push({
        cand: {
          url: chosenSrc,
          isWikiIllustration: isIllustrationText,
        },
        priority: isIllustrationText ? 1 : 0,
      });
    }

    return results
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6)
      .map((r) => r.cand);
  } catch {
    return [];
  }
}

const BAD_EDITION_PATTERN =
  /sparknotes|cliffsnotes|coles|barron'?s|gradesaver|bookrags|york notes|shmoop|monkeynotes|bloom'?s|playscript|the play of|dramatized|retold|adapted by|classic starts|oxford bookworms|penguin readers|easystarts|macmillan readers|study guide|summary & analysis|reading guide|reader'?s guide|teachers?'? guide|literature circle|workbook|companion|omnibus|large print|box set|boxed set|collection set|\b2 books\b|audiobook|audio cd|audible|listening library|full-cast|stenciled edges/i;

const AUDIO_FORMAT_PATTERN = /audio|cd|mp3|cassette|vinyl|\blp\b|record|talking book/i;

const FOREIGN_EDITION_HINT =
  /\b(y la|el |la |los |las |un |une|des|les|le |der|die|das|und|mit|kamie[nń]|filozoficzny|pedra|piedra|pietra|stein|felsefe)\b/i;

export function normalizeMatchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();
}

export function isRelevantTitleMatch(candidateTitle: string, targetTitle: string, altTitles?: string[]): boolean {
  const normTokens = (s: string) =>
    normalizeMatchText(s)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'novel', 'book', 'edition', 'volume', 'part']);
  const significantWords = (tokens: string[]) => {
    const sig = tokens.filter((w) => w.length > 2 && !stopWords.has(w));
    return sig.length > 0 ? sig : tokens;
  };

  const candTokens = normTokens(candidateTitle);
  const candWords = significantWords(candTokens);
  if (candWords.length === 0) return false;

  const titlesToCheck = [targetTitle, ...(altTitles || [])];
  for (const t of titlesToCheck) {
    const tokens = normTokens(t);
    const words = significantWords(tokens);
    if (words.length === 0) continue;
    const matches = words.filter((w) => candWords.includes(w));
    if (matches.length >= Math.min(2, words.length) || matches.length / words.length >= 0.5) {
      return true;
    }
  }
  return false;
}

async function fetchOpenLibraryCoverCandidates(
  title: string,
  creator: string,
  altTitles?: string[]
): Promise<CandidateCover[]> {
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    const cleanLower = normalizeMatchText(cleanTitle);
    const hasForeignHintInTitle = FOREIGN_EDITION_HINT.test(cleanTitle);
    const authorLast =
      creator && !/acclaimed author|unknown|various/i.test(creator)
        ? normalizeMatchText(creator).trim().split(/\s+/).pop() || ''
        : '';

    const runSearch = async (url: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.docs) ? data.docs : [];
      } catch {
        clearTimeout(timeout);
        return [];
      }
    };

    const filterDocs = (docs: any[], allowCanonicalOriginalWork = false) =>
      docs.filter((d: any) => {
        const dTitle = String(d?.title || '');
        const titleLowerNorm = normalizeMatchText(dTitle);
        // Note: work-level search.json `publisher` aggregates every edition's publisher (300+ on classics),
        // so edition-level publisher filtering belongs strictly in the editions.json loop below.
        if (BAD_EDITION_PATTERN.test(titleLowerNorm)) return false;
        if (!cleanLower.includes('revisited') && /revisited/i.test(titleLowerNorm)) return false;
        if (!cleanLower.includes('sequel') && /sequel/i.test(titleLowerNorm)) return false;
        if (!cleanLower.includes('prequel') && /prequel/i.test(titleLowerNorm)) return false;
        if (!cleanTitle.includes('/') && dTitle.includes('/')) return false;

        let authorMatches = false;
        if (authorLast) {
          if (!Array.isArray(d?.author_name) || d.author_name.length === 0) return false;
          authorMatches = d.author_name.some((a: string) =>
            normalizeMatchText(a).includes(authorLast)
          );
          if (!authorMatches) return false;
        }

        const titleMatches = isRelevantTitleMatch(dTitle, cleanTitle, altTitles);
        // If canonical top work by exact author (high edition_count) has translated/original title, allow it
        if (!titleMatches && !(allowCanonicalOriginalWork && authorMatches && (d.edition_count || 0) >= 20)) {
          return false;
        }
        return true;
      });

    const primaryUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}${
      authorLast ? `&author=${encodeURIComponent(authorLast)}` : ''
    }&fields=key,title,author_name,cover_i,edition_count,language&limit=8`;

    const primaryDocs = await runSearch(primaryUrl);
    let filteredDocs = filterDocs(primaryDocs, false);
    if (filteredDocs.length === 0 && primaryDocs.length > 0) {
      filteredDocs = filterDocs(primaryDocs, true);
    }

    if (filteredDocs.length === 0) {
      const qTerm = `${cleanTitle}${authorLast ? ` ${authorLast}` : ''}`;
      const fallbackDocs = await runSearch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(qTerm)}&fields=key,title,author_name,cover_i,edition_count,language&limit=8`
      );
      filteredDocs = filterDocs(fallbackDocs, true);
    }

    // Prioritize exact title match and highest edition count so we query the true canonical work
    filteredDocs.sort((a: any, b: any) => {
      const aExact = normalizeMatchText(String(a?.title || '')) === cleanLower ? 1 : 0;
      const bExact = normalizeMatchText(String(b?.title || '')) === cleanLower ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return (b?.edition_count || 0) - (a?.edition_count || 0);
    });

    const englishFirstIds: number[] = [];
    const fallbackIds: number[] = [];
    const primaryWorkKey = filteredDocs.find((d: any) => typeof d?.key === 'string')?.key || '';

    for (const d of filteredDocs) {
      if (typeof d.cover_i === 'number' && d.cover_i > 0) {
        const langs = Array.isArray(d.language) ? d.language : [];
        if (langs.length === 0 || langs.includes('eng')) {
          englishFirstIds.push(d.cover_i);
        } else {
          fallbackIds.push(d.cover_i);
        }
      }
    }

    // Fetch the top canonical work's editions for clean cover variety without omnibus/latency bloat
    const editionEntries: any[] = [];
    if (primaryWorkKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      try {
        const res = await fetch(`https://openlibrary.org${primaryWorkKey}/editions.json?limit=42`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const edData = await res.json();
          if (Array.isArray(edData?.entries)) {
            editionEntries.push(...edData.entries);
          }
        }
      } catch {
        clearTimeout(timeout);
      }
    }

    const edEngIds: number[] = [];
    const edUntaggedIds: number[] = [];
    const edOtherIds: number[] = [];

    for (const e of editionEntries) {
      if (!Array.isArray(e?.covers) || e.covers.length === 0) continue;

      const physicalFormat = String(e.physical_format || '');
      if (physicalFormat && AUDIO_FORMAT_PATTERN.test(physicalFormat)) continue;

      const eTitleStr = String(e.title || '');
      const metaText = [
        eTitleStr,
        e.subtitle || '',
        physicalFormat,
        ...(Array.isArray(e.publishers) ? e.publishers : []),
        ...(Array.isArray(e.series) ? e.series : []),
      ].join(' ');
      if (BAD_EDITION_PATTERN.test(metaText)) continue;
      if (!cleanTitle.includes('/') && eTitleStr.includes('/')) continue;

      // Only use each edition's primary front cover (secondary slots often hold back covers/flaps or patron uploads)
      const primaryCover = e.covers.find((c: unknown): c is number => typeof c === 'number' && c > 0);
      if (!primaryCover) continue;

      const langs: string[] = Array.isArray(e.languages)
        ? e.languages.map((l: any) => String(l?.key || ''))
        : [];
      const isExplicitEng = langs.includes('/languages/eng');
      const hasOtherLang = langs.length > 0 && !isExplicitEng;

      const matchesCleanTitle = !eTitleStr || isRelevantTitleMatch(eTitleStr, cleanTitle, altTitles);
      const looksForeign =
        !isExplicitEng && !hasForeignHintInTitle && eTitleStr && FOREIGN_EDITION_HINT.test(eTitleStr);

      if (isExplicitEng) {
        edEngIds.push(primaryCover);
      } else if (langs.length === 0 && matchesCleanTitle && !looksForeign) {
        edUntaggedIds.push(primaryCover);
      } else if (hasOtherLang || looksForeign) {
        edOtherIds.push(primaryCover);
      }
    }

    // Interleave editions evenly from first through last to hit diverse designs quickly instead of identical recent printings
    const spreadPick = (arr: number[], maxCount: number): number[] => {
      if (arr.length <= maxCount) return arr;
      if (maxCount <= 1) return arr.slice(0, 1);
      const out: number[] = [];
      const step = (arr.length - 1) / (maxCount - 1);
      for (let i = 0; i < maxCount; i++) {
        out.push(arr[Math.round(i * step)]);
      }
      return out;
    };

    const primaryCount = edEngIds.length + englishFirstIds.length + edUntaggedIds.length;
    const orderedIds = Array.from(
      new Set([
        ...spreadPick(edEngIds, 10),
        ...englishFirstIds,
        ...spreadPick(edUntaggedIds, 4),
        ...fallbackIds,
        ...(primaryCount < 3 ? spreadPick(edOtherIds, 3) : []),
      ])
    ).slice(0, 14);

    return orderedIds.map((id) => ({
      url: `https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`,
      isWikiIllustration: false,
    }));
  } catch {
    return [];
  }
}

async function resolveCoverInternal(item: CulturalItem): Promise<CachedCoverEntry> {
  const origUrl = item.image;
  if (!origUrl) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: false };
  }

  // 1. Analyze current cover first
  const origAnalysis = await analyzeBookCover(origUrl, { timeoutMs: 2400 });
  const origFlaggedByUrl = isUrlTitlePage(origUrl);

  // If cover loads cleanly and does NOT display giant title letters or a printed title page, keep it!
  if (origAnalysis && !origAnalysis.hasBigTitle && !origFlaggedByUrl) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: true };
  }

  // Fallback score if canvas analysis timed out/failed on URL-flagged image
  const origScore = origAnalysis ? origAnalysis.spoilerScore : origFlaggedByUrl ? 120 : 60;

  // 2. Fetch candidate non-spoiler covers / illustrations concurrently
  const [wikiCands, olCands] = await Promise.all([
    fetchWikiMediaCandidates(item.wikiSlug, origUrl, item.creator, item.title),
    fetchOpenLibraryCoverCandidates(item.title, item.creator, item.altTitles),
  ]);

  // Prioritize confirmed Wikipedia illustrations interleaved with Open Library editions;
  // unclassified Wikipedia article photos go at the end as a fallback.
  const wikiIllustrations = wikiCands.filter((c) => c.isWikiIllustration);
  const wikiOther = wikiCands.filter((c) => !c.isWikiIllustration);
  const candidates: CandidateCover[] = [];
  const seenUrls = new Set<string>([origUrl]);
  const maxLen = Math.max(wikiIllustrations.length, olCands.length);
  for (let i = 0; i < maxLen; i++) {
    if (wikiIllustrations[i] && !seenUrls.has(wikiIllustrations[i].url)) {
      seenUrls.add(wikiIllustrations[i].url);
      candidates.push(wikiIllustrations[i]);
    }
    if (olCands[i] && !seenUrls.has(olCands[i].url)) {
      seenUrls.add(olCands[i].url);
      candidates.push(olCands[i]);
    }
  }
  for (const w of wikiOther) {
    if (!seenUrls.has(w.url)) {
      seenUrls.add(w.url);
      candidates.push(w);
    }
  }

  if (candidates.length === 0) {
    return { url: origUrl, altApplied: false, ts: Date.now(), cacheable: origAnalysis !== null };
  }

  // 3. Evaluate candidates in fast parallel batches with an overall 5.5s deadline
  const deadline = Date.now() + 5500;
  let bestCandidate: { url: string; analysis: BookCoverAnalysis } | null = null;

  for (let i = 0; i < candidates.length; i += 4) {
    if (Date.now() >= deadline) break;
    const batch = candidates.slice(i, i + 4);
    const remainingMs = Math.max(1000, deadline - Date.now());

    const analyses = await Promise.all(
      batch.map(async (c) => ({
        url: c.url,
        analysis: await analyzeBookCover(c.url, {
          isWikiIllustration: c.isWikiIllustration,
          timeoutMs: Math.min(3200, remainingMs),
        }),
      }))
    );

    for (const res of analyses) {
      if (!res.analysis) continue;
      if (!bestCandidate || res.analysis.spoilerScore < bestCandidate.analysis.spoilerScore) {
        bestCandidate = { url: res.url, analysis: res.analysis };
      }
      // Early-exit immediately on crisp clean art cover or illustration
      if (!res.analysis.hasBigTitle && res.analysis.spoilerScore <= 12) {
        return { url: res.url, altApplied: true, ts: Date.now(), cacheable: true };
      }
    }
  }

  // Replace if candidate eliminates big title lettering, replaces a bare title page,
  // or materially reduces huge typography size when no completely clean cover exists.
  const origWasTitlePage = Boolean(origAnalysis?.isTitlePage || origFlaggedByUrl);
  const candidateClean =
    bestCandidate &&
    !bestCandidate.analysis.isTitlePage &&
    (!bestCandidate.analysis.hasBigTitle ||
      origWasTitlePage ||
      (bestCandidate.analysis.spoilerScore < origScore - 15 &&
        (!origAnalysis ||
          bestCandidate.analysis.maxLineHeightRatio <= origAnalysis.maxLineHeightRatio * 0.75)));

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
 * Checks if a book's primary cover displays big spoiler title letters or a printed title page,
 * and if so discovers and selects an alternate edition cover or Wikipedia illustration that
 * does not give away the title.
 */
export async function resolveSafeBookCoverItem(item: CulturalItem): Promise<CulturalItem> {
  if (item.category !== 'books' || !item.image || typeof document === 'undefined') {
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
    promise = resolveCoverInternal(item)
      .then((res) => {
        if (res.cacheable !== false) {
          const entry: CachedCoverEntry = { url: res.url, altApplied: res.altApplied, ts: res.ts };
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
