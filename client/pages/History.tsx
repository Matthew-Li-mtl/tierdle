// Every attempt the signed-in user has made, newest first.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AttemptView, HistoryResponse } from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { percent } from './Home.js';

export default function History() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptView[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false; // ignore a late answer if the user has signed out meanwhile

    api<HistoryResponse>(`/history?page=${page}`)
      .then((history) => {
        if (cancelled) return;
        // Keep only the first copy of each attempt, in case a new one shifted the pages.
        setAttempts((current) => {
          const seen = new Set(current.map((attempt) => attempt.id));
          return [...current, ...history.attempts.filter((attempt) => !seen.has(attempt.id))];
        });
        setHasMore(history.hasMore);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught.message);
      });

    return () => {
      cancelled = true;
    };
  }, [user, page]);

  if (!user) {
    return (
      <p>
        <Link to="/signin">Sign in</Link> to see your history.
      </p>
    );
  }

  return (
    <section>
      <h1>Your history</h1>
      {error && <p className="error">{error}</p>}
      {!error && attempts.length === 0 && <p className="muted">No attempts yet.</p>}

      {attempts.length > 0 && (
        <table className="history">
          <thead>
            <tr>
              <th>Day</th>
              <th>List</th>
              <th>Accuracy</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.day}</td>
                <td>{attempt.title}</td>
                <td>{percent(attempt)}</td>
                <td>
                  {attempt.points} / {attempt.maxPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasMore && (
        <button className="button" onClick={() => setPage(page + 1)}>
          Load more
        </button>
      )}
    </section>
  );
}
