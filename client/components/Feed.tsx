// The two feeds of today's posts, and the rating buttons. Anyone can read; rating needs an account.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TIERS,
  type FeedResponse,
  type FeedSort,
  type Item,
  type PostView,
  type RatingResult,
  type Tier,
} from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import TierRows from './TierRows.js';

export default function Feed({ items }: { items: Item[] }) {
  const [sort, setSort] = useState<FeedSort>('recent');
  const [posts, setPosts] = useState<PostView[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false; // ignore this answer if the user has already switched feeds

    api<FeedResponse>(`/posts?sort=${sort}&page=${page}`)
      .then((feed) => {
        if (cancelled) return;
        // New posts shift the pages, so a post can come back twice. Keep only the first copy.
        setPosts((current) => {
          const seen = new Set(current.map((post) => post.id));
          return [...current, ...feed.posts.filter((post) => !seen.has(post.id))];
        });
        setHasMore(feed.hasMore);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught.message);
      });

    return () => {
      cancelled = true;
    };
  }, [sort, page]);

  function switchTo(next: FeedSort) {
    if (next === sort) return;
    setSort(next);
    setPosts([]);
    setPage(1);
    setError('');
  }

  function updatePost(id: string, changes: Partial<PostView>) {
    setPosts((current) => current.map((post) => (post.id === id ? { ...post, ...changes } : post)));
  }

  return (
    <section>
      <div className="tabs">
        <button className={sort === 'recent' ? 'tab active' : 'tab'} onClick={() => switchTo('recent')}>
          Recent
        </button>
        <button className={sort === 'popular' ? 'tab active' : 'tab'} onClick={() => switchTo('popular')}>
          Popular
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && posts.length === 0 && <p className="muted">No posts yet today.</p>}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} items={items} onChange={updatePost} />
      ))}

      {hasMore && (
        <button className="button" onClick={() => setPage(page + 1)}>
          Load more
        </button>
      )}
    </section>
  );
}

function PostCard(props: {
  post: PostView;
  items: Item[];
  onChange: (id: string, changes: Partial<PostView>) => void;
}) {
  const { post, items, onChange } = props;
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Tapping your current rating again removes it.
  async function rate(tier: Tier) {
    setError('');
    setBusy(true);
    try {
      const result =
        tier === post.myRating
          ? await api<RatingResult>(`/posts/${post.id}/rating`, 'DELETE')
          : await api<RatingResult>(`/posts/${post.id}/rating`, 'PUT', { tier });
      onChange(post.id, result);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canRate = user && post.username !== user.username;

  return (
    <article className="post">
      <div className="post-header">
        <strong>{post.username}</strong>
        {/* Every tier is shown, including those with no ratings yet. */}
        <span className="rating-counts">
          <span className="muted">Ratings on this post:</span>
          {TIERS.map((tier) => (
            <span key={tier} className={`rating-count tier-${tier}`}>
              {post.ratingCounts[tier]} {tier}
            </span>
          ))}
        </span>
      </div>
      <TierRows tiers={post.tiers} items={items} />
      {canRate ? (
        <div className="rating" role="group" aria-label={`Rate ${post.username}'s list`}>
          <span className="muted">Rate this post:</span>
          {TIERS.map((tier) => (
            <button
              key={tier}
              className={post.myRating === tier ? `rate tier-${tier} chosen` : `rate tier-${tier}`}
              aria-pressed={post.myRating === tier}
              disabled={busy}
              onClick={() => rate(tier)}
            >
              {tier}
            </button>
          ))}
        </div>
      ) : (
        !user && (
          <Link to="/signin" className="muted">
            Sign in to rate this list
          </Link>
        )
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}
