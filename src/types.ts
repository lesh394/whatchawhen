export type WorkCategory = 'music' | 'books' | 'art';
export type Category = WorkCategory | 'everything';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'classic' | 'forever';
export type GamePhase = 'home' | 'playing' | 'revealing' | 'gameover';

export interface CulturalItem {
  id: string;
  category: WorkCategory;
  title: string;
  creator: string;
  year: number;
  wikiSlug: string;
  wikiPageId?: number;
  image: string;
  highResImage?: string;
  altCoverApplied?: boolean;
  genreOrMovement: string;
  hint1: string;
  hint2: string;
  creatorType: 'Artist' | 'Author' | 'Painter' | 'Band';
  itemType: 'Album' | 'Single' | 'Novel' | 'Play' | 'Painting' | 'Artwork';
  trivia: string;
  altTitles?: string[];
  altCreators?: string[];
  wikiExtract?: string;
}

export interface EasyRoundOptions {
  years: number[];
  identifications: {
    title: string;
    creator: string;
    label: string;
    isCorrect: boolean;
  }[];
}

export interface RoundGuess {
  yearGuess: number;
  rawGuess: string;
  hintsUsed: number;
  isEasyChoice?: boolean;
}

export interface RoundResult {
  item: CulturalItem;
  guess: RoundGuess;
  yearDelta: number;
  yearPoints: number;
  identificationPoints: number;
  creatorMatchAccuracy: 'exact' | 'partial' | 'none';
  titleMatchAccuracy: 'exact' | 'partial' | 'none';
  totalPoints: number;
  wikiExtract?: string;
  wikiUrl: string;
  wikiThumbnail?: string;
  
  // Forever Survival Mode mechanics
  damageTaken?: number;
  healed?: number;
  remainingHp?: number;
  
  // Streak & Difficulty metadata
  multiplierUsed?: number;
  newStreak?: number;
  difficultyUsed?: Difficulty;
  guessTier?: 'perfect' | 'half' | 'blunder';
}

export interface CategoryThemeConfig {
  id: Category;
  name: string;
  tagline: string;
  description: string;
  creatorLabel: string;
  titleLabel: string;
  yearRange: [number, number];
  woodBorder: string;
  bgTexture: string;
  accentColor: string;
  badgeBg: string;
  ambientIcon: string;
}
