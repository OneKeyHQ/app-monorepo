import { useMemo } from 'react';

import type { ITableColumn } from '@onekeyhq/components';
import { useMedia } from '@onekeyhq/components';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
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
  hasStock?: boolean,
  showStockSubtitle?: boolean,
  hiddenDesktopColumns?: readonly string[],
  change24hColumnTitle?: string,
  useStockMetadataColumns?: boolean,
  deferRichRowAfterIndex?: number,
  options?: {
    redesignEnabled?: boolean;
    // Trending-only: reorders to the fixed nine-column roster. Every other
    // list keeps its own columns and takes the visual changes alone.
    redesignColumnOrderEnabled?: boolean;
    volumeTimeRange?: IMarketTimeRangeValue;
  },
): ITableColumn<IMarketToken>[] => {
  const desktopColumns = useColumnsDesktop(
    networkId,
    isWatchlistMode,
    hideTokenAge,
    watchlistFrom,
    copyFrom,
    hasStock,
    showStockSubtitle,
    hiddenDesktopColumns,
    change24hColumnTitle,
    useStockMetadataColumns,
    deferRichRowAfterIndex,
    options?.redesignEnabled,
    options?.redesignColumnOrderEnabled,
    options?.volumeTimeRange,
  );
  const mobileColumns = useColumnsMobile(
    showStockSubtitle,
    useStockMetadataColumns,
  );

  const media = useMedia();

  return useMemo(
    () => (media.gtMd ? desktopColumns : mobileColumns),
    [media.gtMd, desktopColumns, mobileColumns],
  );
};
