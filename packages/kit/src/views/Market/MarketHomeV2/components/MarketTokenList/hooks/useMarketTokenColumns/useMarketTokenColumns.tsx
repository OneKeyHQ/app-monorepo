import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useDesktopColumns } from './useDesktopColumns';
import { useMobileColumns } from './useMobileColumns';

export const useMarketTokenColumns = (
  networkId?: string,
  watchlistActive = false,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useDesktopColumns(networkId, watchlistActive);
  const mobileColumns = useMobileColumns(networkId, watchlistActive);

  const { md } = useMedia();

  return useMemo(
    () => (md ? mobileColumns : desktopColumns),
    [md, mobileColumns, desktopColumns],
  );
};
