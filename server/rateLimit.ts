import type { NextFunction, Request, Response } from 'express';
import { RateLimit } from './models.js';

// Middleware that limits one route per IP address.
// Attempts are counted in MongoDB, because serverless instances do not share memory.
export function rateLimit(name: string, max: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entry = await RateLimit.findOneAndUpdate(
      { key: `${name}:${req.ip}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + windowMs) } },
      { upsert: true, returnDocument: 'after' },
    );
    if (entry.count > max) {
      res.status(429).json({ error: 'Too many attempts. Please try again later.' });
      return;
    }
    next();
  };
}
