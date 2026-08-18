import { useEffect, useState } from 'react';

/**
 * Latches on the first time data arrives.
 *
 * The borrow overview's side requests poll on their own cadence, and each
 * re-run drops its result back to undefined for a moment. Gating a skeleton on
 * "no data right now" therefore lets a value that has already rendered flip
 * back to a skeleton mid-load, with each metric flipping at a different time.
 *
 * Once a field has rendered a value it should never show a skeleton again; a
 * request that genuinely finishes empty still falls through to the placeholder,
 * because its own loading flag is false by then.
 */
export function useLoadedOnce(hasData: boolean) {
  const [loadedOnce, setLoadedOnce] = useState(hasData);
  useEffect(() => {
    if (hasData) {
      setLoadedOnce(true);
    }
  }, [hasData]);
  return loadedOnce;
}
