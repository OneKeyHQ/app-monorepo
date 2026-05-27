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

type IMeasuredRpcUrl = {
  rpcUrl: string;
  responseTime: number;
};

const CHAIN_LIST_RETRY_DELAYS_MS = [2000, 5000, 10_000] as const;
const CHAIN_LIST_RETRY_INTERVAL_MS = 60_000;
const RPC_MEASURE_TIMEOUT_MS = 10_000;
const RPC_MEASURE_MAX_CANDIDATES = 5;

type IChainListLoadRequest = {
  append: boolean;
  isRetry?: boolean;
  keywords?: string;
  page: number;
};

function getChainListRetryDelayMs(retryAttempt: number): number {
  return (
    CHAIN_LIST_RETRY_DELAYS_MS[retryAttempt] ?? CHAIN_LIST_RETRY_INTERVAL_MS
  );
}

function getCandidateRpcUrls(rpcUrls: string[]): string[] {
  return rpcUrls.filter(
    (url) =>
      !url.includes('${') &&
      (url.startsWith('https://') || url.startsWith('http://')),
  );
}

function normalizeSearchKeywords(text?: string): string {
  return text?.trim() ?? '';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function selectTopCandidateRpcUrls(rpcUrls: string[], max: number): string[] {
  const candidates = getCandidateRpcUrls(rpcUrls);
  const httpsUrls = candidates.filter((url) => url.startsWith('https://'));
  const httpUrls = candidates.filter((url) => !url.startsWith('https://'));
  return [...httpsUrls, ...httpUrls].slice(0, max);
}

function pickFastestRpcUrl({
  results,
  fallbackRpcUrl,
}: {
  results: PromiseSettledResult<IMeasuredRpcUrl>[];
  fallbackRpcUrl: string;
}): string {
  const availableRpcUrls = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .toSorted((a, b) => a.responseTime - b.responseTime);
  return availableRpcUrls[0]?.rpcUrl ?? fallbackRpcUrl;
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
  const [measuringChainId, setMeasuringChainId] = useState<
    number | undefined
  >();

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainListRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const chainListRetryAttemptRef = useRef(0);
  const chainListRetryRequestRef = useRef<IChainListLoadRequest | null>(null);
  const loadChainListRef = useRef<
    ((request: IChainListLoadRequest) => Promise<void>) | null
  >(null);
  const isSearchingRef = useRef(false);
  const activeKeywordsRef = useRef('');
  // Monotonic id bumped on every list-replacing op (initial load, reload,
  // search, pagination); used to discard stale async results.
  const listReqIdRef = useRef(0);
  // Synchronous guard so a fast onEndReached burst doesn't fan out duplicate
  // requests before isLoadingMore state has propagated.
  const loadingMoreRef = useRef(false);
  const mountedRef = useIsMounted();

  const clearChainListRetryTimer = useCallback(() => {
    if (chainListRetryTimerRef.current) {
      clearTimeout(chainListRetryTimerRef.current);
      chainListRetryTimerRef.current = null;
    }
    chainListRetryAttemptRef.current = 0;
    chainListRetryRequestRef.current = null;
  }, []);

  const scheduleChainListRetry = useCallback(
    (request: IChainListLoadRequest) => {
      if (!mountedRef.current) {
        return;
      }
      if (chainListRetryTimerRef.current) {
        clearTimeout(chainListRetryTimerRef.current);
      }
      const delay = getChainListRetryDelayMs(chainListRetryAttemptRef.current);
      chainListRetryRequestRef.current = {
        ...request,
        isRetry: true,
      };
      chainListRetryTimerRef.current = setTimeout(() => {
        chainListRetryTimerRef.current = null;
        chainListRetryAttemptRef.current += 1;
        const retryRequest = chainListRetryRequestRef.current;
        if (!retryRequest) {
          return;
        }
        void loadChainListRef.current?.({
          ...retryRequest,
          isRetry: true,
        });
      }, delay);
    },
    [mountedRef],
  );

  const loadChainList = useCallback(
    async (request: IChainListLoadRequest) => {
      const keywords = normalizeSearchKeywords(request.keywords);
      if (!request.isRetry) {
        clearChainListRetryTimer();
      }
      listReqIdRef.current += 1;
      const reqId = listReqIdRef.current;
      const isFirstPage = !request.append && request.page === 1;
      const isSearchRequest = !!keywords;
      try {
        if (!request.isRetry) {
          setHasError(false);
          if (isFirstPage) {
            setIsInitialLoading(!isSearchRequest);
            isSearchingRef.current = isSearchRequest;
            setIsSearching(isSearchRequest);
          }
        }
        if (request.append) {
          loadingMoreRef.current = true;
          setIsLoadingMore(true);
        }
        const result =
          await backgroundApiProxy.serviceCustomRpc.searchChainListByKeywords({
            keywords: keywords || undefined,
            page: request.page,
          });
        if (!mountedRef.current || reqId !== listReqIdRef.current) return;
        setHasError(false);
        clearChainListRetryTimer();
        if (request.append) {
          if (result.length === 0) {
            setHasMore(false);
          } else {
            setItems((prev) => {
              const existingIds = new Set(prev.map((p) => p.chainId));
              const newItems = result.filter(
                (r) => !existingIds.has(r.chainId),
              );
              return [...prev, ...newItems];
            });
            setHasMore(true);
            setCurrentPage(request.page);
          }
          return;
        }
        activeKeywordsRef.current = keywords;
        setItems(result);
        setHasMore(result.length > 0);
        setCurrentPage(request.page);
      } catch {
        if (!mountedRef.current || reqId !== listReqIdRef.current) return;
        if (request.append) {
          setHasMore(false);
        } else {
          setHasError(true);
          activeKeywordsRef.current = keywords;
          setItems([]);
          setHasMore(false);
          setCurrentPage(1);
        }
        scheduleChainListRetry({
          append: request.append,
          keywords,
          page: request.page,
        });
      } finally {
        if (request.append) {
          loadingMoreRef.current = false;
          if (mountedRef.current) {
            setIsLoadingMore(false);
          }
        }
        if (
          !request.append &&
          !request.isRetry &&
          mountedRef.current &&
          reqId === listReqIdRef.current
        ) {
          setIsInitialLoading(false);
          isSearchingRef.current = false;
          setIsSearching(false);
        }
      }
    },
    [clearChainListRetryTimer, mountedRef, scheduleChainListRetry],
  );

  useEffect(() => {
    loadChainListRef.current = loadChainList;
  }, [loadChainList]);

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
    await loadChainList({
      append: false,
      page: 1,
    });
  }, [loadChainList]);

  // Load first page on mount
  useEffect(() => {
    void reloadDefaultList();
  }, [reloadDefaultList]);

  const visibleItems = useMemo(
    () => items.filter((item) => item.rpc.length > 0),
    [items],
  );

  const isMeasuringRpc = measuringChainId !== undefined;

  // Load more pages (pagination)
  const handleEndReached = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      isLoadingMore ||
      !hasMore ||
      hasError ||
      isSearchingRef.current
    ) {
      return;
    }
    const keywords = activeKeywordsRef.current;
    if (normalizeSearchKeywords(searchText) !== keywords) {
      return;
    }
    const nextPage = currentPage + 1;
    void loadChainList({
      append: true,
      keywords: keywords || undefined,
      page: nextPage,
    });
  }, [
    isLoadingMore,
    hasMore,
    hasError,
    searchText,
    currentPage,
    loadChainList,
  ]);

  // Handle search text change with debounce
  const handleSearchTextChange = useCallback(
    (text: string) => {
      listReqIdRef.current += 1;
      clearChainListRetryTimer();
      setSearchText(text);
      const keywords = normalizeSearchKeywords(text);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!keywords) {
        // Clear search: reload default paginated list
        isSearchingRef.current = false;
        setIsSearching(false);
        void reloadDefaultList();
        return;
      }

      debounceTimerRef.current = setTimeout(async () => {
        defaultLogger.setting.page.chainListSearchPerformed({
          keywords,
        });
        await loadChainList({
          append: false,
          keywords,
          page: 1,
        });
      }, 1500);
    },
    [reloadDefaultList, loadChainList, clearChainListRetryTimer],
  );

  // Clean up debounce timer
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearChainListRetryTimer();
    },
    [clearChainListRetryTimer],
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
    async (item: IChainListItem) => {
      if (isMeasuringRpc) {
        return;
      }
      defaultLogger.setting.page.chainListNetworkSelected({
        chainId: String(item.chainId),
        networkName: item.name,
      });
      const candidateRpcUrls = selectTopCandidateRpcUrls(
        item.rpc,
        RPC_MEASURE_MAX_CANDIDATES,
      );
      let rpcUrl = candidateRpcUrls[0] ?? '';
      if (candidateRpcUrls.length > 1) {
        setMeasuringChainId(item.chainId);
        try {
          const results = await Promise.allSettled(
            candidateRpcUrls.map(async (candidateRpcUrl) => {
              const result = await withTimeout(
                backgroundApiProxy.serviceCustomRpc.measureCustomNetworkRpcStatus(
                  {
                    rpcUrl: candidateRpcUrl,
                    chainId: item.chainId,
                  },
                ),
                RPC_MEASURE_TIMEOUT_MS,
              );
              return {
                rpcUrl: candidateRpcUrl,
                responseTime: result.responseTime,
              };
            }),
          );
          rpcUrl = pickFastestRpcUrl({
            results,
            fallbackRpcUrl: candidateRpcUrls[0],
          });
        } catch {
          rpcUrl = candidateRpcUrls[0];
        } finally {
          if (mountedRef.current) {
            setMeasuringChainId(undefined);
          }
        }
      }
      if (!mountedRef.current) {
        return;
      }
      pushFormPage({
        networkName: item.name,
        rpcUrl,
        chainId: item.chainId,
        symbol: item.nativeCurrency?.symbol ?? '',
        blockExplorerUrl: item.explorers?.[0]?.url ?? '',
      });
    },
    [isMeasuringRpc, pushFormPage, mountedRef],
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
      const isMeasuring = measuringChainId === item.chainId;
      const rightContent = (() => {
        if (isMeasuring) {
          return <Spinner size="small" />;
        }
        if (isExisting) {
          return (
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.added })}
            </SizableText>
          );
        }
        return null;
      })();
      return (
        <ListItem
          h={60}
          disabled={isExisting || isMeasuring}
          opacity={isExisting ? 0.5 : 1}
          renderAvatar={<LetterAvatar letter={item.name?.[0]} size="$10" />}
          title={item.name}
          subtitle={`Symbol: ${item.nativeCurrency?.symbol ?? '-'}    ID: ${item.chainId}`}
          onPress={() => {
            void handleSelectNetwork(item);
          }}
        >
          {rightContent}
        </ListItem>
      );
    },
    [isNetworkExisting, measuringChainId, intl, handleSelectNetwork],
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
          title={intl.formatMessage({ id: ETranslations.global_network_error })}
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
            data={visibleItems}
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
