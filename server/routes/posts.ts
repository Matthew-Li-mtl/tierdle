import { Router } from 'express';
import mongoose from 'mongoose';
import {
  TIERS,
  type FeedResponse,
  type Item,
  type PostView,
  type Tiers,
  type TodayResponse,
} from '../../shared/types.js';
import { readUser, requireUser } from '../auth.js';
import { today } from '../day.js';
import { Like, Post, Prompt } from '../models.js';

const router = Router();

const PAGE_SIZE = 20;

// The shape of a post as the client sees it.
function toPostView(post: any, likedByMe: boolean): PostView {
  return {
    id: post._id.toString(),
    username: post.username,
    createdAt: post.createdAt.toISOString(),
    tiers: post.tiers,
    likeCount: post.likeCount,
    likedByMe,
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
    myPost: myPost ? toPostView(myPost, false) : null,
  };
  res.json(response);
});

router.get('/posts', readUser, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const sort: Record<string, -1> =
    req.query.sort === 'popular' ? { likeCount: -1, _id: -1 } : { createdAt: -1, _id: -1 };

  // Ask for one extra post: if it exists, there is another page.
  const found = await Post.find({ day: today() })
    .sort(sort)
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();
  const posts = found.slice(0, PAGE_SIZE);

  // Look up which of these posts the viewer has liked.
  const likes = req.user
    ? await Like.find({ user: req.user.id, post: { $in: posts.map((post) => post._id) } }).lean()
    : [];
  const likedIds = new Set(likes.map((like) => like.post.toString()));

  const response: FeedResponse = {
    posts: posts.map((post) => toPostView(post, likedIds.has(post._id.toString()))),
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
    res.status(201).json(toPostView(post, false));
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    res.status(409).json({ error: 'You already posted today.' });
  }
});

router.post('/posts/:id/like', readUser, requireUser, async (req, res) => {
  const { id } = req.params;
  const post = mongoose.isValidObjectId(id) ? await Post.findById(id) : null;
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (post.user.toString() === req.user!.id) {
    res.status(403).json({ error: 'You cannot like your own post.' });
    return;
  }

  try {
    await Like.create({ user: req.user!.id, post: post._id });
    post.likeCount += 1;
    await Post.updateOne({ _id: post._id }, { $inc: { likeCount: 1 } }); // $inc is safe when two users like at once
  } catch (error: any) {
    if (error.code !== 11000) throw error; // already liked, so there is nothing to do
  }
  res.json({ likeCount: post.likeCount, likedByMe: true });
});

router.delete('/posts/:id/like', readUser, requireUser, async (req, res) => {
  const { id } = req.params;
  const post = mongoose.isValidObjectId(id) ? await Post.findById(id) : null;
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const removed = await Like.findOneAndDelete({ user: req.user!.id, post: post._id });
  if (removed) {
    post.likeCount -= 1;
    await Post.updateOne({ _id: post._id }, { $inc: { likeCount: -1 } });
  }
  res.json({ likeCount: post.likeCount, likedByMe: false });
});

export default router;
