import React, { useState, useSyncExternalStore } from 'react';
import { Category } from '../types';

interface PixelDecorationsProps {
  category: Category;
}

interface PlacedProp {
  id: string;
  posStyle: React.CSSProperties;
  tiltDeg: number;
  scale: number;
  floatClass: string;
  floatDuration: string;
  floatDelay: string;
  opacityClass: string;
}

interface AnchorSlot {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

type ViewportTier = 'mobile' | 'landscape' | 'tablet' | 'desktop';

// 6 non-overlapping corner/flank zones for portrait phones (<640px) in single-category modes
const MOBILE_SLOTS: AnchorSlot[] = [
  { top: 7.5, left: 1.2 },
  { top: 7.5, right: 1.2 },
  { top: 29.0, left: 0.8 },
  { top: 30.0, right: 0.8 },
  { bottom: 2.0, left: 1.4 },
  { bottom: 2.0, right: 1.4 },
];

// 8 well-spaced perimeter zones for portrait phones (<640px) in Everything Mix so all 3 categories fill top, flanks, and bottom without clustering
const MOBILE_DENSE_SLOTS: AnchorSlot[] = [
  { top: 7.5, left: 1.0 },
  { top: 30.5, left: 0.8 },
  { top: 55.5, left: 1.0 },
  { bottom: 2.0, left: 1.4 },
  { top: 7.5, right: 1.0 },
  { top: 30.5, right: 0.8 },
  { top: 55.5, right: 1.0 },
  { bottom: 2.0, right: 1.4 },
];

// 6 wide horizontal corner zones for short landscape phones (height < 580px) so props never stack on top of each other vertically
const LANDSCAPE_SLOTS: AnchorSlot[] = [
  { top: 10.5, left: 1.2 },
  { top: 10.5, right: 1.2 },
  { bottom: 3.0, left: 1.2 },
  { bottom: 3.0, right: 1.2 },
  { bottom: 3.0, left: 18.5 },
  { bottom: 3.0, right: 18.5 },
];

// 6 perimeter zones for portrait/small tablets (640px-1023px) single-category views
const TABLET_SINGLE_SLOTS: AnchorSlot[] = [
  { top: 8.5, left: 1.4 },
  { top: 37.5, left: 1.0 },
  { bottom: 4.0, left: 1.6 },
  { top: 8.5, right: 1.4 },
  { top: 37.5, right: 1.0 },
  { bottom: 4.0, right: 1.6 },
];

// 10 staggered perimeter slots for portrait/small tablets (640px-1023px) in Everything Mix
const TABLET_DENSE_SLOTS: AnchorSlot[] = [
  { top: 8.0, left: 1.2 },
  { top: 31.5, left: 1.0 },
  { top: 55.0, left: 1.2 },
  { bottom: 3.5, left: 1.4 },
  { bottom: 2.8, left: 20.5 },
  { top: 8.0, right: 1.2 },
  { top: 31.5, right: 1.0 },
  { top: 55.0, right: 1.2 },
  { bottom: 3.5, right: 1.4 },
  { bottom: 2.8, right: 20.5 },
];

// 18 staggered perimeter slots distributed around the outer margins, corners, and upper/lower air pockets
// so ALL 18 static drawings remain visible in Everything mode on wide desktop screens while keeping the center card & title clear.
const PERIMETER_SLOTS: AnchorSlot[] = [
  // Left outer column (4 vertical zones)
  { top: 9, left: 1.4 },
  { top: 30, left: 1.2 },
  { top: 51, left: 1.4 },
  { bottom: 13, left: 1.4 },
  // Left inner staggered pockets (5 zones)
  { top: 7, left: 12.2 },
  { top: 20, left: 11.4 },
  { top: 41, left: 10.6 },
  { bottom: 3.5, left: 11.4 },
  { bottom: 3.5, left: 22.0 },
  // Right outer column (4 vertical zones)
  { top: 9, right: 1.4 },
  { top: 30, right: 1.2 },
  { top: 51, right: 1.4 },
  { bottom: 13, right: 1.4 },
  // Right inner staggered pockets (5 zones)
  { top: 7, right: 12.2 },
  { top: 20, right: 11.4 },
  { top: 41, right: 10.6 },
  { bottom: 3.5, right: 11.4 },
  { bottom: 3.5, right: 22.0 },
];

const FLOAT_CLASSES = ['animate-float-gentle', 'animate-float-sway', 'animate-float-bob-alt'];

const MUSIC_PROP_IDS = [
  'music-turntable',
  'music-speaker',
  'music-cassette',
  'music-guitar',
  'music-gramophone',
  'music-synth',
] as const;

const BOOKS_PROP_IDS = [
  'books-shelf',
  'books-desk',
  'books-grimoire',
  'books-globe',
  'books-lamp-stack',
  'books-scrolls',
] as const;

const ART_PROP_IDS = [
  'art-painter',
  'art-easel',
  'art-frame',
  'art-bust',
  'art-amphora',
  'art-mondrian',
] as const;

// 6 wide, non-overlapping perimeter zones (3 Left + 3 Right) for single-category views so every
// enlarged drawing sits clearly in open space on the sides without hiding behind the center card.
const SINGLE_CAT_PREFERRED_SLOTS: AnchorSlot[] = [
  { top: 9, left: 2.2 },    // Upper-left
  { top: 38, left: 1.6 },   // Mid-left
  { bottom: 7, left: 2.8 }, // Lower-left
  { top: 9, right: 2.2 },   // Upper-right
  { top: 38, right: 1.6 },  // Mid-right
  { bottom: 7, right: 2.8 },// Lower-right
];

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPlacementMap(
  ids: readonly string[],
  slotPool: readonly AnchorSlot[],
  tier: ViewportTier,
  isDense: boolean
): Record<string, PlacedProp> {
  const shuffledSlots = shuffleArray(slotPool);
  const map: Record<string, PlacedProp> = {};

  ids.forEach((id, idx) => {
    const base = shuffledSlots[idx % shuffledSlots.length];
    const isCompact = tier === 'mobile' || tier === 'landscape';
    const jitterMult = isCompact ? 0.4 : tier === 'tablet' ? 0.65 : 1;
    const jitterX = (Math.random() - 0.5) * (isDense ? 1.8 : 2.6) * jitterMult;
    const jitterY = (Math.random() - 0.5) * (isDense ? 2.4 : 4.2) * jitterMult;

    const posStyle: React.CSSProperties = {
      transformOrigin: `${base.top !== undefined ? 'top' : 'bottom'} ${base.left !== undefined ? 'left' : 'right'}`,
    };
    const minTop = isCompact ? 7.0 : 7;
    const maxHorizontal =
      tier === 'mobile'
        ? 4.0
        : tier === 'landscape'
        ? 20.5
        : tier === 'tablet'
        ? isDense
          ? 22.5
          : 5.0
        : isDense
        ? 23.5
        : 6.2;

    if (base.top !== undefined) posStyle.top = `${Math.max(minTop, Math.min(76, base.top + jitterY)).toFixed(1)}%`;
    if (base.bottom !== undefined) posStyle.bottom = `${Math.max(1.8, Math.min(20, base.bottom + jitterY)).toFixed(1)}%`;
    if (base.left !== undefined) posStyle.left = `${Math.max(0.8, Math.min(maxHorizontal, base.left + jitterX)).toFixed(1)}%`;
    if (base.right !== undefined) posStyle.right = `${Math.max(0.8, Math.min(maxHorizontal, base.right + jitterX)).toFixed(1)}%`;

    let scale: number;
    let opacityClass: string;
    if (isCompact) {
      scale = Number((0.46 + Math.random() * 0.08).toFixed(2));
      opacityClass = isDense ? 'opacity-60' : 'opacity-65';
    } else if (tier === 'tablet') {
      scale = Number((isDense ? 0.56 + Math.random() * 0.08 : 0.68 + Math.random() * 0.1).toFixed(2));
      opacityClass = isDense ? 'opacity-65 md:opacity-75' : 'opacity-70 md:opacity-80';
    } else {
      scale = Number((isDense ? 0.92 + Math.random() * 0.16 : 1.18 + Math.random() * 0.16).toFixed(2));
      opacityClass = isDense ? 'opacity-65 lg:opacity-80' : 'opacity-75 lg:opacity-88';
    }

    map[id] = {
      id,
      posStyle,
      tiltDeg: Number(((Math.random() - 0.5) * (isCompact ? 10 : 14)).toFixed(1)),
      scale,
      floatClass: FLOAT_CLASSES[idx % FLOAT_CLASSES.length],
      floatDuration: `${(4.2 + Math.random() * 2.6).toFixed(1)}s`,
      floatDelay: `-${(Math.random() * 5).toFixed(1)}s`,
      opacityClass,
    };
  });

  return map;
}

function pickBalancedMixIds(countPerCat: number, extraCount = 0): string[] {
  const m = shuffleArray(MUSIC_PROP_IDS);
  const b = shuffleArray(BOOKS_PROP_IDS);
  const a = shuffleArray(ART_PROP_IDS);
  const picked = [
    ...m.slice(0, countPerCat),
    ...b.slice(0, countPerCat),
    ...a.slice(0, countPerCat),
  ];
  if (extraCount > 0) {
    const leftovers = shuffleArray([
      ...m.slice(countPerCat),
      ...b.slice(countPerCat),
      ...a.slice(countPerCat),
    ]);
    picked.push(...leftovers.slice(0, extraCount));
  }
  return picked;
}

function createAllTierLayouts(): Record<ViewportTier, Record<Category, Record<string, PlacedProp>>> {
  const desktopEverythingIds = [...MUSIC_PROP_IDS, ...BOOKS_PROP_IDS, ...ART_PROP_IDS];
  const tabletEverythingIds = pickBalancedMixIds(3, 1); // 10 evenly balanced mixed items
  const mobileEverythingIds = pickBalancedMixIds(2, 2); // 8 balanced mixed items (all 3 categories well represented)
  const landscapeEverythingIds = pickBalancedMixIds(2, 0); // 6 balanced mixed items for short landscape screens

  return {
    mobile: {
      music: buildPlacementMap(MUSIC_PROP_IDS, MOBILE_SLOTS, 'mobile', false),
      books: buildPlacementMap(BOOKS_PROP_IDS, MOBILE_SLOTS, 'mobile', false),
      art: buildPlacementMap(ART_PROP_IDS, MOBILE_SLOTS, 'mobile', false),
      everything: buildPlacementMap(mobileEverythingIds, MOBILE_DENSE_SLOTS, 'mobile', true),
    },
    landscape: {
      music: buildPlacementMap(MUSIC_PROP_IDS, LANDSCAPE_SLOTS, 'landscape', false),
      books: buildPlacementMap(BOOKS_PROP_IDS, LANDSCAPE_SLOTS, 'landscape', false),
      art: buildPlacementMap(ART_PROP_IDS, LANDSCAPE_SLOTS, 'landscape', false),
      everything: buildPlacementMap(landscapeEverythingIds, LANDSCAPE_SLOTS, 'landscape', true),
    },
    tablet: {
      music: buildPlacementMap(MUSIC_PROP_IDS, TABLET_SINGLE_SLOTS, 'tablet', false),
      books: buildPlacementMap(BOOKS_PROP_IDS, TABLET_SINGLE_SLOTS, 'tablet', false),
      art: buildPlacementMap(ART_PROP_IDS, TABLET_SINGLE_SLOTS, 'tablet', false),
      everything: buildPlacementMap(tabletEverythingIds, TABLET_DENSE_SLOTS, 'tablet', true),
    },
    desktop: {
      music: buildPlacementMap(MUSIC_PROP_IDS, SINGLE_CAT_PREFERRED_SLOTS, 'desktop', false),
      books: buildPlacementMap(BOOKS_PROP_IDS, SINGLE_CAT_PREFERRED_SLOTS, 'desktop', false),
      art: buildPlacementMap(ART_PROP_IDS, SINGLE_CAT_PREFERRED_SLOTS, 'desktop', false),
      everything: buildPlacementMap(desktopEverythingIds, PERIMETER_SLOTS, 'desktop', true),
    },
  };
}

interface PropWrapperProps {
  placement?: PlacedProp;
  children: React.ReactNode;
}

const FloatingProp: React.FC<PropWrapperProps> = ({ placement, children }) => {
  if (!placement) return null;
  return (
    <div
      className={`absolute z-0 pointer-events-none select-none ${placement.opacityClass}`}
      style={{
        ...placement.posStyle,
        transform: `rotate(${placement.tiltDeg}deg) scale(${placement.scale})`,
      }}
    >
      <div
        className={placement.floatClass}
        style={{
          animationDuration: placement.floatDuration,
          animationDelay: placement.floatDelay,
        }}
      >
        {children}
      </div>
    </div>
  );
};

function subscribeViewportTier(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mqDesktop = window.matchMedia('(min-width: 1024px)');
  const mqTablet = window.matchMedia('(min-width: 640px)');
  const mqTall = window.matchMedia('(min-height: 580px)');
  mqDesktop.addEventListener('change', callback);
  mqTablet.addEventListener('change', callback);
  mqTall.addEventListener('change', callback);
  return () => {
    mqDesktop.removeEventListener('change', callback);
    mqTablet.removeEventListener('change', callback);
    mqTall.removeEventListener('change', callback);
  };
}

function getViewportTierSnapshot(): ViewportTier {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'mobile';
  }
  const isTallEnough = window.matchMedia('(min-height: 580px)').matches;
  const isTabletWide = window.matchMedia('(min-width: 640px)').matches;
  const isDesktopWide = window.matchMedia('(min-width: 1024px)').matches;

  if (!isTallEnough) {
    return isTabletWide ? 'landscape' : 'mobile';
  }
  if (isDesktopWide) return 'desktop';
  if (isTabletWide) return 'tablet';
  return 'mobile';
}

export const PixelDecorations: React.FC<PixelDecorationsProps> = ({ category }) => {
  const [layouts] = useState<Record<ViewportTier, Record<Category, Record<string, PlacedProp>>>>(
    createAllTierLayouts
  );
  const viewportTier = useSyncExternalStore(
    subscribeViewportTier,
    getViewportTierSnapshot,
    () => 'desktop'
  );

  const activeLayout = layouts[viewportTier][category];

  const showMusic = category === 'music' || category === 'everything';
  const showBooks = category === 'books' || category === 'everything';
  const showArt = category === 'art' || category === 'everything';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">

      {/* ================= MUSIC CATEGORY: 6 STATIC DRAWINGS ================= */}
      {showMusic && (
        <>
          {/* Top Hanging Party Lights (Music mode) */}
          {category === 'music' && (
            <div className="absolute top-0 left-0 right-0 h-3 flex justify-around opacity-60">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-3 rounded-b-sm animate-pulse ${i % 2 === 1 ? 'hidden sm:block' : ''}`}
                  style={{
                    backgroundColor: ['#f43f5e', '#a855f7', '#06b6d4', '#eab308', '#ec4899'][i % 5],
                    animationDelay: `${i * 0.18}s`,
                    animationDuration: '2s',
                  }}
                />
              ))}
            </div>
          )}

          {/* M1: Turntable Console + Blurred Vinyl Albums */}
          <FloatingProp placement={activeLayout['music-turntable']}>
            <div className="flex flex-col items-start">
              <div className="w-40 h-24 bg-[#3d2010] border-4 border-[#241107] rounded p-1.5 shadow-2xl relative mb-2">
                <div className="w-full h-full bg-[#1a0c06] rounded border border-[#6b3818] relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#111] border-2 border-[#333] flex items-center justify-center relative shadow-md">
                    <div className="w-11 h-11 rounded-full border border-neutral-700/60" />
                    <div className="w-5 h-5 rounded-full bg-rose-600 border border-neutral-400 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <div className="absolute right-3 top-2 w-1.5 h-12 bg-amber-200/80 rounded origin-top transform rotate-25 shadow" />
                  <div className="absolute right-2.5 top-2 w-3.5 h-3.5 bg-amber-400 rounded-full" />
                </div>
              </div>

              <div className="flex -space-x-4 items-end">
                <div
                  className="w-20 h-20 bg-gradient-to-tr from-purple-900 via-fuchsia-600 to-indigo-900 border-2 border-[#e879f9] rounded shadow-xl transform -rotate-12"
                  style={{ filter: 'blur(1.2px) contrast(1.1)' }}
                >
                  <div className="w-full h-full flex flex-col justify-between p-1.5">
                    <div className="w-8 h-1 bg-yellow-300 rounded" />
                    <div className="w-10 h-10 rounded-full bg-yellow-400/80 mx-auto" />
                    <div className="w-full h-1 bg-cyan-400 rounded" />
                  </div>
                </div>
                <div
                  className="w-22 h-22 bg-gradient-to-br from-amber-600 via-orange-500 to-rose-700 border-2 border-[#fcd34d] rounded shadow-2xl transform rotate-6 z-10"
                  style={{ filter: 'blur(1.2px) contrast(1.1)' }}
                >
                  <div className="w-full h-full flex flex-col justify-around p-1.5">
                    <div className="w-12 h-1 bg-white/90 rounded" />
                    <div className="w-12 h-12 rounded-full border-4 border-amber-300/80 mx-auto" />
                  </div>
                </div>
                <div
                  className="w-16 h-16 rounded-full bg-[#0a0a0a] border-2 border-[#2b2b2b] -ml-6 mb-2 flex items-center justify-center shadow-lg transform rotate-45"
                  style={{ filter: 'blur(1px)' }}
                >
                  <div className="w-6 h-6 rounded-full bg-red-600 border border-white/40" />
                </div>
              </div>
            </div>
          </FloatingProp>

          {/* M2: Retro Hi-Fi 80W Speaker Cabinet & Crate */}
          <FloatingProp placement={activeLayout['music-speaker']}>
            <div className="flex flex-col items-center">
              <div className="w-28 h-44 bg-[#30170a] border-4 border-[#170a04] rounded p-2 shadow-2xl flex flex-col justify-between items-center">
                <div className="w-full h-9 bg-[#1f0d04] border border-[#522b13] rounded flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-[#111] border-2 border-amber-500/70" />
                </div>
                <div className="w-18 h-18 rounded-full bg-[#170a04] border-4 border-[#613318] flex items-center justify-center shadow-inner">
                  <div className="w-9 h-9 rounded-full bg-[#0a0502] border-2 border-stone-600 flex items-center justify-center">
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-600/80" />
                  </div>
                </div>
                <div className="text-[7px] font-pixel-title text-amber-500/80">HI-FI 80W</div>
              </div>

              <div className="w-36 h-14 bg-[#4a2612] border-2 border-[#2b1408] rounded mt-2 p-1 flex gap-1 items-end justify-center shadow-lg">
                {['#ec4899', '#3b82f6', '#eab308', '#10b981', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#a855f7'].map((c, i) => (
                  <div key={i} className="w-2.5 h-10 rounded-t-sm border-t border-white/30" style={{ backgroundColor: c, filter: 'blur(0.7px)' }} />
                ))}
              </div>
            </div>
          </FloatingProp>

          {/* M3: Classic Retro Cassette Tape */}
          <FloatingProp placement={activeLayout['music-cassette']}>
            <div className="w-40 h-26 bg-[#1e1b2e] border-4 border-[#0f0d18] rounded-md p-2 shadow-2xl flex flex-col justify-between">
              <div className="w-full h-14 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-400 rounded-sm border-2 border-[#f5d0fe] p-1.5 flex flex-col justify-between">
                <div className="w-full h-1.5 bg-white/80 rounded-sm" />
                <div className="w-full h-6 bg-[#18181b] rounded-sm flex items-center justify-around px-2 border border-stone-600">
                  <div className="w-4 h-4 rounded-full bg-stone-200 border-2 border-stone-700 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-black rounded-full" />
                  </div>
                  <div className="w-10 h-2.5 bg-[#2e1e19] border border-amber-700/70" />
                  <div className="w-4 h-4 rounded-full bg-stone-200 border-2 border-stone-700 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-black rounded-full" />
                  </div>
                </div>
              </div>
              <div className="w-28 h-4 bg-[#110f1a] border-t-2 border-stone-600 mx-auto rounded-t flex items-center justify-around px-3">
                <div className="w-2 h-2 rounded-full bg-stone-400" />
                <div className="w-2 h-2 rounded-full bg-stone-400" />
              </div>
            </div>
          </FloatingProp>

          {/* M4: Pixel Sunburst Electric Guitar */}
          <FloatingProp placement={activeLayout['music-guitar']}>
            <div className="flex flex-col items-center">
              {/* Headstock */}
              <div className="w-6 h-8 bg-[#92400e] border-2 border-[#451a03] rounded-t-md relative flex flex-col justify-around py-1">
                <div className="w-1.5 h-1 bg-stone-300 -ml-1.5 rounded-sm" />
                <div className="w-1.5 h-1 bg-stone-300 -ml-1.5 rounded-sm" />
                <div className="w-1.5 h-1 bg-stone-300 -ml-1.5 rounded-sm" />
              </div>
              {/* Fretboard Neck */}
              <div className="w-4 h-16 bg-[#451a03] border-x-2 border-[#270e02] flex flex-col justify-around py-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-full h-0.5 bg-amber-200/70" />
                ))}
              </div>
              {/* Sunburst Body */}
              <div className="w-24 h-26 -mt-2 rounded-b-3xl rounded-t-2xl bg-gradient-to-br from-red-700 via-amber-500 to-red-900 border-4 border-[#2b0b04] shadow-2xl flex flex-col items-center justify-center relative">
                <div className="w-12 h-14 bg-[#fef3c7]/90 border-2 border-stone-400 rounded-xl flex flex-col justify-around items-center py-1.5">
                  <div className="w-8 h-1.5 bg-stone-800 rounded" />
                  <div className="w-8 h-1.5 bg-stone-800 rounded" />
                  <div className="w-9 h-2 bg-stone-300 border border-stone-700 rounded-sm" />
                </div>
                <div className="absolute right-3 bottom-3 flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-100 border border-stone-700" />
                  <div className="w-2 h-2 rounded-full bg-amber-100 border border-stone-700" />
                </div>
              </div>
            </div>
          </FloatingProp>

          {/* M5: Vintage Brass Horn Gramophone */}
          <FloatingProp placement={activeLayout['music-gramophone']}>
            <div className="flex flex-col items-center">
              {/* Flared Brass Pixel Horn */}
              <div className="relative flex items-end ml-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-700 via-yellow-400 to-amber-200 border-4 border-[#78350f] shadow-xl flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#451a03] border-2 border-amber-500" />
                </div>
                <div className="w-4 h-12 bg-amber-500 border-2 border-[#78350f] -ml-4 -mb-2 transform rotate-12 rounded" />
              </div>
              {/* Wood Box Base */}
              <div className="w-32 h-14 bg-[#5c2d14] border-4 border-[#291206] rounded shadow-2xl relative flex flex-col justify-between p-1.5 -mt-1">
                <div className="w-full h-2 bg-[#170a04] rounded-sm flex items-center justify-center">
                  <div className="w-4 h-3 bg-rose-600 rounded-sm" />
                </div>
                <div className="flex justify-between items-center px-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 border border-[#451a03]" />
                  <div className="w-5 h-1.5 bg-amber-300 rounded" />
                </div>
              </div>
            </div>
          </FloatingProp>

          {/* M6: Retro MIDI Synth Keyboard */}
          <FloatingProp placement={activeLayout['music-synth']}>
            <div className="w-44 h-22 bg-[#1c1917] border-4 border-[#090807] rounded p-2 shadow-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between px-1">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                </div>
                <div className="w-12 h-2.5 bg-[#064e3b] border border-emerald-500 rounded-sm" />
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-stone-400" />
                  <div className="w-2 h-2 rounded-full bg-stone-400" />
                </div>
              </div>
              <div className="w-full h-11 bg-[#0c0a09] p-0.5 flex gap-0.5 relative rounded-sm">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex-1 h-full bg-[#fafaf9] border-b-2 border-stone-400 rounded-b-sm" />
                ))}
                <div className="absolute top-0.5 left-3 right-3 flex justify-between pointer-events-none">
                  {[true, true, false, true, true, true, false, true].map((hasSharp, i) => (
                    <div
                      key={i}
                      className={`w-2 h-6 rounded-b-sm ${hasSharp ? 'bg-[#18181b] border border-stone-600' : 'opacity-0'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FloatingProp>
        </>
      )}

      {/* ================= BOOKS CATEGORY: 6 STATIC DRAWINGS ================= */}
      {showBooks && (
        <>
          {/* B1: Tall Victorian Bookshelf */}
          <FloatingProp placement={activeLayout['books-shelf']}>
            <div className="w-36 h-68 bg-[#291307] border-4 border-[#170a04] rounded p-2 flex flex-col justify-around shadow-2xl">
              <div className="w-full pb-1 border-b-4 border-[#4a2410] flex items-end gap-1">
                <div className="w-4 h-12 bg-[#881337] border-t-2 border-[#fda4af] rounded-t-sm" />
                <div className="w-3.5 h-10 bg-[#1e3a5f] border-t-2 border-[#93c5fd] rounded-t-sm" />
                <div className="w-5 h-14 bg-[#78350f] border-t-2 border-[#fcd34d] rounded-t-sm" />
                <div className="w-3 h-10 bg-[#14532d] border-t-2 border-[#86efac] rounded-t-sm" />
                <div className="w-4 h-12 bg-[#4c1d95] border-t-2 border-[#d8b4fe] rounded-t-sm" />
              </div>
              <div className="w-full pb-1 border-b-4 border-[#4a2410] flex items-end justify-between">
                <div className="flex items-end gap-1">
                  <div className="w-4 h-11 bg-[#713f12] border-t-2 border-[#fef08a] rounded-t-sm" />
                  <div className="w-3.5 h-13 bg-[#042f2e] border-t-2 border-[#5eead4] rounded-t-sm" />
                  <div className="w-4.5 h-10 bg-[#581c87] border-t-2 border-[#e9d5ff] rounded-t-sm" />
                </div>
                <div className="text-lg -mb-1 animate-pulse">🧪</div>
              </div>
              <div className="w-full pb-1 border-b-4 border-[#4a2410] flex items-end gap-1">
                <div className="w-4 h-12 bg-[#831843] border-t-2 border-[#fbcfe8] rounded-t-sm" />
                <div className="w-3.5 h-11 bg-[#1e293b] border-t-2 border-[#cbd5e1] rounded-t-sm transform -rotate-12 origin-bottom-left" />
                <div className="w-5 h-10 bg-[#b45309] border-t-2 border-[#fef3c7] rounded-t-sm ml-1" />
                <div className="w-3 h-9 bg-[#1e3a8a] border-t-2 border-[#bfdbfe] rounded-t-sm" />
              </div>
              <div className="w-full flex items-end justify-around">
                <div className="text-lg">📜</div>
                <div className="w-4 h-11 bg-[#854d0e] border-t-2 border-[#fde047] rounded-t-sm" />
                <div className="w-3.5 h-12 bg-[#7f1d1d] border-t-2 border-[#fca5a5] rounded-t-sm" />
                <div className="text-base">🕯️</div>
              </div>
            </div>
          </FloatingProp>

          {/* B2: Vintage Typewriter & Quill Desk */}
          <FloatingProp placement={activeLayout['books-desk']}>
            <div className="w-44 bg-[#3d1d0c] border-4 border-[#1f0d04] rounded-t p-2.5 shadow-2xl flex flex-col items-center">
              <div className="w-32 bg-[#1c1917] border-2 border-[#44403c] rounded p-1.5 shadow-md flex flex-col items-center relative">
                <div className="w-36 h-4 bg-[#292524] border border-[#57534e] rounded-sm relative flex items-center justify-center -mt-2">
                  <div className="absolute -top-6 w-20 h-7 bg-[#fef3c7] border border-[#d4b996] rounded-t-sm p-1 flex flex-col justify-around shadow-sm">
                    <div className="w-full h-0.5 bg-neutral-400" />
                    <div className="w-3/4 h-0.5 bg-neutral-400" />
                    <div className="w-5/6 h-0.5 bg-neutral-400" />
                  </div>
                  <div className="absolute -left-1.5 w-1.5 h-3 bg-neutral-400 rounded-sm" />
                  <div className="absolute -right-1.5 w-1.5 h-3 bg-neutral-400 rounded-sm" />
                </div>
                <div className="w-full h-8 bg-[#0c0a09] border border-[#292524] rounded-sm mt-1 p-1 flex flex-col justify-around">
                  <div className="flex justify-between px-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 border border-stone-500" />
                    ))}
                  </div>
                  <div className="flex justify-between px-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-stone-300 border border-stone-500" />
                    ))}
                  </div>
                  <div className="w-16 h-1 bg-amber-200/90 rounded mx-auto" />
                </div>
              </div>
              <div className="w-full flex justify-between items-center mt-2 px-1">
                <div className="flex items-center gap-1">
                  <div className="text-xl">🪶</div>
                  <div className="w-3 h-3 rounded-full bg-black border border-stone-600" />
                </div>
                <div className="text-[8px] font-pixel-title text-amber-300/80">UNDERWOOD</div>
              </div>
            </div>
          </FloatingProp>

          {/* B3: Open Illuminated Tome / Grimoire */}
          <FloatingProp placement={activeLayout['books-grimoire']}>
            <div className="w-40 h-28 bg-[#581c1c] border-4 border-[#2b0909] rounded p-1.5 shadow-2xl flex items-stretch gap-1 relative">
              {/* Left Page */}
              <div className="flex-1 bg-[#fef3c7] border border-[#d6b384] rounded-l-sm p-1.5 flex flex-col gap-1">
                <div className="flex gap-1 items-start">
                  <div className="w-5 h-5 bg-[#b91c1c] border border-amber-400 rounded-sm shrink-0" />
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="w-full h-1 bg-stone-600 rounded" />
                    <div className="w-4/5 h-1 bg-stone-600 rounded" />
                  </div>
                </div>
                <div className="w-full h-1 bg-stone-500/80 rounded mt-1" />
                <div className="w-5/6 h-1 bg-stone-500/80 rounded" />
                <div className="w-full h-1 bg-stone-500/80 rounded" />
                <div className="w-2/3 h-1 bg-stone-500/80 rounded" />
              </div>
              {/* Center Spine Shadow */}
              <div className="w-1 bg-[#78350f]" />
              {/* Right Page */}
              <div className="flex-1 bg-[#fde68a] border border-[#d6b384] rounded-r-sm p-1.5 flex flex-col justify-between">
                <div className="flex flex-col gap-1">
                  <div className="w-full h-1 bg-stone-600 rounded" />
                  <div className="w-3/4 h-1 bg-stone-600 rounded" />
                  <div className="w-full h-1 bg-stone-500/80 rounded" />
                </div>
                <div className="w-10 h-7 bg-amber-300/70 border border-amber-700/60 mx-auto rounded-sm flex items-center justify-center text-[10px]">
                  ⚜️
                </div>
              </div>
              {/* Crimson Bookmark Ribbon */}
              <div className="absolute -bottom-3 right-8 w-2.5 h-6 bg-rose-600 border border-rose-950 rounded-b-sm shadow" />
            </div>
          </FloatingProp>

          {/* B4: Brass Antique Library Globe */}
          <FloatingProp placement={activeLayout['books-globe']}>
            <div className="flex flex-col items-center">
              <div className="relative p-1.5 rounded-full border-4 border-amber-500 border-l-transparent transform -rotate-12 shadow-xl">
                <div className="w-22 h-22 rounded-full bg-gradient-to-br from-sky-700 via-cyan-800 to-slate-900 border-2 border-sky-400/50 relative overflow-hidden shadow-inner">
                  {/* Pixel Continents */}
                  <div className="w-7 h-5 bg-emerald-600/85 rounded-sm absolute top-3 left-3" />
                  <div className="w-6 h-8 bg-amber-600/75 rounded-sm absolute top-5 right-3" />
                  <div className="w-8 h-4 bg-emerald-700/80 rounded-sm absolute bottom-3 left-6" />
                  <div className="w-full h-0.5 bg-amber-200/30 absolute top-1/2" />
                </div>
              </div>
              <div className="w-2.5 h-5 bg-amber-600 border-x border-amber-950 -mt-1" />
              <div className="w-14 h-3 bg-[#451a03] border-2 border-[#1f0b01] rounded-t shadow-lg" />
            </div>
          </FloatingProp>

          {/* B5: Leaning Stack of Hardcovers + Green Banker's Lamp */}
          <FloatingProp placement={activeLayout['books-lamp-stack']}>
            <div className="flex flex-col items-center">
              {/* Green Banker's Lamp */}
              <div className="flex flex-col items-center -mb-0.5">
                <div className="w-14 h-6 bg-emerald-600 border-2 border-emerald-950 rounded-t-full shadow-[0_6px_16px_rgba(16,185,129,0.5)] flex items-end justify-center pb-0.5">
                  <div className="w-8 h-1.5 bg-yellow-200/90 rounded-full" />
                </div>
                <div className="w-2 h-6 bg-amber-500 border-x border-amber-800" />
                <div className="w-10 h-2 bg-amber-600 border border-amber-900 rounded-t" />
              </div>
              {/* Stacked Books */}
              <div className="w-24 h-5 bg-[#7c2d12] border-2 border-[#431407] rounded-r flex items-center px-1.5">
                <div className="w-16 h-1.5 bg-amber-200/70 rounded" />
              </div>
              <div className="w-30 h-6 bg-[#1e3a8a] border-2 border-[#0f172a] rounded-l flex items-center justify-end px-2 ml-2">
                <div className="w-18 h-1.5 bg-amber-300/80 rounded" />
              </div>
              <div className="w-34 h-6 bg-[#14532d] border-2 border-[#052e16] rounded-r flex items-center px-2">
                <div className="w-22 h-1.5 bg-yellow-200/80 rounded" />
              </div>
              <div className="w-36 h-7 bg-[#78350f] border-2 border-[#271002] rounded flex items-center justify-between px-2 shadow-xl">
                <div className="w-3 h-full bg-amber-400/80" />
                <div className="w-20 h-2 bg-[#fef3c7]/80 rounded" />
              </div>
            </div>
          </FloatingProp>

          {/* B6: Sealed Parchment Scrolls & Brass Hourglass */}
          <FloatingProp placement={activeLayout['books-scrolls']}>
            <div className="flex items-end gap-3">
              {/* Twin Rolled Scrolls */}
              <div className="flex flex-col gap-1.5">
                <div className="w-24 h-6 bg-[#fef3c7] border-2 border-[#92400e] rounded-full relative flex items-center justify-center shadow-lg">
                  <div className="w-4 h-full bg-rose-700 border-x border-rose-950" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-amber-300 absolute" />
                </div>
                <div className="w-28 h-7 bg-[#fde68a] border-2 border-[#92400e] rounded-full relative flex items-center justify-center shadow-xl ml-2">
                  <div className="w-4 h-full bg-purple-800 border-x border-purple-950" />
                </div>
              </div>
              {/* Brass Pixel Hourglass */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-2 bg-amber-600 border border-amber-950 rounded" />
                <div className="w-9 h-7 bg-sky-200/25 border-2 border-amber-500/80 rounded-b-full flex items-end justify-center p-0.5">
                  <div className="w-5 h-3 bg-amber-300 rounded-b-full" />
                </div>
                <div className="w-9 h-7 bg-sky-200/25 border-2 border-amber-500/80 rounded-t-full -mt-0.5 flex items-end justify-center p-0.5">
                  <div className="w-7 h-4 bg-amber-400 rounded-t-md" />
                </div>
                <div className="w-12 h-2 bg-amber-600 border border-amber-950 rounded" />
              </div>
            </div>
          </FloatingProp>
        </>
      )}

      {/* ================= ART CATEGORY: 6 STATIC DRAWINGS ================= */}
      {showArt && (
        <>
          {/* Gallery Spotlights Beam Effect (Art mode) */}
          {category === 'art' && (
            <>
              <div className="hidden md:block absolute left-12 top-0 w-36 h-72 bg-yellow-400/8 blur-3xl rotate-12 pointer-events-none" />
              <div className="hidden md:block absolute right-12 top-0 w-36 h-72 bg-amber-400/8 blur-3xl -rotate-12 pointer-events-none" />
            </>
          )}

          {/* A1: Pixel Master Painter + Floor Canvases */}
          <FloatingProp placement={activeLayout['art-painter']}>
            <div className="flex flex-col items-center">
              <div className="relative flex flex-col items-center">
                <div className="w-9 h-4 bg-rose-600 border border-rose-900 rounded-t-full -mb-1 z-10 shadow" />
                <div className="w-7 h-7 bg-[#fed7aa] border-2 border-[#9a3412] rounded flex items-center justify-around px-1 z-0">
                  <div className="w-1 h-1 bg-black rounded-full" />
                  <div className="w-1 h-1 bg-black rounded-full" />
                </div>
                <div className="w-10 h-12 bg-[#0284c7] border-2 border-[#075985] rounded-b p-1 flex flex-col justify-between items-center relative">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 absolute top-2 left-2" />
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute bottom-2 right-2" />
                  <div className="w-1 h-1 rounded-full bg-emerald-400 absolute top-4 right-3" />
                </div>
                <div className="flex gap-2 -mt-0.5">
                  <div className="w-3 h-2 bg-[#451a03] rounded-sm" />
                  <div className="w-3 h-2 bg-[#451a03] rounded-sm" />
                </div>
                <div className="absolute -left-6 top-7 w-7 h-6 bg-[#d97706] border-2 border-[#78350f] rounded-full flex items-center justify-around p-0.5 shadow-md">
                  <div className="w-1 h-1 bg-red-600 rounded-full" />
                  <div className="w-1 h-1 bg-blue-600 rounded-full" />
                  <div className="w-1 h-1 bg-yellow-400 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-white/70 rounded-full" />
                </div>
                <div className="absolute -right-4 top-6 flex flex-col items-center">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                  <div className="w-1 h-6 bg-amber-800 rounded-sm" />
                </div>
              </div>
              <div className="flex -space-x-3 items-end mt-2">
                <div className="w-14 h-18 bg-[#fafaf9] border-2 border-[#a8a29e] rounded-sm shadow-md transform -rotate-6 flex items-center justify-center">
                  <div className="w-10 h-14 bg-[#f5f5f4] border border-[#e7e5e4]" />
                </div>
                <div className="w-16 h-20 bg-[#fde047] border-2 border-[#b45309] rounded-sm shadow-lg transform rotate-3 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-t from-emerald-700 via-sky-400 to-amber-200" />
                </div>
              </div>
            </div>
          </FloatingProp>

          {/* A2: Wooden Studio Easel */}
          <FloatingProp placement={activeLayout['art-easel']}>
            <div className="relative w-36 h-56 flex flex-col items-center">
              <div className="w-2.5 h-full bg-[#78350f] border-x border-[#451a03] absolute" />
              <div className="w-2 h-full bg-[#92400e] border border-[#451a03] absolute transform -rotate-12 origin-top left-12" />
              <div className="w-2 h-full bg-[#92400e] border border-[#451a03] absolute transform rotate-12 origin-top right-12" />
              <div className="w-32 h-26 bg-[#f5f5f4] border-4 border-[#522b13] rounded-sm shadow-2xl relative z-10 mt-10 overflow-hidden flex flex-col">
                <div className="w-full h-14 bg-gradient-to-b from-sky-300 via-amber-100 to-emerald-300 relative">
                  <div className="w-6 h-6 rounded-full bg-amber-400 absolute top-1 right-3" />
                  <div className="w-10 h-6 bg-emerald-600 rounded-t-full absolute bottom-0 left-2" />
                  <div className="w-14 h-8 bg-emerald-700 rounded-t-full absolute bottom-0 right-0" />
                </div>
                <div className="w-full flex-1 bg-gradient-to-r from-emerald-800 to-emerald-600" />
              </div>
              <div className="w-36 h-3 bg-[#5c2909] border border-[#2b1202] rounded z-20 -mt-0.5 shadow flex items-center justify-around px-2">
                <div className="w-4 h-1 bg-red-500 rounded" />
                <div className="w-4 h-1 bg-blue-500 rounded" />
                <div className="w-4 h-1 bg-yellow-400 rounded" />
              </div>
              <div className="absolute bottom-1 flex gap-2 z-20">
                <div className="w-4 h-5 bg-[#e2e8f0] border border-stone-500 rounded-sm flex items-center justify-center text-[8px]">🖌️</div>
                <div className="w-3.5 h-4 bg-amber-700 border border-amber-950 rounded-sm" />
              </div>
            </div>
          </FloatingProp>

          {/* A3: Gilded Baroque Museum Frame (Starry Sky Canvas) */}
          <FloatingProp placement={activeLayout['art-frame']}>
            <div className="w-34 h-40 bg-gradient-to-br from-amber-300 via-yellow-600 to-amber-800 border-4 border-[#451a03] rounded-sm p-2 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full bg-[#fef3c7] border-2 border-[#78350f] p-1.5 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-b from-[#0f172a] via-[#1e3a8a] to-[#172554] relative overflow-hidden border border-stone-800">
                  <div className="w-6 h-6 rounded-full bg-yellow-300 shadow-[0_0_12px_#fde047] absolute top-2 right-2" />
                  <div className="w-8 h-3 bg-sky-400/50 rounded-full absolute top-5 left-2" />
                  <div className="w-10 h-3 bg-indigo-300/40 rounded-full absolute top-11 left-6" />
                  <div className="w-6 h-16 bg-[#020617] rounded-t-full absolute bottom-0 left-3" />
                  <div className="w-full h-4 bg-[#1e1b4b] absolute bottom-0" />
                </div>
              </div>
            </div>
          </FloatingProp>

          {/* A4: Classical White Marble Bust on Pedestal */}
          <FloatingProp placement={activeLayout['art-bust']}>
            <div className="flex flex-col items-center">
              {/* Marble Head & Shoulders */}
              <div className="w-9 h-10 bg-gradient-to-b from-stone-100 to-stone-300 border-2 border-stone-500 rounded-t-full relative flex flex-col items-center justify-center">
                <div className="w-2 h-2 bg-stone-400 rounded-full absolute top-3 left-2" />
                <div className="w-5 h-1.5 bg-emerald-700/80 rounded-full -mt-5" />
              </div>
              <div className="w-14 h-7 bg-stone-200 border-2 border-stone-500 rounded-t-xl -mt-0.5" />
              {/* Fluted Stone Pedestal */}
              <div className="w-18 h-2.5 bg-stone-300 border-2 border-stone-600 rounded-sm" />
              <div className="w-14 h-18 bg-stone-200 border-x-2 border-stone-500 flex justify-around px-1 py-1">
                <div className="w-1.5 h-full bg-stone-300 rounded" />
                <div className="w-1.5 h-full bg-stone-300 rounded" />
                <div className="w-1.5 h-full bg-stone-300 rounded" />
              </div>
              <div className="w-20 h-3 bg-stone-400 border-2 border-stone-700 rounded-sm shadow-xl" />
            </div>
          </FloatingProp>

          {/* A5: Terracotta Museum Amphora & Brush Jar */}
          <FloatingProp placement={activeLayout['art-amphora']}>
            <div className="flex items-end gap-2">
              {/* Ceramic Amphora */}
              <div className="flex flex-col items-center relative">
                <div className="w-8 h-2 bg-[#c2410c] border-2 border-[#431407] rounded-full" />
                <div className="w-5 h-4 bg-[#9a3412] border-x-2 border-[#431407]" />
                <div className="w-16 h-18 bg-gradient-to-b from-[#ea580c] to-[#7c2d12] border-2 border-[#431407] rounded-full -mt-1 flex flex-col justify-center items-center gap-1 shadow-xl relative">
                  <div className="w-full h-2.5 bg-[#1c1917] flex justify-around items-center px-1">
                    <div className="w-1.5 h-1.5 bg-amber-300" />
                    <div className="w-1.5 h-1.5 bg-amber-300" />
                    <div className="w-1.5 h-1.5 bg-amber-300" />
                  </div>
                  {/* Side Handles */}
                  <div className="w-3 h-7 border-2 border-[#431407] rounded-l-full -left-2.5 top-2 absolute" />
                  <div className="w-3 h-7 border-2 border-[#431407] rounded-r-full -right-2.5 top-2 absolute" />
                </div>
                <div className="w-9 h-2.5 bg-[#431407] rounded-sm -mt-1" />
              </div>
              {/* Stoneware Brush Crock */}
              <div className="flex flex-col items-center">
                <div className="flex gap-1 -mb-1">
                  <div className="w-1.5 h-8 bg-rose-500 border border-stone-800 transform -rotate-12 rounded-t" />
                  <div className="w-1.5 h-9 bg-amber-400 border border-stone-800 rounded-t" />
                  <div className="w-1.5 h-8 bg-sky-500 border border-stone-800 transform rotate-12 rounded-t" />
                </div>
                <div className="w-10 h-11 bg-stone-400 border-2 border-stone-700 rounded-b-md shadow-md" />
              </div>
            </div>
          </FloatingProp>

          {/* A6: Framed De Stijl Canvas & Paint Tubes */}
          <FloatingProp placement={activeLayout['art-mondrian']}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-30 h-26 bg-black border-4 border-[#1c1917] shadow-2xl grid grid-cols-3 grid-rows-3 gap-1 p-1">
                <div className="col-span-2 row-span-2 bg-[#dc2626]" />
                <div className="bg-white" />
                <div className="bg-[#facc15]" />
                <div className="bg-[#2563eb]" />
                <div className="col-span-2 bg-white" />
              </div>
              {/* Paint Tubes */}
              <div className="flex gap-1.5">
                <div className="w-7 h-2.5 bg-rose-600 border border-stone-300 rounded-l-sm flex justify-end items-center">
                  <div className="w-1.5 h-1.5 bg-stone-200" />
                </div>
                <div className="w-7 h-2.5 bg-sky-500 border border-stone-300 rounded-l-sm flex justify-end items-center">
                  <div className="w-1.5 h-1.5 bg-stone-200" />
                </div>
                <div className="w-7 h-2.5 bg-yellow-400 border border-stone-300 rounded-l-sm flex justify-end items-center">
                  <div className="w-1.5 h-1.5 bg-stone-200" />
                </div>
              </div>
            </div>
          </FloatingProp>
        </>
      )}

      {/* ================= SUBTLE DRIFTING CULTURAL ICONS ================= */}
      {category === 'music' && (
        <>
          <div className="absolute left-[12%] animate-drift text-2xl text-pink-400 opacity-50" style={{ animationDelay: '0s', animationDuration: '16s' }}>♪</div>
          <div className="hidden sm:block absolute left-[34%] animate-drift text-3xl text-cyan-300 opacity-60" style={{ animationDelay: '5s', animationDuration: '17s' }}>♫</div>
          <div className="hidden sm:block absolute left-[68%] animate-drift text-2xl text-purple-300 opacity-60" style={{ animationDelay: '2s', animationDuration: '15s' }}>♬</div>
          <div className="absolute left-[84%] sm:left-[88%] animate-drift text-xl text-amber-300 opacity-50" style={{ animationDelay: '8s', animationDuration: '19s' }}>♩</div>
        </>
      )}

      {category === 'books' && (
        <>
          <div className="absolute left-[14%] sm:left-[18%] animate-drift text-2xl text-amber-200 opacity-50" style={{ animationDelay: '1s', animationDuration: '17s' }}>📜</div>
          <div className="hidden sm:block absolute left-[40%] animate-drift text-2xl opacity-65" style={{ animationDelay: '4s', animationDuration: '15s' }}>📖</div>
          <div className="hidden sm:block absolute left-[75%] animate-drift text-2xl opacity-60" style={{ animationDelay: '2s', animationDuration: '16s' }}>📚</div>
          <div className="absolute left-[84%] sm:left-[88%] animate-drift text-xl text-yellow-300 opacity-50" style={{ animationDelay: '7s', animationDuration: '18s' }}>✨</div>
        </>
      )}

      {category === 'art' && (
        <>
          <div className="absolute left-[15%] animate-drift text-2xl text-rose-400 opacity-50" style={{ animationDelay: '0s', animationDuration: '15s' }}>🖌️</div>
          <div className="hidden sm:block absolute left-[38%] animate-drift text-2xl text-amber-300 opacity-65" style={{ animationDelay: '3s', animationDuration: '16s' }}>🎨</div>
          <div className="hidden sm:block absolute left-[65%] animate-drift text-xl text-sky-400 opacity-60" style={{ animationDelay: '1s', animationDuration: '14s' }}>💧</div>
          <div className="absolute left-[84%] sm:left-[85%] animate-drift text-xl text-emerald-400 opacity-50" style={{ animationDelay: '6s', animationDuration: '18s' }}>✨</div>
        </>
      )}

      {category === 'everything' && (
        <>
          <div className="absolute left-[14%] animate-drift text-2xl text-purple-300 opacity-50" style={{ animationDelay: '0s', animationDuration: '15s' }}>🎵</div>
          <div className="hidden sm:block absolute left-[38%] animate-drift text-2xl text-amber-200 opacity-60" style={{ animationDelay: '3s', animationDuration: '17s' }}>📚</div>
          <div className="hidden sm:block absolute left-[66%] animate-drift text-2xl text-yellow-300 opacity-60" style={{ animationDelay: '1.5s', animationDuration: '16s' }}>🎨</div>
          <div className="absolute left-[84%] sm:left-[86%] animate-drift text-xl text-emerald-300 opacity-50" style={{ animationDelay: '5s', animationDuration: '18s' }}>🎲</div>
        </>
      )}

    </div>
  );
};
