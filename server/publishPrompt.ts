// Puts one approved day's tier list into the database. This is the only way content goes live.
// Usage: npm run publish-prompt -- prompts/2026-11-03.json
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import type { Prompt as PromptData } from '../shared/types.js';
import { today } from './day.js';
import { connectDb } from './db.js';
import { Post, Prompt } from './models.js';

function fail(message: string): never {
  throw new Error(message);
}

function isHttps(url: unknown): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

const path = process.argv[2] ?? fail('Give the path of a prompt file.');
const { day, title, items }: PromptData = JSON.parse(readFileSync(path, 'utf8'));

if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail('"day" must look like YYYY-MM-DD.');
if (day < today()) fail('That day has already passed.');
if (!title) fail('"title" is missing.');
if (!Array.isArray(items) || items.length < 2) fail('A tier list needs at least 2 items.');
if (new Set(items.map((item) => item.slug)).size !== items.length) fail('Item slugs must be unique.');
for (const item of items) {
  if (!item.slug || !item.label) fail('Every item needs a slug and a label.');
  if (!isHttps(item.imageUrl)) fail(`"${item.slug}" needs an https imageUrl.`);
}

await connectDb();
if (await Post.exists({ day })) fail(`${day} already has posts, so it cannot be changed.`);

await Prompt.updateOne({ day }, { day, title, items }, { upsert: true });
console.log(`Published "${title}" for ${day} with ${items.length} items.`);

await mongoose.disconnect();
