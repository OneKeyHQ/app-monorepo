import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useDesktopColumns } from './useDesktopColumns';
import { useMobileColumns } from './useMobileColumns';

export const useMarketTokenColumns = (
  networkId?: string,
  watchlistActive = false,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useDesktopColumns(networkId, watchlistActive);
  const mobileColumns = useMobileColumns(networkId, watchlistActive);

  return useMemo(() => {
    if (desktopColumns.length > 0) {
      return desktopColumns;
    }

    return mobileColumns;
  }, [desktopColumns, mobileColumns]);
};
