import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useDeFiListActions } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_DEFI,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeTab, type IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';

import {
  buildSingleNetworkDeFiCacheKey,
  mergeDeFiOverviewCurrency,
} from '../deFiListDataUtils';
import { deFiListLoadingReducer } from '../deFiListLoadingReducer';
import { planDeFiOverviewInit } from '../deFiOverviewInitPlan';

type IUseDeFiListSingleNetworkDataParams = {
  account?: INetworkAccount;
  network?: IServerNetwork;
  refreshCacheOnly: boolean;
  isFocused: boolean;
  isDeFiEnabled: boolean;
  currentOwnerKey?: string;
  settingsCurrencyId: string;
  currencyMap: Record<string, ICurrencyItem>;
  sourceCurrencyInfo?: ICurrencyItem;
  targetCurrencyInfo?: ICurrencyItem;
  consumePendingManualForceRefreshIntent: () => Promise<boolean>;
  setIsHeaderRefreshing: (value: boolean) => void;
};

export function useDeFiListSingleNetworkData({
  account,
  network,
  refreshCacheOnly,
  isFocused,
  isDeFiEnabled,
  currentOwnerKey,
  settingsCurrencyId,
  currencyMap,
  sourceCurrencyInfo,
  targetCurrencyInfo,
  consumePendingManualForceRefreshIntent,
  setIsHeaderRefreshing,
}: IUseDeFiListSingleNetworkDataParams) {
  const {
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;
  const { updateAccountDeFiOverview, updateOverviewDeFiDataState } =
    useAccountOverviewActions().current;
  const singleNetworkLocalCacheRef = useRef<{
    cacheKey?: string;
    hasCache: boolean;
  }>({ hasCache: false });
  const initDeFiOwnerKeyRef = useRef<string | undefined>(undefined);
  const explicitDeFiRefreshSeqRef = useRef(0);
  const ownerKeyRef = useRef(currentOwnerKey);
  ownerKeyRef.current = currentOwnerKey;

  const { run } = usePromiseResult(
    async () => {
      if (refreshCacheOnly || !isDeFiEnabled || !account || !network) return;
      if (networkUtils.isAllNetwork({ networkId: network.id })) return;

      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
      if (!enabledNetworks[network.id]) {
        const emptyData = defiUtils.getEmptyDeFiData();
        updateAccountDeFiOverview({
          overview: emptyData.overview,
          currency: settingsCurrencyId,
          accountId: account.id,
          networkId: network.id,
          isReady: true,
        });
        updateDeFiListProtocols({ protocols: emptyData.protocols });
        updateDeFiListProtocolMap({ protocolMap: emptyData.protocolMap });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
          loadedOwnerKey: currentOwnerKey,
        });
        setIsHeaderRefreshing(false);
        return;
      }

      const ownerKey = currentOwnerKey;
      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();
      updateDeFiListState({ isRefreshing: true, loadedOwnerKey: undefined });
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
        if (ownerKeyRef.current !== ownerKey) return;

        singleNetworkLocalCacheRef.current = { cacheKey, hasCache: true };
        updateAccountDeFiOverview({
          currency: settingsCurrencyId,
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
        updateDeFiListProtocols({ protocols: resp.protocols });
        updateDeFiListProtocolMap({ protocolMap: resp.protocolMap });
        updateDeFiListState({
          initialized: true,
          isRefreshing: false,
          loadedOwnerKey: currentOwnerKey,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsHeaderRefreshing(false);
        updateDeFiListState(
          deFiListLoadingReducer({
            type: 'settled',
            loadedOwnerKey: ownerKey,
          }),
        );
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
      isDeFiEnabled,
      settingsCurrencyId,
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

  useEffect(() => {
    if (!account?.id || !network?.id) return;
    const ownerKey = currentOwnerKey;
    const cacheKey = buildSingleNetworkDeFiCacheKey({
      accountId: account.id,
      networkId: network.id,
      accountAddress: account.address,
    });
    singleNetworkLocalCacheRef.current = { cacheKey, hasCache: false };
    const initPlan = planDeFiOverviewInit({
      accountId: account.id,
      networkId: network.id,
      accountAddress: account.address,
      lastInitOwnerKey: initDeFiOwnerKeyRef.current,
    });
    initDeFiOwnerKeyRef.current = initPlan.ownerKey;
    if (initPlan.shouldResetReadiness) {
      updateOverviewDeFiDataState({
        accountId: account.id,
        networkId: network.id,
        isReady: undefined,
      });
    }
    void backgroundApiProxy.serviceDeFi.updateCurrentAccount({
      networkId: network.id,
      accountId: account.id,
    });

    if (!initPlan.shouldHydrateSingleNetworkCache) return;
    void (async () => {
      try {
        const localDeFiOverview = (
          await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: account.id,
                networkId: network.id,
                accountAddress: account.address,
              },
            ],
          })
        )[0];
        if (ownerKeyRef.current !== ownerKey) return;
        const rawOverview = localDeFiOverview?.overview?.[network.id];
        singleNetworkLocalCacheRef.current.hasCache = Boolean(rawOverview);
        updateAccountDeFiOverview({
          currency: settingsCurrencyId,
          accountId: account.id,
          networkId: network.id,
          overview: rawOverview
            ? mergeDeFiOverviewCurrency({
                overview: rawOverview,
                sourceCurrencyInfo: currencyMap[rawOverview.currency],
                targetCurrencyInfo: currencyMap[settingsCurrencyId],
              })
            : {
                totalValue: 0,
                totalDebt: 0,
                totalReward: 0,
                netWorth: 0,
              },
          isReady: Boolean(rawOverview),
        });
      } catch (error) {
        console.error(error);
      }
    })();
  }, [
    account?.id,
    account?.address,
    network?.id,
    currentOwnerKey,
    settingsCurrencyId,
    currencyMap,
    updateAccountDeFiOverview,
    updateOverviewDeFiDataState,
  ]);

  const refreshSingleNetworkDeFiOverviewByTarget = useCallback(
    async (target: { accountId: string; networkId: string }) => {
      if (
        !target.accountId ||
        !target.networkId ||
        networkUtils.isAllNetwork({ networkId: target.networkId })
      ) {
        return;
      }
      const seq = (explicitDeFiRefreshSeqRef.current += 1);
      const isLatest = () => explicitDeFiRefreshSeqRef.current === seq;
      try {
        const targetAccount =
          await backgroundApiProxy.serviceAccount.getAccount(target);
        if (!isLatest()) return;
        const localDeFiOverview = (
          await backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: target.accountId,
                networkId: target.networkId,
                accountAddress: targetAccount?.address,
              },
            ],
          })
        )[0];
        if (!isLatest()) return;
        const rawOverview = localDeFiOverview?.overview?.[target.networkId];
        updateAccountDeFiOverview({
          currency: settingsCurrencyId,
          accountId: target.accountId,
          networkId: target.networkId,
          overview: rawOverview
            ? mergeDeFiOverviewCurrency({
                overview: rawOverview,
                sourceCurrencyInfo: currencyMap[rawOverview.currency],
                targetCurrencyInfo: currencyMap[settingsCurrencyId],
              })
            : {
                totalValue: 0,
                totalDebt: 0,
                totalReward: 0,
                netWorth: 0,
              },
          isReady: Boolean(rawOverview),
        });
      } catch {
        // Cache hydration is best effort; the focused DeFi tab will refresh it.
      }
    },
    [currencyMap, settingsCurrencyId, updateAccountDeFiOverview],
  );

  return { run, refreshSingleNetworkDeFiOverviewByTarget };
}
