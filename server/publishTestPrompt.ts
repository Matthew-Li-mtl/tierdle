// TEMPORARY, for testing only: shows one list every day for the next 60 days.
// Usage: npm run test-prompt -- prompts/drafts/<file>.json
// Point MONGODB_URI at a test database when using this. Delete this file before launch.
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { Prompt } from './models.js';
import { readPromptFile } from './publishPrompt.js';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DAYS = 60;

const path = process.argv[2];
if (!path) throw new Error('Give the path of a list file that includes the community tiers.');
const { title, tiers, items, source, author } = readPromptFile(path);

await connectDb();
for (let i = 0; i < DAYS; i++) {
  const day = new Date(Date.now() + i * ONE_DAY).toISOString().slice(0, 10);
  await Prompt.updateOne({ day }, { day, title, tiers, items, source, author }, { upsert: true });
}
console.log(`"${title}" will show for the next ${DAYS} days.`);

await mongoose.disconnect();
