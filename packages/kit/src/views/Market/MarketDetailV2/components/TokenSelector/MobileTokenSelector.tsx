import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack, Toast, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import { MarketStockCategorySelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketStockCategorySelector';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  isMarketTopCoinNavigationSuppressed,
  useMarketTopCoins,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import { useSwapProTokenSearch } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapPro';
import {
  EJotaiContextStoreNames,
  useMarketTokenSelectorConfigAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketAssetListItem,
  IMarketSearchV2Token,
} from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';
import {
  buildMarketSearchTokenDetailPreview,
  buildMarketTokenDetailPreview,
} from '../../utils/marketDetailPreview';

import { getSelectorSearchAssetId } from './constants';
import {
  DETAIL_SELECTOR_TOKEN_CATEGORY,
  DetailSelectorBrowseTabs,
  type IDetailSelectorBrowseTab,
  type IDetailSelectorDefaultCategory,
  useDetailSelectorBrowseState,
} from './detailSelectorBrowse';
import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';
import {
  MobileSelectorCategoryTokenList,
  MobileSelectorStockList,
  MobileSelectorTopCoinsList,
  MobileSelectorWatchlistList,
} from './MobileMarketSelectorBrowseLists';
import { MobileMarketTokenSelectorSearchResults } from './MobileMarketTokenSelectorSearchResults';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';
import { useLiveTokenOverride } from './useLiveTokenOverride';
import { useMobileStockSelectorNavigation } from './useMobileStockSelectorNavigation';
import {
  SelectorListMeasurementsContext,
  useSelectorSwipeKeyboardDismiss,
} from './useSelectorSwipeKeyboardDismiss';

function normalizeRouteBooleanParam(value: boolean | string | undefined) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value;
}

function MobileTokenSelectorContent() {
  const intl = useIntl();
  const route = useRoute();
  const navigation = useAppNavigation();
  const tokenDetailActions = useTokenDetailActions();
  const { navigateToPerps } = usePerpsNavigation();
  const toMarketStockDetailPage = useToMarketStockDetailPage({
    replaceCurrentDetail: true,
  });
  const routeParams = route.params as
    | {
        showFavoriteButton?: boolean | string;
        defaultCategory?: IDetailSelectorDefaultCategory;
      }
    | undefined;
  const showFavoriteButton = normalizeRouteBooleanParam(
    routeParams?.showFavoriteButton,
  );
  const defaultCategory = routeParams?.defaultCategory ?? 'trending';

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode } = selectorConfig;
  const {
    browseTab,
    isFavoritesSelection,
    isStockSelection,
    isTopCoinsSelection,
    tokenCategoryId,
    stockCategoryId,
    watchlistFilter,
    subCategories,
    selectedSubCategoryId,
    selectorTimeRange,
    handleBrowseTabChange: setBrowseTab,
    handleSubCategoryChange,
  } = useDetailSelectorBrowseState({
    defaultCategory,
    isWatchlistMode,
  });

  const [searchValue, setSearchValue] = useState('');
  const searchValueDebounce = useDebounce(searchValue, 500);
  const searchQuery = searchValueDebounce.trim();
  const { searchLoading, searchTokenList } = useSwapProTokenSearch(searchQuery);
  const liveTokenOverride = useLiveTokenOverride();
  const { swipeKeyboardDismissProps, listMeasurements } =
    useSelectorSwipeKeyboardDismiss();
  // Controls are outside the list and need dismissal even when the list scrolls.
  const { swipeKeyboardDismissProps: controlsSwipeKeyboardDismissProps } =
    useSelectorSwipeKeyboardDismiss();

  useEffect(() => {
    if (!searchQuery) {
      return;
    }
    searchTokenList.slice(0, 20).forEach((token) => {
      prewarmMarketTokenImages({
        tokenImageUri: token.logoUrl,
        tokenImageUris: token.logoUrls,
      });
    });
  }, [searchTokenList, searchQuery]);

  const handleBrowseTabChange = useCallback(
    (tabId: IDetailSelectorBrowseTab) => {
      setBrowseTab(tabId);
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: tabId === 'favorites',
      }));
    },
    [setBrowseTab, setSelectorConfig],
  );

  const navigationRequestIdRef = useRef(0);
  const navigateToTokenDetail = useCallback(
    (token: {
      address: string;
      networkId: string;
      assetId?: string;
      stockId?: string;
      isNative?: boolean;
      perpsCoin?: string;
      tokenDetailPreview?: IMarketTokenDetailPreview;
    }) => {
      navigationRequestIdRef.current += 1;
      const requestId = navigationRequestIdRef.current;
      dismissMobileTokenSelectorKeyboard();
      if (token.perpsCoin) {
        navigation.popStack();
        navigateToPerps(token.perpsCoin);
        return;
      }

      void navigateToMarketTokenDetail(token, {
        isCurrentRequest: () => requestId === navigationRequestIdRef.current,
        onError: () =>
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          }),
        tokenDetailActions,
        beforeNavigate: () => navigation.popStack(),
        showFavoriteButton,
        resolveMarketAsset: isFavoritesSelection || Boolean(searchQuery),
        marketTokenCategory:
          isFavoritesSelection || isTopCoinsSelection || searchQuery
            ? undefined
            : tokenCategoryId,
        tokenDetailPreview: token.tokenDetailPreview,
      });
    },
    [
      intl,
      tokenDetailActions,
      navigation,
      navigateToPerps,
      searchQuery,
      showFavoriteButton,
      isFavoritesSelection,
      isTopCoinsSelection,
      tokenCategoryId,
    ],
  );

  const {
    data: topCoins,
    isLoading: isTopCoinsLoading,
    isError: isTopCoinsError,
    refresh: refreshTopCoins,
  } = useMarketTopCoins();
  const handleTopCoinSelect = useCallback(
    (item: IMarketAssetListItem) => {
      if (isMarketTopCoinNavigationSuppressed()) {
        return;
      }
      navigateToTokenDetail({
        address: '',
        networkId: '',
        assetId: item.assetId,
      });
    },
    [navigateToTokenDetail],
  );

  const handleTokenSelect = useCallback(
    (item: IMarketToken) => {
      navigateToTokenDetail({
        ...item,
        tokenDetailPreview: buildMarketTokenDetailPreview(item),
      });
    },
    [navigateToTokenDetail],
  );

  const handleSearchTokenSelect = useCallback(
    (
      token: IMarketSearchV2Token & {
        networkLogoURI: string;
        perpsCoin?: string;
      },
    ) => {
      if (token.perpsCoin) {
        navigateToTokenDetail({
          address: '',
          networkId: '',
          perpsCoin: token.perpsCoin,
        });
        return;
      }
      prewarmMarketTokenImages({
        tokenImageUri: token.logoUrl,
        tokenImageUris: token.logoUrls,
      });
      const tokenDetailPreview = buildMarketSearchTokenDetailPreview(token);
      navigateToTokenDetail({
        address: token.address,
        networkId: token.network,
        isNative: token.isNative,
        assetId: getSelectorSearchAssetId(token),
        stockId: token.stockId,
        tokenDetailPreview,
      });
    },
    [navigateToTokenDetail],
  );

  // The Trending chip names its fixed window, e.g. "24h Trending".
  const chipCategories = useMemo(
    () =>
      subCategories.map((category) =>
        category.id === DETAIL_SELECTOR_TOKEN_CATEGORY
          ? {
              ...category,
              name: intl.formatMessage(
                { id: ETranslations.market_trending_in_range },
                { range: selectorTimeRange },
              ),
            }
          : category,
      ),
    [intl, selectorTimeRange, subCategories],
  );

  const handleSearchStockSelect = useMobileStockSelectorNavigation({
    navigate: toMarketStockDetailPage,
    requestIdRef: navigationRequestIdRef,
    closeSelector: () => navigation.popStack(),
    onError: () =>
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      }),
  });

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        {/* 10px to the tabs, as in the desktop popover and universal search. */}
        <Stack px="$5" pb="$2.5">
          <SearchBar
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.market_search_token_stock_address,
            })}
            value={searchValue}
            onChangeText={setSearchValue}
          />
        </Stack>

        <SelectorListMeasurementsContext.Provider value={listMeasurements}>
          <YStack
            flex={1}
            testID="market-token-selector-results"
            {...swipeKeyboardDismissProps}
          >
            {searchQuery ? (
              <MobileMarketTokenSelectorSearchResults
                query={searchQuery}
                marketItems={searchTokenList}
                isMarketLoading={searchLoading}
                onStockPress={handleSearchStockSelect}
                onMarketPress={handleSearchTokenSelect}
              />
            ) : (
              <>
                <YStack
                  testID="market-token-selector-browse-controls"
                  {...controlsSwipeKeyboardDismissProps}
                >
                  <DetailSelectorBrowseTabs
                    backgroundColor="$bgApp"
                    value={browseTab}
                    onChange={handleBrowseTabChange}
                  />
                  {/* Figma 26934:146096 — 16px above the chips and 10px below;
               a tab without chips starts its list 10px under the tabs. */}
                  {subCategories.length > 0 ? (
                    <MarketStockCategorySelector
                      categories={chipCategories}
                      selectedCategoryId={selectedSubCategoryId}
                      onSelectCategory={handleSubCategoryChange}
                      containerStyle={{ px: '$5', pt: '$4', pb: '$2.5' }}
                    />
                  ) : (
                    <YStack h="$2.5" />
                  )}
                </YStack>
                {isFavoritesSelection ? (
                  <MobileSelectorWatchlistList
                    watchlistFilter={watchlistFilter}
                    onItemPress={handleTokenSelect}
                    liveTokenOverride={liveTokenOverride}
                  />
                ) : null}
                {isStockSelection ? (
                  <MobileSelectorStockList
                    category={stockCategoryId}
                    onItemPress={handleSearchStockSelect}
                  />
                ) : null}
                {!isFavoritesSelection &&
                !isStockSelection &&
                isTopCoinsSelection ? (
                  <MobileSelectorTopCoinsList
                    data={topCoins}
                    isLoading={Boolean(isTopCoinsLoading)}
                    isError={isTopCoinsError}
                    onRetry={() => void refreshTopCoins()}
                    onItemPress={handleTopCoinSelect}
                  />
                ) : null}
                {!isFavoritesSelection &&
                !isStockSelection &&
                !isTopCoinsSelection ? (
                  <MobileSelectorCategoryTokenList
                    category={tokenCategoryId}
                    timeRange={selectorTimeRange}
                    onItemPress={handleTokenSelect}
                    liveTokenOverride={liveTokenOverride}
                  />
                ) : null}
              </>
            )}
          </YStack>
        </SelectorListMeasurementsContext.Provider>
      </Page.Body>
    </Page>
  );
}

function MobileTokenSelectorModal() {
  return (
    <MarketWatchListProviderMirrorV2
      storeName={EJotaiContextStoreNames.marketWatchListV2}
    >
      <MobileTokenSelectorContent />
    </MarketWatchListProviderMirrorV2>
  );
}

export default MobileTokenSelectorModal;
