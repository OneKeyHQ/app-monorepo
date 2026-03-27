import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  ListView,
  Page,
  SearchBar,
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
import { MarketRecommendList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketRecommendList';
import { TokenListItem } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/components/TokenListItem';
import { useMarketTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList';
import { useMarketWatchlistTokenList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';
import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import { MarketTokenListNetworkSelector } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenListNetworkSelector';
import { MarketWatchListProviderMirrorV2 } from '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2';
import {
  EJotaiContextStoreNames,
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
// Unified token list (mobile) — handles both watchlist and network modes
// ---------------------------------------------------------------------------
function MobileTokenList({
  searchQuery,
  onSelectToken,
  networkId,
  isWatchlistMode,
}: {
  searchQuery: string;
  onSelectToken: (item: IMarketToken) => void;
  networkId: string;
  isWatchlistMode: boolean;
}) {
  const [watchlistState] = useMarketWatchListV2Atom();
  const { recommendedTokens } = useMarketBasicConfig();
  const watchlist = watchlistState.data || [];

  // Watchlist data
  const { data: watchlistData, isLoading: isWatchlistLoading } =
    useMarketWatchlistTokenList({
      watchlist,
      initialSortBy: 'v24hUSD',
      initialSortType: 'desc',
    });

  // Spot/network data
  const {
    data: spotData,
    isLoading: isSpotLoading,
    isLoadingMore,
    canLoadMore,
    loadMore,
  } = useMarketTokenList({
    networkId,
    initialSortBy: 'v24hUSD',
    initialSortType: 'desc',
    pageSize: 20,
  });

  const rawData = isWatchlistMode ? watchlistData : spotData;
  const isLoading = isWatchlistMode ? isWatchlistLoading : isSpotLoading;

  // Freeze snapshot — only capture on initial load, ignore polling
  const [snapshot, setSnapshot] = useState<IMarketToken[]>([]);
  const initializedRef = useRef(false);
  const prevModeRef = useRef(isWatchlistMode);

  // Reset snapshot when mode changes
  useEffect(() => {
    if (prevModeRef.current !== isWatchlistMode) {
      prevModeRef.current = isWatchlistMode;
      initializedRef.current = false;
      setSnapshot([]);
    }
  }, [isWatchlistMode]);

  useEffect(() => {
    if (rawData.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setSnapshot(rawData);
    }
  }, [rawData]);
  const stableData = initializedRef.current ? snapshot : rawData;

  const filteredData = useMemo(() => {
    let filtered = stableData;
    // In watchlist mode, filter out perps-only items
    if (isWatchlistMode) {
      filtered = filtered.filter((item) => !item.perpsCoin);
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
  }, [stableData, searchQuery, isWatchlistMode]);

  const renderItem = useCallback(
    ({ item }: { item: IMarketToken }) => (
      <TokenListItem item={item} onPress={() => onSelectToken(item)} />
    ),
    [onSelectToken],
  );

  const keyExtractor = useCallback(
    (item: IMarketToken) =>
      `${isWatchlistMode ? 'wl' : 'spot'}-${item.address}-${item.symbol}-${item.networkId}`,
    [isWatchlistMode],
  );

  const handleEndReached = useCallback(() => {
    if (!isWatchlistMode && canLoadMore && !isLoadingMore) {
      void loadMore();
    }
  }, [isWatchlistMode, canLoadMore, isLoadingMore, loadMore]);

  if (isLoading && stableData.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="small" />
      </Stack>
    );
  }

  if (isWatchlistMode && watchlist.length === 0) {
    return (
      <MarketRecommendList recommendedTokens={recommendedTokens} maxSize={6} />
    );
  }

  return (
    <YStack flex={1}>
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
// Main modal content
// ---------------------------------------------------------------------------
function MobileTokenSelectorContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tokenDetailActions = useTokenDetailActions();
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

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.dexmarket_details_overview,
        })}
      />
      <Page.Body>
        <YStack flex={1}>
          {/* Search */}
          <YStack px="$5" pb="$2">
            <SearchBar
              autoFocus
              onChangeText={setSearchQuery}
              placeholder={intl.formatMessage({
                id: ETranslations.global_search_asset,
              })}
            />
          </YStack>

          {/* Filter bar: Favorites button + Network selector */}
          <XStack alignItems="center" px="$5" pt="$1" pb="$2" gap="$2">
            <Stack
              px="$2"
              py="$1"
              borderRadius="$2"
              borderWidth="$px"
              borderColor={isWatchlistMode ? '$borderActive' : '$borderSubdued'}
              bg={isWatchlistMode ? '$bgActive' : '$bgApp'}
              onPress={handleSelectWatchlist}
            >
              <Icon
                name="StarSolid"
                size="$4"
                color={isWatchlistMode ? '$iconActive' : '$iconSubdued'}
              />
            </Stack>
            <Stack flex={1}>
              <MarketTokenListNetworkSelector
                selectedNetworkId={
                  isWatchlistMode ? undefined : effectiveSpotNetworkId
                }
                onSelectNetworkId={handleSelectNetwork}
                placement="bottom-start"
                containerStyle={{ px: 0 }}
                startListSelect={isWatchlistMode}
                onStartListSelect={handleSelectWatchlist}
              />
            </Stack>
          </XStack>

          {/* Token list */}
          <YStack flex={1}>
            <MobileTokenList
              searchQuery={debouncedQuery}
              onSelectToken={handleSelectToken}
              networkId={effectiveSpotNetworkId}
              isWatchlistMode={isWatchlistMode}
            />
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
