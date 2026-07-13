import type { ITableColumn } from '@onekeyhq/components';
import type {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';

import { type IMarketToken } from '../../MarketTokenData';

import { useColumnsMobile } from './useColumnsMobile';

export const useMarketTokenColumns = (
  _networkId?: string,
  _isWatchlistMode?: boolean,
  _hideTokenAge?: boolean,
  _watchlistFrom?: EWatchlistFrom,
  _copyFrom?: ECopyFrom,
  _hasStock?: boolean,
  showStockSubtitle?: boolean,
  _hiddenDesktopColumns?: readonly string[],
  _change24hColumnTitle?: string,
  useStockMetadataColumns?: boolean,
  _deferRichRowAfterIndex?: number,
): ITableColumn<IMarketToken>[] => {
  // Native only renders the mobile table; keep desktop column imports out of Metro.
  return useColumnsMobile(showStockSubtitle, useStockMetadataColumns);
};
