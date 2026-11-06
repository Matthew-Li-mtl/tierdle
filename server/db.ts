import mongoose from 'mongoose';
import { env } from './env.js';

let connection: Promise<typeof mongoose> | null = null;

// A serverless function can handle many requests before it shuts down,
// so we connect once and reuse that connection instead of reconnecting per request.
export function connectDb() {
  if (!connection) {
    connection = mongoose.connect(env('MONGODB_URI'), { maxPoolSize: 5 }).catch((error) => {
      connection = null; // let the next request try again
      throw error;
    });
  }
  return connection;
}
