import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
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

export type IDetailSelectorDefaultCategory =
  | 'trending'
  | 'top_coins'
  | 'stocks';

export type IDetailSelectorBrowseTab = 'favorites' | 'stocks' | 'tokens';

const DETAIL_SELECTOR_TOKEN_CATEGORY = 'trending';
const DETAIL_SELECTOR_STOCK_CATEGORY = 'all';
const EMPTY_DETAIL_SELECTOR_CATEGORIES: IMarketCategoryItem[] = [];

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

const SelectorTabItem = memo(
  ({
    id,
    name,
    isFocused,
    onPress,
  }: {
    id: IDetailSelectorBrowseTab;
    name: string;
    isFocused: boolean;
    onPress: (id: IDetailSelectorBrowseTab) => void;
  }) => {
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <XStack
        testID={`market-token-selector-tab-${id}`}
        py="$3"
        ml="$4"
        mr="$2"
        borderBottomWidth={isFocused ? '$0.5' : '$0'}
        borderBottomColor="$borderActive"
        onPress={handlePress}
        cursor="default"
      >
        <SizableText
          size="$bodyLgMedium"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
SelectorTabItem.displayName = 'SelectorTabItem';

export function DetailSelectorBrowseTabs({
  value,
  onChange,
}: {
  value: IDetailSelectorBrowseTab;
  onChange: (tabId: IDetailSelectorBrowseTab) => void;
}) {
  const intl = useIntl();
  return (
    <XStack
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      bg="$bg"
      px="$0"
    >
      {(['favorites', 'stocks', 'tokens'] as const).map((tabId) => (
        <SelectorTabItem
          key={tabId}
          id={tabId}
          name={intl.formatMessage({ id: BROWSE_TAB_LABELS[tabId] })}
          isFocused={value === tabId}
          onPress={onChange}
        />
      ))}
    </XStack>
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
  let subCategories = tokenSubCategories;
  if (isStockSelection) {
    subCategories = stockSubCategories;
  } else if (isFavoritesSelection) {
    subCategories = EMPTY_DETAIL_SELECTOR_CATEGORIES;
  }
  const selectedSubCategoryId = isStockSelection
    ? stockCategoryId
    : tokenCategoryId;

  useEffect(() => {
    if (
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
  }, [isConfigLoading, isStockSelection, selectedSubCategoryId, subCategories]);

  const isTopCoinsSelection =
    !isFavoritesSelection &&
    !isStockSelection &&
    tokenCategoryId === MARKET_TOP_COINS_CATEGORY_ID;
  const selectorTimeRange: IMarketTimeRangeValue =
    isFavoritesSelection || isTopCoinsSelection ? '24h' : '1h';

  const handleBrowseTabChange = useCallback((tabId: string) => {
    if (!isDetailSelectorBrowseTab(tabId)) {
      return;
    }
    setBrowseTab(tabId);
  }, []);

  const handleSubCategoryChange = useCallback(
    (categoryId: string) => {
      if (isStockSelection) {
        setStockCategoryId(categoryId);
        return;
      }
      setTokenCategoryId(categoryId);
    },
    [isStockSelection],
  );

  return {
    browseTab,
    setBrowseTab,
    isFavoritesSelection,
    isStockSelection,
    isTopCoinsSelection,
    tokenCategoryId,
    stockCategoryId,
    subCategories,
    selectedSubCategoryId,
    selectorTimeRange,
    handleBrowseTabChange,
    handleSubCategoryChange,
  };
}
