import { useCallback } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabSelect } from '@onekeyhq/shared/src/logger/scopes/dex';

export function useBottomTabAnalytics() {
  const trackTabClick = useCallback((tabName: string) => {
    let tabSelect: ETabSelect;

    switch (tabName.toLowerCase()) {
      case 'transactions':
        tabSelect = ETabSelect.Transactions;
        break;
      case 'holders':
        tabSelect = ETabSelect.Holders;
        break;
      default:
        return; // Don't track unknown tabs
    }

    defaultLogger.dex.actions.dexBottomTabs({
      tabSelect,
    });
  }, []);

  const handleTabChange = useCallback(
    (data: { tabName: string }) => {
      trackTabClick(data.tabName);
    },
    [trackTabClick],
  );

  return {
    trackTabClick,
    handleTabChange,
  };
}
