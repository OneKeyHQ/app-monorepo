import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { runAfterTokensDone } from '@onekeyhq/kit/src/hooks/useRunAfterTokensDone';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useDeFiListActions } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IDeFiDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeTab, type IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';

import {
  convertDeFiOverviewValues,
  mergeDeFiPositionResults,
} from '../deFiListDataUtils';

type IDeFiPositionResponse = Awaited<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>
>;

type IUseDeFiListAllNetworkDataParams = {
  account?: INetworkAccount;
  network?: IServerNetwork;
  wallet?: IDBWallet;
  refreshCacheOnly: boolean;
  isDeFiEnabled: boolean;
  currentOwnerKey?: string;
  settingsCurrencyId: string;
  currencyMap: Record<string, ICurrencyItem>;
  sourceCurrencyInfo?: ICurrencyItem;
  targetCurrencyInfo?: ICurrencyItem;
  consumePendingManualForceRefreshIntent: () => Promise<boolean>;
  setIsHeaderRefreshing: (value: boolean) => void;
};

export function useDeFiListAllNetworkData({
  account,
  network,
  wallet,
  refreshCacheOnly,
  isDeFiEnabled,
  currentOwnerKey,
  settingsCurrencyId,
  currencyMap,
  sourceCurrencyInfo,
  targetCurrencyInfo,
  consumePendingManualForceRefreshIntent,
  setIsHeaderRefreshing,
}: IUseDeFiListAllNetworkDataParams) {
  const {
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;
  const { updateAccountDeFiOverview, updateOverviewDeFiDataState } =
    useAccountOverviewActions().current;
  const [isAllNetRequestsEnabled, setIsAllNetRequestsEnabled] = useState(false);
  const deFiRawDataRef = useRef<IDeFiDBStruct | undefined>(undefined);
  const allNetworkManualForceRefreshRef = useRef(false);
  const ownerKeyRef = useRef(currentOwnerKey);
  const lastPublishedGenerationRef = useRef(0);
  const lastStartedOwnerKeyRef = useRef<string | undefined>(undefined);
  ownerKeyRef.current = currentOwnerKey;

  useEffect(() => {
    const isAllNetworks = networkUtils.isAllNetwork({ networkId: network?.id });
    if (!isAllNetworks) {
      setIsAllNetRequestsEnabled(true);
      return;
    }
    if (!isDeFiEnabled || !account?.id || !network?.id) {
      setIsAllNetRequestsEnabled(false);
      return;
    }
    setIsAllNetRequestsEnabled(false);
    return runAfterTokensDone({
      accountId: account.id,
      networkId: network.id,
      matchAccountId: true,
      matchNetworkId: true,
      fallbackDelayMs: POLLING_DEBOUNCE_INTERVAL * 2,
      deferWhileRefreshing: true,
      onRun: () => setIsAllNetRequestsEnabled(true),
    });
  }, [account?.id, network?.id, isDeFiEnabled]);

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
      if (refreshCacheOnly) return;
      const response =
        await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
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
            allNetworkManualForceRefreshRef.current || !allNetworkDataInit,
        });
      return response;
    },
    [
      account?.id,
      account?.indexedAccountId,
      network?.id,
      refreshCacheOnly,
      sourceCurrencyInfo,
      targetCurrencyInfo,
    ],
  );

  const handleClearAllNetworkData = useCallback(() => {
    updateDeFiListState({ isRefreshing: true, loadedOwnerKey: undefined });
    // Keep the last complete snapshot during a same-owner refresh. The result
    // publication callback below is the only writer that commits a new snapshot.
    if (lastStartedOwnerKeyRef.current !== currentOwnerKey) {
      updateAccountDeFiOverview({
        currency: settingsCurrencyId,
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
      updateDeFiListProtocols({ protocols: [] });
      updateDeFiListProtocolMap({ protocolMap: {} });
    }
    lastStartedOwnerKeyRef.current = currentOwnerKey;
  }, [
    account?.id,
    network?.id,
    currentOwnerKey,
    settingsCurrencyId,
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
      deFiRawDataRef.current =
        (await backgroundApiProxy.simpleDb.deFi.getRawData()) ?? undefined;
      if (refreshCacheOnly) return;
      allNetworkManualForceRefreshRef.current =
        await consumePendingManualForceRefreshIntent();
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: true,
        type: EHomeTab.DEFI,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
      updateDeFiListState({ isRefreshing: true, loadedOwnerKey: undefined });
      updateOverviewDeFiDataState({
        accountId: account?.id,
        networkId: network?.id,
        isReady: undefined,
      });
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
          accounts: [{ accountId, networkId, accountAddress, xpub }],
          deFiRawData: deFiRawDataRef.current,
        });
      const rawOverview = localDeFiOverview?.[0]?.overview?.[networkId];
      if (!rawOverview) return undefined;
      const source = currencyMap[rawOverview.currency];
      const target = currencyMap[settingsCurrencyId];
      return {
        overview:
          rawOverview.currency !== settingsCurrencyId && source && target
            ? {
                ...rawOverview,
                ...convertDeFiOverviewValues(
                  rawOverview,
                  source.value,
                  target.value,
                ),
              }
            : rawOverview,
      };
    },
    [currencyMap, settingsCurrencyId],
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
        };
      }[];
    }) => {
      const overview = data.reduce(
        (sum, item) => ({
          totalValue: sum.totalValue + item.overview.totalValue,
          totalDebt: sum.totalDebt + item.overview.totalDebt,
          totalReward: sum.totalReward + item.overview.totalReward,
          netWorth: sum.netWorth + item.overview.netWorth,
        }),
        { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
      );
      updateAccountDeFiOverview({
        currency: settingsCurrencyId,
        accountId: account?.id,
        networkId: network?.id,
        overview,
        isReady: true,
      });
    },
    [account?.id, network?.id, settingsCurrencyId, updateAccountDeFiOverview],
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
      if (refreshCacheOnly) return;
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.DEFI,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
    },
    [refreshCacheOnly, setIsHeaderRefreshing],
  );

  const handleAllNetworkResultPublished = useCallback(
    (
      result: IDeFiPositionResponse[] | null | undefined,
      generation: number,
    ) => {
      if (
        refreshCacheOnly ||
        result === undefined ||
        !account?.id ||
        !network?.id
      ) {
        return;
      }
      if (ownerKeyRef.current !== currentOwnerKey) return;
      if (generation < lastPublishedGenerationRef.current) return;
      lastPublishedGenerationRef.current = generation;
      const merged = mergeDeFiPositionResults(result ?? []);
      updateAccountDeFiOverview({
        currency: settingsCurrencyId,
        accountId: account.id,
        networkId: network.id,
        overview: merged.overview,
        isReady: true,
      });
      updateDeFiListProtocols({ protocols: merged.protocols });
      updateDeFiListProtocolMap({ protocolMap: merged.protocolMap });
      updateDeFiListState({
        initialized: true,
        isRefreshing: false,
        loadedOwnerKey: currentOwnerKey,
      });
    },
    [
      account?.id,
      network?.id,
      currentOwnerKey,
      refreshCacheOnly,
      settingsCurrencyId,
      updateAccountDeFiOverview,
      updateDeFiListProtocols,
      updateDeFiListProtocolMap,
      updateDeFiListState,
    ],
  );

  const { run: runAllNetworkRequests, isEmptyAccount } =
    useAllNetworkRequests<IDeFiPositionResponse>({
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
      isAllNetworks: network?.isAllNetworks,
      onStarted: handleAllNetworkRequestsStarted,
      onFinished: handleAllNetworkRequestsFinished,
      onResultPublished: handleAllNetworkResultPublished,
      onCacheChecked: ({ accountId, networkId, hasCache }) => {
        updateOverviewDeFiDataState({
          accountId,
          networkId,
          isReady: hasCache,
        });
      },
      allNetworkCacheRequests: handleAllNetworkCacheRequests,
      allNetworkCacheData: handleAllNetworkCacheData,
      allNetworkRequests: handleAllNetworkRequests,
      clearAllNetworkData: handleClearAllNetworkData,
      clearRetainedResultOnAcceptedRun: true,
      isDeFiRequests: true,
      disabled: network?.isAllNetworks ? !isAllNetRequestsEnabled : false,
      shouldAlwaysFetch: refreshCacheOnly,
    });

  const handleRefreshAllNetworkData = useCallback(() => {
    void runAllNetworkRequests({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  }, [runAllNetworkRequests]);

  useEffect(() => {
    if (!network?.isAllNetworks || !isEmptyAccount) return;
    updateDeFiListState({
      initialized: true,
      isRefreshing: false,
      loadedOwnerKey: currentOwnerKey,
    });
    updateAccountDeFiOverview({
      currency: settingsCurrencyId,
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
    updateDeFiListProtocols({ protocols: [] });
    updateDeFiListProtocolMap({ protocolMap: {} });
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    isEmptyAccount,
    currentOwnerKey,
    settingsCurrencyId,
    updateDeFiListState,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
  ]);

  return {
    runAllNetworkRequests,
    handleRefreshAllNetworkData,
    isEmptyAccount,
  };
}
