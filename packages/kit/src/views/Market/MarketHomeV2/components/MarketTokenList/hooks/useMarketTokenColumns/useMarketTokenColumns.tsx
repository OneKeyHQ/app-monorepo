import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';
import type {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';

import { type IMarketToken } from '../../MarketTokenData';

import { useColumnsDesktop } from './useColumnsDesktop';
import { useColumnsMobile } from './useColumnsMobile';

export const useMarketTokenColumns = (
  networkId?: string,
  isWatchlistMode?: boolean,
  hideTokenAge?: boolean,
  watchlistFrom?: EWatchlistFrom,
  copyFrom?: ECopyFrom,
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useColumnsDesktop(
    networkId,
    isWatchlistMode,
    hideTokenAge,
    watchlistFrom,
    copyFrom,
  );
  const mobileColumns = useColumnsMobile();

  const media = useMedia();

  return useMemo(
    () => (media.gtMd ? desktopColumns : mobileColumns),
    [media.gtMd, desktopColumns, mobileColumns],
  );
};
