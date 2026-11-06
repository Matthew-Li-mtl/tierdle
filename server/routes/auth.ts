import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  clearRefreshCookie,
  hashToken,
  randomToken,
  readRefreshCookie,
  startSession,
} from '../auth.js';
import { sendPasswordResetEmail } from '../email.js';
import { PasswordReset, RefreshToken, User } from '../models.js';
import { rateLimit } from '../rateLimit.js';

const router = Router();

const BCRYPT_COST = 10;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Request bodies come from strangers, so anything that is not a string becomes ''.
// This also stops MongoDB operators such as { "$ne": null } from reaching a query.
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (Buffer.byteLength(password) > 72) return 'Password is too long.'; // bcrypt's limit
  return null;
}

router.post('/signup', rateLimit('signup', 10, ONE_HOUR), async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const username = text(req.body?.username).toLowerCase();
  const password = req.body?.password;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores.' });
    return;
  }
  const problem = passwordProblem(password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await User.create({ email, username, passwordHash });
    res.status(201).json(await startSession(res, user));
  } catch (error: any) {
    if (error.code !== 11000) throw error; // 11000 is MongoDB's duplicate key error
    const field = error.keyPattern?.email ? 'email' : 'username';
    res.status(409).json({ error: `That ${field} is already taken.` });
  }
});

router.post('/signin', rateLimit('signin', 20, FIFTEEN_MINUTES), async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = req.body?.password;

  const user = await User.findOne({ email });
  const valid =
    user && typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    res.status(401).json({ error: 'Incorrect email or password.' });
    return;
  }
  res.json(await startSession(res, user));
});

// Refresh token rotation: each refresh token works once and is replaced by a new one.
router.post('/refresh', async (req, res) => {
  const token = readRefreshCookie(req);
  if (typeof token !== 'string') {
    res.json({ user: null, accessToken: null }); // a guest, which is not an error
    return;
  }
  const tokenHash = hashToken(token);

  // One atomic step: find an unused, unexpired token and mark it used.
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
  );
  const user = current && (await User.findById(current.user));

  if (!current || !user) {
    // A used token came back, so it may be stolen. End that whole sign-in on every device.
    const known = await RefreshToken.findOne({ tokenHash });
    if (known) await RefreshToken.deleteMany({ family: known.family });
    clearRefreshCookie(res);
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  res.json(await startSession(res, user, current.family));
});

router.post('/signout', async (req, res) => {
  const token = readRefreshCookie(req);
  if (typeof token === 'string') {
    const current = await RefreshToken.findOne({ tokenHash: hashToken(token) });
    if (current) await RefreshToken.deleteMany({ family: current.family });
  }
  clearRefreshCookie(res);
  res.json({ ok: true });
});

router.post('/forgot-password', rateLimit('forgot', 5, ONE_HOUR), async (req, res) => {
  const email = text(req.body?.email).toLowerCase();

  const user = await User.findOne({ email });
  if (user) {
    const token = randomToken();
    await PasswordReset.deleteMany({ user: user._id }); // only the newest link works
    await PasswordReset.create({
      user: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ONE_HOUR),
    });
    try {
      await sendPasswordResetEmail(email, token);
    } catch (error) {
      console.error('Could not send reset email', error);
    }
  }
  // The same answer every time, so this route cannot reveal who has an account.
  res.json({ ok: true });
});

router.post('/reset-password', rateLimit('reset', 20, ONE_HOUR), async (req, res) => {
  const token = text(req.body?.token);
  const password = req.body?.password;

  const problem = passwordProblem(password);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  // Deleting while finding means the link can only ever be used once.
  const reset = await PasswordReset.findOneAndDelete({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!reset) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await User.updateOne({ _id: reset.user }, { passwordHash });
  await RefreshToken.deleteMany({ user: reset.user }); // sign out everywhere
  res.json({ ok: true });
});

export default router;
