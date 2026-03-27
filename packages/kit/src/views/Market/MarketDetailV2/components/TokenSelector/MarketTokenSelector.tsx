import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { MarketRecommendList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketRecommendList';
import { useColumnsDesktop as useSpotColumnsDesktop } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns/useColumnsDesktop';
import { useMarketTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { useMarketTokenSelectorConfigAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

// ---------------------------------------------------------------------------
// Watchlist list (desktop) — only mounted when isWatchlistMode=true
// ---------------------------------------------------------------------------
function DesktopWatchlistList({
  searchQuery,
  onSelectToken,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
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

  const filteredData = useMemo(() => {
    let filtered = data.filter((item) => !item.perpsCoin);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query),
      );
    }
    return filtered;
  }, [data, searchQuery]);

  const allColumns = useSpotColumnsDesktop(
    undefined,
    true,
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

  if (isLoading && data.length === 0) {
    return (
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  // Empty watchlist — show recommend list without table header
  if (watchlist.length === 0) {
    return (
      <MarketRecommendList recommendedTokens={recommendedTokens} maxSize={6} />
    );
  }

  return (
    <YStack height={LIST_HEIGHT}>
      <Table<IMarketToken>
        showHeader
        scrollEnabled
        stickyHeader
        columns={columns}
        dataSource={filteredData}
        keyExtractor={(item) =>
          `wl-${item.address}-${item.symbol}-${item.networkId}`
        }
        estimatedItemSize={60}
        onRow={onRow}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Spot list (desktop) — only mounted when isWatchlistMode=false
// ---------------------------------------------------------------------------
function DesktopSpotList({
  searchQuery,
  onSelectToken,
  networkId,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  networkId: string;
}) {
  const { navigateToPerps } = usePerpsNavigation();

  const { data, isLoading, isLoadingMore, canLoadMore, loadMore } =
    useMarketTokenList({
      networkId,
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

  const allColumns = useSpotColumnsDesktop(
    networkId,
    false,
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

  if (isLoading && data.length === 0) {
    return (
      <Stack height={LIST_HEIGHT} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Popover content (inner — only rendered when open)
// ---------------------------------------------------------------------------
function BaseMarketTokenSelectorContent() {
  const intl = useIntl();
  const tokenDetailActions = useTokenDetailActions();
  const { closePopover } = usePopoverContext();
  const { navigateToPerps } = usePerpsNavigation();

  // --- All selector state persisted in atom ---
  const [selectorConfig, setSelectorConfig] =
    useMarketTokenSelectorConfigAtom();
  const { isWatchlistMode, spotNetworkId } = selectorConfig;

  // --- Search state (local, resets on remount is OK) ---
  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryRaw(query.trim().slice(0, 64));
  }, []);
  const debouncedQuery = useDebounce(searchQuery, 200);

  // Effective spotNetworkId (default to all networks if empty)
  const effectiveSpotNetworkId = spotNetworkId || getNetworkIdsMap().onekeyall;

  const handleSelectWatchlist = useCallback(() => {
    setSelectorConfig((prev) => ({ ...prev, isWatchlistMode: true }));
  }, [setSelectorConfig]);

  const handleSelectNetwork = useCallback(
    (networkId: string) => {
      setSelectorConfig((prev) => ({
        ...prev,
        isWatchlistMode: false,
        spotNetworkId: networkId,
      }));
    },
    [setSelectorConfig],
  );

  const handleSelectToken = useCallback(
    (item: IMarketToken) => {
      // Perps token — navigate to Perps tab
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

  return (
    <YStack p="$3" gap="$1">
      {/* Search */}
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

      {/* Filter bar: Network selector with built-in favorites ☆ button */}
      <MarketTokenListNetworkSelector
        selectedNetworkId={isWatchlistMode ? undefined : effectiveSpotNetworkId}
        onSelectNetworkId={handleSelectNetwork}
        placement="bottom-start"
        startListSelect={isWatchlistMode}
        onStartListSelect={handleSelectWatchlist}
      />

      {/* List content */}
      <YStack>
        {isWatchlistMode ? (
          <DesktopWatchlistList
            searchQuery={debouncedQuery}
            onSelectToken={handleSelectToken}
          />
        ) : (
          <DesktopSpotList
            searchQuery={debouncedQuery}
            onSelectToken={handleSelectToken}
            networkId={effectiveSpotNetworkId}
          />
        )}
      </YStack>
    </YStack>
  );
}

// Only render content when open
function MarketTokenSelectorContent({ isOpen }: { isOpen: boolean }) {
  return isOpen ? <BaseMarketTokenSelectorContent /> : null;
}

const MarketTokenSelectorContentMemo = memo(MarketTokenSelectorContent);

// ---------------------------------------------------------------------------
// Main Popover component (exported)
// ---------------------------------------------------------------------------
function BaseMarketTokenSelector() {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const { tokenDetail, networkId } = useTokenDetail();

  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });

  const { symbol = '', logoUrl = '', logoUrls } = tokenDetail || {};

  // Wrap entire Popover in useMemo to prevent re-creation
  const content = useMemo(
    () => (
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_search })}
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
