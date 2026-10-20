import { useCallback } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { getSelectorSearchAssetId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/constants';
import { buildMarketSearchTokenDetailPreview } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPreview';
import { useToDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';
import type {
  EUniversalSearchSource,
  IUniversalSearchMarketStock,
  IUniversalSearchV2MarketToken,
} from '@onekeyhq/shared/types/search';

export type IUniversalSearchMarketItem =
  | IUniversalSearchV2MarketToken
  | IUniversalSearchMarketStock;

/**
 * Opens a stock or token search result: logs the click, closes the search
 * modal, opens the Market detail page and records the recent search.
 */
export function useUniversalSearchMarketPress({
  source,
  getSearchInput,
  isTrending,
}: {
  source: EUniversalSearchSource;
  getSearchInput?: () => string;
  isTrending?: boolean;
}) {
  const appNavigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const toMarketDetailPage = useToDetailPage({
    switchToMarketTabFirst: true,
    from: EEnterWay.Search,
    resolveMarketAsset: true,
  });

  return useCallback(
    (item: IUniversalSearchMarketItem) => {
      const { address, network, name, symbol, isNative, stock, stockId } =
        item.payload;
      const isStockListing = isMarketSearchStockListing({
        stockId,
        address,
        network,
      });
      const listingStockId = isStockListing ? stockId?.trim() : undefined;
      // The Market selector's rule: an asset-only result opens through its
      // asset id, while a concrete chain token keeps its own chain identity.
      const assetId = isStockListing
        ? undefined
        : getSelectorSearchAssetId(item.payload);
      // When network is empty and there is no asset id, the item was converted
      // from IMarketToken (trending/legacy) and address contains coingeckoId
      // for legacy navigation
      const isLegacyNavigation = !isStockListing && !network && !assetId;

      const searchText = getSearchInput?.();
      if (searchText) {
        defaultLogger.universalSearch.search.universalSearchClick({
          source,
          searchText,
          type: item.type,
          itemId: listingStockId || address || symbol || '',
          itemTitle: symbol ?? '',
        });
      }

      if (isLegacyNavigation) {
        // Legacy trending item: address contains coingeckoId, use legacy navigation
        setTimeout(async () => {
          appNavigation.push(EUniversalSearchPages.MarketDetail, {
            token: address,
          });
          defaultLogger.market.token.searchToken({
            tokenSymbol: symbol,
            from: 'trendingList',
          });
        }, 80);
        return;
      }

      rootNavigationRef.current?.goBack();
      setTimeout(async () => {
        void toMarketDetailPage({
          tokenAddress: address,
          networkId: network,
          name,
          symbol,
          isNative,
          assetId,
          stockId: listingStockId,
          stock: isStockListing ? stock : undefined,
          tokenDetailPreview: buildMarketSearchTokenDetailPreview(item.payload),
        });

        defaultLogger.market.token.searchToken({
          tokenSymbol: symbol,
          from: isTrending ? 'trendingList' : 'searchList',
        });

        if (!isTrending && symbol?.trim()) {
          setTimeout(() => {
            let recentId = address;
            if (listingStockId) {
              recentId = `stock:${listingStockId}`;
            } else if (assetId) {
              recentId = `asset:${assetId}`;
            }
            universalSearchActions.current.addIntoRecentSearchList({
              id: recentId,
              text: symbol,
              type: item.type,
              timestamp: Date.now(),
            });
          }, 10);
        }
      }, 80);
    },
    [
      appNavigation,
      getSearchInput,
      isTrending,
      source,
      toMarketDetailPage,
      universalSearchActions,
    ],
  );
}
