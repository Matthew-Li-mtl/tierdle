// The main page: today's tier list, then the feeds.
import { useEffect, useState } from 'react';
import type { PostView, TodayResponse } from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import Feed from '../components/Feed.js';
import TierBuilder from '../components/TierBuilder.js';
import TierRows from '../components/TierRows.js';

export default function Home() {
  const { user } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState('');
  const [postCount, setPostCount] = useState(0); // goes up after posting, which reloads the feed

  // Load again when the user signs in or out, because `myPost` depends on who is asking.
  useEffect(() => {
    api<TodayResponse>('/today')
      .then(setToday)
      .catch((caught) => setError(caught.message));
  }, [user?.id]);

  if (error) return <p className="error">{error}</p>;
  if (!today) return <p>Loading...</p>;

  const { prompt, myPost } = today;
  if (!prompt) return <p>There is no tier list today. Check back soon.</p>;

  function handlePosted(post: PostView) {
    setToday({ ...today!, myPost: post });
    setPostCount(postCount + 1);
  }

  return (
    <>
      <h1>{prompt.title}</h1>
      <p className="muted">A new tier list arrives every day at midnight UTC.</p>

      {myPost ? (
        <section>
          <h2>Your tier list</h2>
          <TierRows tiers={myPost.tiers} items={prompt.items} />
        </section>
      ) : (
        <TierBuilder prompt={prompt} onPosted={handlePosted} />
      )}

      <Feed key={`${user?.id}-${postCount}`} items={prompt.items} />

      <details className="credits">
        <summary>Image credits</summary>
        <ul>
          {prompt.items
            .filter((item) => item.credit)
            .map((item) => (
              <li key={item.slug}>
                {item.label}: {item.creditUrl ? <a href={item.creditUrl}>{item.credit}</a> : item.credit}
              </li>
            ))}
        </ul>
      </details>
    </>
  );
}
