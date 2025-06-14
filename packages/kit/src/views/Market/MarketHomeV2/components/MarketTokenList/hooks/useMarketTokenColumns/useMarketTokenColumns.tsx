import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useDesktopColumns } from './useDesktopColumns';
import { useMobileColumns } from './useMobileColumns';

export const useMarketTokenColumns = (
  networkId?: string,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useDesktopColumns(networkId);
  const mobileColumns = useMobileColumns(networkId);

  return useMemo(() => {
    if (desktopColumns.length > 0) {
      return desktopColumns;
    }

    return mobileColumns;
  }, [desktopColumns, mobileColumns]);
};
