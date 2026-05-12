import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { runAfterTokensDone } from '@onekeyhq/kit/src/hooks/useRunAfterTokensDone';
import {
  useAccountDeFiOverviewAtom,
  useAccountOverviewActions,
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
import type { IDeFiDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi';
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
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { RichBlock } from '../RichBlock/RichBlock';

import { deFiListLoadingReducer } from './deFiListLoadingReducer';
import { DeFiListSkeleton } from './DeFiListSkeleton';
import { getOverviewCollapsedProtocolLimit } from './DeFiOverviewPlanner';
import { formatPortfolioTotal } from './formatPortfolioTotal';
import { buildDeFiOverviewCells } from './hooks/useDeFiOverviewTopN';
import { resolveOverviewCols } from './overviewColsResolver';
import { type IProtocolHandle, Protocol } from './Protocol';
import { useIsDeFiEnabled } from './useIsDeFiEnabled';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

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
    registerProtocol,
    tableLayout,
  }: {
    isAllNetworks?: boolean;
    isLast: boolean;
    protocol: IDeFiProtocol;
    protocolKey: string;
    registerProtocol?: (key: string, handle: IProtocolHandle | null) => void;
    tableLayout?: boolean;
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
          protocol={protocol}
          tableLayout={tableLayout}
          isAllNetworks={isAllNetworks}
        />
        {!tableLayout && !isLast ? <MobileProtocolDivider /> : null}
      </YStack>
    );
  },
);
ProtocolListItem.displayName = 'ProtocolListItem';

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
  } = useDeFiListActions().current;

  const { updateAccountDeFiOverview, updateOverviewDeFiDataState } =
    useAccountOverviewActions().current;

  const { isFocused, isHeaderRefreshing } = useTabIsRefreshingFocused();

  const [overview] = useAccountDeFiOverviewAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const media = useMedia();

  const deFiRawDataRef = useRef<IDeFiDBStruct | undefined>(undefined);
  const initializedRef = useRef(initialized);
  const isRefreshingRef = useRef(isRefreshing);
  initializedRef.current = initialized;
  isRefreshingRef.current = isRefreshing;
  const protocolsRef = useRef(protocols);
  const protocolMapRef = useRef(protocolMap);
  protocolsRef.current = protocols;
  protocolMapRef.current = protocolMap;
  const pendingRefreshRef = useRef(false);
  const singleNetworkLocalCacheRef = useRef<{
    cacheKey?: string;
    hasCache: boolean;
  }>({ hasCache: false });

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

  const isForceRefreshRef = useRef(false);

  const computedIsDeFiEnabled = useIsDeFiEnabled(
    network?.id,
    isDeFiEnabledProp === undefined,
  );
  const isDeFiEnabled = isDeFiEnabledProp ?? computedIsDeFiEnabled;
  const [isAllNetRequestsEnabled, setIsAllNetRequestsEnabled] =
    useState<boolean>(false);

  useEffect(() => {
    const isAllNetworks = networkUtils.isAllNetwork({
      networkId: network?.id,
    });
    if (!isAllNetworks) {
      setIsAllNetRequestsEnabled(true);
      return;
    }

    if (!isDeFiEnabled) {
      setIsAllNetRequestsEnabled(false);
      return;
    }

    if (!account?.id || !network?.id) {
      setIsAllNetRequestsEnabled(false);
      return;
    }

    setIsAllNetRequestsEnabled(false);
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
      onRun: () => setIsAllNetRequestsEnabled(true),
    });
  }, [account?.id, network?.id, isDeFiEnabled, updateDeFiListState]);

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

      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();

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
        });
        return;
      }

      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();

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
        const resp =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: account.id,
            networkId: network.id,
            accountAddress: account.address,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            saveToLocal: true,
            isForceRefresh:
              isForceRefreshRef.current || shouldForceInitialRefresh,
          });
        if (singleNetworkLocalCacheRef.current.cacheKey === cacheKey) {
          singleNetworkLocalCacheRef.current.hasCache = true;
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
      } catch (e) {
        console.error(e);
      } finally {
        isForceRefreshRef.current = false;
        updateDeFiListState(deFiListLoadingReducer({ type: 'settled' }));
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
      sourceCurrencyInfo,
      targetCurrencyInfo,
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

  const updateAllNetworkData = useThrottledCallback(() => {
    updateAccountDeFiOverview({
      currency: settings.currencyInfo.id,
      accountId: account?.id,
      networkId: network?.id,
      overview: deFiDataRef.current.overview,
      merge: true,
      isReady: true,
    });
    updateDeFiListProtocols({
      protocols: deFiDataRef.current.protocols,
      merge: true,
    });
    deFiDataRef.current = defiUtils.getEmptyDeFiData();
    updateDeFiListState(deFiListLoadingReducer({ type: 'settled' }));
  }, 1000);

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
        networkId,
        isAllNetworks: true,
        allNetworksAccountId: account?.id,
        allNetworksNetworkId: network?.id,
        saveToLocal: true,
        excludeLowValueProtocols: true,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        isForceRefresh: isForceRefreshRef.current || shouldForceInitialRefresh,
      });

      if (!allNetworkDataInit && r.isSameAllNetworksAccountData) {
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
      network?.id,
      updateAllNetworkData,
      updateDeFiListProtocolMap,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      refreshCacheOnly,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
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

      deFiRawDataRef.current =
        (await backgroundApiProxy.simpleDb.deFi.getRawData()) ?? undefined;

      if (refreshCacheOnly) {
        return;
      }

      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.DEFI,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
      updateOverviewDeFiDataState({
        accountId: account?.id,
        networkId: network?.id,
        isReady: undefined,
      });
    },
    [account?.id, network?.id, refreshCacheOnly, updateOverviewDeFiDataState],
  );

  const handleAllNetworkCacheRequests = useCallback(
    async ({
      accountId,
      networkId,
      accountAddress,
      xpub,
    }: {
      accountId: string;
      networkId: string;
      accountAddress: string;
      xpub?: string;
    }) => {
      const localDeFiOverview =
        await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
          accounts: [
            {
              accountId,
              networkId,
              accountAddress,
              xpub,
            },
          ],
          deFiRawData: deFiRawDataRef.current,
        });

      const rawOverview = localDeFiOverview?.[0]?.overview?.[networkId];

      let convertedOverview = rawOverview;
      if (rawOverview) {
        if (rawOverview.currency !== settings.currencyInfo.id) {
          const _sourceCurrencyInfo = currencyMap[rawOverview.currency];
          const _targetCurrencyInfo = currencyMap[settings.currencyInfo.id];
          convertedOverview = {
            ...rawOverview,
            totalValue: new BigNumber(rawOverview.totalValue)
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber(),
            totalDebt: new BigNumber(rawOverview.totalDebt)
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber(),
            totalReward: new BigNumber(rawOverview.totalReward)
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber(),
            netWorth: new BigNumber(rawOverview.netWorth)
              .div(_sourceCurrencyInfo.value)
              .times(_targetCurrencyInfo.value)
              .toNumber(),
          };
        }
      }

      if (!convertedOverview) {
        return undefined;
      }

      return {
        overview: convertedOverview,
      };
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
      isForceRefreshRef.current = false;

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
      updateDeFiListState(deFiListLoadingReducer({ type: 'settled' }));
    },
    [refreshCacheOnly, updateAllNetworkData, updateDeFiListState],
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
    allNetworkCacheRequests: handleAllNetworkCacheRequests,
    allNetworkCacheData: handleAllNetworkCacheData,
    allNetworkRequests: handleAllNetworkRequests,
    clearAllNetworkData: handleClearAllNetworkData,
    isDeFiRequests: true,
    disabled: network?.isAllNetworks ? !isAllNetRequestsEnabled : false,
  });

  const handleRefreshAllNetworkData = useCallback(() => {
    void runAllNetworkRequests({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  }, [runAllNetworkRequests]);

  useEffect(() => {
    if (network?.isAllNetworks && isEmptyAccount) {
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
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
      updateOverviewDeFiDataState({
        accountId,
        networkId,
        isReady: undefined,
      });
      void backgroundApiProxy.serviceDeFi.updateCurrentAccount({
        networkId,
        accountId,
      });

      if (networkUtils.isAllNetwork({ networkId })) {
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
              totalValue: new BigNumber(rawOverview.totalValue)
                .div(_sourceCurrencyInfo.value)
                .times(_targetCurrencyInfo.value)
                .toNumber(),
              totalDebt: new BigNumber(rawOverview.totalDebt)
                .div(_sourceCurrencyInfo.value)
                .times(_targetCurrencyInfo.value)
                .toNumber(),
              totalReward: new BigNumber(rawOverview.totalReward)
                .div(_sourceCurrencyInfo.value)
                .times(_targetCurrencyInfo.value)
                .toNumber(),
              netWorth: new BigNumber(rawOverview.netWorth)
                .div(_sourceCurrencyInfo.value)
                .times(_targetCurrencyInfo.value)
                .toNumber(),
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
    const refresh = () => {
      if (network?.isAllNetworks) {
        void handleRefreshAllNetworkData();
      } else {
        void run();
      }
    };

    const onRefresh = () => {
      isForceRefreshRef.current = true;
      if (isFocused) {
        pendingRefreshRef.current = false;
        refresh();
      } else {
        pendingRefreshRef.current = true;
      }
    };

    if (isFocused && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      refresh();
    }

    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, onRefresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    };
  }, [isFocused, network?.isAllNetworks, handleRefreshAllNetworkData, run]);

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
        updateDeFiListState({ initialized: true, isRefreshing: false });
        return;
      }

      // All Networks: drop this network's old entries and splice in the
      // refreshed ones. Aggregated overview is recomputed from the merged
      // protocolMap so the header total stays in sync.
      const prefix = `${payload.networkId}-`;
      const nextProtocols = protocolsRef.current
        .filter((p) => p.networkId !== payload.networkId)
        .concat(payload.protocols);

      const nextProtocolMap: Record<string, IProtocolSummary> = {};
      for (const [k, v] of Object.entries(protocolMapRef.current)) {
        if (!k.startsWith(prefix)) nextProtocolMap[k] = v;
      }
      Object.assign(nextProtocolMap, payload.protocolMap);

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
    refreshCacheOnly,
    settings.currencyInfo.id,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  useEffect(() => {
    if (allNetworksResult) {
      if (refreshCacheOnly) {
        return;
      }

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
      });
    }
  }, [
    account?.id,
    network?.id,
    allNetworksResult,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
    settings.currencyInfo.id,
    refreshCacheOnly,
  ]);

  useEffect(() => {
    if (isHeaderRefreshing) {
      if (network?.isAllNetworks) {
        handleRefreshAllNetworkData();
      } else {
        void run();
      }
    }
  }, [
    isHeaderRefreshing,
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
        fontVariant={TABULAR_NUMS}
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
          flex={1}
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
                registerProtocol={registerProtocol}
                tableLayout={tableLayout}
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
    tableLayout,
    network?.isAllNetworks,
    intl,
    isOverflow,
    isSliced,
    isProtocolListInteractionLocked,
    handleToggleSliced,
    registerProtocol,
  ]);

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
          !initialized || isRefreshing ? (
            <DeFiListSkeleton tableLayout={tableLayout} />
          ) : (
            <EmptyDeFi tableLayout={tableLayout} />
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
