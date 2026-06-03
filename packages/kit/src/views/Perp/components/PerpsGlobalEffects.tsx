import { memo, startTransition, useCallback, useEffect, useRef } from 'react';

import { isEqual, noop } from 'lodash';

import { useUpdateEffect } from '@onekeyhq/components';
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
  tradingModeAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountRefreshHookAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveOrderBookOptionsAtom,
  usePerpsWebSocketConnectedAtom,
  useTradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import {
  spotActiveAssetAtom,
  useSpotActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/spot';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { COINTYPE_ETH } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  markPerpsColdStartPerf,
  markPerpsColdStartPerfOnce,
  resetPerpsColdStartPerfSession,
} from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { useDebugHooksDepsChangedChecker } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { getPerpsOrderBookTickOptionsWithCache } from '@onekeyhq/shared/src/utils/perpsOrderBookTickOptionsCache';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBook,
  IWsAllDexsAssetCtxs,
  IWsAllDexsClearinghouseState,
  IWsAllMids,
  IWsBbo,
  IWsOpenOrders,
  IWsTwapStates,
  IWsUserNonFundingLedgerUpdates,
  IWsUserTwapHistory,
  IWsUserTwapSliceFills,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  EPerpsSubscriptionCategory,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useHandleAppStateActive } from '../../../hooks/useHandleAppStateActive';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useLocaleVariant } from '../../../hooks/useLocaleVariant';
import { useNetworkRestore } from '../../../hooks/useNetworkRestore';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  useTradeRouteViewStateAtom,
} from '../../../states/jotai/contexts/hyperliquid';
import {
  useOrderBookTickOptionsAtom,
  usePerpsActiveAssetCtxColdCacheAtom,
  useSubscriptionActiveAtom,
} from '../../../states/jotai/contexts/hyperliquid/atoms';
import { upsertPerpsActiveAssetCtxColdCacheEntry } from '../hooks/usePerpsActiveAssetCtxDisplay';
import {
  isTradeInstrumentBackedBySubscriptionState,
  planTradeSubscriptions,
} from '../utils/subscriptionPlanner';

import { shouldCheckPerpsAccountStatusOnFocus } from './PerpsGlobalEffects.utils';
import { usePerpTokenUrlSync } from './usePerpTokenUrlSync';

const shouldTreatPerpAsFocusedOnMount = !!(
  platformEnv.isExtensionUiExpandTab ||
  platformEnv.isExtensionUiStandaloneWindow
);

let lastRecoveredPerpsLocaleVariant: string | undefined;
let lastRouteSubscriptionStateVersion = 0;

function nextRouteSubscriptionStateVersion() {
  const timeVersion = Date.now() * 1000;
  lastRouteSubscriptionStateVersion = Math.max(
    lastRouteSubscriptionStateVersion + 1,
    timeVersion,
  );
  return lastRouteSubscriptionStateVersion;
}

function resolvePerpRouteFocused(isFocus: boolean) {
  return shouldTreatPerpAsFocusedOnMount || isFocus;
}

function hasTradingUniverseCache(data: { universesByDex?: unknown[][] }) {
  return Boolean(data.universesByDex?.some((items) => items?.length > 0));
}

async function buildActiveInstrumentSwitchParamsFromGlobal(options?: {
  force?: boolean;
}) {
  const currentMode = (await tradingModeAtom.get()) ?? 'perp';
  if (currentMode === 'spot') {
    const spotAsset = await spotActiveAssetAtom.get();
    if (!spotAsset?.coin) {
      return undefined;
    }
    return {
      mode: 'spot' as const,
      coin: spotAsset.coin,
      spotUniverse: spotAsset.universe,
      force: options?.force,
    };
  }

  const perpAsset = await perpsActiveAssetAtom.get();
  if (!perpAsset?.coin) {
    return undefined;
  }
  return {
    mode: 'perp' as const,
    coin: perpAsset.coin,
    force: options?.force,
  };
}

function useSyncContextOrderBookOptionsToGlobal() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();

  const orderBookTickOptionsRef = useRef(orderBookTickOptions);
  orderBookTickOptionsRef.current = orderBookTickOptions;
  const activeTradeInstrumentRef = useRef(activeTradeInstrument);
  activeTradeInstrumentRef.current = activeTradeInstrument;

  const isFocusedRef = useRef(shouldTreatPerpAsFocusedOnMount);

  const updateGlobalOrderBookOptions = useCallback(
    async (
      _orderBookTickOptions: Record<string, IPerpOrderBookTickOptionPersist>,
    ) => {
      if (!isFocusedRef.current) {
        return;
      }
      const prev = await perpsActiveOrderBookOptionsAtom.get();
      const _activeInstrument = activeTradeInstrumentRef.current;
      const effectiveOrderBookTickOptions =
        getPerpsOrderBookTickOptionsWithCache(_orderBookTickOptions);

      const l2SubscriptionOptions = (() => {
        const coin = _activeInstrument?.coin;
        if (!coin) {
          return { nSigFigs: null, mantissa: null };
        }
        const stored = effectiveOrderBookTickOptions[coin];
        const nSigFigs = stored?.nSigFigs ?? null;
        const mantissa =
          stored?.mantissa === undefined ? undefined : stored.mantissa;
        return { nSigFigs: nSigFigs ?? null, mantissa: mantissa ?? null };
      })();

      const next: IPerpsActiveOrderBookOptionsAtom = {
        coin: _activeInstrument?.coin,
        assetId: _activeInstrument?.assetId,
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
    noop(activeTradeInstrument?.coin);
    void updateGlobalOrderBookOptions(orderBookTickOptions);
  }, [
    orderBookTickOptions,
    activeTradeInstrument?.coin,
    activeTradeInstrument?.assetId,
    updateGlobalOrderBookOptions,
  ]);

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, _isHiddenByModal: boolean) => {
      const nextFocused = resolvePerpRouteFocused(isFocus);
      const isFocusedPrev = isFocusedRef.current;
      isFocusedRef.current = nextFocused;
      if (nextFocused !== isFocusedPrev) {
        void updateGlobalOrderBookOptions(orderBookTickOptionsRef.current);
      }
    },
  );
}

function useTradeRouteViewStateSync() {
  const actions = useHyperliquidActions();

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      actions.current.setTradeRouteViewState({
        routeFocused: resolvePerpRouteFocused(isFocus) && !isHiddenByModal,
      });
      if (resolvePerpRouteFocused(isFocus) && !isHiddenByModal) {
        resetPerpsColdStartPerfSession();
        markPerpsColdStartPerf('route_focused');
      } else {
        markPerpsColdStartPerf('route_blurred', {
          isFocus,
          isHiddenByModal,
        });
      }
    },
  );

  useEffect(() => {
    const actionsRef = actions.current;
    if (shouldTreatPerpAsFocusedOnMount) {
      resetPerpsColdStartPerfSession();
      markPerpsColdStartPerf('route_focused_on_mount');
      actionsRef.setTradeRouteViewState({
        routeFocused: true,
      });
    }
    return () => {
      actionsRef.setTradeRouteViewState({
        routeFocused: false,
        tokenSelectorOpen: false,
      });
    };
  }, [actions]);
}

// Caps the perp UI at ~20 Hz for high-frequency channels. Hyperliquid pushes
// l2Book / bbo / allMids many times per second; without this every push
// cascades through every memoized Perp surface (OrderBook, price labels,
// ticker, Wallet USD totals). Leading edge fires instantly so the first value
// after idle lands without delay; trailing edge guarantees the final value
// always lands once the burst stops.
const HIGH_FREQ_CHANNEL_THROTTLE_MS = 50;

// ALL_DEXS_ASSET_CTXS fires ~every 500ms; 1s coalesces token-selector row re-renders.
const ASSET_CTXS_THROTTLE_MS = 1000;

function scheduleThrottledDispatch<T>(
  dirtyRef: { current: T | null },
  timerRef: { current: ReturnType<typeof setTimeout> | null },
  intervalMs: number,
  dispatch: (data: T) => void,
  data: T,
): void {
  dirtyRef.current = data;
  if (timerRef.current) return;
  const pending = dirtyRef.current;
  dirtyRef.current = null;
  startTransition(() => dispatch(pending));
  timerRef.current = setTimeout(() => {
    timerRef.current = null;
    if (dirtyRef.current) {
      const trailing = dirtyRef.current;
      dirtyRef.current = null;
      startTransition(() => dispatch(trailing));
    }
  }, intervalMs);
}

function useHydrateFavoritesBarMarketCache() {
  const actions = useHyperliquidActions();

  useEffect(() => {
    void actions.current.hydrateAllDexsAssetCtxsSnapshotCache();
  }, [actions]);
}

function useHyperliquidEventBusListener() {
  const actions = useHyperliquidActions();

  // Throttle ALL_DEXS_ASSET_CTXS to 1s (leading + trailing) — fires every
  // ~500ms and causes high fan-out market row updates.
  const assetCtxsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetCtxsDirtyRef = useRef<IWsAllDexsAssetCtxs | null>(null);

  const l2BookTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const l2BookDirtyRef = useRef<IBook | null>(null);
  const bboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bboDirtyRef = useRef<IWsBbo | null>(null);
  const allMidsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allMidsDirtyRef = useRef<IWsAllMids | null>(null);

  useEffect(() => {
    const handleDataUpdate = (payload: unknown) => {
      const eventPayload = payload as {
        type: EPerpsSubscriptionCategory;
        subType: ESubscriptionType;
        data: any;
        metadata?: { source?: string; timestamp?: number };
      };
      const { subType, data } = eventPayload;
      markPerpsColdStartPerfOnce(`event_bus_first_${subType}`, {
        source: eventPayload.metadata?.source,
      });

      try {
        switch (subType) {
          case ESubscriptionType.ALL_MIDS:
            scheduleThrottledDispatch(
              allMidsDirtyRef,
              allMidsTimerRef,
              HIGH_FREQ_CHANNEL_THROTTLE_MS,
              (mids) => void actions.current.updateAllMids(mids),
              data as IWsAllMids,
            );
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

          case ESubscriptionType.TWAP_STATES: {
            void actions.current.updateTwapStates(data as IWsTwapStates);
            break;
          }

          case ESubscriptionType.USER_TWAP_HISTORY: {
            void actions.current.updateTwapHistory(data as IWsUserTwapHistory);
            break;
          }

          case ESubscriptionType.USER_TWAP_SLICE_FILLS: {
            void actions.current.updateTwapSliceFills(
              data as IWsUserTwapSliceFills,
            );
            break;
          }

          case ESubscriptionType.ALL_DEXS_ASSET_CTXS: {
            scheduleThrottledDispatch(
              assetCtxsDirtyRef,
              assetCtxsTimerRef,
              ASSET_CTXS_THROTTLE_MS,
              (ctxs) => void actions.current.updateAllDexsAssetCtxs(ctxs),
              data as IWsAllDexsAssetCtxs,
            );
            break;
          }

          case ESubscriptionType.L2_BOOK:
            scheduleThrottledDispatch(
              l2BookDirtyRef,
              l2BookTimerRef,
              HIGH_FREQ_CHANNEL_THROTTLE_MS,
              (book) => void actions.current.updateL2Book(book),
              data as IBook,
            );
            break;

          case ESubscriptionType.BBO:
            scheduleThrottledDispatch(
              bboDirtyRef,
              bboTimerRef,
              HIGH_FREQ_CHANNEL_THROTTLE_MS,
              (bbo) => void actions.current.updateBbo(bbo),
              data as IWsBbo,
            );
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

    // Capture actions at effect setup so the cleanup path does not access
    // ref.current directly (react-hooks lint). The store-recreation case
    // (see comment in useHyperliquidActions) only matters for the long-lived
    // event handlers above, which keep reading actions.current.
    const cleanupActions = actions.current;

    return () => {
      if (assetCtxsTimerRef.current) {
        clearTimeout(assetCtxsTimerRef.current);
        assetCtxsTimerRef.current = null;
      }
      if (assetCtxsDirtyRef.current) {
        try {
          void cleanupActions.updateAllDexsAssetCtxs(assetCtxsDirtyRef.current);
        } catch {
          // unmount path; swallow
        }
      }
      assetCtxsDirtyRef.current = null;
      if (l2BookTimerRef.current) {
        clearTimeout(l2BookTimerRef.current);
        l2BookTimerRef.current = null;
      }
      if (l2BookDirtyRef.current) {
        try {
          void cleanupActions.updateL2Book(l2BookDirtyRef.current);
        } catch {
          // unmount path; swallow
        }
      }
      l2BookDirtyRef.current = null;
      if (bboTimerRef.current) {
        clearTimeout(bboTimerRef.current);
        bboTimerRef.current = null;
      }
      if (bboDirtyRef.current) {
        try {
          void cleanupActions.updateBbo(bboDirtyRef.current);
        } catch {
          // unmount path; swallow
        }
      }
      bboDirtyRef.current = null;
      if (allMidsTimerRef.current) {
        clearTimeout(allMidsTimerRef.current);
        allMidsTimerRef.current = null;
      }
      if (allMidsDirtyRef.current) {
        try {
          void cleanupActions.updateAllMids(allMidsDirtyRef.current);
        } catch {
          // unmount path; swallow
        }
      }
      allMidsDirtyRef.current = null;
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

// OK-53208: perps atoms/WS must survive unmount — mobile modal push
// detaches this tab and re-mount has no recovery. Resets on account
// switch / logout are owned by clearActiveAccountData / ServiceApp.resetApp.
function useHyperliquidSession() {
  const [subscriptionActive] = useSubscriptionActiveAtom();

  const [currentAccount] = usePerpsActiveAccountAtom();
  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      if (resolvePerpRouteFocused(isFocus) && !isHiddenByModal) {
        // Handle tab focus
      } else {
        // Handle tab unfocus
      }
    },
  );

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
    await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
    lastCheckTimeRef.current = Date.now();
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
  const hasBeenFocusedRef = useRef(shouldTreatPerpAsFocusedOnMount);
  const pendingSelectRef = useRef(false);
  // Dedupe by business-semantic params: the callback's deps include several
  // refs that resolve in separate ticks during mount (account.address after
  // id, async globalDeriveType), so the effect would otherwise re-fire the
  // network check each time. refreshHook is included so manual refresh still
  // triggers; account.address is intentionally excluded — it follows id.
  const lastSelectParamsRef = useRef<string | null>(null);
  const isSelectingAccountRef = useRef(false);
  const selectAccountRunIdRef = useRef(0);

  const selectPerpsAccount = useCallback(async () => {
    if (!globalDeriveType) {
      return;
    }
    const params = JSON.stringify({
      indexedAccountId: activeAccount?.indexedAccount?.id || null,
      accountId: activeAccount?.account?.id || null,
      walletId: activeAccount?.wallet?.id || null,
      deriveType: globalDeriveType,
      refreshHook: activeAccountRefreshHook,
    });
    if (lastSelectParamsRef.current === params) {
      return;
    }
    lastSelectParamsRef.current = params;

    const runId = selectAccountRunIdRef.current + 1;
    selectAccountRunIdRef.current = runId;
    isSelectingAccountRef.current = true;
    try {
      noop(activeAccount.account?.address);
      await actions.current.changeActivePerpsAccount({
        indexedAccountId: activeAccount?.indexedAccount?.id || null,
        accountId: activeAccount?.account?.id || null,
        walletId: activeAccount?.wallet?.id || null,
        deriveType: globalDeriveType,
      });
      await checkPerpsAccountStatus();
    } catch (error) {
      lastSelectParamsRef.current = null;
      throw error;
    } finally {
      if (selectAccountRunIdRef.current === runId) {
        isSelectingAccountRef.current = false;
      }
    }
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

  useListenTabFocusState(ETabRoutes.Perp, (isFocus: boolean) => {
    if (resolvePerpRouteFocused(isFocus) && !hasBeenFocusedRef.current) {
      hasBeenFocusedRef.current = true;
      if (pendingSelectRef.current) {
        pendingSelectRef.current = false;
        void selectPerpsAccountRef.current();
      }
    }
  });

  useEffect(() => {
    if (!hasBeenFocusedRef.current) {
      pendingSelectRef.current = true;
      return;
    }
    void selectPerpsAccount();
  }, [selectPerpsAccount]);

  useEffect(() => {
    const fn = async (
      payload: IAppEventBusPayload[EAppEventBusNames.AddDBAccountsToWallet],
    ) => {
      await timerUtils.wait(600);
      if (!perpsAccountAddressRef.current) {
        if (payload?.accounts?.find((item) => item.coinType === COINTYPE_ETH)) {
          if (!hasBeenFocusedRef.current) {
            pendingSelectRef.current = true;
            return;
          }
          // The dedup key intentionally excludes account.address (it resolves
          // asynchronously after account id). Clear it here so that
          // selectPerpsAccount actually runs for the "same indexed account now
          // has an ETH address" case — otherwise the unchanged key causes an
          // early return and the new address is never picked up.
          lastSelectParamsRef.current = null;
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
      if (!hasBeenFocusedRef.current) {
        pendingSelectRef.current = true;
        return;
      }
      void selectPerpsAccountRef.current();
    }
  }, [accountIsAutoCreating, indexedAccountAddressCreationState]);

  useUpdateEffect(() => {
    void (async () => {
      if (!isFocused) {
        return;
      }
      await timerUtils.wait(600);
      if (
        shouldCheckPerpsAccountStatusOnFocus({
          isFocused,
          hasSelectedAccountParams: Boolean(lastSelectParamsRef.current),
          isSelectingAccount: isSelectingAccountRef.current,
          lastCheckTimeMs: lastCheckTimeRef.current,
          nowMs: Date.now(),
          staleMs: timerUtils.getTimeDurationMs({
            // seconds: 10,
            hour: 1,
          }),
        })
      ) {
        await checkPerpsAccountStatus();
      }
    })();
  }, [isFocused, checkPerpsAccountStatus]);
}

function WebSocketSubscriptionUpdate() {
  const [loadingInfo] = usePerpsAccountLoadingInfoAtom();
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeOrderBookOptions] = usePerpsActiveOrderBookOptionsAtom();
  const [perpsActiveAsset] = usePerpsActiveAssetAtom();
  const [spotActiveAsset] = useSpotActiveAssetAtom();
  const [tradingMode] = useTradingModeAtom();
  const [tradeRouteViewState] = useTradeRouteViewStateAtom();
  const actions = useHyperliquidActions();
  const [isWebSocketConnected] = usePerpsWebSocketConnectedAtom();

  const { checkDeps } = useDebugHooksDepsChangedChecker(
    'PerpsGlobalEffects.WebSocketSubscriptionUpdate',
  );

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const isLoading: boolean = !!loadingInfo?.selectAccountLoading;

  // Primitives as deps — avoids re-running on same-value object changes
  const instrumentCoin = activeTradeInstrument?.coin;
  const instrumentMode = activeTradeInstrument.mode;
  const instrumentAssetId = activeTradeInstrument?.assetId;
  const orderBookCoin = activeOrderBookOptions?.coin;
  const orderBookMantissa = activeOrderBookOptions?.mantissa;
  const orderBookNSigFigs = activeOrderBookOptions?.nSigFigs;
  const routeFocused = tradeRouteViewState.routeFocused;
  const tokenSelectorOpen = tradeRouteViewState.tokenSelectorOpen;
  const tokenSelectorTab = tradeRouteViewState.tokenSelectorTab;
  const infoPanelTab = tradeRouteViewState.infoPanelTab;
  const favoritesBarSpotActive = tradeRouteViewState.favoritesBarSpotActive;
  const accountAddress = activePerpsAccount?.accountAddress;
  const perpsActiveAssetCoin = perpsActiveAsset?.coin;
  const spotActiveAssetCoin = spotActiveAsset?.coin;

  // Refs for reading inside effect body without triggering it
  const activeTradeInstrumentRef = useRef(activeTradeInstrument);
  activeTradeInstrumentRef.current = activeTradeInstrument;
  const activeOrderBookOptionsRef = useRef(activeOrderBookOptions);
  activeOrderBookOptionsRef.current = activeOrderBookOptions;
  const tradeRouteViewStateRef = useRef(tradeRouteViewState);
  tradeRouteViewStateRef.current = tradeRouteViewState;
  const syncSequenceRef = useRef(0);

  const subscriptionPlan = planTradeSubscriptions({
    activeInstrument: activeTradeInstrumentRef.current,
    hasAccount: !!accountAddress,
    orderBookOptions: activeOrderBookOptionsRef.current,
    viewState: tradeRouteViewStateRef.current,
  });

  const isInstrumentBackedBySubscriptionState =
    isTradeInstrumentBackedBySubscriptionState({
      activeInstrument: activeTradeInstrumentRef.current,
      tradingMode,
      perpCoin: perpsActiveAssetCoin,
      spotCoin: spotActiveAssetCoin,
    });

  useEffect(() => {
    checkDeps({
      isWebSocketConnected,
      isLoading,
      actions,
      address: accountAddress,
      coin: instrumentCoin,
      tradingMode: instrumentMode,
      assetId: instrumentAssetId,
      mantissa: orderBookMantissa,
      nSigFigs: orderBookNSigFigs,
      orderBookCoin,
      routeFocused,
      tokenSelectorOpen,
      tokenSelectorTab,
      infoPanelTab,
      favoritesBarSpotActive,
      perpsActiveAssetCoin,
      spotActiveAssetCoin,
      subscriptionTradingMode: tradingMode,
      subscriptionStateKey: subscriptionPlan.subscriptionStateKey,
      shouldSyncSubscriptions: subscriptionPlan.shouldSyncSubscriptions,
    });

    syncSequenceRef.current += 1;
    const sequence = syncSequenceRef.current;
    const routeStateVersion = nextRouteSubscriptionStateVersion();
    void (async () => {
      try {
        const routeStateApplied =
          await backgroundApiProxy.serviceHyperliquidSubscription.setRouteSubscriptionState(
            {
              enableLedgerUpdates: subscriptionPlan.enableLedgerUpdates,
              routeStateVersion,
              spotAssetCtxsEnabled: subscriptionPlan.spotAssetCtxsEnabled,
              spotEnabled: subscriptionPlan.spotEnabled,
            },
          );

        if (!routeStateApplied || syncSequenceRef.current !== sequence) {
          return;
        }

        if (
          subscriptionPlan.shouldSyncSubscriptions &&
          isInstrumentBackedBySubscriptionState
        ) {
          markPerpsColdStartPerf('ui_update_subscriptions_call', {
            accountAddress: accountAddress ? 'set' : 'empty',
            coin: instrumentCoin,
            mode: instrumentMode,
            routeFocused,
            tokenSelectorOpen,
            infoPanelTab,
          });
          await actions.current.updateSubscriptions();
        }
      } catch (error) {
        console.error('Failed to sync Perps subscriptions:', error);
      }
    })();
  }, [
    checkDeps,
    isWebSocketConnected,
    isLoading,
    actions,
    accountAddress,
    instrumentCoin,
    instrumentMode,
    instrumentAssetId,
    orderBookCoin,
    orderBookMantissa,
    orderBookNSigFigs,
    routeFocused,
    tokenSelectorOpen,
    tokenSelectorTab,
    infoPanelTab,
    favoritesBarSpotActive,
    perpsActiveAssetCoin,
    spotActiveAssetCoin,
    tradingMode,
    isInstrumentBackedBySubscriptionState,
    subscriptionPlan.enableLedgerUpdates,
    subscriptionPlan.spotAssetCtxsEnabled,
    subscriptionPlan.spotEnabled,
    subscriptionPlan.subscriptionStateKey,
    subscriptionPlan.shouldSyncSubscriptions,
  ]);
  return null;
}

function useHyperliquidSymbolSelect() {
  const actions = useHyperliquidActions();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [, setActiveAssetCtxColdCache] = usePerpsActiveAssetCtxColdCacheAtom();
  const activeTradeInstrumentRef = useRef(activeTradeInstrument);
  activeTradeInstrumentRef.current = activeTradeInstrument;
  const isInitializingRef = useRef(false);

  const selectInitialSymbol = useCallback(async () => {
    if (isInitializingRef.current) {
      markPerpsColdStartPerf('initial_symbol_skip_initializing');
      return;
    }
    isInitializingRef.current = true;
    markPerpsColdStartPerf('initial_symbol_start', {
      activeCoin: activeTradeInstrumentRef.current?.coin,
    });
    try {
      // OK-53208: latch lives in ServiceHyperliquid (singleton) so that
      // Perp tab detach/remount does not re-trigger this init.
      const claimed =
        await backgroundApiProxy.serviceHyperliquid.tryClaimInitialSymbolSelect();
      markPerpsColdStartPerf('initial_symbol_claimed', {
        claimed,
        activeCoin: activeTradeInstrumentRef.current?.coin,
      });
      if (!claimed && activeTradeInstrumentRef.current?.coin) {
        return;
      }
      if (claimed) {
        markPerpsColdStartPerf('initial_symbol_refresh_meta_background_start');
        let refreshTradingMetaPromise: Promise<void> | undefined;
        const refreshTradingMeta = () => {
          if (refreshTradingMetaPromise) {
            return refreshTradingMetaPromise;
          }
          refreshTradingMetaPromise = (async () => {
            markPerpsColdStartPerf('initial_symbol_refresh_trading_meta_start');
            await backgroundApiProxy.serviceHyperliquid.refreshTradingMeta();
            markPerpsColdStartPerf('initial_symbol_refresh_trading_meta_end');
          })().catch((error) => {
            // Offline entry should still hydrate UI context from persisted BG atoms.
            markPerpsColdStartPerf('initial_symbol_refresh_trading_meta_error');
            defaultLogger.perp.hyperliquid.coldStartInitializationError({
              type: 'refresh_trading_meta',
              error,
            });
          });
          return refreshTradingMetaPromise;
        };
        const refreshSpotMeta = (delayMs: number) => {
          void (async () => {
            if (delayMs > 0) {
              markPerpsColdStartPerf('initial_symbol_defer_spot_meta_refresh', {
                delayMs,
              });
              await timerUtils.wait(delayMs);
            }
            try {
              markPerpsColdStartPerf('initial_symbol_refresh_spot_meta_start');
              await backgroundApiProxy.serviceHyperliquid.refreshSpotMeta();
              markPerpsColdStartPerf('initial_symbol_refresh_spot_meta_end');
            } catch (e) {
              markPerpsColdStartPerf('initial_symbol_refresh_spot_meta_error');
              defaultLogger.perp.hyperliquid.coldStartInitializationError({
                type: 'refresh_spot_meta',
                error: e,
              });
            }
          })();
        };
        const deferTradingMetaRefresh = (delayMs: number) => {
          void (async () => {
            markPerpsColdStartPerf(
              'initial_symbol_defer_trading_meta_refresh',
              {
                delayMs,
              },
            );
            await timerUtils.wait(delayMs);
            await refreshTradingMeta();
          })();
        };

        const tradingUniverse =
          await backgroundApiProxy.serviceHyperliquid.getTradingUniverse();
        const hasCachedTradingUniverse =
          hasTradingUniverseCache(tradingUniverse);
        markPerpsColdStartPerf('initial_symbol_trading_universe_cache', {
          hasCachedTradingUniverse,
          universeCounts: tradingUniverse.universesByDex?.map(
            (items) => items?.length ?? 0,
          ),
        });
        if (!hasCachedTradingUniverse) {
          markPerpsColdStartPerf('initial_symbol_wait_trading_meta_no_cache');
          await refreshTradingMeta();
        } else {
          deferTradingMetaRefresh(1200);
        }
        refreshSpotMeta(1800);
      }
      markPerpsColdStartPerf('initial_symbol_build_switch_params_start');
      const switchParams = await buildActiveInstrumentSwitchParamsFromGlobal({
        force: true,
      });
      markPerpsColdStartPerf('initial_symbol_build_switch_params_end', {
        hasSwitchParams: !!switchParams,
        coin: switchParams?.coin,
        mode: switchParams?.mode,
      });
      if (!switchParams) {
        return;
      }
      if (switchParams.mode === 'perp') {
        void backgroundApiProxy.serviceHyperliquid
          .refreshActiveAssetCtxSnapshot({ coin: switchParams.coin })
          .catch((error) => {
            markPerpsColdStartPerf('initial_symbol_active_ctx_snapshot_error', {
              coin: switchParams.coin,
            });
            defaultLogger.perp.hyperliquid.coldStartInitializationError({
              type: 'active_asset_ctx_snapshot',
              coin: switchParams.coin,
              error,
            });
          });
      }
      markPerpsColdStartPerf('initial_symbol_switch_trade_instrument_start', {
        coin: switchParams.coin,
        mode: switchParams.mode,
      });
      await actions.current.switchTradeInstrument(switchParams);
      markPerpsColdStartPerf('initial_symbol_switch_trade_instrument_end', {
        coin: switchParams.coin,
        mode: switchParams.mode,
      });
      if (switchParams.mode === 'perp') {
        void backgroundApiProxy.serviceHyperliquid
          .hydrateActiveAssetCtxSnapshotCache({ coin: switchParams.coin })
          .then((entry) => {
            if (!entry?.data) {
              return;
            }
            markPerpsColdStartPerf('initial_symbol_active_ctx_cold_cache_set', {
              coin: entry.data.coin,
              ageMs: Date.now() - entry.updatedAt,
            });
            setActiveAssetCtxColdCache((prev) =>
              upsertPerpsActiveAssetCtxColdCacheEntry({
                cache: prev,
                data: entry.data,
                updatedAt: entry.updatedAt,
              }),
            );
          })
          .catch((error) => {
            markPerpsColdStartPerf('initial_symbol_active_ctx_cache_error', {
              coin: switchParams.coin,
            });
            defaultLogger.perp.hyperliquid.coldStartInitializationError({
              type: 'active_asset_ctx_cache',
              coin: switchParams.coin,
              error,
            });
          });
      }
    } finally {
      markPerpsColdStartPerf('initial_symbol_end');
      isInitializingRef.current = false;
    }
  }, [actions, setActiveAssetCtxColdCache]);

  useListenTabFocusState(ETabRoutes.Perp, (isFocus: boolean) => {
    if (!resolvePerpRouteFocused(isFocus)) return;
    void selectInitialSymbol();
  });

  useEffect(() => {
    if (!shouldTreatPerpAsFocusedOnMount) {
      return;
    }
    void selectInitialSymbol();
  }, [selectInitialSymbol]);
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
          // Force reload TradingView Candles WebView to fix data gap after screen unlock
          void backgroundApiProxy.serviceHyperliquidSubscription.forceReloadCandlesWebview();
        }
      } else {
        // Screen locked - dispose clients
        void backgroundApiProxy.serviceHyperliquid.disposeExchangeClients();
      }
      prevUnLockRef.current = unLock;
    }
  }, [unLock, checkPerpsAccountStatus]);
}

function useHyperliquidLocaleChangeRecovery() {
  const localeVariant = useLocaleVariant();
  const actions = useHyperliquidActions();
  const isRouteFocused = useRouteIsFocused();
  const isFocusedRef = useRef(resolvePerpRouteFocused(isRouteFocused));
  const pendingRecoveryRef = useRef(false);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);
  const localeVariantRef = useRef(localeVariant);
  localeVariantRef.current = localeVariant;

  const recoverSubscriptions = useCallback(async () => {
    if (recoveryPromiseRef.current) {
      await recoveryPromiseRef.current;
      return;
    }
    recoveryPromiseRef.current = (async () => {
      await backgroundApiProxy.serviceHyperliquidSubscription.enableSubscriptionsHandler();
      await backgroundApiProxy.serviceHyperliquidSubscription.resumeSubscriptions(
        {
          forceRebuild: true,
        },
      );
      await actions.current.updateSubscriptions();
      await backgroundApiProxy.serviceHyperliquidSubscription.forceReloadCandlesWebview();
      lastRecoveredPerpsLocaleVariant = localeVariantRef.current;
    })().finally(() => {
      recoveryPromiseRef.current = null;
    });
    await recoveryPromiseRef.current;
  }, [actions]);

  useListenTabFocusState(
    ETabRoutes.Perp,
    (isFocus: boolean, isHiddenByModal: boolean) => {
      isFocusedRef.current =
        resolvePerpRouteFocused(isFocus) && !isHiddenByModal;
      if (isFocusedRef.current && pendingRecoveryRef.current) {
        pendingRecoveryRef.current = false;
        void recoverSubscriptions();
      }
    },
  );

  useEffect(() => {
    const currentLocaleVariant = localeVariantRef.current;
    if (lastRecoveredPerpsLocaleVariant === undefined) {
      lastRecoveredPerpsLocaleVariant = currentLocaleVariant;
      return;
    }
    if (lastRecoveredPerpsLocaleVariant === currentLocaleVariant) {
      return;
    }
    if (!isFocusedRef.current) {
      pendingRecoveryRef.current = true;
      return;
    }
    void recoverSubscriptions();
  }, [localeVariant, recoverSubscriptions]);
}

function AutoPauseSubscriptions() {
  const pauseSubscriptionsTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  // Dedup: visibilitychange + window.focus can fire back-to-back
  const lastFocusStateRef = useRef<boolean | null>(null);

  const onFocusHandler = useCallback(
    async ({
      isFocus,
      pauseDelay,
    }: {
      isFocus: boolean;
      pauseDelay?: number;
    }) => {
      if (lastFocusStateRef.current === isFocus && pauseDelay === undefined) {
        return;
      }
      lastFocusStateRef.current = isFocus;

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

  const isFocusedRef = useRef(shouldTreatPerpAsFocusedOnMount);
  useListenTabFocusState(ETabRoutes.Perp, (isFocus: boolean) => {
    const nextFocused = resolvePerpRouteFocused(isFocus);
    const isFocusPrev = isFocusedRef.current;
    isFocusedRef.current = nextFocused;
    if (isFocusPrev !== nextFocused) {
      void onFocusHandler({ isFocus: isFocusedRef.current });
    }
  });

  const handleAppActiveFromBackground = useCallback(() => {
    if (isFocusedRef.current) {
      // Native doesn't set lastFocusStateRef to false on background,
      // so reset it here to prevent dedup guard from blocking resume
      lastFocusStateRef.current = false;
      void onFocusHandler({ isFocus: true });
    }
  }, [onFocusHandler]);

  useHandleAppStateActive(
    platformEnv.isNative ? handleAppActiveFromBackground : undefined,
  );

  // Desktop / web: keep the subscription live as long as the Perp route
  // is mounted. Browser-tab hidden, window blur, switching to another OS
  // app, same-origin iframe focus — none of these should pause the data
  // flow. Only in-app navigation away from Perp (handled by
  // useListenTabFocusState above) or auto-lock triggers a pause. On
  // native the OS itself suspends JS in the background and resume is
  // handled by useHandleAppStateActive.

  const [isLocked] = useAppIsLockedAtom();

  useEffect(() => {
    if (isLocked) {
      void onFocusHandler({ isFocus: false });
    } else {
      void onFocusHandler({ isFocus: isFocusedRef.current });
    }
  }, [isLocked, onFocusHandler]);

  useEffect(() => {
    return () => {
      // OK-53208: unmount ≠ user left Perp. Mobile modal push detaches this
      // tab; a 300ms pauseSubscriptions timer scheduled here would survive
      // in the event loop, fire after remount, and kill WS data flow.
      // Real tab-focus-loss owns the pause timer via useListenTabFocusState.
      clearTimeout(pauseSubscriptionsTimerRef.current);
    };
  }, []);

  return null;
}

function useHyperliquidNetworkReachabilityRecovery() {
  const { isInternetReachable } = useNetworkRestore();
  const actions = useHyperliquidActions();
  const isRouteFocused = useRouteIsFocused();
  const isFocused = resolvePerpRouteFocused(isRouteFocused);
  const isFocusedRef = useRef(isFocused);
  const wasOfflineRef = useRef(isInternetReachable === false);
  const recoveryPromiseRef = useRef<Promise<void> | null>(null);

  isFocusedRef.current = isFocused;

  const recoverSubscriptions = useCallback(async (): Promise<boolean> => {
    if (recoveryPromiseRef.current) {
      try {
        await recoveryPromiseRef.current;
        return true;
      } catch {
        return false;
      }
    }

    const recoveryPromise = (async () => {
      const switchParams = await buildActiveInstrumentSwitchParamsFromGlobal();
      await Promise.all([
        (async () => {
          await backgroundApiProxy.serviceHyperliquidSubscription.enableSubscriptionsHandler();
          // Network restoration can leave server-side streams missing while the
          // socket still looks open.
          await backgroundApiProxy.serviceHyperliquidSubscription.resumeSubscriptions(
            {
              forceReconnect: true,
            },
          );
        })(),
        switchParams
          ? actions.current.switchTradeInstrument(switchParams)
          : Promise.resolve(false),
      ]);
      await actions.current.updateSubscriptions();
      await backgroundApiProxy.serviceHyperliquidSubscription.forceReloadCandlesWebview();
    })();
    recoveryPromiseRef.current = recoveryPromise;
    try {
      await recoveryPromise;
      return true;
    } catch (error) {
      console.error('perps network reachability recovery failed:', error);
      return false;
    } finally {
      if (recoveryPromiseRef.current === recoveryPromise) {
        recoveryPromiseRef.current = null;
      }
    }
  }, [actions]);

  const handleReachabilityChange = useCallback(
    (nextReachable: boolean | null) => {
      if (nextReachable === null) {
        return;
      }
      if (nextReachable === false) {
        if (isFocusedRef.current) {
          wasOfflineRef.current = true;
        }
        return;
      }
      if (isFocusedRef.current && wasOfflineRef.current) {
        void (async () => {
          const recovered = await recoverSubscriptions();
          if (recovered) {
            wasOfflineRef.current = false;
          }
        })();
      }
    },
    [recoverSubscriptions],
  );

  useEffect(() => {
    handleReachabilityChange(isInternetReachable);
  }, [handleReachabilityChange, isInternetReachable]);

  useEffect(() => {
    if (isFocused) {
      handleReachabilityChange(isInternetReachable);
    }
  }, [handleReachabilityChange, isFocused, isInternetReachable]);
}

// Bridge for context-less callers (tray, notifications): the bg
// `changeActiveAsset` alone leaves this context's
// activeTradeInstrumentAtom / tradingModeAtom stale, so the UI keeps
// rendering the previous coin.
function useHyperliquidInstrumentSwitchRequest() {
  const actions = useHyperliquidActions();
  useEffect(() => {
    const handler = (
      payload: IAppEventBusPayload[EAppEventBusNames.PerpSwitchActiveInstrument],
    ) => {
      if (!payload?.coin) return;
      // Context-less callers (tray, notifications) update bg
      // perpsActiveAssetAtom before emitting. Without `force: true`,
      // changeActiveAsset hits its `activeAsset?.coin === coin` early-exit
      // and skips clearActiveAssetData / form reset / limit price update.
      void actions.current.switchTradeInstrument({
        mode: payload.mode,
        coin: payload.coin,
        force: true,
      });
    };
    appEventBus.on(EAppEventBusNames.PerpSwitchActiveInstrument, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.PerpSwitchActiveInstrument, handler);
    };
  }, [actions]);
}

function PerpsGlobalEffectsView() {
  useHydrateFavoritesBarMarketCache();
  useHyperliquidEventBusListener();
  useHyperliquidSession();
  useHyperliquidAccountSelect();
  usePerpTokenUrlSync();
  useHyperliquidSymbolSelect();
  useHyperliquidInstrumentSwitchRequest();
  useHyperliquidScreenLockHandler();
  useHyperliquidLocaleChangeRecovery();
  useHyperliquidNetworkReachabilityRecovery();
  useSyncContextOrderBookOptionsToGlobal();
  useTradeRouteViewStateSync();

  return (
    <>
      <WebSocketSubscriptionUpdate />
      <AutoPauseSubscriptions />
    </>
  );
}

const PerpsGlobalEffectsMemo = memo(() => <PerpsGlobalEffectsView />);
PerpsGlobalEffectsMemo.displayName = 'PerpsGlobalEffectsMemo';

export function PerpsGlobalEffects() {
  return <PerpsGlobalEffectsMemo />;
}
