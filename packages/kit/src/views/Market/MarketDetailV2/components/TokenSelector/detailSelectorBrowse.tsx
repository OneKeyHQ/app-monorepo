import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import type {
  IMarketCategoryItem,
  IMarketTimeRangeValue,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import {
  ensureMarketTopCoinsCategory,
  getMarketHomeFallbackSpotCategories,
  isMarketStockCategory,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SelectorTabBar } from './selectorTabBar';

export type IDetailSelectorDefaultCategory =
  | 'trending'
  | 'top_coins'
  | 'stocks';

export type IDetailSelectorBrowseTab = 'favorites' | 'stocks' | 'tokens';
export type IDetailSelectorWatchlistFilter =
  | 'all'
  | 'spot'
  | 'stocks'
  | 'perps';

export const DETAIL_SELECTOR_TOKEN_CATEGORY = 'trending';
const DETAIL_SELECTOR_STOCK_CATEGORY = 'all';

const BROWSE_TAB_LABELS: Record<IDetailSelectorBrowseTab, ETranslations> = {
  favorites: ETranslations.global_favorites,
  stocks: ETranslations.perps_token_selector_stocks,
  tokens: ETranslations.global_universal_search_tabs_tokens,
};

export function getInitialDetailSelectorTokenCategory({
  defaultCategory,
  marketTokenCategory,
}: {
  defaultCategory: IDetailSelectorDefaultCategory;
  marketTokenCategory?: string;
}): string {
  const categoryId = marketTokenCategory?.trim();
  if (categoryId && !isMarketStockCategory({ id: categoryId, name: '' })) {
    return categoryId;
  }
  if (defaultCategory === 'top_coins') {
    return MARKET_TOP_COINS_CATEGORY_ID;
  }
  return DETAIL_SELECTOR_TOKEN_CATEGORY;
}

export function getInitialDetailSelectorBrowseTab({
  defaultCategory,
  isWatchlistMode,
}: {
  defaultCategory: IDetailSelectorDefaultCategory;
  isWatchlistMode: boolean;
}): IDetailSelectorBrowseTab {
  if (defaultCategory === 'stocks') {
    return 'stocks';
  }
  if (isWatchlistMode) {
    return 'favorites';
  }
  return 'tokens';
}

function isDetailSelectorBrowseTab(
  tabId: string,
): tabId is IDetailSelectorBrowseTab {
  return tabId === 'favorites' || tabId === 'stocks' || tabId === 'tokens';
}

export function DetailSelectorBrowseTabs({
  value,
  onChange,
  backgroundColor,
}: {
  value: IDetailSelectorBrowseTab;
  onChange: (tabId: IDetailSelectorBrowseTab) => void;
  backgroundColor?: '$bg' | '$bgApp';
}) {
  const intl = useIntl();
  const tabs = useMemo(
    () =>
      (['favorites', 'stocks', 'tokens'] as const).map((tabId) => ({
        id: tabId,
        label: intl.formatMessage({ id: BROWSE_TAB_LABELS[tabId] }),
      })),
    [intl],
  );
  return (
    <SelectorTabBar
      tabs={tabs}
      value={value}
      onChange={onChange}
      testIDPrefix="market-token-selector-tab-"
      backgroundColor={backgroundColor}
    />
  );
}

export function useDetailSelectorBrowseState({
  defaultCategory,
  isWatchlistMode,
  marketTokenCategory,
}: {
  defaultCategory: IDetailSelectorDefaultCategory;
  isWatchlistMode: boolean;
  marketTokenCategory?: string;
}) {
  const intl = useIntl();
  const [{ data: watchlist, isMounted: isWatchlistMounted }] =
    useMarketWatchListV2Atom();
  const isWatchlistEmpty =
    isWatchlistMounted && !watchlist?.some((item) => !item.perpsCoin);
  const [browseTab, setBrowseTab] = useState<IDetailSelectorBrowseTab>(() =>
    getInitialDetailSelectorBrowseTab({
      defaultCategory,
      isWatchlistMode,
    }),
  );
  const isFavoritesSelection = browseTab === 'favorites';
  const isStockSelection = browseTab === 'stocks';
  const {
    spotCategories: apiSpotCategories,
    stockCategories: apiStockCategories,
    isLoading: isConfigLoading,
  } = useMarketBasicConfig();
  const tokenSubCategories = useMemo(() => {
    const source =
      apiSpotCategories.length > 0
        ? apiSpotCategories.map((category) => ({
            id: category.type,
            name: category.name,
          }))
        : getMarketHomeFallbackSpotCategories((descriptor) =>
            intl.formatMessage(descriptor),
          );
    return ensureMarketTopCoinsCategory(
      source.filter((category) => !isMarketStockCategory(category)),
      intl.formatMessage({ id: ETranslations.market_top_coins }),
    );
  }, [apiSpotCategories, intl]);
  const stockSubCategories = useMemo<IMarketCategoryItem[]>(
    () =>
      apiStockCategories.map((category) => ({
        id: category.category,
        name: category.name,
      })),
    [apiStockCategories],
  );
  const [tokenCategoryId, setTokenCategoryId] = useState(() =>
    getInitialDetailSelectorTokenCategory({
      defaultCategory,
      marketTokenCategory,
    }),
  );
  const [stockCategoryId, setStockCategoryId] = useState(
    DETAIL_SELECTOR_STOCK_CATEGORY,
  );
  const [selectedWatchlistFilter, setWatchlistFilter] =
    useState<IDetailSelectorWatchlistFilter>('all');
  const watchlistFilter = isWatchlistEmpty ? 'all' : selectedWatchlistFilter;

  useEffect(() => {
    if (isWatchlistEmpty) {
      setWatchlistFilter('all');
    }
  }, [isWatchlistEmpty]);
  const watchlistSubCategories = useMemo<IMarketCategoryItem[]>(
    () => [
      { id: 'all', name: intl.formatMessage({ id: ETranslations.global_all }) },
      {
        id: 'spot',
        name: intl.formatMessage({
          id: ETranslations.prime_crypto_payment__label,
        }),
      },
      {
        id: 'stocks',
        name: intl.formatMessage({
          id: ETranslations.perps_token_selector_stocks,
        }),
      },
      {
        id: 'perps',
        name: intl.formatMessage({ id: ETranslations.global_perp }),
      },
    ],
    [intl],
  );
  let subCategories = tokenSubCategories;
  let selectedSubCategoryId: string = tokenCategoryId;
  if (isStockSelection) {
    subCategories = stockSubCategories;
    selectedSubCategoryId = stockCategoryId;
  } else if (isFavoritesSelection) {
    subCategories = isWatchlistEmpty ? [] : watchlistSubCategories;
    selectedSubCategoryId = watchlistFilter;
  }

  useEffect(() => {
    if (
      isFavoritesSelection ||
      isConfigLoading !== false ||
      subCategories.length === 0 ||
      subCategories.some((category) => category.id === selectedSubCategoryId)
    ) {
      return;
    }
    const nextCategoryId = subCategories[0]?.id;
    if (!nextCategoryId) {
      return;
    }
    if (isStockSelection) {
      setStockCategoryId(nextCategoryId);
      return;
    }
    setTokenCategoryId(nextCategoryId);
  }, [
    isConfigLoading,
    isFavoritesSelection,
    isStockSelection,
    selectedSubCategoryId,
    subCategories,
  ]);

  const isTopCoinsSelection =
    !isFavoritesSelection &&
    !isStockSelection &&
    tokenCategoryId === MARKET_TOP_COINS_CATEGORY_ID;
  // Every selector list ranks and reports on the 24h window, regardless of
  // the time frame picked on the Market home.
  const selectorTimeRange: IMarketTimeRangeValue = '24h';

  const handleBrowseTabChange = useCallback((tabId: string) => {
    if (!isDetailSelectorBrowseTab(tabId)) {
      return;
    }
    setBrowseTab(tabId);
  }, []);

  const handleSubCategoryChange = useCallback(
    (categoryId: string) => {
      if (isFavoritesSelection) {
        if (
          categoryId === 'all' ||
          categoryId === 'spot' ||
          categoryId === 'stocks' ||
          categoryId === 'perps'
        ) {
          setWatchlistFilter(categoryId);
        }
        return;
      }
      if (isStockSelection) {
        setStockCategoryId(categoryId);
        return;
      }
      setTokenCategoryId(categoryId);
    },
    [isFavoritesSelection, isStockSelection],
  );

  return {
    browseTab,
    setBrowseTab,
    isFavoritesSelection,
    isStockSelection,
    isTopCoinsSelection,
    tokenCategoryId,
    stockCategoryId,
    watchlistFilter,
    subCategories,
    selectedSubCategoryId,
    selectorTimeRange,
    handleBrowseTabChange,
    handleSubCategoryChange,
  };
}
