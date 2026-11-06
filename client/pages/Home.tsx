// The main page: today's tier list, then the feeds.
import { useEffect, useState } from 'react';
import { TIERS, type PostView, type Tiers, type TodayResponse } from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import Feed from '../components/Feed.js';
import TierBuilder from '../components/TierBuilder.js';
import TierRows from '../components/TierRows.js';

export default function Home() {
  const { user } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [error, setError] = useState('');
  const [postCount, setPostCount] = useState(0); // goes up after posting or deleting, which reloads the feed
  const [editingFrom, setEditingFrom] = useState<Tiers | undefined>(); // the deleted list, to start the builder from
  const [editError, setEditError] = useState('');
  const [busy, setBusy] = useState(false);

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
    setEditingFrom(undefined);
    setPostCount(postCount + 1);
  }

  // Editing deletes the post and its ratings, so ask first, every time.
  async function handleEdit(post: PostView) {
    const ratings = TIERS.reduce((total, tier) => total + post.ratingCounts[tier], 0);
    const lost = ratings === 1 ? 'its 1 rating' : `all ${ratings} of its ratings`;
    const ok = window.confirm(
      `Editing deletes your posted tier list and ${lost}. This cannot be undone.\n\n` +
        'Your list will open in the editor so you can change it and post it again.',
    );
    if (!ok) return;

    setEditError('');
    setBusy(true);
    try {
      await api(`/posts/${post.id}`, 'DELETE');
      setEditingFrom(post.tiers);
      setToday({ ...today!, myPost: null });
      setPostCount(postCount + 1);
    } catch (caught) {
      setEditError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{prompt.title}</h1>
      <p className="muted">New tier list at midnight UTC!</p>

      {myPost ? (
        <section>
          <h2>Your tier list</h2>
          <TierRows tiers={myPost.tiers} items={prompt.items} />
          <button className="button" disabled={busy} onClick={() => handleEdit(myPost)}>
            Edit my tier list
          </button>
          {editError && <p className="error">{editError}</p>}
        </section>
      ) : (
        <TierBuilder prompt={prompt} onPosted={handlePosted} startFrom={editingFrom} />
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
