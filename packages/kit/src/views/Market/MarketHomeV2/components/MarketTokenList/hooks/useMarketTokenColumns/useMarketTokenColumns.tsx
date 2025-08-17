import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useColumnsDesktop } from './useColumnsDesktop';
import { useColumnsMobile } from './useColumnsMobile';

export const useMarketTokenColumns = (
  networkId?: string,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useColumnsDesktop(networkId);
  const mobileColumns = useColumnsMobile();

  const { md } = useMedia();

  return useMemo(
    () => (md ? mobileColumns : desktopColumns),
    [md, mobileColumns, desktopColumns],
  );
};
