import { memo, useCallback, useEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { isEqual, noop } from 'lodash';

import { useUpdateEffect } from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import {
  useAccountIsAutoCreatingAtom,
  useAppIsLockedAtom,
  useIndexedAccountAddressCreationStateAtom,
  usePasswordAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsActiveOrderBookOptionsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import {
  perpsActiveAssetAtom,
  perpsActiveOrderBookOptionsAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountRefreshHookAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveOrderBookOptionsAtom,
  usePerpsUserConfigPersistAtom,
  usePerpsWebSocketConnectedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { COINTYPE_ETH } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { useDebugHooksDepsChangedChecker } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBook,
  IWsAllDexsAssetCtxs,
  IWsAllDexsClearinghouseState,
  IWsAllMids,
  IWsOpenOrders,
  IWsUserNonFundingLedgerUpdates,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  EPerpsSubscriptionCategory,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';
import {
  EPerpUserType,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import {
  useOrderBookTickOptionsAtom,
  useSubscriptionActiveAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';

import { usePerpTokenUrlSync } from './usePerpTokenUrlSync';

function useSyncContextOrderBookOptionsToGlobal() {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();

  const orderBookTickOptionsRef = useRef(orderBookTickOptions);
  orderBookTickOptionsRef.current = orderBookTickOptions;

  const isFocusedRef = useRef(true);

  const updateGlobalOrderBookOptions = useCallback(
    async (
      _orderBookTickOptions: Record<string, IPerpOrderBookTickOptionPersist>,
    ) => {
      if (!isFocusedRef.current) {
        return;
      }
      const prev = await perpsActiveOrderBookOptionsAtom.get();
      const _activeAsset = await perpsActiveAssetAtom.get();

      const l2SubscriptionOptions = (() => {
        const coin = _activeAsset?.coin;
        if (!coin) {
          return { nSigFigs: null, mantissa: null };
        }
        const stored = _orderBookTickOptions[coin];
        const nSigFigs = stored?.nSigFigs ?? null;
        const mantissa =
          stored?.mantissa === undefined ? undefined : stored.mantissa;
        return { nSigFigs: nSigFigs ?? null, mantissa: mantissa ?? null };
      })();

      const next: IPerpsActiveOrderBookOptionsAtom = {
        coin: _activeAsset?.coin,
        assetId: _activeAsset?.assetId,
        ...l2SubscriptionOptions,
      };
      if (isEqual(prev, next)) {
        return;
      }
      await perpsActiveOrderBookOptionsAtom.set(
        (): IPerpsActiveOrderBookOptionsAtom => next,
      );
    },
    [],
  );

  useEffect(() => {
    noop(orderBookTickOptions);
    noop(activeAsset?.coin);
    void updateGlobalOrderBookOptions(orderBookTickOptions);
  }, [orderBookTickOptions, activeAsset?.coin, updateGlobalOrderBookOptions]);

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, _isHiddenByModal: boolean) => {
      const isFocusedPrev = isFocusedRef.current;
      isFocusedRef.current = isFocus;
      if (isFocus !== isFocusedPrev) {
        void updateGlobalOrderBookOptions(orderBookTickOptionsRef.current);
      }
    },
  );
}

function useHyperliquidEventBusListener() {
  const actions = useHyperliquidActions();

  useEffect(() => {
    const handleDataUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: EPerpsSubscriptionCategory;
        subType: ESubscriptionType;
        data: any;
        metadata?: { source?: string; timestamp?: number };
      };
      const { subType, data } = eventPayload;

      try {
        switch (subType) {
          case ESubscriptionType.ALL_MIDS:
            void actions.current.updateAllMids(data as IWsAllMids);
            break;

          case ESubscriptionType.WEB_DATA2: {
            const webData2 = data as IWsWebData2;
            void actions.current.updateWebData2(webData2);
            break;
          }
          case ESubscriptionType.ALL_DEXS_CLEARINGHOUSE_STATE: {
            void actions.current.updateAllDexsClearinghouseState(
              data as IWsAllDexsClearinghouseState,
            );
            break;
          }

          case ESubscriptionType.OPEN_ORDERS: {
            void actions.current.updateOpenOrders(data as IWsOpenOrders);
            break;
          }

          case ESubscriptionType.ALL_DEXS_ASSET_CTXS: {
            void actions.current.updateAllDexsAssetCtxs(
              data as IWsAllDexsAssetCtxs,
            );
            break;
          }

          case ESubscriptionType.L2_BOOK:
            void actions.current.updateL2Book(data as IBook);
            break;

          case ESubscriptionType.USER_NON_FUNDING_LEDGER_UPDATES:
            void actions.current.updateLedgerUpdates(
              data as IWsUserNonFundingLedgerUpdates,
            );
            break;

          case ESubscriptionType.ACTIVE_ASSET_CTX:
            // move to global jotai, updateActiveAssetCtx() in background
            // void actions.current.updateActiveAssetCtx(
            //   data as IWsActiveAssetCtx,
            //   eventPayload.metadata.coin,
            // );
            break;

          case ESubscriptionType.ACTIVE_ASSET_DATA:
            // move to global jotai, updateActiveAssetData() in background
            // void actions.current.updateActiveAssetData(
            //   data as IActiveAssetData,
            //   eventPayload.metadata.coin,
            // );
            break;

          // case ESubscriptionType.BBO:
          //   break;

          default:
        }
      } catch (error) {
        console.error('Failed to process data update:', error);
      }
    };

    const handleConnectionChange = (payload: unknown) => {
      const eventPayload = payload as {
        type: 'connection';
        subType: string;
        data: {
          status: 'connected' | 'disconnected';
          lastConnected: number;
          service: string;
          activeSubscriptions: number;
        };
      };
      const { data } = eventPayload;

      try {
        void actions.current.updateConnectionState({
          isConnected: data.status === 'connected',
        });
      } catch (error) {
        console.error('Failed to process connection change:', error);
      }
    };

    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, handleDataUpdate);
    appEventBus.on(
      EAppEventBusNames.HyperliquidConnectionChange,
      handleConnectionChange,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleDataUpdate,
      );
      appEventBus.off(
        EAppEventBusNames.HyperliquidConnectionChange,
        handleConnectionChange,
      );
    };
  }, [actions]);
}

function useHyperliquidSession() {
  const [subscriptionActive] = useSubscriptionActiveAtom();
  const actions = useHyperliquidActions();

  const [currentAccount] = usePerpsActiveAccountAtom();
  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      if (isFocus && !isHiddenByModal) {
        // Handle tab focus
      } else {
        // Handle tab unfocus
      }
    },
  );

  useEffect(() => {
    const actionsRef = actions.current;
    return () => {
      void actionsRef.clearAllData();
    };
  }, [actions]);

  return {
    userAddress: currentAccount?.accountAddress,
    isActive: subscriptionActive,
  };
}

function useHyperliquidAccountSelect() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const actions = useHyperliquidActions();
  const [accountIsAutoCreating] = useAccountIsAutoCreatingAtom();
  const isFocused = useRouteIsFocused();
  const [indexedAccountAddressCreationState] =
    useIndexedAccountAddressCreationStateAtom();
  const perpsAccountAddressRef = useRef(activePerpsAccount?.accountAddress);
  perpsAccountAddressRef.current = activePerpsAccount?.accountAddress;

  // const [perpsAccountStatus] = usePerpsSelectedAccountStatusAtom();
  // const perpsAccountStatusRef = useRef(perpsAccountStatus);
  // perpsAccountStatusRef.current = perpsAccountStatus;

  const lastCheckTimeRef = useRef(0);
  const checkPerpsAccountStatus = useCallback(async () => {
    lastCheckTimeRef.current = Date.now();
    await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
  }, []);

  const { result: globalDeriveType, run: refreshGlobalDeriveType } =
    usePromiseResult(
      async () => {
        const driveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: PERPS_NETWORK_ID,
          });
        return driveType;
      },
      [],
      {
        checkIsFocused: false,
      },
    );

  useEffect(() => {
    const fn = async () => {
      await refreshGlobalDeriveType();
    };
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, fn);
    };
  }, [refreshGlobalDeriveType]);

  const [{ refreshHook: activeAccountRefreshHook }] =
    usePerpsActiveAccountRefreshHookAtom();

  const selectPerpsAccount = useCallback(async () => {
    if (!globalDeriveType) {
      return;
    }
    noop(activeAccountRefreshHook);
    noop(activeAccount.account?.address);
    console.log(
      'selectPerpsAccount______555_address',
      activeAccount.account?.address,
    );
    const _account = await actions.current.changeActivePerpsAccount({
      indexedAccountId: activeAccount?.indexedAccount?.id || null,
      accountId: activeAccount?.account?.id || null,
      walletId: activeAccount?.wallet?.id || null,
      deriveType: globalDeriveType,
    });
    await checkPerpsAccountStatus();
  }, [
    actions,
    activeAccount.account?.address,
    activeAccount.account?.id,
    activeAccount?.wallet?.id,
    activeAccount?.indexedAccount?.id,
    checkPerpsAccountStatus,
    globalDeriveType,
    activeAccountRefreshHook,
  ]);

  const selectPerpsAccountRef = useRef(selectPerpsAccount);
  selectPerpsAccountRef.current = selectPerpsAccount;

  useEffect(() => {
    void selectPerpsAccount();
  }, [selectPerpsAccount]);

  useEffect(() => {
    const fn = async (
      payload: IAppEventBusPayload[EAppEventBusNames.AddDBAccountsToWallet],
    ) => {
      await timerUtils.wait(600);
      if (!perpsAccountAddressRef.current) {
        if (payload?.accounts?.find((item) => item.coinType === COINTYPE_ETH)) {
          await selectPerpsAccountRef.current();
        }
      }
    };
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddDBAccountsToWallet, fn);
    };
  }, []);

  useUpdateEffect(() => {
    if (!accountIsAutoCreating && !indexedAccountAddressCreationState) {
      void selectPerpsAccountRef.current();
    }
  }, [accountIsAutoCreating, indexedAccountAddressCreationState]);

  useUpdateEffect(() => {
    void (async () => {
      if (
        isFocused &&
        lastCheckTimeRef.current +
          timerUtils.getTimeDurationMs({
            // seconds: 10,
            hour: 1,
          }) <
          Date.now()
      ) {
        await timerUtils.wait(600);
        await checkPerpsAccountStatus();
      }
    })();
  }, [isFocused, checkPerpsAccountStatus]);
}

function WebSocketSubscriptionUpdate() {
  const [loadingInfo] = usePerpsAccountLoadingInfoAtom();
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeOrderBookOptions] = usePerpsActiveOrderBookOptionsAtom();
  const actions = useHyperliquidActions();
  const [isWebSocketConnected] = usePerpsWebSocketConnectedAtom();

  const { checkDeps } = useDebugHooksDepsChangedChecker(
    'PerpsGlobalEffects.WebSocketSubscriptionUpdate',
  );

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const isLoading: boolean = !!loadingInfo?.selectAccountLoading;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    checkDeps({
      isWebSocketConnected,
      isLoading,
      actions,
      address: activePerpsAccount?.accountAddress,
      coin: activeAsset?.coin,
      mantissa: activeOrderBookOptions?.mantissa,
      nSigFigs: activeOrderBookOptions?.nSigFigs,
      orderBookCoin: activeOrderBookOptions?.coin,
    });
    noop(activePerpsAccount?.accountAddress);
    noop(activeAsset?.coin);
    noop(activeOrderBookOptions?.coin);
    noop(activeOrderBookOptions?.mantissa);
    noop(activeOrderBookOptions?.nSigFigs);

    if (isWebSocketConnected === true && !isLoading) {
      if (
        activeAsset?.coin &&
        activeOrderBookOptions?.coin === activeAsset?.coin
      ) {
        console.log('updateSubscriptions______PerpsGlobalEffects');
        void actions.current.updateSubscriptions();
      } else {
        // update orderbook options to match the active asset
        // Toast.error({
        //   title: 'Error',
        //   message:
        //     'Orderbook options do not match the active asset coin, please change the asset',
        // });
      }
    }
  }, [
    checkDeps,
    isWebSocketConnected,
    isLoading,
    actions,
    activePerpsAccount?.accountAddress,
    activeAsset?.coin,
    activeOrderBookOptions?.mantissa,
    activeOrderBookOptions?.nSigFigs,
    activeOrderBookOptions?.coin,
  ]);
  return null;
}

function useHyperliquidSymbolSelect() {
  const actions = useHyperliquidActions();
  useEffect(() => {
    void (async () => {
      await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
      const currentToken = await perpsActiveAssetAtom.get();
      await actions.current.changeActiveAsset({
        coin: currentToken.coin,
        force: true,
      });
    })();
  }, [actions]);
}

function useHyperliquidScreenLockHandler() {
  const [{ unLock }] = usePasswordAtom();
  const prevUnLockRef = useRef<boolean | null>(null);
  const isFocused = useRouteIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const checkPerpsAccountStatus = useCallback(async () => {
    await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
  }, []);

  useEffect(() => {
    if (prevUnLockRef.current === null) {
      prevUnLockRef.current = unLock;
      return;
    }

    if (prevUnLockRef.current !== unLock) {
      if (unLock) {
        // Screen unlocked - restore status
        if (isFocusedRef.current) {
          void checkPerpsAccountStatus();
        }
      } else {
        // Screen locked - dispose clients
        void backgroundApiProxy.serviceHyperliquid.disposeExchangeClients();
      }
      prevUnLockRef.current = unLock;
    }
  }, [unLock, checkPerpsAccountStatus]);
}

function AutoPauseSubscriptions() {
  const pauseSubscriptionsTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const [perpsConfig] = usePerpsUserConfigPersistAtom();

  // const isFocusedRoute = useRouteIsFocused();
  // useEffect(() => {
  //   //
  // }, [isFocusedRoute]);

  const onFocusHandler = useCallback(
    async ({
      isFocus,
      pauseDelay,
    }: {
      isFocus: boolean;
      pauseDelay?: number;
    }) => {
      // console.log('AutoPauseSubscriptions___useListenTabFocusState', {
      //   isFocus,
      //   isHideByModal,
      // });
      if (isFocus) {
        clearTimeout(pauseSubscriptionsTimerRef.current);
        void backgroundApiProxy.serviceHyperliquidSubscription.enableSubscriptionsHandler();
        void backgroundApiProxy.serviceHyperliquidSubscription.resumeSubscriptions();
      } else {
        void backgroundApiProxy.serviceHyperliquidSubscription.disableSubscriptionsHandler();
        clearTimeout(pauseSubscriptionsTimerRef.current);
        // eslint-disable-next-line no-param-reassign
        pauseDelay =
          pauseDelay ??
          timerUtils.getTimeDurationMs({
            minute: 5,
            seconds: 30,
          });
        pauseSubscriptionsTimerRef.current = setTimeout(() => {
          void backgroundApiProxy.serviceHyperliquidSubscription.pauseSubscriptions();
        }, pauseDelay);
      }
    },
    [],
  );

  const isFocusedRef = useRef(false);
  useListenTabFocusState(ETabRoutes.Perp, (isFocus: boolean) => {
    const isFocusPrev = isFocusedRef.current;
    isFocusedRef.current = isFocus;
    if (isFocusPrev !== isFocus) {
      void onFocusHandler({ isFocus: isFocusedRef.current });
    }
  });

  const [isLocked] = useAppIsLockedAtom();

  useEffect(() => {
    if (isLocked) {
      void onFocusHandler({ isFocus: false });
    } else if (
      perpsConfig?.perpUserConfig?.currentUserType === EPerpUserType.PERP_NATIVE
    ) {
      void onFocusHandler({ isFocus: isFocusedRef.current });
    } else {
      void onFocusHandler({ isFocus: false, pauseDelay: 300 });
    }
  }, [isLocked, onFocusHandler, perpsConfig?.perpUserConfig?.currentUserType]);

  useEffect(() => {
    return () => {
      clearTimeout(pauseSubscriptionsTimerRef.current);
      void onFocusHandler({ isFocus: false, pauseDelay: 300 });
    };
  }, [onFocusHandler]);

  return null;
}

function PerpsGlobalEffectsView() {
  useHyperliquidEventBusListener();
  useHyperliquidSession();
  useHyperliquidAccountSelect();
  usePerpTokenUrlSync();
  useHyperliquidSymbolSelect();
  useHyperliquidScreenLockHandler();
  useSyncContextOrderBookOptionsToGlobal();

  return (
    <>
      <DelayedRender delay={600}>
        <WebSocketSubscriptionUpdate />
      </DelayedRender>
      <AutoPauseSubscriptions />
    </>
  );
}

const PerpsGlobalEffectsMemo = memo(() => {
  console.log('PerpsGlobalEffectsMemo___mouted');

  return (
    <GlobalJotaiReady>
      <PerpsGlobalEffectsView />
    </GlobalJotaiReady>
  );
});
PerpsGlobalEffectsMemo.displayName = 'PerpsGlobalEffectsMemo';

export function PerpsGlobalEffects() {
  return <PerpsGlobalEffectsMemo />;
}
