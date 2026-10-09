import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { runAfterTokensDone } from '@onekeyhq/kit/src/hooks/useRunAfterTokensDone';
import {
  buildOverviewOwnerKey,
  useAccountDeFiOverviewAtom,
  useAccountOverviewActions,
  useOverviewDeFiDataStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeFiListActions,
  useDeFiListProtocolMapAtom,
  useDeFiListProtocolsAtom,
  useDeFiListSlicedAtom,
  useDeFiListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_DEFI,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { RichBlock } from '../RichBlock/RichBlock';

import {
  deFiListLoadingReducer,
  isDeFiAllNetworkRequestsGranted,
  resolveDeFiFanOutFinishedState,
  shouldApplyDeFiAllNetworksResult,
  shouldResetDeFiReadinessOnRunStart,
  shouldShowDeFiEmptyState,
} from './deFiListLoadingReducer';
import { DeFiListSkeleton } from './DeFiListSkeleton';
import { planDeFiOverviewInit } from './deFiOverviewInitPlan';
import { getOverviewCollapsedProtocolLimit } from './DeFiOverviewPlanner';
import { formatPortfolioTotal } from './formatPortfolioTotal';
import { buildDeFiOverviewCells } from './hooks/useDeFiOverviewTopN';
import { resolveOverviewCols } from './overviewColsResolver';
import { type IProtocolHandle, Protocol } from './Protocol';
import { useIsDeFiEnabled } from './useIsDeFiEnabled';

const MAX_PROTOCOLS_ON_SMALL_SCREEN = 6;
const PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS = 600;

function buildSingleNetworkDeFiCacheKey({
  accountId,
  networkId,
  accountAddress,
}: {
  accountId: string;
  networkId: string;
  accountAddress?: string;
}) {
  return `${accountId}:${networkId}:${accountAddress ?? ''}`;
}

function buildDeFiListOwnerKey({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId?: string;
}) {
  if (!accountId || !networkId) return undefined;
  return `${accountId}:${networkId}`;
}

function MobileProtocolDivider() {
  return (
    <YStack px="$5" py="$1.5">
      <Divider borderColor="$borderSubdued" />
    </YStack>
  );
}

export type IDeFiListBlockProps = {
  refreshCacheOnly?: boolean;
  tableLayout?: boolean;
  /**
   * Desktop: when `true`, the internal "DeFi · $total" header row is not
   * rendered — the parent mounts DeFiAllocationCard (which carries the total)
   * alongside the overview grid instead.
   */
  hideInternalTitle?: boolean;
  isDeFiEnabled?: boolean;
  registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
  onCollapseToProtocol?: (protocol: IDeFiProtocol) => void;
};

const ProtocolListItem = memo(
  ({
    isAllNetworks,
    isLast,
    protocol,
    protocolKey,
    accountId,
    indexedAccountId,
    registerProtocol,
    tableLayout,
    onActionSuccess,
  }: {
    isAllNetworks?: boolean;
    isLast: boolean;
    protocol: IDeFiProtocol;
    protocolKey: string;
    accountId?: string;
    indexedAccountId?: string;
    registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
    tableLayout?: boolean;
    onActionSuccess?: (
      params: IProtocolPositionActionSuccessParams,
    ) => void | Promise<void>;
  }) => {
    const handleProtocolRef = useCallback(
      (handle: IProtocolHandle | null) => {
        registerProtocol?.(protocolKey, handle);
      },
      [protocolKey, registerProtocol],
    );

    return (
      <YStack key={`${protocol.networkId}-${protocol.protocol}`}>
        <Protocol
          ref={registerProtocol ? handleProtocolRef : undefined}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          protocol={protocol}
          tableLayout={tableLayout}
          isAllNetworks={isAllNetworks}
          onActionSuccess={onActionSuccess}
        />
        {!tableLayout && !isLast ? <MobileProtocolDivider /> : null}
      </YStack>
    );
  },
);
ProtocolListItem.displayName = 'ProtocolListItem';

// Convert a DeFi overview's monetary fields from one fiat currency to another
// using the two currencies' rate values. Returns only the converted numeric
// fields so callers can spread them over the source overview, preserving its
// other keys (e.g. `currency`).
function convertDeFiOverviewValues(
  overview: {
    totalValue: number;
    totalDebt: number;
    totalReward: number;
    netWorth: number;
  },
  sourceCurrencyValue: string,
  targetCurrencyValue: string,
) {
  const convert = (value: number) =>
    new BigNumber(value)
      .div(sourceCurrencyValue)
      .times(targetCurrencyValue)
      .toNumber();
  return {
    totalValue: convert(overview.totalValue),
    totalDebt: convert(overview.totalDebt),
    totalReward: convert(overview.totalReward),
    netWorth: convert(overview.netWorth),
  };
}

function sortDeFiProtocolsByNetWorth({
  protocols,
  protocolMap,
}: {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
}) {
  return protocols.toSorted((a, b) =>
    new BigNumber(
      protocolMap[
        defiUtils.buildProtocolMapKey({
          protocol: b.protocol,
          networkId: b.networkId,
        })
      ]?.netWorth ?? 0,
    ).comparedTo(
      new BigNumber(
        protocolMap[
          defiUtils.buildProtocolMapKey({
            protocol: a.protocol,
            networkId: a.networkId,
          })
        ]?.netWorth ?? 0,
      ),
    ),
  );
}

function DeFiListBlock({
  refreshCacheOnly = false,
  tableLayout,
  hideInternalTitle = false,
  isDeFiEnabled: isDeFiEnabledProp,
  registerProtocol,
  onCollapseToProtocol,
}: IDeFiListBlockProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();

  const sourceCurrencyInfo = useMemo(
    () => currencyMap[settings.currencyInfo.id],
    [settings.currencyInfo.id, currencyMap],
  );
  const targetCurrencyInfo = useMemo(() => currencyMap.usd, [currencyMap]);

  const {
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
    updateDeFiListSupportedActions,
  } = useDeFiListActions().current;

  const { updateAccountDeFiOverview, updateOverviewDeFiDataState } =
    useAccountOverviewActions().current;

  const { isFocused, isHeaderRefreshing, setIsHeaderRefreshing } =
    useTabIsRefreshingFocused();

  const [overview] = useAccountDeFiOverviewAtom();
  const overviewRef = useRef(overview);
  overviewRef.current = overview;
  const [overviewDeFiDataState] = useOverviewDeFiDataStateAtom();
  const overviewDeFiDataStateRef = useRef(overviewDeFiDataState);
  overviewDeFiDataStateRef.current = overviewDeFiDataState;
  const [{ isRefreshing, initialized, loadedOwnerKey }] =
    useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const media = useMedia();

  const initializedRef = useRef(initialized);
  const isRefreshingRef = useRef(isRefreshing);
  initializedRef.current = initialized;
  isRefreshingRef.current = isRefreshing;
  const protocolsRef = useRef(protocols);
  const protocolMapRef = useRef(protocolMap);
  protocolsRef.current = protocols;
  protocolMapRef.current = protocolMap;
  const pendingRefreshRef = useRef<
    | {
        payload: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate];
      }
    | undefined
  >(undefined);
  const singleNetworkLocalCacheRef = useRef<{
    cacheKey?: string;
    hasCache: boolean;
  }>({ hasCache: false });
  // Owner the init effect last ran for; see planDeFiOverviewInit.
  const initDeFiOwnerKeyRef = useRef<string | undefined>(undefined);

  const [isSliced, setIsSliced] = useDeFiListSlicedAtom();
  const overviewCols = useMemo(
    () =>
      resolveOverviewCols({
        gtXl: media.gtXl,
        gtLg: media.gtLg,
      }),
    [media.gtXl, media.gtLg],
  );
  const maxProtocolsOnLargeScreen = useMemo(
    () =>
      getOverviewCollapsedProtocolLimit({
        cols: overviewCols,
        protocolCount: protocols.length,
      }),
    [overviewCols, protocols.length],
  );
  const overflowThreshold = tableLayout
    ? maxProtocolsOnLargeScreen
    : MAX_PROTOCOLS_ON_SMALL_SCREEN;
  const isOverflow = protocols.length > overflowThreshold;

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const currentOwnerKey = useMemo(
    () =>
      buildDeFiListOwnerKey({
        accountId: account?.id,
        networkId: network?.id,
      }),
    [account?.id, network?.id],
  );
  // Read by the single-network `run` after each await: a fetch issued for the
  // previous owner must not write its positions (or stamp its owner as
  // loaded) once the owner has changed underneath it.
  const liveOwnerKeyRef = useRef(currentOwnerKey);
  liveOwnerKeyRef.current = currentOwnerKey;

  // The DeFi list provider lives inside `Tabs.Container`, which no longer
  // remounts on an account switch (OK-63873), so `protocols` would keep the
  // previous owner's positions until the debounced fetch (>= 1 s) replaces
  // them. Drop them in the same commit the owner changes (layout effect,
  // before paint): the block then shows its skeleton, and `loadedOwnerKey`
  // is reset so the empty state cannot claim the new owner early.
  const prevOwnerKeyRef = useRef(currentOwnerKey);
  useLayoutEffect(() => {
    if (refreshCacheOnly || prevOwnerKeyRef.current === currentOwnerKey) {
      return;
    }
    prevOwnerKeyRef.current = currentOwnerKey;
    updateDeFiListProtocols({ protocols: [] });
    updateDeFiListProtocolMap({ protocolMap: {} });
    updateDeFiListState(deFiListLoadingReducer({ type: 'start' }));
  }, [
    currentOwnerKey,
    refreshCacheOnly,
    updateDeFiListProtocolMap,
    updateDeFiListProtocols,
    updateDeFiListState,
  ]);

  const pendingManualForceRefreshIntentRef = useRef<
    | {
        ownerKey: string;
      }
    | undefined
  >(undefined);
  const allNetworkManualForceRefreshRef = useRef(false);
  const prepareManualDeFiForceRefresh = useCallback(
    (payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate]) => {
      if (!payload?.isManualRefresh || refreshCacheOnly || !currentOwnerKey) {
        return;
      }

      pendingManualForceRefreshIntentRef.current = {
        ownerKey: currentOwnerKey,
      };
    },
    [currentOwnerKey, refreshCacheOnly],
  );
  const consumePendingManualForceRefreshIntent = useCallback(async () => {
    const intent = pendingManualForceRefreshIntentRef.current;
    if (!intent) {
      return false;
    }

    pendingManualForceRefreshIntentRef.current = undefined;
    if (!currentOwnerKey || intent.ownerKey !== currentOwnerKey) {
      return false;
    }

    try {
      const { allowed } =
        await backgroundApiProxy.serviceDeFi.consumeManualDeFiForceRefreshQuota();
      return allowed;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, [currentOwnerKey]);

  const computedIsDeFiEnabled = useIsDeFiEnabled(
    network?.id,
    isDeFiEnabledProp === undefined,
  );
  const isDeFiEnabled = isDeFiEnabledProp ?? computedIsDeFiEnabled;
  // Held per owner, not as a plain flag: `Tabs.Container` no longer remounts
  // on an account switch (OK-63873), so a boolean would still read `true`
  // from the previous owner in the switch render and let the new owner's
  // fan-out start before the gate below closes it. The closing render then
  // starts a skipped run that invalidates the in-flight one, and the
  // redundant-run gate skips the reopened run as a duplicate, so the new
  // owner's positions were never published. The cache-only instance lives in
  // the Portfolio pane, which is frozen behind the other tabs and thawed for
  // the switch render only, so it keeps any grant (see the helper).
  const [allNetRequestsEnabledOwnerKey, setAllNetRequestsEnabledOwnerKey] =
    useState<string | undefined>(undefined);
  const isAllNetRequestsEnabled = isDeFiAllNetworkRequestsGranted({
    refreshCacheOnly,
    grantedOwnerKey: allNetRequestsEnabledOwnerKey,
    ownerKey: currentOwnerKey,
  });

  usePromiseResult(
    async () => {
      if (refreshCacheOnly || !isDeFiEnabled) {
        updateDeFiListSupportedActions({ supportedActions: [] });
        return;
      }

      try {
        const supportedActions =
          await backgroundApiProxy.serviceDeFi.fetchSupportedDeFiProtocols();
        updateDeFiListSupportedActions({ supportedActions });
      } catch (error) {
        console.error(error);
        updateDeFiListSupportedActions({ supportedActions: [] });
      }
    },
    [refreshCacheOnly, isDeFiEnabled, updateDeFiListSupportedActions],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
    },
  );

  useEffect(() => {
    const isAllNetworks = networkUtils.isAllNetwork({
      networkId: network?.id,
    });
    if (!isAllNetworks) {
      setAllNetRequestsEnabledOwnerKey(currentOwnerKey);
      return;
    }

    if (!isDeFiEnabled) {
      setAllNetRequestsEnabledOwnerKey(undefined);
      return;
    }

    if (!account?.id || !network?.id) {
      setAllNetRequestsEnabledOwnerKey(undefined);
      return;
    }

    setAllNetRequestsEnabledOwnerKey(undefined);
    if (!initializedRef.current && !isRefreshingRef.current) {
      updateDeFiListState({
        initialized: false,
        isRefreshing: true,
      });
    }
    return runAfterTokensDone({
      accountId: account?.id,
      networkId: network?.id,
      matchAccountId: true,
      matchNetworkId: true,
      fallbackDelayMs: POLLING_DEBOUNCE_INTERVAL * 2,
      deferWhileRefreshing: true,
      onRun: () => setAllNetRequestsEnabledOwnerKey(currentOwnerKey),
    });
  }, [
    account?.id,
    network?.id,
    currentOwnerKey,
    isDeFiEnabled,
    updateDeFiListState,
  ]);

  const { run } = usePromiseResult(
    async () => {
      if (refreshCacheOnly) {
        return;
      }

      if (!account || !network) {
        return;
      }

      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        return;
      }

      const runOwnerKey = currentOwnerKey;
      const isStaleRun = () => liveOwnerKeyRef.current !== runOwnerKey;

      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
      if (isStaleRun()) {
        return;
      }

      if (!enabledNetworks[network.id]) {
        const emptyData = defiUtils.getEmptyDeFiData();
        updateAccountDeFiOverview({
          overview: emptyData.overview,
          currency: settings.currencyInfo.id,
          accountId: account.id,
          networkId: network.id,
          isReady: true,
        });
        updateDeFiListProtocols({
          protocols: emptyData.protocols,
        });
        updateDeFiListProtocolMap({
          protocolMap: emptyData.protocolMap,
        });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
          loadedOwnerKey: currentOwnerKey,
        });
        setIsHeaderRefreshing(false);
        return;
      }

      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();
      if (isStaleRun()) {
        return;
      }
      updateDeFiListState({
        isRefreshing: true,
        loadedOwnerKey: undefined,
      });

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.DEFI,
        accountId: account.id,
        networkId: network.id,
      });

      try {
        const cacheKey = buildSingleNetworkDeFiCacheKey({
          accountId: account.id,
          networkId: network.id,
          accountAddress: account.address,
        });
        const shouldForceInitialRefresh =
          singleNetworkLocalCacheRef.current.cacheKey !== cacheKey ||
          !singleNetworkLocalCacheRef.current.hasCache;
        const shouldForceManualRefresh =
          await consumePendingManualForceRefreshIntent();
        const resp =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: account.id,
            indexedAccountId: account.indexedAccountId,
            networkId: network.id,
            accountAddress: account.address,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            saveToLocal: true,
            isForceRefresh:
              shouldForceManualRefresh || shouldForceInitialRefresh,
          });
        if (singleNetworkLocalCacheRef.current.cacheKey === cacheKey) {
          singleNetworkLocalCacheRef.current.hasCache = true;
        }
        if (isStaleRun()) {
          return;
        }
        updateAccountDeFiOverview({
          currency: settings.currencyInfo.id,
          accountId: account.id,
          networkId: network.id,
          overview: {
            totalValue: resp.overview.totalValue ?? 0,
            totalDebt: resp.overview.totalDebt ?? 0,
            totalReward: resp.overview.totalReward ?? 0,
            netWorth: resp.overview.netWorth ?? 0,
          },
          isReady: true,
        });
        updateDeFiListProtocols({
          protocols: resp.protocols,
        });
        updateDeFiListProtocolMap({
          protocolMap: resp.protocolMap,
        });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
          loadedOwnerKey: currentOwnerKey,
        });
      } catch (e) {
        console.error(e);
      } finally {
        // A stale run's "settled" would end the NEW owner's loading and
        // header-refresh state (and stamp the previous owner as loaded) while
        // its fetch is still in flight; the live run settles its own owner.
        if (!isStaleRun()) {
          setIsHeaderRefreshing(false);
          updateDeFiListState(
            deFiListLoadingReducer({
              type: 'settled',
              loadedOwnerKey: currentOwnerKey,
            }),
          );
        }
        appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
          isRefreshing: false,
          type: EHomeTab.DEFI,
          accountId: account.id,
          networkId: network.id,
        });
      }
    },
    [
      account,
      network,
      refreshCacheOnly,
      settings.currencyInfo.id,
      updateAccountDeFiOverview,
      updateDeFiListProtocols,
      updateDeFiListProtocolMap,
      updateDeFiListState,
      currentOwnerKey,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      setIsHeaderRefreshing,
      consumePendingManualForceRefreshIntent,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_DEFI,
    },
  );

  const deFiDataRef = useRef<{
    overview: {
      totalValue: number;
      totalDebt: number;
      totalReward: number;
      netWorth: number;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocols: IDeFiProtocol[];
  }>(defiUtils.getEmptyDeFiData());
  // Owner whose running fan-out returned positions. `useAllNetworkRequests`
  // fires `onFinished` before it publishes the result, so stamping the owner
  // loaded there, with the list still empty, paints the empty state for a
  // few frames before the result effect fills the list in.
  const fanOutPositionsOwnerKeyRef = useRef<string | undefined>(undefined);

  const updateAllNetworkData = useThrottledCallback(() => {
    updateAccountDeFiOverview({
      currency: settings.currencyInfo.id,
      accountId: account?.id,
      networkId: network?.id,
      overview: deFiDataRef.current.overview,
      merge: true,
      isReady: true,
    });
    const hasPositions =
      deFiDataRef.current.protocols.length > 0 ||
      protocolsRef.current.length > 0;
    updateDeFiListProtocols({
      protocols: deFiDataRef.current.protocols,
      merge: true,
    });
    deFiDataRef.current = defiUtils.getEmptyDeFiData();
    // The first flush is the leading edge of the throttle, often a single
    // network's empty response while the rest are still in flight. Stamping
    // the owner loaded with nothing listed paints the empty state before the
    // positions arrive; the run's `onFinished` settles a truly empty owner.
    if (!hasPositions) {
      return;
    }
    updateDeFiListState(
      deFiListLoadingReducer({
        type: 'settled',
        loadedOwnerKey: currentOwnerKey,
      }),
    );
  }, 1000);

  // The owner-switch reset above only clears the atoms: a throttled merge
  // queued for the previous owner would still land in the next owner's list
  // (and stamp it loaded), so drop it with the accumulated data.
  const deFiDataOwnerKeyRef = useRef(currentOwnerKey);
  useLayoutEffect(() => {
    if (deFiDataOwnerKeyRef.current === currentOwnerKey) {
      return;
    }
    deFiDataOwnerKeyRef.current = currentOwnerKey;
    updateAllNetworkData.cancel();
    deFiDataRef.current = defiUtils.getEmptyDeFiData();
  }, [currentOwnerKey, updateAllNetworkData]);

  const handleAllNetworkRequests = useCallback(
    async ({
      accountId,
      networkId,
      allNetworkDataInit,
    }: {
      accountId: string;
      networkId: string;
      allNetworkDataInit?: boolean;
    }) => {
      if (refreshCacheOnly) {
        return;
      }

      const shouldForceInitialRefresh = !allNetworkDataInit;
      const r = await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
        accountId,
        indexedAccountId: account?.indexedAccountId,
        networkId,
        isAllNetworks: true,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
        excludeLowValueProtocols: true,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        isForceRefresh:
          allNetworkManualForceRefreshRef.current || shouldForceInitialRefresh,
      });
      if (r.protocols.length && liveOwnerKeyRef.current === currentOwnerKey) {
        fanOutPositionsOwnerKeyRef.current = currentOwnerKey;
      }

      if (
        !allNetworkDataInit &&
        r.isSameAllNetworksAccountData &&
        // The fan-out outlives an owner switch; a response issued for the
        // previous owner must not be merged into the next owner's list.
        liveOwnerKeyRef.current === currentOwnerKey
      ) {
        deFiDataRef.current = {
          overview: {
            totalValue: new BigNumber(r.overview.totalValue ?? 0)
              .plus(deFiDataRef.current.overview.totalValue)
              .toNumber(),
            totalDebt: new BigNumber(r.overview.totalDebt ?? 0)
              .plus(deFiDataRef.current.overview.totalDebt)
              .toNumber(),
            totalReward: new BigNumber(r.overview.totalReward ?? 0)
              .plus(deFiDataRef.current.overview.totalReward)
              .toNumber(),
            netWorth: new BigNumber(r.overview.netWorth ?? 0)
              .plus(deFiDataRef.current.overview.netWorth)
              .toNumber(),
            chains: Array.from(
              new Set([
                ...deFiDataRef.current.overview.chains,
                ...r.overview.chains,
              ]),
            ),
            protocolCount:
              deFiDataRef.current.overview.protocolCount +
              r.overview.protocolCount,
            positionCount:
              deFiDataRef.current.overview.positionCount +
              r.overview.positionCount,
          },
          protocols: [...deFiDataRef.current.protocols, ...r.protocols],
        };
        updateDeFiListProtocolMap({
          protocolMap: r.protocolMap,
          merge: true,
        });
        updateAllNetworkData();
      }

      return r;
    },
    [
      account?.id,
      account?.indexedAccountId,
      network?.id,
      currentOwnerKey,
      updateAllNetworkData,
      updateDeFiListProtocolMap,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      refreshCacheOnly,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    updateDeFiListState({
      isRefreshing: true,
      loadedOwnerKey: undefined,
    });
    // An overview that already belongs to this owner was seeded from the
    // local cache moments earlier (the header's cache-only instance runs in
    // the switch render). Zeroing it only for this run's cache probe to write
    // the same value back dips the header total for a few frames, so only an
    // overview left by another owner is reset.
    const currentOverview = overviewRef.current;
    const isOverviewOfOwner =
      !!account?.id &&
      !!network?.id &&
      currentOverview.accountId === account.id &&
      currentOverview.networkId === network.id;
    if (!isOverviewOfOwner) {
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account?.id,
        networkId: network?.id,
        overview: {
          totalValue: 0,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 0,
          chains: [],
          protocolCount: 0,
          positionCount: 0,
        },
      });
    }
    updateDeFiListProtocols({
      protocols: [],
    });
    updateDeFiListProtocolMap({
      protocolMap: {},
    });
  }, [
    account?.id,
    network?.id,
    settings.currencyInfo.id,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  const handleAllNetworkRequestsStarted = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      if (!refreshCacheOnly && accountId && networkId) {
        await backgroundApiProxy.serviceDeFi.updateCurrentAccount({
          accountId,
          networkId,
        });
      }

      if (refreshCacheOnly) {
        return;
      }

      fanOutPositionsOwnerKeyRef.current = undefined;
      allNetworkManualForceRefreshRef.current =
        await consumePendingManualForceRefreshIntent();

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.DEFI,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
      updateDeFiListState({
        isRefreshing: true,
        loadedOwnerKey: undefined,
      });
      if (
        shouldResetDeFiReadinessOnRunStart({
          readiness: overviewDeFiDataStateRef.current,
          ownerKey: buildOverviewOwnerKey(account?.id, network?.id),
        })
      ) {
        updateOverviewDeFiDataState({
          accountId: account?.id,
          networkId: network?.id,
          isReady: undefined,
        });
      }
    },
    [
      account?.id,
      network?.id,
      refreshCacheOnly,
      consumePendingManualForceRefreshIntent,
      updateDeFiListState,
      updateOverviewDeFiDataState,
    ],
  );

  const handleAllNetworkCacheRequestsBatch = useCallback(
    async (accounts: IAllNetworkAccountInfo[]) => {
      // Read the shared snapshot once in bg instead of returning the entire
      // database to main and sending it back for each network.
      const localDeFiOverviews =
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: accounts.map(
            ({ accountId, networkId, apiAddress, accountXpub }) => ({
              accountId,
              networkId,
              accountAddress: apiAddress,
              xpub: accountXpub,
            }),
          ),
        });

      return accounts.map(({ networkId }, index) => {
        const rawOverview = localDeFiOverviews[index]?.overview?.[networkId];

        let convertedOverview = rawOverview;
        if (rawOverview) {
          if (rawOverview.currency !== settings.currencyInfo.id) {
            const _sourceCurrencyInfo = currencyMap[rawOverview.currency];
            const _targetCurrencyInfo = currencyMap[settings.currencyInfo.id];
            // One missing rate must not discard the other cached networks.
            if (!_sourceCurrencyInfo || !_targetCurrencyInfo) {
              return undefined;
            }
            convertedOverview = {
              ...rawOverview,
              ...convertDeFiOverviewValues(
                rawOverview,
                _sourceCurrencyInfo.value,
                _targetCurrencyInfo.value,
              ),
            };
          }
        }

        if (!convertedOverview) {
          return undefined;
        }

        return {
          overview: convertedOverview,
        };
      });
    },
    [currencyMap, settings.currencyInfo.id],
  );

  const handleAllNetworkCacheData = useCallback(
    async ({
      data,
    }: {
      data: {
        overview: {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
          currency: string;
        };
      }[];
    }) => {
      const tempOverview: {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
      } = {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
      };
      for (const d of data) {
        tempOverview.totalValue += d.overview.totalValue;
        tempOverview.totalDebt += d.overview.totalDebt;
        tempOverview.totalReward += d.overview.totalReward;
        tempOverview.netWorth += d.overview.netWorth;
      }
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account?.id,
        networkId: network?.id,
        overview: tempOverview,
        isReady: true,
      });
    },
    [
      account?.id,
      network?.id,
      settings.currencyInfo.id,
      updateAccountDeFiOverview,
    ],
  );

  const handleAllNetworkRequestsFinished = useCallback(
    async ({
      accountId,
      networkId,
    }: {
      accountId?: string;
      networkId?: string;
    }) => {
      allNetworkManualForceRefreshRef.current = false;
      setIsHeaderRefreshing(false);

      if (refreshCacheOnly) {
        return;
      }

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.DEFI,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

      updateAllNetworkData.flush();

      // `useAllNetworkRequests` fires `onFinished` even when `resp` is
      // null (no positions), where the downstream `allNetworksResult`
      // effect would otherwise skip clearing the loading flag pair.
      // When the run did return positions, only end the loading here: the
      // result effect stamps the owner loaded in the commit that fills the
      // list, so the frames in between keep the skeleton, not the empty state.
      const positionsOwnerKey = fanOutPositionsOwnerKeyRef.current;
      fanOutPositionsOwnerKeyRef.current = undefined;
      updateDeFiListState(
        resolveDeFiFanOutFinishedState({
          positionsOwnerKey,
          finishedOwnerKey: buildDeFiListOwnerKey({ accountId, networkId }),
        }),
      );
    },
    [
      refreshCacheOnly,
      setIsHeaderRefreshing,
      updateAllNetworkData,
      updateDeFiListState,
    ],
  );

  const handleAllNetworkCacheChecked = useCallback(
    ({
      accountId,
      networkId,
      hasCache,
    }: {
      accountId?: string;
      networkId?: string;
      hasCache: boolean;
    }) => {
      updateOverviewDeFiDataState({
        accountId,
        networkId,
        isReady: hasCache,
      });
    },
    [updateOverviewDeFiDataState],
  );

  const {
    run: runAllNetworkRequests,
    result: allNetworksResult,
    isEmptyAccount,
  } = useAllNetworkRequests<
    Awaited<
      ReturnType<
        typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions
      >
    >
  >({
    accountId: account?.id,
    networkId: network?.id,
    walletId: wallet?.id,
    isAllNetworks: network?.isAllNetworks,
    onStarted: handleAllNetworkRequestsStarted,
    onFinished: handleAllNetworkRequestsFinished,
    onCacheChecked: handleAllNetworkCacheChecked,
    allNetworkCacheRequestsBatch: handleAllNetworkCacheRequestsBatch,
    allNetworkCacheData: handleAllNetworkCacheData,
    allNetworkRequests: handleAllNetworkRequests,
    clearAllNetworkData: handleClearAllNetworkData,
    isDeFiRequests: true,
    disabled: network?.isAllNetworks ? !isAllNetRequestsEnabled : false,
    // The cache-only instance is the sole writer of the header's DeFi
    // readiness and only reads local caches. usePromiseResult skips
    // deps-triggered runs while the route is unfocused, which left readiness
    // unset for entire sessions; let this instance run regardless of focus.
    shouldAlwaysFetch: refreshCacheOnly,
  });

  const handleRefreshAllNetworkData = useCallback(() => {
    void runAllNetworkRequests({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  }, [runAllNetworkRequests]);

  const handleActionSuccess = useCallback(
    async ({ accountId, networkId }: IProtocolPositionActionSuccessParams) => {
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      await backgroundApiProxy.serviceDeFi.refreshAccountDeFiPositionsAfterAction(
        {
          accountId,
          networkId,
        },
      );
    },
    [],
  );

  useEffect(() => {
    if (network?.isAllNetworks && isEmptyAccount) {
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
        loadedOwnerKey: currentOwnerKey,
      });
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account?.id,
        networkId: network?.id,
        overview: {
          totalValue: 0,
          totalDebt: 0,
          netWorth: 0,
          totalReward: 0,
          chains: [],
          protocolCount: 0,
          positionCount: 0,
        },
        isReady: true,
      });
      updateDeFiListProtocols({
        protocols: [],
      });
      updateDeFiListProtocolMap({
        protocolMap: {},
      });
    }
  }, [
    account?.id,
    network?.id,
    isEmptyAccount,
    network?.isAllNetworks,
    currentOwnerKey,
    updateDeFiListState,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    settings.currencyInfo.id,
  ]);

  useEffect(() => {
    const initDeFiData = async ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => {
      const cacheKey = buildSingleNetworkDeFiCacheKey({
        accountId,
        networkId,
        accountAddress: account?.address,
      });
      singleNetworkLocalCacheRef.current = {
        cacheKey,
        hasCache: false,
      };
      const initPlan = planDeFiOverviewInit({
        accountId,
        networkId,
        accountAddress: account?.address,
        lastInitOwnerKey: initDeFiOwnerKeyRef.current,
      });
      initDeFiOwnerKeyRef.current = initPlan.ownerKey;
      if (initPlan.shouldResetReadiness) {
        updateOverviewDeFiDataState({
          accountId,
          networkId,
          isReady: undefined,
        });
      }
      void backgroundApiProxy.serviceDeFi.updateCurrentAccount({
        networkId,
        accountId,
      });

      if (!initPlan.shouldHydrateSingleNetworkCache) {
        return;
      }

      const localDeFiOverview = (
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountId,
              networkId,
              accountAddress: account?.address,
            },
          ],
        })
      )[0];

      if (localDeFiOverview) {
        const rawOverview = localDeFiOverview.overview[networkId];
        if (singleNetworkLocalCacheRef.current.cacheKey === cacheKey) {
          singleNetworkLocalCacheRef.current.hasCache = Boolean(rawOverview);
        }
        if (rawOverview) {
          let convertedOverview = rawOverview;
          if (rawOverview.currency !== settings.currencyInfo.id) {
            const _sourceCurrencyInfo = currencyMap[rawOverview.currency];
            const _targetCurrencyInfo = currencyMap[settings.currencyInfo.id];
            convertedOverview = {
              ...rawOverview,
              ...convertDeFiOverviewValues(
                rawOverview,
                _sourceCurrencyInfo.value,
                _targetCurrencyInfo.value,
              ),
            };
          }
          updateAccountDeFiOverview({
            currency: settings.currencyInfo.id,
            accountId,
            networkId,
            overview: convertedOverview,
            isReady: true,
          });
        } else {
          updateAccountDeFiOverview({
            accountId,
            networkId,
            overview: {
              totalValue: 0,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 0,
            },
            isReady: false,
          });
        }
      } else {
        updateAccountDeFiOverview({
          accountId,
          networkId,
          overview: {
            totalValue: 0,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 0,
          },
          isReady: false,
        });
      }
    };
    if (account?.id && network?.id) {
      void initDeFiData({
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [
    account?.id,
    network?.id,
    account?.address,
    updateAccountDeFiOverview,
    updateOverviewDeFiDataState,
    settings.currencyInfo.id,
    currencyMap,
  ]);

  useEffect(() => {
    if (refreshCacheOnly) {
      return;
    }

    const refresh = (
      payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate],
    ) => {
      prepareManualDeFiForceRefresh(payload);
      if (network?.isAllNetworks) {
        void handleRefreshAllNetworkData();
      } else {
        void run();
      }
    };

    const onRefresh = (
      payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate],
    ) => {
      if (isFocused) {
        pendingRefreshRef.current = undefined;
        void refresh(payload);
      } else {
        pendingRefreshRef.current = {
          payload: payload?.isManualRefresh ? undefined : payload,
        };
      }
    };

    if (isFocused && pendingRefreshRef.current) {
      const { payload } = pendingRefreshRef.current;
      pendingRefreshRef.current = undefined;
      void refresh(payload);
    }

    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, onRefresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    };
  }, [
    isFocused,
    network?.isAllNetworks,
    handleRefreshAllNetworkData,
    prepareManualDeFiForceRefresh,
    refreshCacheOnly,
    run,
  ]);

  useEffect(() => {
    const onDeFiPositionRefreshed = (
      payload: IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed],
    ) => {
      if (refreshCacheOnly) return;
      if (!account?.id || !network?.id) return;

      // Prefer indexedAccountId equality (robust for All Networks mode);
      // fall back to a strict accountId match for accounts without an
      // indexed id (imported / watching-only / external). A walletId-only
      // compare is unsafe for those types because they all share a single
      // wallet bucket (`imported`, `watching`, `external`) — distinct
      // accounts inside the same bucket would otherwise leak each other's
      // refreshed positions into the current view.
      const currentIndexedId = account.indexedAccountId;
      const payloadIndexedId = payload.indexedAccountId;
      if (currentIndexedId && payloadIndexedId) {
        if (currentIndexedId !== payloadIndexedId) return;
      } else if (payload.accountId !== account.id) {
        return;
      }

      if (!network.isAllNetworks) {
        if (
          payload.accountId !== account.id ||
          payload.networkId !== network.id
        ) {
          return;
        }
        updateAccountDeFiOverview({
          currency: settings.currencyInfo.id,
          accountId: account.id,
          networkId: network.id,
          overview: {
            totalValue: payload.overview.totalValue,
            totalDebt: payload.overview.totalDebt,
            totalReward: payload.overview.totalReward,
            netWorth: payload.overview.netWorth,
          },
          isReady: true,
        });
        updateDeFiListProtocols({ protocols: payload.protocols });
        updateDeFiListProtocolMap({ protocolMap: payload.protocolMap });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
          loadedOwnerKey: currentOwnerKey,
        });
        return;
      }

      // All Networks: drop this network's old entries and splice in the
      // refreshed ones. Aggregated overview is recomputed from the merged
      // protocolMap so the header total stays in sync.
      const prefix = `${payload.networkId}-`;
      const refreshedProtocols = protocolsRef.current
        .filter((p) => p.networkId !== payload.networkId)
        .concat(payload.protocols);

      const nextProtocolMap: Record<string, IProtocolSummary> = {};
      for (const [k, v] of Object.entries(protocolMapRef.current)) {
        if (!k.startsWith(prefix)) nextProtocolMap[k] = v;
      }
      Object.assign(nextProtocolMap, payload.protocolMap);
      const nextProtocols = sortDeFiProtocolsByNetWorth({
        protocols: refreshedProtocols,
        protocolMap: nextProtocolMap,
      });

      let totalValueBN = new BigNumber(0);
      let totalDebtBN = new BigNumber(0);
      let totalRewardBN = new BigNumber(0);
      let netWorthBN = new BigNumber(0);
      for (const s of Object.values(nextProtocolMap)) {
        totalValueBN = totalValueBN.plus(s.totalValue ?? 0);
        totalDebtBN = totalDebtBN.plus(s.totalDebt ?? 0);
        totalRewardBN = totalRewardBN.plus(s.totalReward ?? 0);
        netWorthBN = netWorthBN.plus(s.netWorth ?? 0);
      }

      updateDeFiListProtocols({ protocols: nextProtocols });
      updateDeFiListProtocolMap({ protocolMap: nextProtocolMap });
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account.id,
        networkId: network.id,
        overview: {
          totalValue: totalValueBN.toNumber(),
          totalDebt: totalDebtBN.toNumber(),
          totalReward: totalRewardBN.toNumber(),
          netWorth: netWorthBN.toNumber(),
        },
        isReady: true,
      });
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
        loadedOwnerKey: currentOwnerKey,
      });
    };

    appEventBus.on(
      EAppEventBusNames.DeFiPositionRefreshed,
      onDeFiPositionRefreshed,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.DeFiPositionRefreshed,
        onDeFiPositionRefreshed,
      );
    };
  }, [
    account?.id,
    account?.indexedAccountId,
    network?.id,
    network?.isAllNetworks,
    currentOwnerKey,
    refreshCacheOnly,
    settings.currencyInfo.id,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  // `useAllNetworkRequests` keeps returning the previous owner's result until
  // the next owner's fan-out lands (its runner guard only lets the live owner
  // publish). An owner switch re-runs this effect through its owner deps, so
  // without this check the retained result would be written as the new
  // owner's positions and overview, and stamp the new owner as loaded.
  const appliedAllNetworksResultRef = useRef<
    | { result: typeof allNetworksResult; ownerKey: string | undefined }
    | undefined
  >(undefined);
  useEffect(() => {
    if (allNetworksResult) {
      if (refreshCacheOnly) {
        return;
      }
      if (
        !shouldApplyDeFiAllNetworksResult({
          applied: appliedAllNetworksResultRef.current,
          result: allNetworksResult,
          ownerKey: currentOwnerKey,
        })
      ) {
        return;
      }
      appliedAllNetworksResultRef.current = {
        result: allNetworksResult,
        ownerKey: currentOwnerKey,
      };

      const tempOverview = {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
        chains: [] as string[],
        protocolCount: 0,
        positionCount: 0,
      };
      const tempProtocols: IDeFiProtocol[] = [];
      const tempProtocolMap: Record<string, IProtocolSummary> = {};
      // merge all networks result
      for (const r of allNetworksResult) {
        tempOverview.totalValue = new BigNumber(tempOverview.totalValue)
          .plus(r.overview.totalValue)
          .toNumber();
        tempOverview.totalDebt = new BigNumber(tempOverview.totalDebt)
          .plus(r.overview.totalDebt)
          .toNumber();
        tempOverview.netWorth = new BigNumber(tempOverview.netWorth)
          .plus(r.overview.netWorth)
          .toNumber();
        tempOverview.totalReward = new BigNumber(tempOverview.totalReward)
          .plus(r.overview.totalReward)
          .toNumber();
        tempOverview.chains = Array.from(
          new Set([...tempOverview.chains, ...r.overview.chains]),
        );
        tempOverview.protocolCount += r.overview.protocolCount;
        tempOverview.positionCount += r.overview.positionCount;
        tempProtocols.push(...r.protocols);
        Object.assign(tempProtocolMap, r.protocolMap);
      }
      updateAccountDeFiOverview({
        currency: settings.currencyInfo.id,
        accountId: account?.id,
        networkId: network?.id,
        overview: tempOverview,
        isReady: true,
      });
      updateDeFiListProtocols({
        protocols: tempProtocols,
      });
      updateDeFiListProtocolMap({
        protocolMap: tempProtocolMap,
      });
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
        loadedOwnerKey: currentOwnerKey,
      });
    }
  }, [
    account?.id,
    network?.id,
    currentOwnerKey,
    allNetworksResult,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
    settings.currencyInfo.id,
    refreshCacheOnly,
  ]);

  useEffect(() => {
    if (isHeaderRefreshing && !refreshCacheOnly) {
      if (network?.isAllNetworks) {
        handleRefreshAllNetworkData();
      } else {
        void run();
      }
    }
  }, [
    isHeaderRefreshing,
    refreshCacheOnly,
    run,
    handleRefreshAllNetworkData,
    network?.isAllNetworks,
  ]);

  const filteredProtocols = useMemo(() => {
    // Keep the mounted list in the same exposure order as the overview tiles,
    // so every collapsed overview tile can scroll to an existing protocol row.
    const sorted = buildDeFiOverviewCells(protocols, (protocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      });
      const info = buildProtocolDisplayInfo({
        protocol,
        protocolInfo: protocolMap[key],
      });
      const nw = new BigNumber(info.netWorth);
      return nw.isFinite() ? nw.toNumber() : 0;
    }).map((e) => e.protocol);

    if (isOverflow && isSliced) {
      const limit = tableLayout
        ? maxProtocolsOnLargeScreen
        : MAX_PROTOCOLS_ON_SMALL_SCREEN;
      return sorted.slice(0, limit);
    }
    return sorted;
  }, [
    protocols,
    protocolMap,
    isOverflow,
    isSliced,
    tableLayout,
    maxProtocolsOnLargeScreen,
  ]);

  const protocolListLockUntilRef = useRef(0);
  const protocolListUnlockTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [isProtocolListInteractionLocked, setIsProtocolListInteractionLocked] =
    useState(false);

  const isProtocolListLocked = useCallback(
    () => protocolListLockUntilRef.current > Date.now(),
    [],
  );
  const lockProtocolListInteractions = useCallback(() => {
    protocolListLockUntilRef.current =
      Date.now() + PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS;
    setIsProtocolListInteractionLocked(true);

    if (protocolListUnlockTimerRef.current) {
      clearTimeout(protocolListUnlockTimerRef.current);
    }
    protocolListUnlockTimerRef.current = setTimeout(() => {
      protocolListUnlockTimerRef.current = null;
      setIsProtocolListInteractionLocked(false);
    }, PROTOCOL_LIST_TOGGLE_PRESS_LOCK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (protocolListUnlockTimerRef.current) {
        clearTimeout(protocolListUnlockTimerRef.current);
      }
    };
  }, []);

  const getCollapsedBottomProtocol = useCallback(() => {
    const limit = Math.min(overflowThreshold, filteredProtocols.length);
    return filteredProtocols[limit - 1];
  }, [filteredProtocols, overflowThreshold]);

  const handleToggleSliced = useCallback(() => {
    if (isProtocolListLocked()) return;
    const targetProtocol = isSliced ? undefined : getCollapsedBottomProtocol();
    lockProtocolListInteractions();
    setIsSliced(!isSliced);
    if (targetProtocol) {
      onCollapseToProtocol?.(targetProtocol);
    }
  }, [
    isSliced,
    getCollapsedBottomProtocol,
    isProtocolListLocked,
    lockProtocolListInteractions,
    onCollapseToProtocol,
    setIsSliced,
  ]);

  const renderSubTitle = useCallback(() => {
    if (!initialized && isRefreshing) {
      // w=120 widens the preset's default 103 px to better approximate
      // a typical "$XX,XXX.XX" measurement; same width as DeFiContainer
      // for one canonical loading shape across both surfaces.
      return <Skeleton.HeadingXl w={120} />;
    }

    return (
      <SizableText
        size="$headingXl"
        color={tableLayout ? '$textSubdued' : '$text'}
      >
        {formatPortfolioTotal(
          Number(overview.netWorth) || 0,
          settings.currencyInfo.symbol,
          settingsValue.hideValue,
        )}
      </SizableText>
    );
  }, [
    settings.currencyInfo.symbol,
    settingsValue.hideValue,
    overview.netWorth,
    initialized,
    isRefreshing,
    tableLayout,
  ]);
  const renderContent = useCallback(() => {
    return (
      <>
        <YStack
          gap={tableLayout ? '$5' : '$0'}
          pt={tableLayout ? '$0' : '$1'}
          flex={platformEnv.isNative ? 1 : undefined}
          pointerEvents={isProtocolListInteractionLocked ? 'none' : undefined}
        >
          {filteredProtocols.map((protocol, index) => {
            const protocolKey = defiUtils.buildProtocolMapKey({
              protocol: protocol.protocol,
              networkId: protocol.networkId,
            });
            return (
              <ProtocolListItem
                key={`${protocol.networkId}-${protocol.protocol}`}
                isAllNetworks={network?.isAllNetworks}
                isLast={index === filteredProtocols.length - 1}
                protocol={protocol}
                protocolKey={protocolKey}
                accountId={account?.id}
                indexedAccountId={account?.indexedAccountId}
                registerProtocol={registerProtocol}
                tableLayout={tableLayout}
                onActionSuccess={handleActionSuccess}
              />
            );
          })}
        </YStack>
        {isOverflow ? (
          <XStack
            alignItems="center"
            justifyContent="center"
            pt="$4"
            px="$pagePadding"
          >
            <Button
              testID="home-render-content-btn"
              size="small"
              variant="secondary"
              disabled={isProtocolListInteractionLocked}
              onPress={handleToggleSliced}
              $md={
                {
                  flexGrow: 1,
                  flexBasis: 0,
                  size: 'medium',
                  borderRadius: '$full',
                } as any
              }
            >
              {isSliced
                ? intl.formatMessage({ id: ETranslations.global_show_more })
                : intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </XStack>
        ) : null}
      </>
    );
  }, [
    filteredProtocols,
    account?.id,
    account?.indexedAccountId,
    tableLayout,
    network?.isAllNetworks,
    intl,
    isOverflow,
    isSliced,
    isProtocolListInteractionLocked,
    handleToggleSliced,
    handleActionSuccess,
    registerProtocol,
  ]);
  const shouldShowEmptyDeFi = shouldShowDeFiEmptyState({
    protocolsLength: protocols.length,
    initialized,
    isRefreshing,
    ownerKey: currentOwnerKey,
    loadedOwnerKey,
  });

  if (refreshCacheOnly) {
    return null;
  }

  if (!isDeFiEnabled) {
    return null;
  }

  if (protocols.length === 0) {
    return (
      <RichBlock
        withTitleSeparator
        title={
          hideInternalTitle
            ? undefined
            : intl.formatMessage({ id: ETranslations.global_earn })
        }
        subTitle={hideInternalTitle ? undefined : renderSubTitle()}
        subTitleProps={tableLayout ? undefined : { color: '$text' }}
        headerContainerProps={{ px: '$pagePadding' }}
        // Match the loaded branch's content inset so the loading-state
        // skeleton sits in the same column as the eventual cards.
        contentContainerProps={tableLayout ? { px: '$pagePadding' } : undefined}
        plainContentContainer
        content={
          shouldShowEmptyDeFi ? (
            <EmptyDeFi tableLayout={tableLayout} />
          ) : (
            <DeFiListSkeleton tableLayout={tableLayout} />
          )
        }
      />
    );
  }

  return (
    <RichBlock
      withTitleSeparator
      title={
        hideInternalTitle
          ? undefined
          : intl.formatMessage({ id: ETranslations.global_earn })
      }
      subTitle={hideInternalTitle ? undefined : renderSubTitle()}
      subTitleProps={tableLayout ? undefined : { color: '$text' }}
      headerContainerProps={{ px: '$pagePadding' }}
      contentContainerProps={tableLayout ? { px: '$pagePadding' } : undefined}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { DeFiListBlock };
