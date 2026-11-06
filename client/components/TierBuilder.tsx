// Where you make your tier list. Tiles can be dragged, or tapped and then placed,
// which also makes it work on phones and with a keyboard.
import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { TIERS, type Item, type PostView, type Prompt, type Tier, type Tiers } from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import Tile from './Tile.js';

type RowName = Tier | 'unranked';
type Rows = Record<RowName, string[]>;

function emptyRows(prompt: Prompt): Rows {
  return { S: [], A: [], B: [], C: [], D: [], unranked: prompt.items.map((item) => item.slug) };
}

// Restores a list in progress, so nothing is lost when a guest leaves to sign in.
function loadRows(prompt: Prompt): Rows {
  try {
    const saved: Rows = JSON.parse(localStorage.getItem(`tierdle:${prompt.day}`) ?? '');
    const savedSlugs = Object.values(saved).flat().sort();
    const slugs = prompt.items.map((item) => item.slug).sort();
    if (savedSlugs.join() === slugs.join()) return saved;
  } catch {
    // Nothing saved yet, or storage is unavailable.
  }
  return emptyRows(prompt);
}

export default function TierBuilder(props: { prompt: Prompt; onPosted: (post: PostView) => void }) {
  const { prompt, onPosted } = props;
  const { user } = useAuth();
  const [rows, setRows] = useState<Rows>(() => loadRows(prompt));
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(`tierdle:${prompt.day}`, JSON.stringify(rows));
    } catch {
      // The list still works for this visit without storage.
    }
  }, [rows, prompt.day]);

  // Takes a tile out of its row and puts it in the target row, before `beforeSlug` if given.
  function move(slug: string, target: RowName, beforeSlug?: string) {
    setSelected(null);
    if (slug === beforeSlug) return;
    setRows((current) => {
      const next = {} as Rows;
      for (const name of Object.keys(current) as RowName[]) {
        next[name] = current[name].filter((other) => other !== slug);
      }
      const index = beforeSlug ? next[target].indexOf(beforeSlug) : next[target].length;
      next[target].splice(index, 0, slug);
      return next;
    });
  }

  function handleDrop(event: DragEvent, target: RowName, beforeSlug?: string) {
    event.preventDefault();
    event.stopPropagation();
    move(event.dataTransfer.getData('text/plain'), target, beforeSlug);
  }

  function handleTileClick(slug: string, row: RowName) {
    if (selected && selected !== slug) move(selected, row, slug);
    else setSelected(selected === slug ? null : slug);
  }

  async function post() {
    setError('');
    try {
      const tiers: Tiers = { S: rows.S, A: rows.A, B: rows.B, C: rows.C, D: rows.D };
      onPosted(await api<PostView>('/posts', 'POST', { day: prompt.day, tiers }));
      localStorage.removeItem(`tierdle:${prompt.day}`);
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  function renderTiles(row: RowName) {
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

  return (
    <section>
      <div className="tiers">
        {TIERS.map((tier) => (
          <div
            className="tier"
            key={tier}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, tier)}
          >
            <button
              className={`tier-label tier-${tier}`}
              aria-label={`Move selected item to tier ${tier}`}
              onClick={() => selected && move(selected, tier)}
            >
              {tier}
            </button>
            <div className="tier-items" onClick={() => selected && move(selected, tier)}>
              {renderTiles(tier)}
            </div>
          </div>
        ))}
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
      {user ? (
        <button className="button primary" disabled={rows.unranked.length === prompt.items.length} onClick={post}>
          Post my tier list
        </button>
      ) : (
        <Link to="/signin" className="button primary">
          Sign in to post
        </Link>
      )}
    </section>
  );
}
