// Used by both the server and the client, so the two always agree on the shape of the data.

export const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;
export type Tier = (typeof TIERS)[number];
export type Tiers = Record<Tier, string[]>; // each tier holds a list of item slugs, best first

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
  likeCount: number;
  likedByMe: boolean;
}

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
