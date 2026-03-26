import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  Page,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import { useScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useMarketWatchListV2Atom,
  useSelectedNetworkIdAtom,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useMarketPerpsTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketPerpsToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { MarketPerpsCategorySelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/MarketPerpsCategorySelector';
import { MarketPerpsTokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/MarketPerpsTokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { useMarketTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketWatchlistCategorySelector';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import {
  EJotaiContextStoreNames,
  type IMarketTokenSelectorTab,
  useMarketTokenSelectorConfigAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type { LayoutChangeEvent } from 'react-native';

// ---------------------------------------------------------------------------
// Tab item component (reusable pill-shaped tab)
// ---------------------------------------------------------------------------
const TabItem = memo(
  ({
    id,
    name,
    isFocused,
    onPress,
  }: {
    id: string;
    name: string;
    isFocused: boolean;
    onPress: (id: string) => void;
  }) => {
    const { handleItemLayout } = useScrollableFilterBar();
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <XStack
        alignItems="center"
        justifyContent="center"
        px="$2.5"
        py="$1.5"
        borderRadius="$full"
        userSelect="none"
        cursor="default"
        backgroundColor={isFocused ? '$bgActive' : '$transparent'}
        onPress={handlePress}
        onLayout={(event: LayoutChangeEvent) => handleItemLayout(id, event)}
      >
        <SizableText
          numberOfLines={1}
          size="$bodyMdMedium"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);
TabItem.displayName = 'MobileTokenSelectorTabItem';

// ---------------------------------------------------------------------------
// Watchlist list
// ---------------------------------------------------------------------------
function WatchlistList({
  searchQuery,
  onSelectToken,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
}) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const [selectedFilter, setSelectedFilter] =
    useState<IWatchlistFilterType>('all');

  const { data, isLoading } = useMarketWatchlistTokenList({
    watchlist: watchlistState.data || [],
    initialSortBy: 'v24hUSD',
    initialSortType: 'desc',
  });

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query),
    );
  }, [data, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem item={item} onPress={() => onSelectToken(item)} />
    ),
    [onSelectToken],
  );

  const keyExtractor = useCallback(
    (item: IMarketToken) =>
      `watchlist-${item.address}-${item.symbol}-${item.networkId}`,
    [],
  );

  if (isLoading && data.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack flex={1}>
      <MarketWatchlistCategorySelector
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <ListView
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={60}
        showsVerticalScrollIndicator={false}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Spot list
// ---------------------------------------------------------------------------
function SpotList({
  searchQuery,
  onSelectToken,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
}) {
  const [selectedNetworkId, setSelectedNetworkId] = useSelectedNetworkIdAtom();

  useEffect(() => {
    if (!selectedNetworkId) {
      const allNetworkId = getNetworkIdsMap().onekeyall;
      setSelectedNetworkId(allNetworkId);
    }
  }, [selectedNetworkId, setSelectedNetworkId]);

  const effectiveNetworkId = selectedNetworkId || getNetworkIdsMap().onekeyall;

  const { data, isLoading, isLoadingMore, canLoadMore, loadMore } =
    useMarketTokenList({
      networkId: effectiveNetworkId,
      initialSortBy: 'v24hUSD',
      initialSortType: 'desc',
      pageSize: 20,
    });

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query),
    );
  }, [data, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem item={item} onPress={() => onSelectToken(item)} />
    ),
    [onSelectToken],
  );

  const keyExtractor = useCallback(
    (item: IMarketToken) =>
      `spot-${item.address}-${item.symbol}-${item.networkId}`,
    [],
  );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  if (isLoading && data.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack flex={1}>
      <MarketTokenListNetworkSelector
        selectedNetworkId={effectiveNetworkId}
        onSelectNetworkId={setSelectedNetworkId}
        placement="bottom-start"
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <ListView
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={60}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Futures/Perps list — uses real perps data and navigates to Perps tab
// ---------------------------------------------------------------------------
function FuturesList({
  searchQuery,
  onCloseModal,
}: {
  searchQuery: string;
  onCloseModal: () => void;
}) {
  const { perpsCategories: rawPerpsCategories } = useMarketBasicConfig();
  const { navigateToPerps } = usePerpsNavigation();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    perpsCategories[0]?.tabId ?? '',
  );

  useEffect(() => {
    if (!selectedCategoryId && perpsCategories[0]?.tabId) {
      setSelectedCategoryId(perpsCategories[0].tabId);
    }
  }, [selectedCategoryId, perpsCategories]);

  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const query = searchQuery.toLowerCase();
    return tokens.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query),
    );
  }, [tokens, searchQuery]);

  const handleSelectPerpsToken = useCallback(
    (coin: string) => {
      onCloseModal();
      navigateToPerps(coin);
    },
    [onCloseModal, navigateToPerps],
  );

  const renderItem = useCallback(
    ({ item }: { item: IMarketPerpsToken }) => (
      <MarketPerpsTokenListItem
        item={item}
        onPress={() => handleSelectPerpsToken(item.name)}
      />
    ),
    [handleSelectPerpsToken],
  );

  const keyExtractor = useCallback(
    (item: IMarketPerpsToken) => `futures-${item.name}`,
    [],
  );

  if (isLoading && tokens.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack flex={1}>
      <MarketPerpsCategorySelector
        categories={perpsCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <ListView
        data={filteredTokens}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={60}
        showsVerticalScrollIndicator={false}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Main modal content
// ---------------------------------------------------------------------------
function MobileTokenSelectorContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tokenDetailActions = useTokenDetailActions();
  const { navigateToPerps } = usePerpsNavigation();

  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const activeTab = selectorConfig.activeTab;

  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryRaw(query.trim().slice(0, 64));
  }, []);

  const setActiveTab = useCallback(
    (tab: string) => {
      startTransition(() => {
        setSelectorConfig((prev) => ({
          ...prev,
          activeTab: tab as IMarketTokenSelectorTab,
        }));
      });
    },
    [setSelectorConfig],
  );

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      // Perps token — navigate to Perps tab (same as Market home)
      if (item.perpsCoin) {
        navigation.popStack();
        navigateToPerps(item.perpsCoin);
        return;
      }

      const shortCode = networkUtils.getNetworkShortCode({
        networkId: item.networkId,
      });

      tokenDetailActions.current.changeActiveToken({
        tokenAddress: item.address,
        networkId: item.networkId,
        isNative: item.isNative ?? false,
      });

      navigation.popStack();

      const targetTab = platformEnv.isNative
        ? ETabRoutes.Discovery
        : ETabRoutes.Market;
      const params = {
        tokenAddress: item.address,
        network: shortCode || item.networkId,
        isNative: item.isNative,
      };
      setTimeout(() => {
        rootNavigationRef.current?.navigate(ERootRoutes.Main, {
          screen: targetTab,
          params: {
            screen: ETabMarketRoutes.MarketDetailV2,
            params,
          },
        });
      }, 100);
    },
    [tokenDetailActions, navigation, navigateToPerps],
  );

  const tabNames = useMemo(
    () => ({
      watchlist: intl.formatMessage({ id: ETranslations.global_favorites }),
      spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      futures: intl.formatMessage({ id: ETranslations.global_perp }),
    }),
    [intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.dexmarket_details_overview,
        })}
      />
      <Page.Body>
        <YStack flex={1}>
          {/* Search — uncontrolled value for debounce (Perps pattern) */}
          <YStack px="$5" pb="$2">
            <SearchBar
              autoFocus
              onChangeText={setSearchQuery}
              placeholder={intl.formatMessage({
                id: ETranslations.global_search_asset,
              })}
            />
          </YStack>

          {/* Tab bar — direct TabItem rendering (Perps pattern) */}
          <XStack
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            bg="$bg"
            px="$5"
          >
            <TabItem
              id="watchlist"
              name={tabNames.watchlist}
              isFocused={activeTab === 'watchlist'}
              onPress={setActiveTab}
            />
            <TabItem
              id="spot"
              name={tabNames.spot}
              isFocused={activeTab === 'spot'}
              onPress={setActiveTab}
            />
            <TabItem
              id="futures"
              name={tabNames.futures}
              isFocused={activeTab === 'futures'}
              onPress={setActiveTab}
            />
          </XStack>

          {/* Tab content */}
          <YStack flex={1}>
            {activeTab === 'watchlist' ? (
              <WatchlistList
                searchQuery={searchQuery}
                onSelectToken={handleSelectToken}
              />
            ) : null}
            {activeTab === 'spot' ? (
              <SpotList
                searchQuery={searchQuery}
                onSelectToken={handleSelectToken}
              />
            ) : null}
            {activeTab === 'futures' ? (
              <FuturesList
                searchQuery={searchQuery}
                onCloseModal={() => navigation.popStack()}
              />
            ) : null}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Default export (wrapped with providers for lazy loading)
// ---------------------------------------------------------------------------
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
