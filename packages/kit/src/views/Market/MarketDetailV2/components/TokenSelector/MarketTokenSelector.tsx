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
  Popover,
  SearchBar,
  SizableText,
  Spinner,
  Stack,
  Table,
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
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import { useMarketPerpsTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketPerpsToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList';
import { usePerpsColumnsDesktop } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/usePerpsColumns';
import { MarketPerpsCategorySelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/MarketPerpsCategorySelector';
import { MarketRecommendList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketRecommendList';
import { useColumnsDesktop as useSpotColumnsDesktop } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns/useColumnsDesktop';
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
  type IWatchlistSelectorFilter,
  useMarketTokenSelectorConfigAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

const LIST_HEIGHT = 400;

// Columns to hide in the search popover (not enough width)
const HIDDEN_SPOT_COLUMNS = new Set([
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
]);
const HIDDEN_PERPS_COLUMNS = new Set(['fundingRate']);

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
  selectedFilter,
  onSelectFilter,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  selectedFilter: string;
  onSelectFilter: (filter: IWatchlistFilterType) => void;
}) {
  const { navigateToPerps } = usePerpsNavigation();
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
  }, [stableData, searchQuery, selectedFilter]);

  const allColumns = useSpotColumnsDesktop(
    undefined,
    true, // isWatchlistMode
    false,
    EWatchlistFrom.Search,
    ECopyFrom.Search,
  );
  const columns = useMemo(
    () => allColumns.filter((c) => !HIDDEN_SPOT_COLUMNS.has(c.dataIndex)),
    [allColumns],
  );

  const onRow = useCallback(
    (item: IMarketToken) => ({
      onPress: () => {
        if (item.perpsCoin) {
          navigateToPerps(item.perpsCoin);
          return;
        }
        onSelectToken(item);
      },
    }),
    [onSelectToken, navigateToPerps],
  );

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    if (watchlist.length === 0) {
      return <MarketRecommendList recommendedTokens={recommendedTokens} maxSize={6} />;
    }
    return null;
  }, [isLoading, watchlist.length, recommendedTokens]);

  if (isLoading && stableData.length === 0) {
    return (
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack>
      <MarketWatchlistCategorySelector
        selectedFilter={selectedFilter as IWatchlistFilterType}
        onSelectFilter={onSelectFilter}
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <YStack height={LIST_HEIGHT}>
        <Table<IMarketToken>
          showHeader
          scrollEnabled
          stickyHeader
          columns={columns}
          dataSource={filteredData}
          keyExtractor={(item) =>
            `watchlist-${item.address}-${item.symbol}-${item.networkId}`
          }
          estimatedItemSize={60}
          onRow={onRow}
          TableEmptyComponent={TableEmptyComponent}
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
  const { navigateToPerps } = usePerpsNavigation();
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

  const allColumns = useSpotColumnsDesktop(
    selectedNetworkId,
    false, // isWatchlistMode
    false,
    undefined,
    ECopyFrom.Search,
  );
  const columns = useMemo(
    () => allColumns.filter((c) => !HIDDEN_SPOT_COLUMNS.has(c.dataIndex)),
    [allColumns],
  );

  const handleEndReached = useCallback(() => {
    if (canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  const onRow = useCallback(
    (item: IMarketToken) => ({
      onPress: () => {
        if (item.perpsCoin) {
          navigateToPerps(item.perpsCoin);
          return;
        }
        onSelectToken(item);
      },
    }),
    [onSelectToken, navigateToPerps],
  );

  if (isLoading && stableData.length === 0) {
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
      <YStack height={LIST_HEIGHT}>
        <Table<IMarketToken>
          showHeader
          scrollEnabled
          stickyHeader
          columns={columns}
          dataSource={filteredData}
          keyExtractor={(item) =>
            `spot-${item.address}-${item.symbol}-${item.networkId}`
          }
          estimatedItemSize={60}
          onEndReached={handleEndReached}
          onRow={onRow}
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
  selectedCategoryId,
  onSelectCategory,
}: {
  searchQuery: string;
  onClosePopover: () => void;
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

  // Auto-select first category if atom has no value yet
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

  const allPerpsColumns = usePerpsColumnsDesktop();
  const perpsColumns = useMemo(
    () => allPerpsColumns.filter((c) => !HIDDEN_PERPS_COLUMNS.has(c.dataIndex)),
    [allPerpsColumns],
  );

  const onRow = useCallback(
    (item: IMarketPerpsToken) => ({
      onPress: () => {
        navigateToPerps(item.name);
        onClosePopover();
      },
    }),
    [navigateToPerps, onClosePopover],
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
        selectedCategoryId={effectiveCategoryId}
        onSelectCategory={onSelectCategory}
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <YStack height={LIST_HEIGHT}>
        <Table<IMarketPerpsToken>
          showHeader
          scrollEnabled
          stickyHeader
          columns={perpsColumns}
          dataSource={filteredTokens}
          keyExtractor={(item) => `futures-${item.name}`}
          estimatedItemSize={60}
          onRow={onRow}
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

  // Effective spotNetworkId (default to all networks if empty)
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

  const handleClosePopover = useCallback(() => {
    closePopover?.();
  }, [closePopover]);

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
            selectedFilter={watchlistFilter}
            onSelectFilter={setWatchlistFilter}
          />
        ) : null}
        {activeTab === 'spot' ? (
          <DesktopSpotList
            searchQuery={debouncedQuery}
            onSelectToken={handleSelectToken}
            selectedNetworkId={effectiveSpotNetworkId}
            onNetworkIdChange={setSpotNetworkId}
          />
        ) : null}
        {activeTab === 'futures' ? (
          <DesktopFuturesList
            searchQuery={debouncedQuery}
            onClosePopover={handleClosePopover}
            selectedCategoryId={perpsCategoryId}
            onSelectCategory={setPerpsCategoryId}
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
// Main Popover component (exported) — reads atom directly like Perps pattern
// ---------------------------------------------------------------------------
function BaseMarketTokenSelector() {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { tokenDetail, networkId, isNative } = useTokenDetail();

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};

  // Wrap entire Popover in useMemo (Perps pattern) to prevent re-creation
  const content = useMemo(
    () => (
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
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        }
        renderContent={({ isOpen: isOpenProp }) => (
          <MarketTokenSelectorContentMemo isOpen={isOpenProp ?? false} />
        )}
      />
    ),
    [isOpen, symbol, logoUrl, logoUrls, effectiveNetworkLogoUri, intl],
  );

  return content;
}

export const MarketTokenSelector = memo(BaseMarketTokenSelector);
