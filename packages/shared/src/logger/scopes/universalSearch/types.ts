import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

const searchTypeTrackingNameMap: Record<EUniversalSearchType, string> = {
  [EUniversalSearchType.Address]: 'address',
  [EUniversalSearchType.MarketToken]: 'tokens',
  [EUniversalSearchType.V2MarketToken]: 'market',
  [EUniversalSearchType.AccountAssets]: 'myAssets',
  [EUniversalSearchType.Dapp]: 'dApps',
  [EUniversalSearchType.Perp]: 'perps',
  [EUniversalSearchType.Settings]: 'settings',
};

export function getSearchTypeTrackingName(type: EUniversalSearchType): string {
  return searchTypeTrackingNameMap[type] ?? type;
}

export interface IUniversalSearchParams {
  /**
   * The search text entered by the user
   */
  searchText: string;
  /**
   * Total number of search results
   */
  resultCount: number;
  /**
   * Per-type result breakdown, e.g. "market:5,perps:3,settings:2"
   */
  exposedTypes: string;
}

export interface ISearchResultClickParams {
  searchText: string;
  type: EUniversalSearchType;
  itemId: string;
  itemTitle: string;
}
