// Builds the Express app. dev.ts runs it locally, and api/index.ts runs it on Vercel.
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';

const app = express();

app.set('trust proxy', 1); // Vercel's proxy tells us the visitor's real IP address
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api', async (_req, _res, next) => {
  await connectDb();
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api', postRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Express sends any error thrown in a route here. Details stay in the logs, not the response.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default app;
