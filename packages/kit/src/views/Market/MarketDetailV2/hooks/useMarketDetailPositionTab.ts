import { useCallback } from 'react';

import { useMarketDetailPositionTabPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * Remembers whether the last tab picked on any market detail page was My
 * position. Pages open on My position when it was, and on their own default
 * tab otherwise. The choice is only read when a page opens; nothing switches
 * tabs afterwards, so an asset without a position shows its empty state.
 */
export function useMarketDetailPositionTab() {
  const [{ preferPosition }, setPositionTabPreference] =
    useMarketDetailPositionTabPersistAtom();

  // Called for tab changes the user makes (taps and swipes).
  const recordTabChange = useCallback(
    (isPositionTab: boolean) => {
      setPositionTabPreference({ preferPosition: isPositionTab });
    },
    [setPositionTabPreference],
  );

  return { preferPosition, recordTabChange };
}
