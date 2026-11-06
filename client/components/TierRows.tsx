// A finished tier list that can only be looked at, used for your own post and for the feeds.
import { TIERS, type Item, type Tiers } from '../../shared/types.js';
import Tile from './Tile.js';

export default function TierRows({ tiers, items }: { tiers: Tiers; items: Item[] }) {
  return (
    <div className="tiers">
      {TIERS.map((tier) => (
        <div className="tier" key={tier}>
          <div className={`tier-label tier-${tier}`}>{tier}</div>
          <div className="tier-items">
            {tiers[tier].map((slug) => {
              const item = items.find((candidate) => candidate.slug === slug);
              return (
                item && (
                  <div className="tile" key={slug}>
                    <Tile item={item} />
                  </div>
                )
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
