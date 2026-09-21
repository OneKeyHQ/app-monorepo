import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IProtocolPositionActionSuccessParams } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import { useAccountOverviewActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useDeFiListActions } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { sortDeFiProtocolsByNetWorth } from '../deFiListDataUtils';

type IUseDeFiListRefreshParams = {
  account?: INetworkAccount;
  network?: IServerNetwork;
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  refreshCacheOnly: boolean;
  isFocused: boolean;
  isHeaderRefreshing: boolean;
  currentOwnerKey?: string;
  settingsCurrencyId: string;
  prepareManualDeFiForceRefresh: (
    payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate],
  ) => void;
  run: () => Promise<unknown>;
  handleRefreshAllNetworkData: () => void;
  refreshSingleNetworkDeFiOverviewByTarget: (target: {
    accountId: string;
    networkId: string;
  }) => Promise<void>;
};

export function useDeFiListRefresh({
  account,
  network,
  protocols,
  protocolMap,
  refreshCacheOnly,
  isFocused,
  isHeaderRefreshing,
  currentOwnerKey,
  settingsCurrencyId,
  prepareManualDeFiForceRefresh,
  run,
  handleRefreshAllNetworkData,
  refreshSingleNetworkDeFiOverviewByTarget,
}: IUseDeFiListRefreshParams) {
  const { updateAccountDeFiOverview } = useAccountOverviewActions().current;
  const {
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;
  const protocolsRef = useRef(protocols);
  const protocolMapRef = useRef(protocolMap);
  const pendingRefreshRef = useRef<
    | { payload: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate] }
    | undefined
  >(undefined);
  protocolsRef.current = protocols;
  protocolMapRef.current = protocolMap;

  const refresh = useCallback(
    (payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate]) => {
      prepareManualDeFiForceRefresh(payload);
      if (network?.isAllNetworks) {
        handleRefreshAllNetworkData();
      } else {
        void run();
      }
    },
    [
      network?.isAllNetworks,
      handleRefreshAllNetworkData,
      prepareManualDeFiForceRefresh,
      run,
    ],
  );

  useEffect(() => {
    if (refreshCacheOnly) return;
    const onRefresh = (
      payload?: IAppEventBusPayload[EAppEventBusNames.AccountDataUpdate],
    ) => {
      if (isFocused) {
        pendingRefreshRef.current = undefined;
        refresh(payload);
      } else {
        pendingRefreshRef.current = {
          payload: payload?.isManualRefresh ? undefined : payload,
        };
      }
    };
    if (isFocused && pendingRefreshRef.current) {
      const { payload } = pendingRefreshRef.current;
      pendingRefreshRef.current = undefined;
      refresh(payload);
    }
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, onRefresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, onRefresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, onRefresh);
    };
  }, [isFocused, refresh, refreshCacheOnly]);

  useEffect(() => {
    if (!refreshCacheOnly) return;
    const onRefreshByProvidedAccounts = (
      params: IAppEventBusPayload[EAppEventBusNames.RefreshTokenList],
    ) => {
      if (params?.refreshByProvidedAccounts && params.accounts?.[0]) {
        void refreshSingleNetworkDeFiOverviewByTarget(params.accounts[0]);
      }
    };
    appEventBus.on(
      EAppEventBusNames.RefreshTokenList,
      onRefreshByProvidedAccounts,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.RefreshTokenList,
        onRefreshByProvidedAccounts,
      );
    };
  }, [refreshCacheOnly, refreshSingleNetworkDeFiOverviewByTarget]);

  useEffect(() => {
    const onDeFiPositionRefreshed = (
      payload: IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed],
    ) => {
      if (refreshCacheOnly || !account?.id || !network?.id) return;
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
          currency: settingsCurrencyId,
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

      const refreshedProtocols = protocolsRef.current
        .filter((protocol) => protocol.networkId !== payload.networkId)
        .concat(payload.protocols);
      const prefix = `${payload.networkId}-`;
      const nextProtocolMap: Record<string, IProtocolSummary> = {};
      for (const [key, value] of Object.entries(protocolMapRef.current)) {
        if (!key.startsWith(prefix)) nextProtocolMap[key] = value;
      }
      Object.assign(nextProtocolMap, payload.protocolMap);
      const nextProtocols = sortDeFiProtocolsByNetWorth({
        protocols: refreshedProtocols,
        protocolMap: nextProtocolMap,
      });
      let totalValue = new BigNumber(0);
      let totalDebt = new BigNumber(0);
      let totalReward = new BigNumber(0);
      let netWorth = new BigNumber(0);
      Object.values(nextProtocolMap).forEach((summary) => {
        totalValue = totalValue.plus(summary.totalValue ?? 0);
        totalDebt = totalDebt.plus(summary.totalDebt ?? 0);
        totalReward = totalReward.plus(summary.totalReward ?? 0);
        netWorth = netWorth.plus(summary.netWorth ?? 0);
      });
      updateDeFiListProtocols({ protocols: nextProtocols });
      updateDeFiListProtocolMap({ protocolMap: nextProtocolMap });
      updateAccountDeFiOverview({
        currency: settingsCurrencyId,
        accountId: account.id,
        networkId: network.id,
        overview: {
          totalValue: totalValue.toNumber(),
          totalDebt: totalDebt.toNumber(),
          totalReward: totalReward.toNumber(),
          netWorth: netWorth.toNumber(),
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
    settingsCurrencyId,
    updateAccountDeFiOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  useEffect(() => {
    if (!isHeaderRefreshing || refreshCacheOnly) return;
    if (network?.isAllNetworks) {
      handleRefreshAllNetworkData();
    } else {
      void run();
    }
  }, [
    isHeaderRefreshing,
    refreshCacheOnly,
    network?.isAllNetworks,
    handleRefreshAllNetworkData,
    run,
  ]);

  const handleActionSuccess = useCallback(
    async ({ accountId, networkId }: IProtocolPositionActionSuccessParams) => {
      // The callback is the authoritative success edge for the action. Route
      // it directly to the concrete account/network so the DeFi tab does not
      // depend on the History container being mounted to start the positions
      // request. ServiceDeFi emits DeFiPositionRefreshed for the active tab
      // and coalesces the delayed/local-confirm refreshes by the same key.
      void backgroundApiProxy.serviceDeFi
        .refreshAccountDeFiPositionsAfterAction({
          accountId,
          networkId,
        })
        .catch((error) => {
          console.error('[DeFiListBlock] action refresh failed', error);
        });
      appEventBus.emit(EAppEventBusNames.HistoryTxStatusChanged, undefined);
    },
    [],
  );

  return { handleActionSuccess };
}
