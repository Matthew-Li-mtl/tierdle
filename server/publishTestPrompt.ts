// TEMPORARY, for testing only: shows the fast food list every day for the next 60 days.
// Point MONGODB_URI at a test database when using this. Delete this file before launch.
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { Prompt } from './models.js';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DAYS = 60;

const { title, items } = JSON.parse(readFileSync('prompts/drafts/01-us-fast-food.json', 'utf8'));

await connectDb();
for (let i = 0; i < DAYS; i++) {
  const day = new Date(Date.now() + i * ONE_DAY).toISOString().slice(0, 10);
  await Prompt.updateOne({ day }, { day, title, items }, { upsert: true });
}
console.log(`"${title}" will show for the next ${DAYS} days.`);

await mongoose.disconnect();
