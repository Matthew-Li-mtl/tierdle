// A small bar chart of today's guesses: one bar per guess, as long as its accuracy,
// each with a button that shows that guess as a read-only tier list below.
import type { GuessRecord } from '../../shared/types.js';
import { percent } from '../pages/Home.js';

export default function GuessChart(props: {
  guesses: GuessRecord[];
  previewing: number | null; // the guess number being previewed, if any
  onPreview: (number: number | null) => void;
}) {
  const { guesses, previewing, onPreview } = props;
  if (guesses.length === 0) return null;
  const best = Math.max(...guesses.map((guess) => guess.points));

  return (
    <ol className="guess-chart" aria-label="Your guesses today">
      {guesses.map((guess) => {
        const open = previewing === guess.number;
        return (
          <li key={guess.number} className={guess.points === best ? 'guess best' : 'guess'}>
            <span className="guess-number">{guess.number}</span>
            {/* The bar is decoration; the percentage beside it carries the same information as text. */}
            <span className="guess-track" aria-hidden="true">
              <span className="guess-bar" style={{ width: `${guess.accuracy * 100}%` }} />
            </span>
            <span className="guess-accuracy">{percent(guess)}</span>
            {/* Pressing it again hides the preview. */}
            <button
              className={open ? 'button small active' : 'button small'}
              aria-pressed={open}
              aria-label={`Preview guess ${guess.number}`}
              onClick={() => onPreview(open ? null : guess.number)}
            >
              {open ? 'Hide' : 'Preview'}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
