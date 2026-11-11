import { CulturalItem, Difficulty, RoundGuess, RoundResult } from '../types';

export interface TimeguessrDifficultyProfile {
  yearHalfLifeK: number;
  maxYearDelta: number;
  bothExactIdPoints: number;
  titleExactIdPoints: number;
  creatorExactIdPoints: number;
  partialIdPoints: number;
  perfectHeal: number;
  blunderDamage: number;
  damageDivisor: number;
  minHalfDamage: number;
}

/**
 * TimeGuessr-inspired scoring curves (max 5,000 Year + 5,000 Identification = 10,000 per round),
 * scaling increasingly harsher across Easy -> Normal -> Hard difficulty levels:
 *
 * Year Formula: round( 5000 / (1 + (yearDelta / k)^2) ), zeroed out beyond maxYearDelta.
 * - Easy:   k = 12 (classic TimeGuessr 50% at 12 yrs), cutoff > 25 yrs, generous partial ID credit
 * - Normal: k = 6  (2x harsher: 50% at 6 yrs), cutoff > 15 yrs, stricter ID credit
 * - Hard:   k = 3  (4x harsher: 50% at 3 yrs), cutoff > 8 yrs, ZERO partial fuzzy ID credit
 */
export const TIMEGUESSR_DIFFICULTY_PROFILES: Record<Difficulty, TimeguessrDifficultyProfile> = {
  easy: {
    yearHalfLifeK: 12,
    maxYearDelta: 25,
    bothExactIdPoints: 5000,
    titleExactIdPoints: 4000,
    creatorExactIdPoints: 2500,
    partialIdPoints: 1500,
    perfectHeal: 15,
    blunderDamage: 25,
    damageDivisor: 450,
    minHalfDamage: 5,
  },
  normal: {
    yearHalfLifeK: 6,
    maxYearDelta: 15,
    bothExactIdPoints: 5000,
    titleExactIdPoints: 3500,
    creatorExactIdPoints: 2000,
    partialIdPoints: 750,
    perfectHeal: 12,
    blunderDamage: 35,
    damageDivisor: 330,
    minHalfDamage: 10,
  },
  hard: {
    yearHalfLifeK: 3,
    maxYearDelta: 8,
    bothExactIdPoints: 5000,
    titleExactIdPoints: 2500,
    creatorExactIdPoints: 1250,
    partialIdPoints: 0,
    perfectHeal: 10,
    blunderDamage: 45,
    damageDivisor: 250,
    minHalfDamage: 15,
  },
};

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^the\s+/, '')
    .replace(/^(a|an)\s+/, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeepLeadingArticle(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholeTarget(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (haystack === needle) return true;
  if (needle.length < 2) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(needle)}(?:\\s|$)`);
  return pattern.test(haystack);
}

export function checkMatch(
  guess: string,
  target: string,
  aliases: string[] = []
): 'exact' | 'partial' | 'none' {
  const normGuess = normalizeString(guess);
  const rawGuessNorm = normalizeKeepLeadingArticle(guess);
  if (!normGuess && !rawGuessNorm) return 'none';

  const targets = Array.from(
    new Set(
      [target, ...aliases]
        .flatMap(t => [normalizeString(t), normalizeKeepLeadingArticle(t)])
        .filter(Boolean)
    )
  );

  // 1. Exact full string OR exact whole phrase contained inside a combined guess (e.g. "Title - Creator")
  for (const t of targets) {
    if (
      normGuess === t ||
      rawGuessNorm === t ||
      containsWholeTarget(normGuess, t) ||
      containsWholeTarget(rawGuessNorm, t)
    ) {
      return 'exact';
    }
  }

  // 2. Partial word/substring match
  for (const t of targets) {
    if (normGuess.length >= 4 && t.includes(normGuess)) {
      return 'partial';
    }
    if (t.length >= 4 && normGuess.includes(t)) {
      return 'partial';
    }
    const targetWords = t.split(/\s+/).filter(w => w.length >= 4);
    const guessWords = normGuess.split(/\s+/).filter(w => w.length >= 4);
    if (
      targetWords.some(tw =>
        guessWords.some(gw => gw === tw || (gw.length >= 5 && tw.includes(gw)) || tw.includes(gw))
      )
    ) {
      return 'partial';
    }
  }

  return 'none';
}

/**
 * TimeGuessr inverse-square decay formula scaled harshly by difficulty level.
 * Returns between 0 and 5,000 points.
 */
export function calculateTimeguessrYearPoints(
  yearDelta: number,
  difficulty: Difficulty = 'normal'
): number {
  const profile = TIMEGUESSR_DIFFICULTY_PROFILES[difficulty];
  if (yearDelta === 0) return 5000;
  if (yearDelta > profile.maxYearDelta) return 0;

  const score = Math.round(5000 / (1 + (yearDelta / profile.yearHalfLifeK) ** 2));
  return Math.max(0, Math.min(5000, score));
}

export function evaluateRound(
  item: CulturalItem,
  guess: RoundGuess,
  currentHp: number = 100,
  streakCount: number = 0,
  difficulty: Difficulty = 'normal'
): Omit<RoundResult, 'wikiExtract' | 'wikiUrl' | 'wikiThumbnail'> & {
  newStreak: number;
  multiplierUsed: number;
} {
  const profile = TIMEGUESSR_DIFFICULTY_PROFILES[difficulty];
  const yearDelta = Math.abs(guess.yearGuess - item.year);
  const yearPoints = calculateTimeguessrYearPoints(yearDelta, difficulty);

  // Check creator & title match
  let creatorMatch = checkMatch(guess.rawGuess, item.creator, item.altCreators);
  let titleMatch = checkMatch(guess.rawGuess, item.title, item.altTitles);

  // If Easy Mode selected card matches item
  if (guess.isEasyChoice) {
    const normGuess = normalizeString(guess.rawGuess);
    const normTitle = normalizeString(item.title);
    const normCreator = normalizeString(item.creator);

    if (
      normGuess &&
      (containsWholeTarget(normGuess, normTitle) ||
        containsWholeTarget(normGuess, normCreator) ||
        normGuess.includes(normTitle))
    ) {
      creatorMatch = 'exact';
      titleMatch = 'exact';
    } else {
      creatorMatch = 'none';
      titleMatch = 'none';
    }
  }

  let identificationPoints = 0;
  if (creatorMatch === 'exact' && titleMatch === 'exact') {
    identificationPoints = profile.bothExactIdPoints;
  } else if (titleMatch === 'exact') {
    identificationPoints = profile.titleExactIdPoints;
  } else if (creatorMatch === 'exact') {
    identificationPoints = profile.creatorExactIdPoints;
  } else if (creatorMatch === 'partial' || titleMatch === 'partial') {
    identificationPoints = profile.partialIdPoints;
  } else {
    identificationPoints = 0;
  }

  // TimeGuessr cap: 5,000 Year + 5,000 ID = 10,000 max per round (50,000 max in 5-round Classic)
  const totalPoints = yearPoints + identificationPoints;

  // Outcome tiers:
  // 1. 'perfect': Full 10,000 / 10,000 bullseye
  // 2. 'blunder': Strictly 0 pts total
  // 3. 'half': Scored points on year and/or identification below 10,000
  let guessTier: 'perfect' | 'half' | 'blunder' = 'half';
  if (totalPoints === 10000) {
    guessTier = 'perfect';
  } else if (totalPoints === 0) {
    guessTier = 'blunder';
  }

  // Perfect Streak tracker (for badge / pride; does not inflate score past 10,000)
  let newStreak = streakCount;
  if (guessTier === 'perfect') {
    newStreak = streakCount + 1;
  } else if (guessTier === 'blunder') {
    newStreak = 0;
  }

  // Forever Survival Mode Damage / Healing (scales harsher per difficulty level)
  let damageTaken = 0;
  let healed = 0;

  if (guessTier === 'perfect') {
    healed = profile.perfectHeal;
    damageTaken = 0;
  } else if (guessTier === 'blunder') {
    damageTaken = profile.blunderDamage;
  } else {
    const missedPoints = Math.max(0, 10000 - totalPoints);
    damageTaken = Math.max(
      profile.minHalfDamage,
      Math.round(missedPoints / profile.damageDivisor)
    );
  }

  const remainingHp = Math.min(100, Math.max(0, currentHp - damageTaken + healed));

  return {
    item,
    guess,
    yearDelta,
    yearPoints,
    identificationPoints,
    creatorMatchAccuracy: creatorMatch,
    titleMatchAccuracy: titleMatch,
    totalPoints,
    damageTaken,
    healed,
    remainingHp,
    newStreak,
    multiplierUsed: 1,
    difficultyUsed: difficulty,
    guessTier,
  };
}
