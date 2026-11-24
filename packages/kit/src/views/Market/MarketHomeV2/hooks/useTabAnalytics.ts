import { useCallback, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EDexListName } from '@onekeyhq/shared/src/logger/scopes/dex';

import type {
  IMarketHomeTabChangeContext,
  IMarketHomeTabValue,
} from '../types';

function getTabSelectionKey(
  tabId: IMarketHomeTabValue,
  context?: IMarketHomeTabChangeContext,
) {
  return `${tabId}:${context?.categoryId ?? ''}`;
}

export function useTabAnalytics() {
  // Track if this is the first tab change (automatic) to skip analytics
  const isFirstTabChange = useRef(true);
  // Previous tab and spot category, to prevent duplicate analytics events
  const prevSelectionKey = useRef<string | null>(null);

  const handleTabChange = useCallback(
    (tabId: IMarketHomeTabValue, context?: IMarketHomeTabChangeContext) => {
      const selectionKey = getTabSelectionKey(tabId, context);
      // Skip analytics for the first automatic tab change
      if (isFirstTabChange.current) {
        isFirstTabChange.current = false;
        prevSelectionKey.current = selectionKey;
        return;
      }

      // Skip analytics if neither the tab nor its category changed
      if (prevSelectionKey.current === selectionKey) {
        return;
      }

      prevSelectionKey.current = selectionKey;

      // Track dex list selection only when user clicks tab (not default selection)
      defaultLogger.dex.list.dexList({
        // Unchanged legacy mapping for version comparison; `tabValue` is exact.
        dexListName:
          tabId === 'trending' ? EDexListName.Trending : EDexListName.Watchlist,
        tabValue: tabId,
        ...(context?.categoryId ? { categoryId: context.categoryId } : {}),
      });
    },
    [],
  );

  return {
    handleTabChange,
  };
}
