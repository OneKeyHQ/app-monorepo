import { isMarketSearchStockListing } from '@onekeyhq/shared/src/utils/marketSearchStock';

export const MARKET_SEARCH_TABS = {
  all: 'all',
  tokens: 'tokens',
  stocks: 'stocks',
} as const;

export type IMarketSearchTab =
  (typeof MARKET_SEARCH_TABS)[keyof typeof MARKET_SEARCH_TABS];

/**
 * A type tab shows only when it has results; All is always first. Pass
 * `hasTokenResults` as true while tokens are still loading so the tab does not
 * flicker away and back.
 */
export function getDetailPopoverSearchTabs(
  hasStockResults: boolean,
  hasTokenResults = true,
): IMarketSearchTab[] {
  const tabs: IMarketSearchTab[] = [MARKET_SEARCH_TABS.all];
  if (hasStockResults) {
    tabs.push(MARKET_SEARCH_TABS.stocks);
  }
  if (hasTokenResults) {
    tabs.push(MARKET_SEARCH_TABS.tokens);
  }
  return tabs;
}

export function isDetailSearchChainToken(item: {
  stockId?: string;
  address?: string;
  network?: string;
  networkId?: string;
}): boolean {
  return !isMarketSearchStockListing({
    stockId: item.stockId,
    address: item.address ?? '',
    network: item.network ?? item.networkId ?? '',
  });
}

type IPreviewSection<T> = {
  tabIndex: number;
  data: T[];
  sliceData?: T[];
  showMore?: boolean;
};

/**
 * The search All tab's preview of the stock and token sections, shared by the
 * Market detail selector and universal search: when one of them is the only
 * section with results, it lists every row; otherwise each shows the first
 * `previewLimit` rows and a Show more (stocks also when another page is
 * left). Other sections keep their own preview.
 */
export function applyMarketSectionPreview<S extends IPreviewSection<unknown>>(
  sections: S[],
  {
    stockTabIndex,
    tokenTabIndex,
    previewLimit,
    stockCanLoadMore,
  }: {
    stockTabIndex: number;
    tokenTabIndex: number;
    previewLimit: number;
    stockCanLoadMore: boolean;
  },
): S[] {
  const isPreview =
    sections.filter((section) => section.data.length > 0).length > 1;
  return sections.map((section) => {
    const isStock = section.tabIndex === stockTabIndex;
    if (!isStock && section.tabIndex !== tokenTabIndex) {
      return section;
    }
    if (!isPreview) {
      return { ...section, sliceData: section.data, showMore: false };
    }
    return {
      ...section,
      sliceData: section.data.slice(0, previewLimit),
      showMore:
        section.data.length > previewLimit || (isStock && stockCanLoadMore),
    };
  });
}
