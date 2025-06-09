import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useDesktopColumns } from './useDesktopColumns';
import { useMobileColumns } from './useMobileColumns';

export const useMarketTokenColumns = (): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useDesktopColumns();
  const mobileColumns = useMobileColumns();

  return useMemo(() => {
    if (desktopColumns.length > 0) {
      return desktopColumns;
    }

    return mobileColumns;
  }, [desktopColumns, mobileColumns]);
};
