import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildCoinFromSearchAssetType } from '@onekeyhq/shared/src/utils/perpsDexUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';
import type { IUniversalSearchResultItem } from '@onekeyhq/shared/types/search';

export const WATCHLIST_TAB_INDEX = 4;

export function getUniversalSearchTabIndex(
  searchType: EUniversalSearchType,
  options?: { isWebDappMode?: boolean },
): number {
  const isWebDappMode = options?.isWebDappMode ?? platformEnv.isWebDappMode;
  const tabMapping: Record<EUniversalSearchType, number> = {
    [EUniversalSearchType.Address]: 1,
    [EUniversalSearchType.MarketStock]: 2,
    [EUniversalSearchType.V2MarketToken]: 3,
    [EUniversalSearchType.Perp]: 5,
    [EUniversalSearchType.MarketToken]: 0,
    [EUniversalSearchType.AccountAssets]: isWebDappMode ? 0 : 6,
    [EUniversalSearchType.Dapp]: isWebDappMode ? 6 : 7,
    [EUniversalSearchType.Settings]: isWebDappMode ? 7 : 8,
  };

  return tabMapping[searchType];
}

export function shouldPrioritizeMarketSearchSections({
  isFocusInMarketRoute,
  initialTab,
}: {
  isFocusInMarketRoute: boolean;
  initialTab?: 'market' | 'dapp';
}): boolean {
  return isFocusInMarketRoute || initialTab === 'market';
}

export function resolveUniversalSearchInitialTabName({
  initialTab,
  allTabTitle,
  dappTabTitle,
}: {
  initialTab?: 'market' | 'dapp';
  allTabTitle: string;
  dappTabTitle: string;
}): string {
  if (initialTab === 'dapp') {
    return dappTabTitle;
  }
  // Market used to land on the Market tab. After stocks were split out,
  // that hid the Stocks section on native Discovery / extension, where
  // ETabRoutes.Market is not focused. Open All so both groups stay visible.
  return allTabTitle;
}

export function prioritizeMarketFocusedSections<T extends { tabIndex: number }>(
  sections: T[],
  tabIndexes: { stocks: number; market: number; perp: number },
): T[] {
  const stocksSection = sections.find(
    (section) => section.tabIndex === tabIndexes.stocks,
  );
  const marketSection = sections.find(
    (section) => section.tabIndex === tabIndexes.market,
  );
  const perpSection = sections.find(
    (section) => section.tabIndex === tabIndexes.perp,
  );
  const otherSections = sections.filter(
    (section) =>
      section.tabIndex !== tabIndexes.stocks &&
      section.tabIndex !== tabIndexes.market &&
      section.tabIndex !== tabIndexes.perp,
  );

  if (!stocksSection && !marketSection) {
    return sections;
  }

  return [marketSection, stocksSection, perpSection, ...otherSections].filter(
    (section): section is T => Boolean(section),
  );
}

export function getUniversalSearchWatchlistKey(
  item: IUniversalSearchResultItem,
): string | undefined {
  if (item.type === EUniversalSearchType.MarketStock) {
    return item.payload.stockId ? `stock:${item.payload.stockId}` : undefined;
  }
  if (item.type === EUniversalSearchType.V2MarketToken) {
    if (item.payload.stockId) {
      return `stock:${item.payload.stockId}`;
    }
    if (item.payload.network && item.payload.address) {
      return `${item.payload.network}:${
        normalizeTokenContractAddress({
          networkId: item.payload.network,
          contractAddress: item.payload.address,
        }) || item.payload.address
      }`;
    }
    return undefined;
  }
  if (item.type === EUniversalSearchType.Perp) {
    const coin =
      buildCoinFromSearchAssetType({
        assetType: item.payload.assetType,
        name: item.payload.name,
      }) ?? item.payload.name;
    return coin ? `perps:${coin}` : undefined;
  }
  return undefined;
}
