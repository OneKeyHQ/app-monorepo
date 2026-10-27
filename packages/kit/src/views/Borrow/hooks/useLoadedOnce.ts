import { useEffect, useState } from 'react';

/**
 * Latches on the first time data arrives.
 *
 * The borrow overview's side requests poll on their own cadence, and each
 * re-run drops its result back to undefined for a moment. Gating a skeleton on
 * "no data right now" therefore lets a value that has already rendered flip
 * back to a skeleton mid-load, with each metric flipping at a different time.
 *
 * A field that has rendered a value should stay visible during refreshes of
 * the same market and account. A different scope must start with its own
 * loading state, including on the first render after a switch.
 */
export function useLoadedOnce(hasData: boolean, scopeKey: string) {
  const [loaded, setLoaded] = useState({ scopeKey, once: hasData });

  if (loaded.scopeKey !== scopeKey) {
    setLoaded({ scopeKey, once: hasData });
  }

  useEffect(() => {
    if (hasData) {
      setLoaded((current) =>
        current.scopeKey === scopeKey && !current.once
          ? { scopeKey, once: true }
          : current,
      );
    }
  }, [hasData, scopeKey]);

  return hasData || (loaded.scopeKey === scopeKey && loaded.once);
}
