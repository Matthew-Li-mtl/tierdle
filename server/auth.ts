// Shared helpers for tokens and for checking who is making a request.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import type { Session, SessionUser } from '../shared/types.js';
import { env } from './env.js';
import { RefreshToken } from './models.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser; // set by readUser when the request has a valid access token
    }
  }
}

const ACCESS_TOKEN_LIFETIME = '15m';
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_COOKIE = 'refreshToken';

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

// We store only a hash, so a leaked database does not hand out working tokens.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshCookieOptions() {
  return {
    httpOnly: true, // page JavaScript cannot read it, which limits the damage of an XSS bug
    secure: process.env.NODE_ENV === 'production', // HTTPS only once deployed
    sameSite: 'strict' as const, // browsers will not send it on requests from other sites
    path: '/api/auth', // sent only to the auth routes
  };
}

export function readRefreshCookie(req: Request): unknown {
  return req.cookies[REFRESH_COOKIE];
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

// Issues a new refresh token in a cookie, and returns a new access token.
// Pass `family` when rotating; leave it out to start a brand new sign-in.
export async function startSession(
  res: Response,
  user: { _id: Types.ObjectId; username: string },
  family: string = randomUUID(),
): Promise<Session> {
  const refreshToken = randomToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_TOKEN_MS });

  const id = user._id.toString();
  const accessToken = jwt.sign({ username: user.username }, env('JWT_SECRET'), {
    subject: id,
    expiresIn: ACCESS_TOKEN_LIFETIME,
    algorithm: 'HS256',
  });
  return { user: { id, username: user.username }, accessToken };
}

// Middleware: guests pass through with no req.user. A bad or expired token gets a 401,
// which tells the client to refresh and try again.
export function readUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(header.replace('Bearer ', ''), env('JWT_SECRET'), {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    req.user = { id: payload.sub!, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired.' });
  }
}

// Middleware: put this after readUser on routes that need a signed-in user.
export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  next();
}
