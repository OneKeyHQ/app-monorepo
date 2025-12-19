import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';

import { type IMarketToken } from '../../MarketTokenData';

import { useColumnsDesktop } from './useColumnsDesktop';
import { useColumnsMobile } from './useColumnsMobile';

export const useMarketTokenColumns = (
  networkId?: string,
  isWatchlistMode?: boolean,
  hideTokenAge?: boolean,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useColumnsDesktop(
    networkId,
    isWatchlistMode,
    hideTokenAge,
  );
  const mobileColumns = useColumnsMobile();

  const media = useMedia();

  return useMemo(
    () => (media.gtMd ? desktopColumns : mobileColumns),
    [media.gtMd, desktopColumns, mobileColumns],
  );
};
