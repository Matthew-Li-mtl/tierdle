// Today's list, scoring guesses, and each user's history of attempts.
import { Router } from 'express';
import {
  MAX_GUESSES,
  scoreGuess,
  tierResults,
  type AttemptView,
  type GuessRecord,
  type GuessResponse,
  type GuessScore,
  type HistoryResponse,
  type Item,
  type Placements,
  type Prompt as PromptView,
  type TodayResponse,
} from '../../shared/types.js';
import { readUser, requireUser } from '../auth.js';
import { today } from '../day.js';
import { Attempt, Prompt } from '../models.js';
import { rateLimit } from '../rateLimit.js';

const router = Router();

const PAGE_SIZE = 20;
const ONE_HOUR = 60 * 60 * 1000;

// What the browser may see of a list. Each item's `tier` is the answer, so it is left out.
function toPromptView(prompt: any): PromptView {
  return {
    day: prompt.day,
    title: prompt.title,
    tiers: prompt.tiers,
    items: prompt.items.map(({ slug, label, imageUrl, credit, creditUrl }: Item) => ({
      slug,
      label,
      imageUrl,
      credit,
      creditUrl,
    })),
    source: prompt.source?.url ? { label: prompt.source.label, url: prompt.source.url } : undefined,
    author: prompt.author?.url ? { name: prompt.author.name, url: prompt.author.url } : undefined,
  };
}

function toAttemptView(attempt: any): AttemptView {
  return {
    id: attempt._id.toString(),
    day: attempt.day,
    title: attempt.title,
    points: attempt.points,
    maxPoints: attempt.maxPoints,
    accuracy: attempt.maxPoints === 0 ? 0 : attempt.points / attempt.maxPoints,
    createdAt: attempt.createdAt.toISOString(),
  };
}

// The answer: item slug -> the community's tier.
function answerOf(prompt: any): Placements {
  return Object.fromEntries(prompt.items.map((item: any) => [item.slug, item.tier]));
}

// The signed-in viewer's guesses today, oldest first, with their arrangements so any can be restored,
// and how each tier did, worked out again from the answer.
// Guests get an empty list without touching the database: their browser keeps their guesses.
async function guessesToday(userId: string | undefined, prompt: any): Promise<GuessRecord[]> {
  if (!userId || !prompt) return [];
  const answer = answerOf(prompt);
  const attempts = await Attempt.find({ user: userId, day: prompt.day }).sort({ createdAt: 1, _id: 1 }).lean();
  return attempts.map((attempt, index) => {
    const placements = Object.fromEntries(Object.entries(attempt.placements ?? {})) as Placements;
    return {
      number: attempt.number ?? index + 1, // attempts saved before numbering existed go by their order
      placements,
      tierResults: tierResults(placements, answer, prompt.tiers.length),
      points: attempt.points,
      maxPoints: attempt.maxPoints,
      accuracy: attempt.maxPoints === 0 ? 0 : attempt.points / attempt.maxPoints,
      createdAt: attempt.createdAt.toISOString(),
    };
  });
}

// A guess must place every item of today's list exactly once, in a tier that exists.
// Partial guesses are refused because the score compares every item.
function isValidGuess(placements: any, slugs: string[], tierCount: number): placements is Placements {
  if (typeof placements !== 'object' || placements === null || Array.isArray(placements)) return false;
  const keys = Object.keys(placements);
  return (
    keys.length === slugs.length &&
    slugs.every((slug) => Number.isInteger(placements[slug])) &&
    slugs.every((slug) => placements[slug] >= 0 && placements[slug] < tierCount)
  );
}

router.get('/today', readUser, async (req, res) => {
  const day = today();
  const prompt = await Prompt.findOne({ day }).lean();
  const response: TodayResponse = {
    day,
    prompt: prompt && toPromptView(prompt),
    guesses: await guessesToday(req.user?.id, prompt),
  };
  res.json(response);
});

// Scores a guess. Anyone can guess; signed-in users also get the guess saved, up to MAX_GUESSES a day.
// Guests' limit is kept by their browser, since without an account there is nothing to count against.
// The rate limit stops a script from scoring guess after guess to find the answer.
router.post('/guesses', rateLimit('guess', 120, ONE_HOUR), readUser, async (req, res) => {
  const day = today();

  // The guess was made for an earlier day if midnight UTC passed while the user was working on it.
  if (req.body?.day !== day) {
    res.status(409).json({ error: 'A new tier list has started. Please reload the page.' });
    return;
  }
  const prompt = await Prompt.findOne({ day }).lean();
  if (!prompt) {
    res.status(404).json({ error: 'There is no tier list today.' });
    return;
  }
  const placements = req.body?.placements;
  const slugs = prompt.items.map((item) => item.slug);
  if (!isValidGuess(placements, slugs, prompt.tiers.length)) {
    res.status(400).json({ error: 'Place every item in a tier before checking your guess.' });
    return;
  }

  const answer = answerOf(prompt);
  const score: GuessScore = {
    ...scoreGuess(placements, answer, prompt.tiers.length),
    tierResults: tierResults(placements, answer, prompt.tiers.length),
  };

  if (req.user) {
    const used = await Attempt.countDocuments({ user: req.user.id, day });
    if (used >= MAX_GUESSES) {
      res.status(409).json({ error: `You have used all ${MAX_GUESSES} guesses today.` });
      return;
    }
    try {
      await Attempt.create({
        user: req.user.id,
        day,
        number: used + 1,
        title: prompt.title,
        placements,
        points: score.points,
        maxPoints: score.maxPoints,
      });
    } catch (error: any) {
      // Another guess took this number a moment earlier (the unique index), such as a double click.
      if (error.code !== 11000) throw error;
      res.status(409).json({ error: 'That guess was already counted. Please reload the page.' });
      return;
    }
  }
  const response: GuessResponse = { score, guesses: await guessesToday(req.user?.id, prompt) };
  res.json(response);
});

// Every attempt the signed-in user has made, newest first, 20 per page.
router.get('/history', readUser, requireUser, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);

  // Ask for one extra attempt: if it exists, there is another page.
  const found = await Attempt.find({ user: req.user!.id })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();

  const response: HistoryResponse = {
    attempts: found.slice(0, PAGE_SIZE).map(toAttemptView),
    hasMore: found.length > PAGE_SIZE,
  };
  res.json(response);
});

export default router;
