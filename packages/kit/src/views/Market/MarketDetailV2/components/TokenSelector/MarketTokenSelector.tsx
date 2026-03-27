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
  Icon,
  ListView,
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
  usePopoverContext,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
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
import { TokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { useMarketTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketWatchlistCategorySelector';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import {
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
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

const LIST_HEIGHT = 400;

// ---------------------------------------------------------------------------
// Tab item
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
TabItem.displayName = 'DesktopTokenSelectorTabItem';

// ---------------------------------------------------------------------------
// Watchlist list (desktop)
// ---------------------------------------------------------------------------
function DesktopWatchlistList({
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
    let filtered = data;
    // Apply category filter
    if (selectedFilter === 'spot') {
      filtered = filtered.filter((item) => !item.perpsCoin);
    } else if (selectedFilter === 'perps') {
      filtered = filtered.filter((item) => !!item.perpsCoin);
    }
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query),
      );
    }
    return filtered;
  }, [data, searchQuery, selectedFilter]);

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
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack>
      <MarketWatchlistCategorySelector
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <MarketListColumnHeader />
      <YStack height={LIST_HEIGHT}>
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
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Spot list (desktop)
// ---------------------------------------------------------------------------
function DesktopSpotList({
  searchQuery,
  onSelectToken,
  selectedNetworkId,
  onNetworkIdChange,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  selectedNetworkId: string;
  onNetworkIdChange: (id: string) => void;
}) {
  const { data, isLoading, isLoadingMore, canLoadMore, loadMore } =
    useMarketTokenList({
      networkId: selectedNetworkId,
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
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack>
      <MarketTokenListNetworkSelector
        selectedNetworkId={selectedNetworkId}
        onSelectNetworkId={onNetworkIdChange}
        placement="bottom-start"
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <MarketListColumnHeader />
      <YStack height={LIST_HEIGHT}>
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
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Futures/Perps list (desktop) — navigates to Perps tab
// ---------------------------------------------------------------------------
function DesktopFuturesList({
  searchQuery,
  onClosePopover,
  categoryRef,
}: {
  searchQuery: string;
  onClosePopover: () => void;
  categoryRef: React.MutableRefObject<string>;
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

  // Use ref to persist across unmount/remount, local state for rendering
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    () => categoryRef.current || perpsCategories[0]?.tabId || '',
  );

  // Sync ref on change
  const handleSelectCategory = useCallback(
    (id: string) => {
      categoryRef.current = id;
      setSelectedCategoryId(id);
    },
    [categoryRef],
  );

  // Set initial value once data loads
  useEffect(() => {
    if (!selectedCategoryId && perpsCategories[0]?.tabId) {
      handleSelectCategory(perpsCategories[0].tabId);
    }
  }, [selectedCategoryId, perpsCategories, handleSelectCategory]);

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
      onClosePopover();
      navigateToPerps(coin);
    },
    [onClosePopover, navigateToPerps],
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
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack>
      <MarketPerpsCategorySelector
        categories={perpsCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <YStack height={LIST_HEIGHT}>
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
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Popover content (inner — only rendered when open, like Perps pattern)
// ---------------------------------------------------------------------------
function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();

  // --- Tab state (persisted atom) ---
  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const activeTab = selectorConfig.activeTab;

  // --- Search state ---
  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryRaw(query.trim().slice(0, 64));
  }, []);

  // --- Debounced search ---
  const debouncedQuery = useDebounce(searchQuery, 200);

  // --- Spot: network selection (lifted to survive tab switches) ---
  const [spotNetworkId, setSpotNetworkId] = useState(
    () => getNetworkIdsMap().onekeyall,
  );

  // --- Futures: category persisted across tab switches via ref ---
  const perpsCategoryRef = useRef('');

  const setActiveTab = useCallback(
    (tab: string) => {
      startTransition(() => {
        setSelectorConfig({ activeTab: tab as IMarketTokenSelectorTab });
      });
    },
    [setSelectorConfig],
  );

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      // Perps token — navigate to Perps tab (same as Market home)
      if (item.perpsCoin) {
        closePopover?.();
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

      closePopover?.();

      // Sync URL
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
    [tokenDetailActions, closePopover, navigateToPerps],
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
    <YStack p="$3" gap="$1">
      {/* Search — uncontrolled value to let debounce work (Perps pattern) */}
      <XStack px="$2" pt="$2">
        <SearchBar
          containerProps={{ borderRadius: '$2', mx: '$2', mt: '$2', flex: 1 }}
          autoFocus
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_asset,
          })}
          onChangeText={setSearchQuery}
        />
      </XStack>

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

      {/* List content */}
      <YStack>
        {activeTab === 'watchlist' ? (
          <DesktopWatchlistList
            searchQuery={debouncedQuery}
            onSelectToken={handleSelectToken}
          />
        ) : null}
        {activeTab === 'spot' ? (
          <DesktopSpotList
            searchQuery={debouncedQuery}
            onSelectToken={handleSelectToken}
            selectedNetworkId={spotNetworkId}
            onNetworkIdChange={setSpotNetworkId}
          />
        ) : null}
        {activeTab === 'futures' ? (
          <DesktopFuturesList
            searchQuery={debouncedQuery}
            onClosePopover={() => closePopover?.()}
            categoryRef={perpsCategoryRef}
          />
        ) : null}
      </YStack>
    </YStack>
  );
}

// Only render content when open (Perps pattern — avoids unnecessary rendering)
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <BaseMarketTokenSelectorContent /> : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

// ---------------------------------------------------------------------------
// Main Popover component (exported)
// ---------------------------------------------------------------------------
function BaseMarketTokenSelector({
  tokenDetail,
  networkId,
  networkLogoUri,
  isNative,
}: {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  isNative?: boolean;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: networkLogoUri,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.global_search_asset })}
      floatingPanelProps={{
        width: 800,
      }}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      renderTrigger={
        <XStack
          gap="$2"
          alignItems="center"
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
        >
          <Token
            size="md"
            tokenImageUri={logoUrl}
            tokenImageUris={logoUrls}
            networkImageUri={effectiveNetworkLogoUri}
            fallbackIcon="CryptoCoinOutline"
          />
          <SizableText
            size="$heading2xl"
            color="$text"
            numberOfLines={1}
            maxWidth="$60"
            flexShrink={1}
          >
            {symbol}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
      }
      renderContent={({ isOpen: isOpenProp }) => (
        <MarketTokenSelectorContentMemo isOpen={isOpenProp ?? false} />
      )}
    />
  );
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
