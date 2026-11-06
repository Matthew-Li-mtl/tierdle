// The two feeds of today's posts, and the like button. Anyone can read; liking needs an account.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeedResponse, FeedSort, Item, PostView } from '../../shared/types.js';
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

  async function toggleLike() {
    setError('');
    try {
      const method = post.likedByMe ? 'DELETE' : 'POST';
      onChange(post.id, await api<Partial<PostView>>(`/posts/${post.id}/like`, method));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  return (
    <article className="post">
      <div className="post-header">
        <strong>{post.username}</strong>
        {user && post.username !== user.username ? (
          <button className={post.likedByMe ? 'like liked' : 'like'} aria-pressed={post.likedByMe} onClick={toggleLike}>
            Like {post.likeCount}
          </button>
        ) : user ? (
          <span className="muted">{post.likeCount} likes</span>
        ) : (
          <Link to="/signin" className="like">
            Like {post.likeCount}
          </Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <TierRows tiers={post.tiers} items={items} />
    </article>
  );
}
