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
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
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

import type { IMarketTokenSelectorTab } from './useMarketTokenSelector';
import type { LayoutChangeEvent } from 'react-native';

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
      <YStack height={LIST_HEIGHT}>
        <ListView
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
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
    <YStack>
      <MarketTokenListNetworkSelector
        selectedNetworkId={effectiveNetworkId}
        onSelectNetworkId={setSelectedNetworkId}
        placement="bottom-start"
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <YStack height={LIST_HEIGHT}>
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
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Futures/Perps list (desktop) — navigates to Perps tab
// ---------------------------------------------------------------------------
function DesktopFuturesList({
  searchQuery,
  onClosePopover,
}: {
  searchQuery: string;
  onClosePopover: () => void;
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
        onSelectCategory={setSelectedCategoryId}
        containerStyle={{ px: '$3', pt: '$2', pb: '$1' }}
      />
      <YStack height={LIST_HEIGHT}>
        <ListView
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
// Popover content
// ---------------------------------------------------------------------------
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  const intl = useIntl();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] =
    useState<IMarketTokenSelectorTab>('watchlist');

  // Reset search when popover closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text.slice(0, 64));
  }, []);

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
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
    [tokenDetailActions, closePopover],
  );

  const tabNames = useMemo(
    () => ({
      watchlist: intl.formatMessage({ id: ETranslations.global_favorites }),
      spot: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      futures: intl.formatMessage({ id: ETranslations.global_perp }),
    }),
    [intl],
  );

  const tabs = useMemo(
    () => [
      { id: 'watchlist', name: tabNames.watchlist },
      { id: 'spot', name: tabNames.spot },
      { id: 'futures', name: tabNames.futures },
    ],
    [tabNames],
  );

  const handleTabPress = useCallback((tabId: string) => {
    startTransition(() => {
      setActiveTab(tabId as IMarketTokenSelectorTab);
    });
  }, []);

  const renderTabItem = useCallback(
    (tab: { id: string; name: string }) => (
      <TabItem
        key={tab.id}
        id={tab.id}
        name={tab.name}
        isFocused={activeTab === tab.id}
        onPress={handleTabPress}
      />
    ),
    [activeTab, handleTabPress],
  );

  return (
    <YStack p="$3" gap="$2">
      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder={intl.formatMessage({
          id: ETranslations.global_search,
        })}
      />

      {/* Tabs */}
      <ScrollableFilterBar selectedItemId={activeTab}>
        {tabs.map(renderTabItem)}
      </ScrollableFilterBar>

      {/* List content */}
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
        />
      ) : null}
      {activeTab === 'futures' ? (
        <DesktopFuturesList
          searchQuery={debouncedQuery}
          onClosePopover={() => closePopover?.()}
        />
      ) : null}
    </YStack>
  );
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
  const [isOpen, setIsOpen] = useState(false);

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: networkLogoUri,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};

  return (
    <Popover
      title="Select Token"
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
