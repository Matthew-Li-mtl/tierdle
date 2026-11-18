// A read-only copy of one earlier guess: its items in the tiers it gave them, with each tier's result.
// Nothing here can be clicked, dragged or focused; the main tier list above stays as it is.
import type { GuessRecord, Item, Prompt, TierResult } from '../../shared/types.js';
import { percent } from '../pages/Home.js';
import Tile from './Tile.js';

// A tier's result: a see-through gray fill as wide as the share of its items that are right,
// and that share as text on the right. Empty tiers show nothing. Also used by the main tier list.
export function TierShare(props: { result: TierResult | undefined; tierName: string }) {
  const { result, tierName } = props;
  if (!result || result.placed === 0) return null;
  const share = result.correct / result.placed;
  return (
    <>
      <span className="tier-fill" style={{ width: `${share * 100}%` }} aria-hidden="true" />
      <span className="tier-share" aria-label={`${result.correct} of ${result.placed} correct in tier ${tierName}`}>
        {Math.round(share * 100)}%
      </span>
    </>
  );
}

export function hasShare(result: TierResult | undefined): boolean {
  return Boolean(result && result.placed > 0);
}

export default function GuessPreview(props: { prompt: Prompt; guess: GuessRecord }) {
  const { prompt, guess } = props;
  return (
    <section className="guess-preview" aria-label={`Guess ${guess.number}, read only`}>
      <h2>
        Guess {guess.number}: {percent(guess)}
      </h2>
      <div className="tiers">
        {prompt.tiers.map((name, index) => {
          const result = guess.tierResults?.[index];
          const items = prompt.items.filter((item) => guess.placements[item.slug] === index);
          return (
            <div className="tier" key={index}>
              <div className={`tier-label tier-${index}${name.length > 3 ? ' long' : ''}`}>{name}</div>
              <div className={hasShare(result) ? 'tier-items scored' : 'tier-items'}>
                <TierShare result={result} tierName={name} />
                {items.map((item: Item) => (
                  <div className="tile" key={item.slug}>
                    <Tile item={item} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
