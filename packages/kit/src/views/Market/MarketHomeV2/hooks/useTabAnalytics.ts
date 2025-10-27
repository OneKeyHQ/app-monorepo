import { useCallback, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EDexListName } from '@onekeyhq/shared/src/logger/scopes/dex';

import type { IMarketHomeTabValue } from '../types';

export function useTabAnalytics() {
  // Track if this is the first tab change (automatic) to skip analytics
  const isFirstTabChange = useRef(true);
  // Track previous tab to prevent duplicate analytics events
  const prevTabId = useRef<IMarketHomeTabValue | null>(null);

  const handleTabChange = useCallback((tabId: IMarketHomeTabValue) => {
    // Skip analytics for the first automatic tab change
    if (isFirstTabChange.current) {
      isFirstTabChange.current = false;
      prevTabId.current = tabId;
      return;
    }

    // Skip analytics if tab hasn't actually changed (prevent duplicate events)
    if (prevTabId.current === tabId) {
      return;
    }

    // Update previous tab id
    prevTabId.current = tabId;

    // Track dex list selection only when user clicks tab (not default selection)
    // Convert tab value to dex list name
    const dexListName =
      tabId === 'trending' ? EDexListName.Trending : EDexListName.Watchlist;

    defaultLogger.dex.list.dexList({
      dexListName,
    });
  }, []);

  return {
    handleTabChange,
  };
}
