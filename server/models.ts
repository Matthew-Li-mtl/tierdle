// Every MongoDB collection in the app is defined in this one file.
import mongoose, { Schema } from 'mongoose';
import { TIERS } from '../shared/types.js';

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
  },
  { _id: false },
);

const promptSchema = new Schema({
  day: { type: String, required: true, unique: true }, // "YYYY-MM-DD" in UTC
  title: { type: String, required: true },
  items: { type: [itemSchema], required: true },
});
export const Prompt = mongoose.model('Prompt', promptSchema);

const postSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true }, // copied from User so feeds need no join
    day: { type: String, required: true },
    tiers: {
      SS: [String],
      S: [String],
      A: [String],
      B: [String],
      C: [String],
      D: [String],
      F: [String],
    },
    // Copies of what the ratings add up to, so feeds need no counting.
    // score is the points total the popular feed sorts by. It is never sent to the browser.
    score: { type: Number, default: 0 },
    ratingCounts: Object.fromEntries(TIERS.map((tier) => [tier, { type: Number, default: 0 }])),
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
postSchema.index({ user: 1, day: 1 }, { unique: true }); // one post per user per day
postSchema.index({ day: 1, createdAt: -1, _id: -1 }); // the recent feed
postSchema.index({ day: 1, score: -1, _id: -1 }); // the popular feed
export const Post = mongoose.model('Post', postSchema);

const ratingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  tier: { type: String, enum: TIERS, required: true },
});
ratingSchema.index({ user: 1, post: 1 }, { unique: true }); // one rating per user per post
export const Rating = mongoose.model('Rating', ratingSchema);

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
