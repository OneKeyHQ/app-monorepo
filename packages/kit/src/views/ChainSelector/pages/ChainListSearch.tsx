import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EChainSelectorPages as EChainSelectorPagesEnum,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IChainListItem } from '@onekeyhq/shared/types/customNetwork';

import { LetterAvatar } from '../../../components/LetterAvatar';
import { ListItem } from '../../../components/ListItem';

import type { RouteProp } from '@react-navigation/core';

type IChainListSearchRoute = RouteProp<
  IChainSelectorParamList & IModalSettingParamList,
  | EChainSelectorPages.ChainListSearch
  | EModalSettingRoutes.SettingChainListSearch
>;

function pickBestRpcUrl(rpcUrls: string[]): string {
  const httpUrls = rpcUrls.filter(
    (url) =>
      !url.includes('${') &&
      (url.startsWith('https://') || url.startsWith('http://')),
  );
  const httpsUrl = httpUrls.find((url) => url.startsWith('https://'));
  if (httpsUrl) return httpsUrl;
  if (httpUrls.length > 0) return httpUrls[0];
  // Fallback: leave empty so user fills it manually
  return '';
}

function ChainListSearchSkeletonList() {
  return (
    <Stack>
      {[...Array(8)].map((_, index) => (
        <ListItem key={index}>
          <Skeleton radius="round" w="$10" h="$10" />
          <Stack gap="$1" flex={1}>
            <Skeleton h="$4" w="$32" />
            <Skeleton h="$3" w="$24" />
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

function ChainListSearch() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IChainListSearchRoute>();
  const { onSuccess } = route.params ?? {};

  // Determine which form route to push to based on which modal stack
  // this component is mounted in.
  // - ChainSelector modal → EChainSelectorPages.AddCustomNetwork
  // - Settings modal      → EModalSettingRoutes.SettingCustomNetwork
  const isSettingsContext =
    route.name === EModalSettingRoutes.SettingChainListSearch;

  const [items, setItems] = useState<IChainListItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [existingNetworkIds, setExistingNetworkIds] = useState<Set<string>>(
    new Set(),
  );
  const [hasError, setHasError] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchingRef = useRef(false);
  // Monotonic id bumped on every list-replacing op (initial load, reload,
  // search, pagination); used to discard stale async results.
  const listReqIdRef = useRef(0);
  // Synchronous guard so a fast onEndReached burst doesn't fan out duplicate
  // requests before isLoadingMore state has propagated.
  const loadingMoreRef = useRef(false);
  const mountedRef = useIsMounted();

  const refreshExistingNetworks = useCallback(async () => {
    try {
      const allNetworks =
        await backgroundApiProxy.serviceNetwork.getAllNetworks();
      const ids = new Set(allNetworks.networks.map((n) => n.id));
      setExistingNetworkIds(ids);
    } catch {
      // ignore
    }
  }, []);

  // Load existing networks on mount + refresh on AddedCustomNetwork event
  useEffect(() => {
    void refreshExistingNetworks();
    defaultLogger.setting.page.enterChainListSearch();
    appEventBus.on(
      EAppEventBusNames.AddedCustomNetwork,
      refreshExistingNetworks,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AddedCustomNetwork,
        refreshExistingNetworks,
      );
    };
  }, [refreshExistingNetworks]);

  const reloadDefaultList = useCallback(async () => {
    listReqIdRef.current += 1;
    const reqId = listReqIdRef.current;
    try {
      setIsInitialLoading(true);
      setHasError(false);
      const result =
        await backgroundApiProxy.serviceCustomRpc.searchChainListByKeywords({
          page: 1,
        });
      if (!mountedRef.current || reqId !== listReqIdRef.current) return;
      setItems(result);
      setHasMore(result.length > 0);
      setCurrentPage(1);
    } catch {
      if (!mountedRef.current || reqId !== listReqIdRef.current) return;
      setHasError(true);
    } finally {
      if (mountedRef.current && reqId === listReqIdRef.current) {
        setIsInitialLoading(false);
      }
    }
  }, [mountedRef]);

  // Load first page on mount
  useEffect(() => {
    void reloadDefaultList();
  }, [reloadDefaultList]);

  // Load more pages (pagination)
  const handleEndReached = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      isLoadingMore ||
      !hasMore ||
      searchText ||
      isSearchingRef.current
    ) {
      return;
    }
    loadingMoreRef.current = true;
    listReqIdRef.current += 1;
    const reqId = listReqIdRef.current;
    const nextPage = currentPage + 1;
    try {
      setIsLoadingMore(true);
      const result =
        await backgroundApiProxy.serviceCustomRpc.searchChainListByKeywords({
          page: nextPage,
        });
      if (!mountedRef.current || reqId !== listReqIdRef.current) return;
      if (result.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...result]);
        setCurrentPage(nextPage);
      }
    } catch {
      // Silently fail on pagination
    } finally {
      loadingMoreRef.current = false;
      if (mountedRef.current && reqId === listReqIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, hasMore, searchText, currentPage, mountedRef]);

  // Handle search text change with debounce
  const handleSearchTextChange = useCallback(
    (text: string) => {
      setSearchText(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!text) {
        // Clear search: reload default paginated list
        isSearchingRef.current = false;
        setIsSearching(false);
        void reloadDefaultList();
        return;
      }

      debounceTimerRef.current = setTimeout(async () => {
        listReqIdRef.current += 1;
        const reqId = listReqIdRef.current;
        try {
          isSearchingRef.current = true;
          setIsSearching(true);
          setHasError(false);
          defaultLogger.setting.page.chainListSearchPerformed({
            keywords: text,
          });
          const result =
            await backgroundApiProxy.serviceCustomRpc.searchChainListByKeywords(
              {
                keywords: text,
              },
            );
          if (!mountedRef.current || reqId !== listReqIdRef.current) return;
          setItems(result);
          setHasMore(false); // search results are not paginated
        } catch {
          if (!mountedRef.current || reqId !== listReqIdRef.current) return;
          setHasError(true);
        } finally {
          if (mountedRef.current && reqId === listReqIdRef.current) {
            isSearchingRef.current = false;
            setIsSearching(false);
          }
        }
      }, 1500);
    },
    [reloadDefaultList, mountedRef],
  );

  // Clean up debounce timer
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  const pushFormPage = useCallback(
    (params: Record<string, unknown> = {}) => {
      const formParams = {
        state: 'add' as const,
        ...params,
        onSuccess,
      };
      if (isSettingsContext) {
        navigation.push(EModalSettingRoutes.SettingCustomNetwork, formParams);
      } else {
        navigation.push(EChainSelectorPagesEnum.AddCustomNetwork, formParams);
      }
    },
    [navigation, isSettingsContext, onSuccess],
  );

  const handleSelectNetwork = useCallback(
    (item: IChainListItem) => {
      defaultLogger.setting.page.chainListNetworkSelected({
        chainId: String(item.chainId),
        networkName: item.name,
      });
      pushFormPage({
        networkName: item.name,
        rpcUrl: pickBestRpcUrl(item.rpc),
        chainId: item.chainId,
        symbol: item.nativeCurrency?.symbol ?? '',
        blockExplorerUrl: item.explorers?.[0]?.url ?? '',
      });
    },
    [pushFormPage],
  );

  const handleManualAdd = useCallback(() => {
    defaultLogger.setting.page.chainListManualAdd();
    pushFormPage();
  }, [pushFormPage]);

  const headerRight = useCallback(
    () => (
      <Button
        testID="chain-list-search-manual-add"
        variant="tertiary"
        size="medium"
        onPress={handleManualAdd}
      >
        {intl.formatMessage({
          id: ETranslations.custom_network_manual_add,
        })}
      </Button>
    ),
    [handleManualAdd, intl],
  );

  const { bottom } = useSafeAreaInsets();

  const isNetworkExisting = useCallback(
    (chainId: number) => {
      const networkId = accountUtils.buildCustomEvmNetworkId({
        chainId: String(chainId),
      });
      return existingNetworkIds.has(networkId);
    },
    [existingNetworkIds],
  );

  const renderItem = useCallback(
    ({ item }: { item: IChainListItem }) => {
      const isExisting = isNetworkExisting(item.chainId);
      return (
        <ListItem
          h={60}
          disabled={isExisting}
          opacity={isExisting ? 0.5 : 1}
          renderAvatar={<LetterAvatar letter={item.name?.[0]} size="$10" />}
          title={item.name}
          subtitle={`Symbol: ${item.nativeCurrency?.symbol ?? '-'}    ID: ${item.chainId}`}
          onPress={() => handleSelectNetwork(item)}
        >
          {isExisting ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              Added
            </SizableText>
          ) : null}
        </ListItem>
      );
    },
    [isNetworkExisting, handleSelectNetwork],
  );

  const listFooter = useMemo(() => {
    if (isLoadingMore) {
      return (
        <Stack py="$4" alignItems="center">
          <Spinner size="small" />
        </Stack>
      );
    }
    return <Stack h={bottom || '$2'} />;
  }, [isLoadingMore, bottom]);

  const listEmpty = useMemo(() => {
    if (isInitialLoading || isSearching) {
      return null;
    }
    if (hasError) {
      return (
        <Empty
          illustration="GlobeError"
          title="Network error. Please try again."
        />
      );
    }
    return (
      <Empty
        illustration="BlockQuestionMark"
        title={intl.formatMessage({ id: ETranslations.global_no_results })}
      />
    );
  }, [isInitialLoading, isSearching, hasError, intl]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <Stack px="$5" pb="$2">
          <SearchBar
            placeholder={intl.formatMessage({
              id: ETranslations.custom_network_chainlist_search_placeholder,
            })}
            value={searchText}
            onChangeText={handleSearchTextChange}
          />
        </Stack>
        {isInitialLoading || isSearching ? (
          <ChainListSearchSkeletonList />
        ) : (
          <ListView
            data={items}
            estimatedItemSize={60}
            keyExtractor={(item) => String(item.chainId)}
            renderItem={renderItem}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={listFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default ChainListSearch;
