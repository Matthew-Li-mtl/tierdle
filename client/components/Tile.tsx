// One item: its picture and its name. If the picture fails to load, the name still shows.
import { useState } from 'react';
import type { Item } from '../../shared/types.js';

export default function Tile({ item }: { item: Item }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <>
      {!imageFailed && (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      <span>{item.label}</span>
    </>
  );
}
