// Used by both the server and the client, so the two always agree on the shape of the data.

// A list can have from 2 to 10 tiers, matching what TierMaker templates use.
export const MIN_TIERS = 2;
export const MAX_TIERS = 10;

export interface Item {
  slug: string;
  label: string;
  imageUrl: string;
  credit?: string;
  creditUrl?: string;
}

// Today's list, as the browser sees it. The answer (each item's community tier) is never included.
export interface Prompt {
  day: string;
  title: string;
  tiers: string[]; // tier names, best first, such as ["S", "A", "B", "C", "D"]
  items: Item[];
  source?: { label: string; url: string }; // where the community ranking came from
  author?: { name: string; url: string }; // who made the original tier list template
}

// Where each item was placed: item slug -> tier index (0 is the top tier).
export type Placements = Record<string, number>;

export interface Score {
  points: number;
  maxPoints: number;
  accuracy: number; // points / maxPoints, from 0 to 1
}

// The scoring rule. Every item starts worth one point per tier, and loses one point
// for each tier it is away from the community's tier.
// Example with 5 tiers: an item placed in B when the community put it in S is 2 tiers off,
// so it scores 5 - 2 = 3 of its 5 points.
export function scoreGuess(guess: Placements, answer: Placements, tierCount: number): Score {
  const slugs = Object.keys(answer);
  const maxPoints = tierCount * slugs.length;
  const lost = slugs.reduce((total, slug) => total + Math.abs(guess[slug] - answer[slug]), 0);
  const points = maxPoints - lost;
  return { points, maxPoints, accuracy: maxPoints === 0 ? 0 : points / maxPoints };
}

// How one tier of a guess did: of the items placed in it, how many the community also put there.
export interface TierResult {
  correct: number;
  placed: number;
}

// One result per tier, in tier order. Example: 5 items placed in A, 4 of them A in the answer,
// gives { correct: 4, placed: 5 }, shown as 80%.
export function tierResults(guess: Placements, answer: Placements, tierCount: number): TierResult[] {
  const results = Array.from({ length: tierCount }, () => ({ correct: 0, placed: 0 }));
  for (const slug of Object.keys(answer)) {
    const tier = guess[slug];
    results[tier].placed += 1;
    if (tier === answer[slug]) results[tier].correct += 1;
  }
  return results;
}

// A score plus how each tier did. This is what checking a guess returns.
export interface GuessScore extends Score {
  tierResults: TierResult[];
}

// Everyone gets this many guesses at each day's list.
export const MAX_GUESSES = 7;

// One guess at today's list, with its arrangement so it can be restored.
// Signed-in users' guesses come from the server; guests' are kept in their browser.
export interface GuessRecord extends GuessScore {
  number: number; // 1 to MAX_GUESSES
  placements: Placements;
  createdAt: string;
}

// One saved guess, for the history page.
export interface AttemptView extends Score {
  id: string;
  day: string;
  title: string;
  createdAt: string;
}

export interface TodayResponse {
  day: string;
  prompt: Prompt | null;
  guesses: GuessRecord[]; // the signed-in viewer's guesses today, oldest first; empty for guests
}

export interface GuessResponse {
  score: GuessScore;
  guesses: GuessRecord[]; // after saving this guess; empty for guests, whose browser keeps their own
}

export interface HistoryResponse {
  attempts: AttemptView[];
  hasMore: boolean;
}

export interface SessionUser {
  id: string;
  username: string;
}

export interface Session {
  user: SessionUser | null;
  accessToken: string | null;
}
