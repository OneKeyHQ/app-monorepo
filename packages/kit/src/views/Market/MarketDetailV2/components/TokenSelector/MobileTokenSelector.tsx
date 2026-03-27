import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useMarketWatchListV2Atom,
  useTokenDetailActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { MarketListColumnHeader } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListColumnHeader';
import { useMarketPerpsTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketPerpsToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { MarketPerpsCategorySelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/MarketPerpsCategorySelector';
import { MarketPerpsTokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/MarketPerpsTokenListItem';
import { MarketRecommendList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketRecommendList';
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
  type IWatchlistSelectorFilter,
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

// ---------------------------------------------------------------------------
// Tab item component — underline style matching Market home Tabs.TabBar
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
    const handlePress = useCallback(() => onPress(id), [id, onPress]);
    return (
      <YStack
        alignItems="center"
        justifyContent="center"
        h={44}
        ml="$5"
        userSelect="none"
        cursor="default"
        onPress={handlePress}
        position="relative"
      >
        <SizableText
          numberOfLines={1}
          size="$bodyMdMedium"
          color={isFocused ? '$text' : '$textSubdued'}
        >
          {name}
        </SizableText>
        {isFocused ? (
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            h="$0.5"
            bg="$text"
            borderRadius={1}
          />
        ) : null}
      </YStack>
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
  selectedFilter,
  onSelectFilter,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  selectedFilter: string;
  onSelectFilter: (filter: IWatchlistFilterType) => void;
}) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const { recommendedTokens } = useMarketBasicConfig();
  const watchlist = watchlistState.data || [];

  const { data, isLoading } = useMarketWatchlistTokenList({
    watchlist,
    initialSortBy: 'v24hUSD',
    initialSortType: 'desc',
  });

  // Freeze snapshot — only capture on initial load, ignore polling (Perps pattern)
  const [snapshot, setSnapshot] = useState<IMarketToken[]>([]);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (data.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setSnapshot(data);
    }
  }, [data]);
  const stableData = initializedRef.current ? snapshot : data;

  const filteredData = useMemo(() => {
    let filtered = stableData;
    if (selectedFilter === 'spot') {
      filtered = filtered.filter((item) => !item.perpsCoin);
    } else if (selectedFilter === 'perps') {
      filtered = filtered.filter((item) => !!item.perpsCoin);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query),
      );
    }
    return filtered;
  }, [stableData, searchQuery, selectedFilter]);

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

  if (isLoading && stableData.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  if (watchlist.length === 0) {
    return <MarketRecommendList recommendedTokens={recommendedTokens} maxSize={6} />;
  }

  return (
    <YStack flex={1}>
      <MarketWatchlistCategorySelector
        selectedFilter={selectedFilter as IWatchlistFilterType}
        onSelectFilter={onSelectFilter}
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <MarketListColumnHeader />
      <ListView
        useFlashList
        windowSize={3}
        initialNumToRender={10}
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
  selectedNetworkId,
  onNetworkIdChange,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  selectedNetworkId: string;
  onNetworkIdChange: (networkId: string) => void;
}) {
  const { data, isLoading, isLoadingMore, canLoadMore, loadMore } =
    useMarketTokenList({
      networkId: selectedNetworkId,
      initialSortBy: 'v24hUSD',
      initialSortType: 'desc',
      pageSize: 20,
    });

  // Freeze snapshot — only capture on initial load, ignore polling (Perps pattern)
  const [snapshot, setSnapshot] = useState<IMarketToken[]>([]);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (data.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setSnapshot(data);
    }
  }, [data]);
  const stableData = initializedRef.current ? snapshot : data;

  const filteredData = useMemo(() => {
    if (!searchQuery) return stableData;
    const query = searchQuery.toLowerCase();
    return stableData.filter(
      (item) =>
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query),
    );
  }, [stableData, searchQuery]);

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

  if (isLoading && stableData.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack flex={1}>
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={onNetworkIdChange}
        placement="bottom-start"
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <MarketListColumnHeader />
      <ListView
        useFlashList
        windowSize={3}
        initialNumToRender={10}
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
  selectedCategoryId,
  onSelectCategory,
}: {
  searchQuery: string;
  onCloseModal: () => void;
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}) {
  const { navigateToPerps } = usePerpsNavigation();
  const { perpsCategories: rawPerpsCategories } = useMarketBasicConfig();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  const effectiveCategoryId =
    selectedCategoryId || perpsCategories[0]?.tabId || '';
  useEffect(() => {
    if (!selectedCategoryId && perpsCategories[0]?.tabId) {
      onSelectCategory(perpsCategories[0].tabId);
    }
  }, [selectedCategoryId, perpsCategories, onSelectCategory]);

  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId: effectiveCategoryId,
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
        selectedCategoryId={effectiveCategoryId}
        onSelectCategory={onSelectCategory}
        containerStyle={{ px: '$5', pt: '$3', pb: '$2' }}
      />
      <ListView
        useFlashList
        windowSize={3}
        initialNumToRender={10}
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

  // --- All selector state persisted in atom (survives remount like Perps) ---
  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { activeTab, watchlistFilter, spotNetworkId, perpsCategoryId } =
    selectorConfig;

  // --- Search state (local, resets on remount is OK) ---
  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryRaw(query.trim().slice(0, 64));
  }, []);
  const debouncedQuery = useDebounce(searchQuery, 200);

  const effectiveSpotNetworkId = spotNetworkId || getNetworkIdsMap().onekeyall;

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

  const setWatchlistFilter = useCallback(
    (filter: IWatchlistSelectorFilter) => {
      setSelectorConfig((prev) => ({ ...prev, watchlistFilter: filter }));
    },
    [setSelectorConfig],
  );

  const setSpotNetworkId = useCallback(
    (id: string) => {
      setSelectorConfig((prev) => ({ ...prev, spotNetworkId: id }));
    },
    [setSelectorConfig],
  );

  const setPerpsCategoryId = useCallback(
    (id: string) => {
      setSelectorConfig((prev) => ({ ...prev, perpsCategoryId: id }));
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
            bg="$bgApp"
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
                searchQuery={debouncedQuery}
                onSelectToken={handleSelectToken}
                selectedFilter={watchlistFilter}
                onSelectFilter={setWatchlistFilter}
              />
            ) : null}
            {activeTab === 'spot' ? (
              <SpotList
                searchQuery={debouncedQuery}
                onSelectToken={handleSelectToken}
                selectedNetworkId={effectiveSpotNetworkId}
                onNetworkIdChange={setSpotNetworkId}
              />
            ) : null}
            {activeTab === 'futures' ? (
              <FuturesList
                searchQuery={debouncedQuery}
                onCloseModal={() => navigation.popStack()}
                selectedCategoryId={perpsCategoryId}
                onSelectCategory={setPerpsCategoryId}
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
