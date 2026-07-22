import { useCallback, useEffect, useMemo, useRef } from 'react';

import { uniqBy } from 'lodash';

import { onVisibilityStateChange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getTokensTabLastState,
  runAfterTokensDone,
} from '@onekeyhq/kit/src/hooks/useRunAfterTokensDone';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeInteraction } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HISTORY_PAGE_SIZE,
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  type IAppEventBusPayload,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { REQUEST_TIMEOUT } from '@onekeyhq/shared/src/request/requestConst';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { buildTokenRefreshPlanAfterHistory } from '../../pages/historyTokenRefreshGate';
import {
  EHomeBackgroundRecoveryRefreshDomain,
  useRegisterHomeBackgroundRecoveryRefresh,
} from '../../pages/HomeBackgroundRecoveryRefreshProvider';
import {
  createHomeHistoryStoreResult,
  runHomeHistoryStoreRequest,
} from '../sections/history/homeHistoryControllerUtils';
import {
  HOME_HISTORY_DATA_SCHEMA_VERSION,
  type IHomeHistoryStorePayload,
} from '../sections/history/homeHistorySourceAdapter';
import {
  HOME_HISTORY_ACTION_IDS,
  createHomeHistoryStorePayload,
  mergeHomeHistoryAddressMap,
  mergeHomeHistoryPage,
  reconcileHomeHistoryFirstPage,
} from '../sections/history/homeHistoryStoreModel';

import {
  useHomeNavigationSnapshot,
  useHomeSectionPayload,
  useStableHomeFactsOwner,
} from './homeStoreHooks';
import { useHomeStoreControllerActions } from './useHomeStoreControllerActions';
import {
  type IHomeSectionSourceRequestHandle,
  useHomeStoreSourcePublisher,
} from './useHomeStoreSourcePublisher';

type IHomeHistoryResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceHistory.fetchAccountHistory>
>;

type ITokenRefreshAccount = { accountId: string; networkId: string };

const NATIVE_LOAD_MORE_HARD_LIMIT = 30;
const LOAD_MORE_SOFT_TIMEOUT_MS = REQUEST_TIMEOUT + 15 * 1000;
const EMPTY_HOME_HISTORY_TOKEN_MAP: IHomeHistoryStorePayload['tokenMap'] = {};

function normalizeCursor(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  const value = typeof input === 'string' ? input : String(input);
  return value.length > 0 ? value : null;
}

function getTokenRefreshAccountKey(account: ITokenRefreshAccount) {
  return `${account.accountId}::${account.networkId}`;
}

function emitHistoryListStateUpdate({
  accountId,
  isRefreshing,
  networkId,
}: {
  accountId: string;
  isRefreshing: boolean;
  networkId: string;
}) {
  appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
    accountId,
    isRefreshing,
    networkId,
    type: EHomeTab.HISTORY,
  });
}

function useHomeHistoryStoreSource({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}) {
  const {
    activeAccount: {
      account,
      deriveInfoItems,
      indexedAccount,
      network,
      vaultSettings,
      wallet,
    },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const { updateAllNetworksState } = useAccountOverviewActions().current;
  const interaction = useHomeInteraction();
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const homeTokenListMap =
    portfolioPayload?.tokenListMap ?? EMPTY_HOME_HISTORY_TOKEN_MAP;
  const stableOwner = useStableHomeFactsOwner();
  const {
    beginHomeSectionRequest,
    completeHomeSectionRequest,
    resetHomeSectionSource,
  } = useHomeStoreSourcePublisher();
  const { markHomeSectionCommandHandled } = useHomeStoreControllerActions();

  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const mergeDerive = Boolean(
    !accountUtils.isOthersWallet({ walletId: walletId ?? '' }) &&
    deriveInfoItems.length > 1 &&
    vaultSettings?.mergeDeriveAssetsEnabled,
  );
  const requestAccountId = mergeDerive ? indexedAccountId : accountId;
  const ownerMatches = Boolean(
    stableOwner &&
    stableOwner.owner.walletId === walletId &&
    stableOwner.owner.accountId === accountId &&
    (isAllNetworks
      ? stableOwner.owner.network.kind === 'allNetworks'
      : stableOwner.owner.network.kind === 'singleNetwork' &&
        stableOwner.owner.network.networkId === networkId),
  );
  const sourceEnabled = Boolean(
    enabled &&
    ownerMatches &&
    stableOwner &&
    walletId &&
    accountId &&
    requestAccountId &&
    networkId,
  );
  const identityKey = useMemo(
    () =>
      sourceEnabled
        ? stringUtils.stableStringify({
            accountId,
            filterLowValue: settings.isFilterLowValueHistoryEnabled,
            filterScam: settings.isFilterScamHistoryEnabled,
            indexedAccountId,
            mergeDerive,
            networkId,
            sourceCurrencyId: settings.currencyInfo.id,
            walletId,
          })
        : undefined,
    [
      accountId,
      indexedAccountId,
      mergeDerive,
      networkId,
      settings.currencyInfo.id,
      settings.isFilterLowValueHistoryEnabled,
      settings.isFilterScamHistoryEnabled,
      sourceEnabled,
      walletId,
    ],
  );

  const payloadRef = useRef<IHomeHistoryStorePayload>(
    createHomeHistoryStorePayload(),
  );
  const firstPageRef = useRef<IAccountHistoryTx[]>([]);
  const pageRef = useRef(1);
  const isIndexerRef = useRef(false);
  const identityGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);
  const loadMoreCountRef = useRef(0);
  const tabRefreshCountRef = useRef(0);
  const lastVisibilityRefreshAtRef = useRef(0);
  const pendingTokenRefreshCleanupRef = useRef<(() => void) | undefined>(
    undefined,
  );
  const pendingTokenRefreshAccountsRef = useRef<ITokenRefreshAccount[]>([]);
  const processingCommandIdsRef = useRef(new Set<string>());
  const hasPublishedPayloadRef = useRef(false);
  const tokenMapRef = useRef(homeTokenListMap);
  tokenMapRef.current = homeTokenListMap;

  const stopPendingTokenRefresh = useCallback(() => {
    pendingTokenRefreshCleanupRef.current?.();
    pendingTokenRefreshCleanupRef.current = undefined;
    pendingTokenRefreshAccountsRef.current = [];
  }, []);

  const emitRefreshTokenList = useCallback(
    (accounts: ITokenRefreshAccount[]) => {
      if (accounts.length > 0) {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, { accounts });
      }
    },
    [],
  );

  const beginGatewayRequest = useCallback(() => {
    if (!stableOwner || !identityKey) {
      throw new OneKeyLocalError('Home History source owner is unavailable');
    }
    return beginHomeSectionRequest({
      dataSchemaVersion: HOME_HISTORY_DATA_SCHEMA_VERSION,
      ownerToken: stableOwner.ownerToken,
      paramsFingerprint: identityKey,
      quoteBasis: { currency: settings.currencyInfo.id },
      sectionId: 'history',
    });
  }, [
    beginHomeSectionRequest,
    identityKey,
    settings.currencyInfo.id,
    stableOwner,
  ]);

  const completeGatewayRequest = useCallback(
    (
      handle: IHomeSectionSourceRequestHandle,
      result: Parameters<typeof completeHomeSectionRequest>[1],
    ) => completeHomeSectionRequest(handle, result),
    [completeHomeSectionRequest],
  );

  const gateway = useMemo(
    () => ({ begin: beginGatewayRequest, complete: completeGatewayRequest }),
    [beginGatewayRequest, completeGatewayRequest],
  );

  const fetchRemoteHistory = useCallback(
    async ({
      manual,
      page,
      cursor,
    }: {
      manual: boolean;
      page?: number;
      cursor?: string | null;
    }): Promise<IHomeHistoryResponse> => {
      if (!networkId || !requestAccountId) {
        throw new OneKeyLocalError('Home History request identity is invalid');
      }
      tabRefreshCountRef.current += 1;
      if (tabRefreshCountRef.current === 1) {
        emitHistoryListStateUpdate({
          accountId: requestAccountId,
          isRefreshing: true,
          networkId,
        });
      }
      try {
        const common = {
          currencyMap,
          excludeTestNetwork: true,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          filterScam: settings.isFilterScamHistoryEnabled,
          isManualRefresh: manual,
          networkId,
          sourceCurrency: settings.currencyInfo.id,
          ...(page ? { page } : {}),
          ...(cursor ? { cursor } : {}),
        };
        const fetchPromise = mergeDerive
          ? backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              { ...common, indexedAccountId: requestAccountId },
            )
          : backgroundApiProxy.serviceHistory.fetchAccountHistory({
              ...common,
              accountId: requestAccountId,
            });
        if (!page) {
          return await fetchPromise;
        }
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new OneKeyLocalError('History load more timed out')),
              LOAD_MORE_SOFT_TIMEOUT_MS,
            );
          });
          return await Promise.race([fetchPromise, timeoutPromise]);
        } finally {
          if (timeout) {
            clearTimeout(timeout);
          }
        }
      } finally {
        tabRefreshCountRef.current -= 1;
        if (tabRefreshCountRef.current === 0) {
          emitHistoryListStateUpdate({
            accountId: requestAccountId,
            isRefreshing: false,
            networkId,
          });
        }
      }
    },
    [
      currencyMap,
      mergeDerive,
      networkId,
      requestAccountId,
      settings.currencyInfo.id,
      settings.isFilterLowValueHistoryEnabled,
      settings.isFilterScamHistoryEnabled,
    ],
  );

  const runPostFetchEffects = useCallback(
    async (response: IHomeHistoryResponse) => {
      updateAllNetworksState({
        visibleCount: uniqBy(response.allAccounts, 'networkId').length,
      });
      if (response.addressMap && Object.keys(response.addressMap).length > 0) {
        await backgroundApiProxy.serviceHistory.updateLocalAddressesInfo({
          data: response.addressMap,
          merge: true,
        });
      }

      const refreshAccounts = uniqBy(
        [
          ...pendingTokenRefreshAccountsRef.current,
          ...response.accountsWithChangedTxs,
        ],
        getTokenRefreshAccountKey,
      );
      stopPendingTokenRefresh();
      const tokenRefreshPlan = buildTokenRefreshPlanAfterHistory({
        accounts: refreshAccounts,
        lastTokensTabState: getTokensTabLastState(),
        tokenRefreshScope: {
          accountId: requestAccountId ?? '',
          includesAllAccountsInNetwork: mergeDerive,
          networkId: networkId ?? '',
        },
      });
      emitRefreshTokenList(tokenRefreshPlan.accountsToRefreshNow);
      if (tokenRefreshPlan.accountsToRefreshAfterTokensDone.length > 0) {
        const accounts = tokenRefreshPlan.accountsToRefreshAfterTokensDone;
        const tokensDoneScope = tokenRefreshPlan.tokensDoneScope ?? {
          accountId: requestAccountId ?? '',
          networkId: networkId ?? '',
        };
        pendingTokenRefreshAccountsRef.current = accounts;
        pendingTokenRefreshCleanupRef.current = runAfterTokensDone({
          accountId: tokensDoneScope.accountId,
          networkId: tokensDoneScope.networkId,
          matchAccountId: true,
          matchNetworkId: !network?.isAllNetworks,
          fallbackDelayMs: POLLING_DEBOUNCE_INTERVAL,
          retryDelayMs: POLLING_DEBOUNCE_INTERVAL,
          deferWhileRefreshing: true,
          onRun: () => {
            pendingTokenRefreshCleanupRef.current = undefined;
            pendingTokenRefreshAccountsRef.current = [];
            emitRefreshTokenList(accounts);
          },
        });
      }
      if (response.accountsWithCompletedDeFiPortfolioTxs.length > 0) {
        await Promise.all(
          response.accountsWithCompletedDeFiPortfolioTxs.map(
            ({ accountId: changedAccountId, networkId: changedNetworkId }) =>
              backgroundApiProxy.serviceDeFi.refreshAccountDeFiPositionsAfterAction(
                {
                  accountId: changedAccountId,
                  networkId: changedNetworkId,
                },
              ),
          ),
        );
      }
    },
    [
      emitRefreshTokenList,
      mergeDerive,
      network?.isAllNetworks,
      networkId,
      requestAccountId,
      stopPendingTokenRefresh,
      updateAllNetworksState,
    ],
  );

  const loadFirstPage = useCallback(
    async ({ manual }: { manual: boolean }) => {
      if (!sourceEnabled || !identityKey) {
        return;
      }
      requestGenerationRef.current += 1;
      const requestGeneration = requestGenerationRef.current;
      const identityGeneration = identityGenerationRef.current;
      try {
        await runHomeHistoryStoreRequest({
          gateway,
          isCurrent: () =>
            identityGenerationRef.current === identityGeneration &&
            requestGenerationRef.current === requestGeneration,
          load: () => fetchRemoteHistory({ manual }),
          project: (response) => {
            const nextData = reconcileHomeHistoryFirstPage({
              current: payloadRef.current.data,
              firstPage: response.txs,
              previousFirstPage: firstPageRef.current,
            });
            firstPageRef.current = response.txs;
            if (nextData.length === response.txs.length) {
              pageRef.current = 1;
              loadMoreCountRef.current = 0;
            }
            const payload = createHomeHistoryStorePayload({
              addressMap: mergeHomeHistoryAddressMap(
                payloadRef.current.addressMap,
                response.addressMap,
              ),
              cursor: normalizeCursor(response.next),
              data: nextData,
              hasMore:
                !isAllNetworks && Boolean(response.hasMoreOnChainHistory),
              tokenMap: tokenMapRef.current,
            });
            payloadRef.current = payload;
            hasPublishedPayloadRef.current = true;
            isIndexerRef.current = Boolean(response.isIndexer);
            return payload;
          },
          afterSuccess: runPostFetchEffects,
        });
      } catch (error) {
        console.error('Home History first page failed:', error);
      }
    },
    [
      fetchRemoteHistory,
      gateway,
      identityKey,
      isAllNetworks,
      runPostFetchEffects,
      sourceEnabled,
    ],
  );

  const loadLocalCache = useCallback(async () => {
    if (!networkId || !requestAccountId) {
      return { addressMap: {}, data: [] as IAccountHistoryTx[] };
    }
    const addressMapPromise =
      backgroundApiProxy.serviceHistory.getLocalAddressesInfo();
    if (!mergeDerive) {
      const data =
        await backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
          accountId: requestAccountId,
          currencyMap,
          excludeTestNetwork: true,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          filterScam: settings.isFilterScamHistoryEnabled,
          networkId,
          sourceCurrency: settings.currencyInfo.id,
        });
      return { addressMap: await addressMapPromise, data };
    }
    const { networkAccounts } =
      await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          excludeEmptyAccount: true,
          indexedAccountId: requestAccountId,
          networkId,
        },
      );
    const rows = await Promise.all(
      networkAccounts.map((networkAccount) =>
        backgroundApiProxy.serviceHistory.getAccountsLocalHistoryTxs({
          accountId: networkAccount.account?.id ?? '',
          currencyMap,
          filterLowValue: settings.isFilterLowValueHistoryEnabled,
          filterScam: settings.isFilterScamHistoryEnabled,
          networkId,
          sourceCurrency: settings.currencyInfo.id,
        }),
      ),
    );
    return {
      addressMap: await addressMapPromise,
      data: rows
        .flat()
        .toSorted(
          (left, right) =>
            (right.decodedTx.updatedAt ?? right.decodedTx.createdAt ?? 0) -
            (left.decodedTx.updatedAt ?? left.decodedTx.createdAt ?? 0),
        )
        .slice(0, HISTORY_PAGE_SIZE),
    };
  }, [
    currencyMap,
    mergeDerive,
    networkId,
    requestAccountId,
    settings.currencyInfo.id,
    settings.isFilterLowValueHistoryEnabled,
    settings.isFilterScamHistoryEnabled,
  ]);

  const seedCacheThenLoad = useCallback(async () => {
    if (!sourceEnabled || !identityKey) {
      return;
    }
    const identityGeneration = identityGenerationRef.current;
    const handle = gateway.begin();
    try {
      const cache = await loadLocalCache();
      if (identityGenerationRef.current !== identityGeneration) {
        gateway.complete(handle, { kind: 'error' });
        return;
      }
      const payload = createHomeHistoryStorePayload({
        addressMap: cache.addressMap,
        data: cache.data,
        tokenMap: tokenMapRef.current,
      });
      payloadRef.current = payload;
      firstPageRef.current = cache.data;
      gateway.complete(handle, createHomeHistoryStoreResult(payload));
      hasPublishedPayloadRef.current = true;
    } catch (error) {
      gateway.complete(handle, { kind: 'error' });
      console.error('Home History cache read failed:', error);
    }
    if (identityGenerationRef.current === identityGeneration) {
      await loadFirstPage({ manual: false });
    }
  }, [gateway, identityKey, loadFirstPage, loadLocalCache, sourceEnabled]);

  const loadMore = useCallback(async () => {
    if (
      !sourceEnabled ||
      isAllNetworks ||
      loadMoreInFlightRef.current ||
      !payloadRef.current.hasMore ||
      (platformEnv.isNative &&
        loadMoreCountRef.current >= NATIVE_LOAD_MORE_HARD_LIMIT)
    ) {
      return;
    }
    loadMoreInFlightRef.current = true;
    const identityGeneration = identityGenerationRef.current;
    const requestGeneration = requestGenerationRef.current;
    const previousCursor = payloadRef.current.cursor;
    const nextPage = pageRef.current + 1;
    try {
      await runHomeHistoryStoreRequest({
        gateway,
        isCurrent: () =>
          identityGenerationRef.current === identityGeneration &&
          requestGenerationRef.current === requestGeneration,
        load: () =>
          fetchRemoteHistory({
            cursor: previousCursor,
            manual: false,
            page: nextPage,
          }),
        project: (response) => {
          const merged = mergeHomeHistoryPage({
            current: payloadRef.current.data,
            incoming: response.txs,
          });
          const nextCursor = normalizeCursor(response.next);
          const cursorAdvanced = isHistoryCursorAdvanced(
            previousCursor ?? undefined,
            nextCursor ?? undefined,
            { indexerTimestampCursor: isIndexerRef.current },
          );
          const hasMore = Boolean(
            response.hasMoreOnChainHistory &&
            response.txs.length > 0 &&
            merged.addedCount > 0 &&
            cursorAdvanced,
          );
          const payload = createHomeHistoryStorePayload({
            addressMap: mergeHomeHistoryAddressMap(
              payloadRef.current.addressMap,
              response.addressMap,
            ),
            cursor: nextCursor,
            data: merged.data,
            hasMore,
            tokenMap: tokenMapRef.current,
          });
          payloadRef.current = payload;
          hasPublishedPayloadRef.current = true;
          pageRef.current = nextPage;
          loadMoreCountRef.current += 1;
          if (typeof response.isIndexer === 'boolean') {
            isIndexerRef.current = response.isIndexer;
          }
          return payload;
        },
        afterSuccess: async (response) => {
          if (response.addressMap && Object.keys(response.addressMap).length) {
            await backgroundApiProxy.serviceHistory.updateLocalAddressesInfo({
              data: response.addressMap,
              merge: true,
            });
          }
        },
      });
    } catch (error) {
      console.error('Home History load more failed:', error);
    } finally {
      if (identityGenerationRef.current === identityGeneration) {
        loadMoreInFlightRef.current = false;
      }
    }
  }, [fetchRemoteHistory, gateway, isAllNetworks, sourceEnabled]);

  const clearPendingRows = useCallback(() => {
    if (!sourceEnabled) {
      return;
    }
    requestGenerationRef.current += 1;
    const payload = createHomeHistoryStorePayload({
      ...payloadRef.current,
      data: payloadRef.current.data.filter(
        (tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending,
      ),
    });
    payloadRef.current = payload;
    hasPublishedPayloadRef.current = true;
    const handle = gateway.begin();
    gateway.complete(handle, createHomeHistoryStoreResult(payload));
  }, [gateway, sourceEnabled]);

  useEffect(() => {
    identityGenerationRef.current += 1;
    requestGenerationRef.current += 1;
    loadMoreInFlightRef.current = false;
    loadMoreCountRef.current = 0;
    pageRef.current = 1;
    isIndexerRef.current = false;
    hasPublishedPayloadRef.current = false;
    payloadRef.current = createHomeHistoryStorePayload({
      tokenMap: tokenMapRef.current,
    });
    firstPageRef.current = [];
    stopPendingTokenRefresh();
    if (!sourceEnabled || !identityKey || !stableOwner) {
      if (stableOwner) {
        resetHomeSectionSource({
          ownerToken: stableOwner.ownerToken,
          sectionId: 'history',
        });
      }
      return undefined;
    }
    void seedCacheThenLoad();
    return () => {
      identityGenerationRef.current += 1;
      requestGenerationRef.current += 1;
    };
  }, [
    identityKey,
    resetHomeSectionSource,
    seedCacheThenLoad,
    sourceEnabled,
    stableOwner,
    stopPendingTokenRefresh,
  ]);

  useEffect(
    () => () => {
      stopPendingTokenRefresh();
    },
    [stopPendingTokenRefresh],
  );

  useEffect(() => {
    if (!sourceEnabled || !hasPublishedPayloadRef.current) {
      return;
    }
    const payload = createHomeHistoryStorePayload({
      ...payloadRef.current,
      tokenMap: homeTokenListMap,
    });
    payloadRef.current = payload;
    const handle = gateway.begin();
    gateway.complete(handle, createHomeHistoryStoreResult(payload));
  }, [gateway, homeTokenListMap, sourceEnabled]);

  useEffect(() => {
    if (!sourceEnabled || !visible) {
      return undefined;
    }
    const refresh = (
      payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate],
    ) => {
      void loadFirstPage({ manual: Boolean(payload?.isManualRefresh) });
    };
    const refreshWithoutPayload = () => {
      void loadFirstPage({ manual: false });
    };
    appEventBus.on(
      EAppEventBusNames.HistoryTxStatusChanged,
      refreshWithoutPayload,
    );
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      refreshWithoutPayload,
    );
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refreshWithoutPayload);
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      clearPendingRows,
    );
    const timer = setInterval(
      refreshWithoutPayload,
      POLLING_INTERVAL_FOR_HISTORY,
    );
    return () => {
      clearInterval(timer);
      appEventBus.off(
        EAppEventBusNames.HistoryTxStatusChanged,
        refreshWithoutPayload,
      );
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        refreshWithoutPayload,
      );
      appEventBus.off(
        EAppEventBusNames.RefreshHistoryList,
        refreshWithoutPayload,
      );
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        clearPendingRows,
      );
    };
  }, [clearPendingRows, loadFirstPage, sourceEnabled, visible]);

  useEffect(() => {
    if (!sourceEnabled || !visible) {
      return undefined;
    }
    return onVisibilityStateChange((isVisible) => {
      const now = Date.now();
      if (
        isVisible &&
        now - lastVisibilityRefreshAtRef.current >= POLLING_INTERVAL_FOR_HISTORY
      ) {
        lastVisibilityRefreshAtRef.current = now;
        void loadFirstPage({ manual: true });
      }
    });
  }, [loadFirstPage, sourceEnabled, visible]);

  useEffect(() => {
    const command = interaction.pendingSectionCommands.find(
      (candidate) =>
        candidate.sectionId === 'history' &&
        !processingCommandIdsRef.current.has(candidate.intentId),
    );
    if (!command || !stableOwner) {
      return;
    }
    const commandOwnerToken = stableOwner.ownerToken;
    processingCommandIdsRef.current.add(command.intentId);
    void (async () => {
      try {
        if (
          command.type === 'sectionRefreshRequested' &&
          command.actionId === HOME_HISTORY_ACTION_IDS.refresh
        ) {
          await loadFirstPage({ manual: true });
        } else if (
          command.type === 'sectionActionInvoked' &&
          command.actionId === HOME_HISTORY_ACTION_IDS.loadMore
        ) {
          await loadMore();
        }
      } finally {
        processingCommandIdsRef.current.delete(command.intentId);
        markHomeSectionCommandHandled({
          intentId: command.intentId,
          ownerToken: commandOwnerToken,
        });
      }
    })();
  }, [
    interaction.pendingSectionCommands,
    loadFirstPage,
    loadMore,
    markHomeSectionCommandHandled,
    stableOwner,
  ]);

  return { refresh: () => loadFirstPage({ manual: true }) };
}

export function HomeHistoryStoreController() {
  const navigation = useHomeNavigationSnapshot();
  const enabled =
    navigation.value.kind === 'ready' &&
    navigation.value.tabs.includes('history');
  const visible =
    navigation.value.kind === 'ready' &&
    (navigation.value.selectedTabId === 'portfolio' ||
      navigation.value.selectedTabId === 'history');
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const source = useHomeHistoryStoreSource({ enabled, visible });

  useRegisterHomeBackgroundRecoveryRefresh({
    callback: source.refresh,
    domain: EHomeBackgroundRecoveryRefreshDomain.history,
    operationKey: 'home-history-store-source',
    owner: {
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    },
  });

  return null;
}

export { useHomeHistoryStoreSource };
