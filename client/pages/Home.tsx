// The main page: today's list to guess, your score, and your guesses so far.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MAX_GUESSES,
  type GuessRecord,
  type GuessResponse,
  type Placements,
  type Score,
  type TodayResponse,
} from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import TierBuilder from '../components/TierBuilder.js';

// 0.875 -> "87.5%"
export function percent(score: Score) {
  return `${(score.accuracy * 100).toFixed(1)}%`;
}

// Guests' guesses live in this browser only, one list per day.
function guestKey(day: string) {
  return `tierguessr:guesses:${day}`;
}

function loadGuestGuesses(day: string): GuessRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(guestKey(day)) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return []; // nothing saved, or storage is unavailable
  }
}

function saveGuestGuesses(day: string, guesses: GuessRecord[]) {
  try {
    localStorage.setItem(guestKey(day), JSON.stringify(guesses));
  } catch {
    // The guesses still show for this visit without storage.
  }
}

export default function Home() {
  const { user } = useAuth();
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const [error, setError] = useState('');

  // Load again when the user signs in or out: signed-in guesses come from the account,
  // and guests' come from this browser.
  useEffect(() => {
    setLastScore(null);
    api<TodayResponse>('/today')
      .then((response) => {
        setToday(response);
        setGuesses(user ? response.guesses : loadGuestGuesses(response.day));
      })
      .catch((caught) => setError(caught.message));
  }, [user?.id]);

  if (error) return <p className="error">{error}</p>;
  if (!today) return <p>Loading...</p>;

  const { prompt } = today;
  if (!prompt) return <p>There is no tier list today. Check back soon.</p>;

  const guessesLeft = Math.max(0, MAX_GUESSES - guesses.length);
  const best = guesses.reduce<GuessRecord | null>((top, guess) => (!top || guess.points > top.points ? guess : top), null);

  function handleScored(result: GuessResponse, placements: Placements) {
    setLastScore(result.score);
    if (user) {
      setGuesses(result.guesses); // the server's saved list, including this guess
    } else {
      const next = [
        ...guesses,
        { ...result.score, number: guesses.length + 1, placements, createdAt: new Date().toISOString() },
      ];
      setGuesses(next);
      saveGuestGuesses(prompt!.day, next);
    }
  }

  return (
    <>
      <h1>{prompt.title}</h1>
      <p className="muted">
        Guess how the community ranked these. Put every item in a tier, then check your accuracy. You get{' '}
        {MAX_GUESSES} guesses. New list at midnight UTC!
      </p>

      {lastScore && (
        <div className="result" role="status">
          <span className="result-accuracy">{percent(lastScore)}</span>
          <span>
            accurate: {lastScore.points} of {lastScore.maxPoints} points
          </span>
        </div>
      )}
      {best && (
        <p className="muted">
          Your best today: {percent(best)}, with {guesses.length} of {MAX_GUESSES} guesses used.
          {user && (
            <>
              {' '}
              <Link to="/history">See your history</Link>
            </>
          )}
        </p>
      )}
      {!user && guesses.length > 0 && (
        <p className="muted">
          Your guesses are saved in this browser. <Link to="/signin">Sign in</Link> to keep them in your account and
          history.
        </p>
      )}

      <TierBuilder prompt={prompt} guesses={guesses} guessesLeft={guessesLeft} onScored={handleScored} />

      {/* Always visible, so the source of the answers is credited without opening anything. */}
      {prompt.source && (
        <p className="attribution">
          Answers from the <a href={prompt.source.url}>{prompt.source.label}</a>.
        </p>
      )}
      {prompt.author && (
        <p className="attribution author">
          Original tier list by <a href={prompt.author.url}>{prompt.author.name}</a>.
        </p>
      )}

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
