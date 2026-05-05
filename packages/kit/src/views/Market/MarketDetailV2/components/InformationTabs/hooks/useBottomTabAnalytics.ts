import { useCallback } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabSelect } from '@onekeyhq/shared/src/logger/scopes/dex';

const TAB_SELECT_BY_KEY: Partial<Record<string, ETabSelect>> = {
  transactions: ETabSelect.Transactions,
  portfolio: ETabSelect.Portfolio,
  holders: ETabSelect.Holders,
};

function getFallbackTabSelect(index: number) {
  // Use index to identify tab type since tabName is localized.
  switch (index) {
    case 0:
      return ETabSelect.Transactions;
    case 1:
      return ETabSelect.Portfolio;
    default:
      return undefined;
  }
}

export function useBottomTabAnalytics(tabKeys?: readonly string[]) {
  const trackTabClick = useCallback(
    (data: { index: number; tabName: string }) => {
      const tabKey = tabKeys?.[data.index];
      const tabSelect = tabKey
        ? TAB_SELECT_BY_KEY[tabKey]
        : getFallbackTabSelect(data.index);
      if (!tabSelect) {
        return;
      }

      defaultLogger.dex.actions.dexBottomTabs({
        tabSelect,
      });
    },
    [tabKeys],
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
