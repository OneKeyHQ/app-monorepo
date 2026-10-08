import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Button,
  Page,
  ScrollView,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useToMarketStockDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage';
import { MobileMarketStockListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MobileMarketStockListItem';
import {
  MarketNormalTokenList,
  MarketWatchlistTokenList,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList';
import { TokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenListItem';
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
import type {
  IMarketStockPublicItem,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { prewarmMarketTokenImages } from '../../utils/marketDetailImagePreload';
import {
  buildMarketSearchTokenDetailPreview,
  buildMarketTokenDetailPreview,
} from '../../utils/marketDetailPreview';

import { ALL_NETWORK_ID, TOKEN_SELECTOR_POLLING_INTERVAL } from './constants';
import {
  DetailSelectorBrowseTabs,
  type IDetailSelectorBrowseTab,
  type IDetailSelectorDefaultCategory,
  useDetailSelectorBrowseState,
} from './detailSelectorBrowse';
import { dismissMobileTokenSelectorKeyboard } from './dismissMobileTokenSelectorKeyboard';
import { MobileMarketTokenSelectorSearchResults } from './MobileMarketTokenSelectorSearchResults';
import { navigateToMarketTokenDetail } from './navigateToMarketTokenDetail';
import { useLiveTokenOverride } from './useLiveTokenOverride';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

function normalizeRouteBooleanParam(value: boolean | string | undefined) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value;
}

function toMobileTopCoin(item: IMarketAssetListItem): IMarketToken {
  const price = Number(item.price);
  const change24h = Number(item.priceChange24hPercent);
  return {
    id: item.assetId,
    assetId: item.assetId,
    name: item.symbol.toUpperCase(),
    symbol: item.symbol.toUpperCase(),
    address: '',
    decimals: 0,
    price: Number.isFinite(price) ? price : 0,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    priceChangeRaw: item.priceChange24hPercent,
    marketCap: Number(item.marketCap) || 0,
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: Number(item.volume24h) || 0,
    tokenImageUri: item.logoUrl,
    networkLogoUri: '',
    networkId: '',
  };
}

function MobileDetailStockBrowseList({
  category,
  onItemPress,
}: {
  category: string;
  onItemPress: (item: IMarketStockPublicItem) => void;
}) {
  const intl = useIntl();
  const {
    items,
    isLoading,
    isError,
    canLoadMore,
    isLoadingMore,
    loadMore,
    refresh,
  } = useMarketStockSelectorList({ query: '', category });

  if (isLoading && items.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  if (isError && items.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_connet_error_try_again,
          })}
        </SizableText>
        <Button
          size="small"
          variant="tertiary"
          testID="mobile-market-token-selector-stock-browse-retry"
          onPress={() => void refresh()}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  return (
    <ScrollView flex={1}>
      {items.map((item) => (
        <MobileMarketStockListItem
          key={item.stockId}
          item={item}
          onPress={onItemPress}
        />
      ))}
      {canLoadMore ? (
        <Button
          alignSelf="center"
          my="$2"
          size="small"
          variant="tertiary"
          testID="mobile-market-token-selector-stock-browse-show-more"
          loading={isLoadingMore}
          onPress={() => void loadMore()}
        >
          {intl.formatMessage({ id: ETranslations.global_show_more })}
        </Button>
      ) : null}
    </ScrollView>
  );
}

function MobileDetailTopCoinsList({
  data,
  isLoading,
  onItemPress,
}: {
  data: IMarketAssetListItem[];
  isLoading: boolean;
  onItemPress: (item: IMarketAssetListItem) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: IMarketAssetListItem }) => (
      <TokenListItem
        item={toMobileTopCoin(item)}
        onPress={() => onItemPress(item)}
      />
    ),
    [onItemPress],
  );
  if (isLoading && data.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.assetId}
      renderItem={renderItem}
      initialNumToRender={12}
      maxToRenderPerBatch={20}
      windowSize={7}
      style={{ flex: 1 }}
    />
  );
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

  const { data: topCoins, isLoading: isTopCoinsLoading } = useMarketTopCoins();
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
        stockId: token.stockId,
        tokenDetailPreview,
      });
    },
    [navigateToTokenDetail],
  );

  const handleSearchStockSelect = useCallback(
    (stock: IMarketStockPublicItem) => {
      navigationRequestIdRef.current += 1;
      dismissMobileTokenSelectorKeyboard();
      // Replace the open detail while this modal is still in the root state,
      // then close the modal. Popping first hides the tab stack and stacks
      // another detail page.
      void toMarketStockDetailPage(stock).finally(() => {
        navigation.popStack();
      });
    },
    [navigation, toMarketStockDetailPage],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_search })}
      />
      <Page.Body>
        <Stack px="$5" pb="$4">
          <SearchBar
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            value={searchValue}
            onChangeText={setSearchValue}
          />
        </Stack>

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
            <DetailSelectorBrowseTabs
              value={browseTab}
              onChange={handleBrowseTabChange}
            />
            {subCategories.length > 0 ? (
              <MarketStockCategorySelector
                categories={subCategories}
                selectedCategoryId={selectedSubCategoryId}
                onSelectCategory={handleSubCategoryChange}
                containerStyle={{ px: '$4', py: '$2' }}
              />
            ) : null}
            {isFavoritesSelection ? (
              <MarketWatchlistTokenList
                onItemPress={handleTokenSelect}
                hidePerps
                liveTokenOverride={liveTokenOverride}
                pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
              />
            ) : null}
            {isStockSelection ? (
              <MobileDetailStockBrowseList
                category={stockCategoryId}
                onItemPress={handleSearchStockSelect}
              />
            ) : null}
            {!isFavoritesSelection && !isStockSelection && isTopCoinsSelection ? (
              <MobileDetailTopCoinsList
                data={topCoins}
                isLoading={Boolean(isTopCoinsLoading)}
                onItemPress={handleTopCoinSelect}
              />
            ) : null}
            {!isFavoritesSelection && !isStockSelection && !isTopCoinsSelection ? (
              <MarketNormalTokenList
                onItemPress={handleTokenSelect}
                networkId={ALL_NETWORK_ID}
                selectedCategory={tokenCategoryId}
                timeRange={selectorTimeRange}
                liveTokenOverride={liveTokenOverride}
                pollingInterval={TOKEN_SELECTOR_POLLING_INTERVAL}
              />
            ) : null}
          </>
        )}
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
