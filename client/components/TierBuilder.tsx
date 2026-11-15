// Where you make your guess. Tiles can be dragged, or tapped and then placed,
// which also makes it work on phones and with a keyboard.
import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { GuessRecord, GuessResponse, Item, Placements, Prompt } from '../../shared/types.js';
import { api } from '../api.js';
import GuessChart from './GuessChart.js';
import Tile from './Tile.js';

// One row per tier, named by its position ("0" is the top tier), plus the unranked pile.
type Rows = Record<string, string[]>;

function emptyRows(prompt: Prompt): Rows {
  const rows: Rows = { unranked: prompt.items.map((item) => item.slug) };
  prompt.tiers.forEach((_name, index) => (rows[index] = []));
  return rows;
}

// Restores a guess in progress, so nothing is lost when a guest leaves to sign in.
// Saved progress only counts if it has the same rows and items as today's list.
function loadRows(prompt: Prompt): Rows {
  try {
    const saved: Rows = JSON.parse(localStorage.getItem(`tierguessr:${prompt.day}`) ?? '');
    const sameRows = Object.keys(saved).sort().join() === Object.keys(emptyRows(prompt)).sort().join();
    const savedSlugs = Object.values(saved).flat().sort();
    const slugs = prompt.items.map((item) => item.slug).sort();
    if (sameRows && savedSlugs.join() === slugs.join()) return saved;
  } catch {
    // Nothing saved yet, or storage is unavailable.
  }
  return emptyRows(prompt);
}

// The rows a saved guess had. Items keep the list's order within each tier.
function rowsFrom(prompt: Prompt, placements: Placements): Rows {
  const rows = emptyRows(prompt);
  rows.unranked = [];
  for (const item of prompt.items) {
    const tier = placements[item.slug];
    if (rows[tier] === undefined) rows.unranked.push(item.slug); // not in this guess; should not happen
    else rows[tier].push(item.slug);
  }
  return rows;
}

export default function TierBuilder(props: {
  prompt: Prompt;
  guesses: GuessRecord[];
  guessesLeft: number;
  onScored: (result: GuessResponse, placements: Placements) => void;
}) {
  const { prompt, guesses, guessesLeft, onScored } = props;
  const [rows, setRows] = useState<Rows>(() => loadRows(prompt));
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Saved after every change. The guess stays after checking it, so the next attempt can start from it.
  useEffect(() => {
    try {
      localStorage.setItem(`tierguessr:${prompt.day}`, JSON.stringify(rows));
    } catch {
      // The game still works for this visit without storage.
    }
  }, [rows, prompt.day]);

  // Takes a tile out of its row and puts it in the target row, before `beforeSlug` if given.
  function move(slug: string, target: string, beforeSlug?: string) {
    setSelected(null);
    if (slug === beforeSlug) return;
    setRows((current) => {
      const next: Rows = {};
      for (const name of Object.keys(current)) {
        next[name] = current[name].filter((other) => other !== slug);
      }
      const index = beforeSlug ? next[target].indexOf(beforeSlug) : next[target].length;
      next[target].splice(index, 0, slug);
      return next;
    });
  }

  function handleDrop(event: DragEvent, target: string, beforeSlug?: string) {
    event.preventDefault();
    event.stopPropagation();
    move(event.dataTransfer.getData('text/plain'), target, beforeSlug);
  }

  function handleTileClick(slug: string, row: string) {
    if (selected && selected !== slug) move(selected, row, slug);
    else setSelected(selected === slug ? null : slug);
  }

  // Turn the rows into item -> tier index, which is what the server scores.
  function placementsOf(current: Rows): Placements {
    const placements: Placements = {};
    prompt.tiers.forEach((_name, index) => {
      for (const slug of current[index]) placements[slug] = index;
    });
    return placements;
  }

  async function check() {
    setError('');
    setBusy(true);
    try {
      const placements = placementsOf(rows);
      onScored(await api<GuessResponse>('/guesses', 'POST', { day: prompt.day, placements }), placements);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function renderTiles(row: string) {
    return rows[row].map((slug) => {
      const item = prompt.items.find((candidate) => candidate.slug === slug) as Item;
      return (
        <div
          key={slug}
          className={selected === slug ? 'tile selected' : 'tile'}
          role="button"
          tabIndex={0}
          draggable
          aria-pressed={selected === slug}
          onDragStart={(event) => event.dataTransfer.setData('text/plain', slug)}
          onDrop={(event) => handleDrop(event, row, slug)}
          onClick={() => handleTileClick(slug, row)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleTileClick(slug, row);
            }
          }}
        >
          <Tile item={item} />
        </div>
      );
    });
  }

  const left = rows.unranked.length;
  const buttonText =
    guessesLeft === 0
      ? 'No guesses left today'
      : left > 0
        ? `Place ${left} more ${left === 1 ? 'item' : 'items'}`
        : `Check my guess (${guessesLeft} ${guessesLeft === 1 ? 'guess' : 'guesses'} left)`;

  // The checked guess the board matches right now, if any: just after checking, after Restore,
  // or after a reload. Its per-tier results are drawn inside the tiers. Moving a tile makes the
  // board differ, so the results disappear rather than describe tiles that have moved.
  const current = placementsOf(rows);
  const sameAsBoard = (guess: GuessRecord) =>
    left === 0 && prompt.items.every((item) => guess.placements[item.slug] === current[item.slug]);
  const shown = [...guesses].reverse().find(sameAsBoard);

  return (
    <section>
      <div className="tiers">
        {prompt.tiers.map((name, index) => {
          // Of the items in this tier, the share the community also put here. Empty tiers show nothing.
          const result = shown?.tierResults?.[index];
          const share = result && result.placed > 0 ? result.correct / result.placed : null;
          return (
            <div
              className="tier"
              key={index}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, String(index))}
            >
              {/* Colors go by position, so the top tier is always red whatever it is called. */}
              <button
                className={`tier-label tier-${index}${name.length > 3 ? ' long' : ''}`}
                aria-label={`Move selected item to tier ${name}`}
                onClick={() => selected && move(selected, String(index))}
              >
                {name}
              </button>
              <div
                className={share === null ? 'tier-items' : 'tier-items scored'}
                onClick={() => selected && move(selected, String(index))}
              >
                {share !== null && (
                  <>
                    <span className="tier-fill" style={{ width: `${share * 100}%` }} aria-hidden="true" />
                    <span
                      className="tier-share"
                      aria-label={`${result!.correct} of ${result!.placed} correct in tier ${name}`}
                    >
                      {Math.round(share * 100)}%
                    </span>
                  </>
                )}
                {renderTiles(String(index))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="unranked"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, 'unranked')}
        onClick={() => selected && move(selected, 'unranked')}
      >
        {renderTiles('unranked')}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={left > 0 || guessesLeft === 0 || busy} onClick={check}>
        {buttonText}
      </button>

      {/* Restoring only changes the tiers on screen. It does not use up a guess. */}
      <GuessChart
        guesses={guesses}
        onRestore={(placements) => {
          setSelected(null);
          setRows(rowsFrom(prompt, placements));
        }}
      />
    </section>
  );
}
