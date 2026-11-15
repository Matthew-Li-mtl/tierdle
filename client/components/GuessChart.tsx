// A small bar chart of today's guesses: one bar per guess, as long as its accuracy,
// each with a button that puts the tiers back the way that guess had them.
import type { GuessRecord, Placements } from '../../shared/types.js';
import { percent } from '../pages/Home.js';

export default function GuessChart(props: { guesses: GuessRecord[]; onRestore: (placements: Placements) => void }) {
  const { guesses, onRestore } = props;
  if (guesses.length === 0) return null;
  const best = Math.max(...guesses.map((guess) => guess.points));

  return (
    <ol className="guess-chart" aria-label="Your guesses today">
      {guesses.map((guess) => (
        <li key={guess.number} className={guess.points === best ? 'guess best' : 'guess'}>
          <span className="guess-number">{guess.number}</span>
          {/* The bar is decoration; the percentage beside it carries the same information as text. */}
          <span className="guess-track" aria-hidden="true">
            <span className="guess-bar" style={{ width: `${guess.accuracy * 100}%` }} />
          </span>
          <span className="guess-accuracy">{percent(guess)}</span>
          <button
            className="button small"
            aria-label={`Restore guess ${guess.number}`}
            onClick={() => onRestore(guess.placements)}
          >
            Restore
          </button>
        </li>
      ))}
    </ol>
  );
}
