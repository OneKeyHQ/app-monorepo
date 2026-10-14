import { useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import { convertSearchTokenToMarketToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/constants';
import { MarketStockSelectorTable } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketStockSelectorList';
import {
  type IMarketSearchResultToken,
  TokenTabList,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelectorSearchResults';
import type { useMarketStockSelectorList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList';
import { buildMarketSearchTokenDetailPreview } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPreview';
import { mapMarketStockPublicItemToSearchToken } from '@onekeyhq/shared/src/utils/marketSearchStock';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';
import type {
  IUniversalSearchMarketStock,
  IUniversalSearchResultItem,
  IUniversalSearchV2MarketToken,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

type IMarketStockSelectorListResult = ReturnType<
  typeof useMarketStockSelectorList
>;

export function toUniversalSearchStockItem(
  stock: IMarketStockPublicItem,
): IUniversalSearchMarketStock {
  return {
    type: EUniversalSearchType.MarketStock,
    payload: mapMarketStockPublicItemToSearchToken(stock),
  };
}

function toSelectorSearchToken(
  item: IUniversalSearchV2MarketToken,
): IMarketSearchResultToken {
  return {
    // The row resolves the chain badge from `networkId` when this is empty.
    ...convertSearchTokenToMarketToken({ ...item.payload, networkLogoURI: '' }),
    tokenDetailPreview: buildMarketSearchTokenDetailPreview(item.payload),
  };
}

/**
 * The selector-shaped token of each token search result, built once per
 * result list so the memoized rows keep their props between renders, and the
 * way back from a pressed row to the result it came from.
 */
export function useUniversalSearchSelectorTokens(
  items: IUniversalSearchResultItem[],
) {
  return useMemo(() => {
    const itemByTokenId = new Map<string, IUniversalSearchV2MarketToken>();
    const tokens: IMarketSearchResultToken[] = [];
    items.forEach((item) => {
      if (item.type !== EUniversalSearchType.V2MarketToken) {
        return;
      }
      const token = toSelectorSearchToken(item);
      itemByTokenId.set(token.id, item);
      tokens.push(token);
    });
    return { tokens, itemByTokenId };
  }, [items]);
}

/** The desktop Tokens tab: the selector's sortable token table. */
export function UniversalSearchTokenTab({
  tokens,
  itemByTokenId,
  onPress,
}: {
  tokens: IMarketSearchResultToken[];
  itemByTokenId: Map<string, IUniversalSearchV2MarketToken>;
  onPress: (item: IUniversalSearchV2MarketToken) => void;
}) {
  const handlePress = useCallback(
    (token: IMarketSearchResultToken) => {
      const item = itemByTokenId.get(token.id);
      if (item) {
        onPress(item);
      }
    },
    [itemByTokenId, onPress],
  );
  return (
    <YStack flex={1}>
      <TokenTabList items={tokens} onPress={handlePress} />
    </YStack>
  );
}

/** The desktop Stocks tab: the selector's paged stock table. */
export function UniversalSearchStockTab({
  result,
  onPress,
}: {
  result: IMarketStockSelectorListResult;
  onPress: (item: IUniversalSearchMarketStock) => void;
}) {
  const handlePress = useCallback(
    (stock: IMarketStockPublicItem) => {
      onPress(toUniversalSearchStockItem(stock));
    },
    [onPress],
  );
  return (
    <YStack flex={1}>
      <MarketStockSelectorTable result={result} onItemPress={handlePress} />
    </YStack>
  );
}
