// Every MongoDB collection in the app is defined in this one file.
import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
});
export const User = mongoose.model('User', userSchema);

const itemSchema = new Schema(
  {
    slug: { type: String, required: true },
    label: { type: String, required: true },
    imageUrl: { type: String, required: true },
    credit: String,
    creditUrl: String,
    tier: { type: Number, required: true }, // the community's tier: the answer, never sent to the browser
  },
  { _id: false },
);

const promptSchema = new Schema({
  day: { type: String, required: true, unique: true }, // "YYYY-MM-DD" in UTC
  title: { type: String, required: true },
  tiers: { type: [String], required: true }, // tier names, best first
  items: { type: [itemSchema], required: true },
  source: { label: String, url: String }, // credit for the community ranking
  author: { name: String, url: String }, // credit for whoever made the original template
});
export const Prompt = mongoose.model('Prompt', promptSchema);

// One guess by a signed-in user. Each user gets MAX_GUESSES per day, numbered from 1.
const attemptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true },
    number: { type: Number, required: true }, // 1 for the day's first guess, and so on
    title: { type: String, required: true }, // copied from the prompt so history needs no join
    placements: { type: Map, of: Number, required: true }, // item slug -> tier index
    points: { type: Number, required: true },
    maxPoints: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
attemptSchema.index({ user: 1, createdAt: -1, _id: -1 }); // the history page
// One guess per number per user per day. Two requests at once cannot both become guess 7,
// so nobody gets an 8th. Attempts saved before numbering existed are left out of the rule.
attemptSchema.index(
  { user: 1, day: 1, number: 1 },
  { unique: true, partialFilterExpression: { number: { $exists: true } } },
);
export const Attempt = mongoose.model('Attempt', attemptSchema);

const refreshTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true }, // shared by all tokens from one sign-in
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }, // MongoDB deletes the document after this time
});
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

const passwordResetSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const RateLimit = mongoose.model('RateLimit', rateLimitSchema);
