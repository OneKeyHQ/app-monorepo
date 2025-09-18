import { useCallback } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabSelect } from '@onekeyhq/shared/src/logger/scopes/dex';

export function useBottomTabAnalytics() {
  const trackTabClick = useCallback(
    (data: { index: number; tabName: string }) => {
      let tabSelect: ETabSelect;

      // Use index to identify tab type since tabName is localized
      switch (data.index) {
        case 0: // First tab is always transactions
          tabSelect = ETabSelect.Transactions;
          break;
        case 1: // Second tab is holders (when available)
          tabSelect = ETabSelect.Holders;
          break;
        default:
          return; // Don't track unknown tabs
      }

      defaultLogger.dex.actions.dexBottomTabs({
        tabSelect,
      });
    },
    [],
  );

  const handleTabChange = useCallback(
    (data: { index: number; tabName: string }) => {
      console.log('handleTabChange', data);
      trackTabClick(data);
    },
    [trackTabClick],
  );

  return {
    trackTabClick,
    handleTabChange,
  };
}
