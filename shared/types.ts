// Used by both the server and the client, so the two always agree on the shape of the data.

export const TIERS = ['SS', 'S', 'A', 'B', 'C', 'D', 'F'] as const;
export type Tier = (typeof TIERS)[number];
export type Tiers = Record<Tier, string[]>; // each tier holds a list of item slugs, best first

// Points one rating adds to a post's score. Popular sorts by the total.
// The score stays on the server: it is never sent to the browser or shown.
export const RATING_POINTS: Record<Tier, number> = { SS: 15, S: 12, A: 9, B: 8, C: 6, D: 9, F: 15 };

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

export interface Item {
  slug: string;
  label: string;
  imageUrl: string;
  credit?: string;
  creditUrl?: string;
}

export interface Prompt {
  day: string;
  title: string;
  items: Item[];
}

export interface PostView {
  id: string;
  username: string;
  createdAt: string;
  tiers: Tiers;
  ratingCounts: Record<Tier, number>; // how many people gave each rating
  myRating: Tier | null; // the viewer's rating, or null for guests, the author, and unrated posts
}

// What the rating routes reply with.
export type RatingResult = Pick<PostView, 'ratingCounts' | 'myRating'>;

export interface TodayResponse {
  day: string;
  prompt: Prompt | null;
  myPost: PostView | null;
}

export interface FeedResponse {
  posts: PostView[];
  hasMore: boolean;
}

export type FeedSort = 'recent' | 'popular';

export interface SessionUser {
  id: string;
  username: string;
}

export interface Session {
  user: SessionUser | null;
  accessToken: string | null;
}
