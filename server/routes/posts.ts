import { Router } from 'express';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import {
  RATING_POINTS,
  TIERS,
  isTier,
  type FeedResponse,
  type Item,
  type PostView,
  type RatingResult,
  type Tier,
  type Tiers,
  type TodayResponse,
} from '../../shared/types.js';
import { readUser, requireUser } from '../auth.js';
import { today } from '../day.js';
import { Post, Prompt, Rating } from '../models.js';

const router = Router();

const PAGE_SIZE = 20;

// The shape of a post as the client sees it.
// Older posts may lack the SS and F tiers or rating counts, so those are filled in as empty.
// The points score is deliberately left out: it only orders the popular feed.
function ratingCountsOf(post: any): Record<Tier, number> {
  return Object.fromEntries(TIERS.map((tier) => [tier, post?.ratingCounts?.[tier] ?? 0])) as Record<Tier, number>;
}

function toPostView(post: any, myRating: Tier | null): PostView {
  const tiers = Object.fromEntries(TIERS.map((tier) => [tier, post.tiers?.[tier] ?? []])) as Tiers;
  return {
    id: post._id.toString(),
    username: post.username,
    createdAt: post.createdAt.toISOString(),
    tiers,
    ratingCounts: ratingCountsOf(post),
    myRating,
  };
}

// A list may leave items out, but it needs at least one item,
// and every item must belong to today's list and appear only once.
function isValidList(tiers: any, slugs: string[]): tiers is Tiers {
  if (typeof tiers !== 'object' || tiers === null) return false;
  if (!TIERS.every((tier) => Array.isArray(tiers[tier]))) return false;
  const placed = TIERS.flatMap((tier) => tiers[tier]);
  return (
    placed.length > 0 &&
    new Set(placed).size === placed.length &&
    placed.every((slug) => slugs.includes(slug))
  );
}

router.get('/today', readUser, async (req, res) => {
  const day = today();
  const prompt = await Prompt.findOne({ day }).lean();
  const myPost = req.user && (await Post.findOne({ user: req.user.id, day }).lean());

  const response: TodayResponse = {
    day,
    prompt: prompt && { day: prompt.day, title: prompt.title, items: prompt.items as Item[] },
    myPost: myPost ? toPostView(myPost, null) : null,
  };
  res.json(response);
});

router.get('/posts', readUser, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const sort: Record<string, -1> =
    req.query.sort === 'popular' ? { score: -1, _id: -1 } : { createdAt: -1, _id: -1 };

  // Ask for one extra post: if it exists, there is another page.
  const found = await Post.find({ day: today() })
    .sort(sort)
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();
  const posts = found.slice(0, PAGE_SIZE);

  // Look up how the viewer rated these posts, in one query.
  const ratings = req.user
    ? await Rating.find({ user: req.user.id, post: { $in: posts.map((post) => post._id) } }).lean()
    : [];
  const myRatings = new Map(ratings.map((rating) => [rating.post.toString(), rating.tier as Tier]));

  const response: FeedResponse = {
    posts: posts.map((post) => toPostView(post, myRatings.get(post._id.toString()) ?? null)),
    hasMore: found.length > PAGE_SIZE,
  };
  res.json(response);
});

router.post('/posts', readUser, requireUser, async (req, res) => {
  const day = today();
  const { tiers } = req.body ?? {};

  // The list was built for an earlier day if midnight UTC passed while the user was working on it.
  if (req.body?.day !== day) {
    res.status(409).json({ error: 'A new tier list has started. Please reload the page.' });
    return;
  }
  const prompt = await Prompt.findOne({ day }).lean();
  if (!prompt) {
    res.status(404).json({ error: 'There is no tier list today.' });
    return;
  }
  if (!isValidList(tiers, prompt.items.map((item) => item.slug))) {
    res.status(400).json({ error: 'Place at least one item in a tier before posting.' });
    return;
  }

  try {
    const post = await Post.create({
      user: req.user!.id,
      username: req.user!.username,
      day,
      tiers,
    });
    res.status(201).json(toPostView(post, null));
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    res.status(409).json({ error: 'You already posted today.' });
  }
});

// Finds the post a rating route is about, or replies 404.
async function findPost(req: Request, res: Response) {
  const id = String(req.params.id);
  const post = mongoose.isValidObjectId(id) ? await Post.findById(id).lean() : null;
  if (!post) res.status(404).json({ error: 'Post not found.' });
  return post;
}

// Moves one rating out of tier `from` and into tier `to` (either may be null), adjusting
// the hidden score and the per-tier counts. $inc is safe when several people rate at once,
// because the database does the addition.
async function adjustScore(postId: unknown, from: Tier | null, to: Tier | null) {
  const inc: Record<string, number> = {};
  if (from !== to) {
    inc.score = (to ? RATING_POINTS[to] : 0) - (from ? RATING_POINTS[from] : 0);
    if (from) inc[`ratingCounts.${from}`] = -1;
    if (to) inc[`ratingCounts.${to}`] = 1;
  }
  // The same rating again, or removing one that does not exist, changes nothing.
  const updated =
    from === to
      ? await Post.findById(postId).lean()
      : await Post.findByIdAndUpdate(postId, { $inc: inc }, { new: true }).lean();
  const result: RatingResult = { ratingCounts: ratingCountsOf(updated), myRating: to };
  return result;
}

// Rates a post, or changes an earlier rating. Body: { tier: "SS" | "S" | ... | "F" }.
router.put('/posts/:id/rating', readUser, requireUser, async (req, res) => {
  const tier = req.body?.tier;
  if (!isTier(tier)) {
    res.status(400).json({ error: 'Choose a rating from SS to F.' });
    return;
  }
  const post = await findPost(req, res);
  if (!post) return;
  if (post.user.toString() === req.user!.id) {
    res.status(403).json({ error: 'You cannot rate your own post.' });
    return;
  }

  // One atomic step that saves the new rating and returns the old one (null if this is the first),
  // so two requests at once cannot both count as a first rating.
  const previous = await Rating.findOneAndUpdate(
    { user: req.user!.id, post: post._id },
    { tier },
    { upsert: true, new: false },
  ).lean();
  res.json(await adjustScore(post._id, (previous?.tier as Tier | undefined) ?? null, tier));
});

// Removes the viewer's rating. Doing it twice is harmless.
router.delete('/posts/:id/rating', readUser, requireUser, async (req, res) => {
  const post = await findPost(req, res);
  if (!post) return;

  const removed = await Rating.findOneAndDelete({ user: req.user!.id, post: post._id }).lean();
  res.json(await adjustScore(post._id, (removed?.tier as Tier | undefined) ?? null, null));
});

export default router;
