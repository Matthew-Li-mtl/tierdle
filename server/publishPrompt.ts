// Puts one approved day's list into the database. This is the only way content goes live.
// Usage: npm run publish-prompt -- prompts/2026-11-03.json
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { MAX_TIERS, MIN_TIERS } from '../shared/types.js';
import { today } from './day.js';
import { connectDb } from './db.js';
import { Attempt, Prompt } from './models.js';

function fail(message: string): never {
  throw new Error(message);
}

function isHttps(url: unknown): boolean {
  return typeof url === 'string' && url.startsWith('https://');
}

// Checks a list file and returns what to store. Also used by publishTestPrompt.ts.
export function readPromptFile(path: string) {
  const { day, title, tiers, items, source, author } = JSON.parse(readFileSync(path, 'utf8'));

  if (!title) fail('"title" is missing.');
  if (!Array.isArray(tiers) || tiers.length < MIN_TIERS || tiers.length > MAX_TIERS) {
    fail(`"tiers" must list ${MIN_TIERS} to ${MAX_TIERS} tier names, best first.`);
  }
  if (!tiers.every((name: unknown) => typeof name === 'string' && name.trim())) fail('Every tier needs a name.');
  if (!Array.isArray(items) || items.length < 2) fail('A tier list needs at least 2 items.');
  if (new Set(items.map((item: any) => item.slug)).size !== items.length) fail('Item slugs must be unique.');
  for (const item of items) {
    if (!item.slug || !item.label) fail('Every item needs a slug and a label.');
    if (!isHttps(item.imageUrl)) fail(`"${item.slug}" needs an https imageUrl.`);
    // The answer: which tier the community put this item in, counting from 0 at the top.
    if (!Number.isInteger(item.tier) || item.tier < 0 || item.tier >= tiers.length) {
      fail(`"${item.slug}" needs a "tier" from 0 to ${tiers.length - 1}.`);
    }
  }
  if (source !== undefined && (!source.label || !isHttps(source.url))) {
    fail('"source" needs a label and an https url, to credit where the ranking came from.');
  }
  if (author !== undefined && (!author.name || !isHttps(author.url))) {
    fail('"author" needs a name and an https url, to credit who made the original tier list.');
  }
  return { day, title, tiers, items, source, author };
}

// Run as a command (not when publishTestPrompt.ts imports readPromptFile).
if (process.argv[1]?.endsWith('publishPrompt.ts')) {
  const path = process.argv[2] ?? fail('Give the path of a prompt file.');
  const prompt = readPromptFile(path);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(prompt.day ?? '')) fail('"day" must look like YYYY-MM-DD.');
  if (prompt.day < today()) fail('That day has already passed.');

  // Scores are worked out against the answer when they are made, so changing a day that already
  // has guesses would leave those scores measuring a different list. Refuse it.
  await connectDb();
  if (await Attempt.exists({ day: prompt.day })) fail(`${prompt.day} already has guesses, so it cannot be changed.`);

  await Prompt.updateOne({ day: prompt.day }, prompt, { upsert: true });
  console.log(`Published "${prompt.title}" for ${prompt.day} with ${prompt.items.length} items.`);
  await mongoose.disconnect();
}
