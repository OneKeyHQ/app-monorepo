import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type {
  IRefreshEventPayload,
  IScheduleRecommendedRefresh,
  IShouldRefreshByAccounts,
} from './types';

export function useRecommendedRefreshAppEvents({
  accountId,
  networkId,
  enableFetch,
  shouldRefreshByAccounts,
  scheduleRecommendedRefresh,
}: {
  accountId?: string;
  networkId: string;
  enableFetch: boolean;
  shouldRefreshByAccounts: IShouldRefreshByAccounts;
  scheduleRecommendedRefresh: IScheduleRecommendedRefresh;
}) {
  useEffect(() => {
    if (!enableFetch || !accountId || !networkId) {
      return;
    }

    const handleRefresh =
      (eventName: EAppEventBusNames) => (payload?: IRefreshEventPayload) => {
        if (
          eventName === EAppEventBusNames.RefreshTokenList &&
          payload?.accounts &&
          !shouldRefreshByAccounts(payload.accounts)
        ) {
          return;
        }

        scheduleRecommendedRefresh({ source: 'app-event' });
      };

    const onAccountDataUpdate = handleRefresh(
      EAppEventBusNames.AccountDataUpdate,
    );
    const onAccountUpdate = handleRefresh(EAppEventBusNames.AccountUpdate);
    const onGlobalDeriveTypeUpdate = handleRefresh(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
    );
    const onNetworkDeriveTypeChanged = handleRefresh(
      EAppEventBusNames.NetworkDeriveTypeChanged,
    );
    const onRefreshTokenList = handleRefresh(
      EAppEventBusNames.RefreshTokenList,
    );
    const onRefreshEarnRecommendedList = handleRefresh(
      EAppEventBusNames.RefreshEarnRecommendedList,
    );

    appEventBus.on(EAppEventBusNames.AccountDataUpdate, onAccountDataUpdate);
    appEventBus.on(EAppEventBusNames.AccountUpdate, onAccountUpdate);
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      onGlobalDeriveTypeUpdate,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      onNetworkDeriveTypeChanged,
    );
    appEventBus.on(EAppEventBusNames.RefreshTokenList, onRefreshTokenList);
    appEventBus.on(
      EAppEventBusNames.RefreshEarnRecommendedList,
      onRefreshEarnRecommendedList,
    );

    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, onAccountDataUpdate);
      appEventBus.off(EAppEventBusNames.AccountUpdate, onAccountUpdate);
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        onGlobalDeriveTypeUpdate,
      );
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        onNetworkDeriveTypeChanged,
      );
      appEventBus.off(EAppEventBusNames.RefreshTokenList, onRefreshTokenList);
      appEventBus.off(
        EAppEventBusNames.RefreshEarnRecommendedList,
        onRefreshEarnRecommendedList,
      );
    };
  }, [
    accountId,
    enableFetch,
    networkId,
    scheduleRecommendedRefresh,
    shouldRefreshByAccounts,
  ]);
}
