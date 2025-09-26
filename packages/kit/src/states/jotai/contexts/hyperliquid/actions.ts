import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import {
  perpsActiveAccountAtom,
  perpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IL2BookOptions,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  connectionStateAtom,
  contextAtomMethod,
  l2BookAtom,
  orderBookTickOptionsAtom,
  perpsActiveOpenOrdersAtom,
  perpsActivePositionAtom,
  perpsAllAssetCtxsAtom,
  perpsAllMidsAtom,
  subscriptionActiveAtom,
  tradingFormAtom,
  tradingLoadingAtom,
} from './atoms';
import { EActionType, withToast } from './utils';

import type { ITradingFormData } from './atoms';

class ContextJotaiActionsHyperliquid extends ContextJotaiActionsBase {
  private orderBookTickOptionsLoaded = false;

  updateAllMids = contextAtomMethod((_, set, data: HL.IWsAllMids) => {
    set(perpsAllMidsAtom(), data);
  });

  allAssetCtxsRequiredNumber = 0;

  markAllAssetCtxsRequired = contextAtomMethod((_, _set) => {
    this.allAssetCtxsRequiredNumber += 1;
  });

  markAllAssetCtxsNotRequired = contextAtomMethod((_, _set) => {
    this.allAssetCtxsRequiredNumber -= 1;
    if (this.allAssetCtxsRequiredNumber <= 0) {
      this.allAssetCtxsRequiredNumber = 0;
    }
  });

  updateAllAssetCtxs = contextAtomMethod((_, set, data: HL.IWsWebData2) => {
    if (this.allAssetCtxsRequiredNumber <= 0) {
      // skip update if not required for better performance
      return;
    }
    // just save raw ctxs here
    // use usePerpsAssetCtx() for single asset ctx with ctx formatted
    set(perpsAllAssetCtxsAtom(), {
      assetCtxs: data.assetCtxs,
    });
  });

  updateWebData2 = contextAtomMethod(async (get, set, data: HL.IWsWebData2) => {
    this.updateAllAssetCtxs.call(set, data);

    const activeAccount = await perpsActiveAccountAtom.get();
    const dataUser = data?.user?.toLowerCase();
    const activeAccountAddress = activeAccount?.accountAddress?.toLowerCase();

    if (activeAccountAddress === dataUser) {
      // Update active positions from webData2
      const positions = data?.clearinghouseState?.assetPositions || [];
      const activePositions = positions.filter((pos) => {
        const size = parseFloat(pos.position?.szi || '0');
        return Math.abs(size) > 0;
      });

      set(perpsActivePositionAtom(), {
        accountAddress: activeAccountAddress,
        activePositions,
      });

      const openOrders = data?.openOrders || [];
      set(perpsActiveOpenOrdersAtom(), {
        accountAddress: activeAccountAddress,
        openOrders,
      });
    } else {
      const activePosition = get(perpsActivePositionAtom());
      if (
        activePosition?.accountAddress?.toLowerCase() !== activeAccountAddress
      ) {
        set(perpsActivePositionAtom(), {
          accountAddress: activeAccountAddress,
          activePositions: [],
        });
      }
      const activeOpenOrders = get(perpsActiveOpenOrdersAtom());
      if (
        activeOpenOrders?.accountAddress?.toLowerCase() !== activeAccountAddress
      ) {
        set(perpsActiveOpenOrdersAtom(), {
          accountAddress: activeAccountAddress,
          openOrders: [],
        });
      }
    }
  });

  updateL2Book = contextAtomMethod((_, set, data: HL.IBook) => {
    set(l2BookAtom(), data);
  });

  ensureOrderBookTickOptionsLoaded = contextAtomMethod(async (_get, set) => {
    if (this.orderBookTickOptionsLoaded) return;
    try {
      const stored =
        await backgroundApiProxy.simpleDb.perp.getOrderBookTickOptions();
      set(orderBookTickOptionsAtom(), stored);
    } catch (error) {
      console.error('Failed to load order book tick options:', error);
    } finally {
      this.orderBookTickOptionsLoaded = true;
    }
  });

  getPersistedL2BookOptions = contextAtomMethod(
    async (get, set, coin: string): Promise<IL2BookOptions | null> => {
      await this.ensureOrderBookTickOptionsLoaded.call(set);
      const persistedOptions = get(orderBookTickOptionsAtom());
      const persistedForSymbol = persistedOptions?.[coin];
      if (!persistedForSymbol) {
        return null;
      }
      return {
        nSigFigs: persistedForSymbol.nSigFigs ?? null,
        ...(persistedForSymbol.mantissa != null
          ? { mantissa: persistedForSymbol.mantissa }
          : {}),
      };
    },
  );

  setOrderBookTickOption = contextAtomMethod(
    async (
      get,
      set,
      payload: null | {
        symbol: string;
        option: IPerpOrderBookTickOptionPersist | null;
      },
    ) => {
      if (!payload?.symbol) return;
      const { symbol, option } = payload;
      const prev = get(orderBookTickOptionsAtom());
      const next: Record<string, IPerpOrderBookTickOptionPersist> = {
        ...prev,
      };

      if (!option) {
        delete next[symbol];
      } else {
        next[symbol] = option;
      }

      set(orderBookTickOptionsAtom(), next);

      try {
        await backgroundApiProxy.simpleDb.perp.setOrderBookTickOption({
          symbol,
          option,
        });
      } catch (error) {
        console.error('Failed to persist order book tick option:', error);
      }
    },
  );

  updateConnectionState = contextAtomMethod(
    (
      get,
      set,
      payload: Partial<{ isConnected: boolean; reconnectCount: number }>,
    ) => {
      const current = get(connectionStateAtom());
      set(connectionStateAtom(), {
        ...current,
        ...payload,
        lastConnected: payload.isConnected ? Date.now() : current.lastConnected,
      });
    },
  );

  changeActiveAsset = contextAtomMethod(
    async (get, set, { coin, force }: { coin: string; force?: boolean }) => {
      const activeAsset = await perpsActiveAssetAtom.get();
      const currentToken = activeAsset?.coin;
      if (currentToken === coin && !force) return;

      await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
        coin,
      });

      const l2BookOptions = await this.getPersistedL2BookOptions.call(
        set,
        coin,
      );

      const currentForm = get(tradingFormAtom());
      set(tradingFormAtom(), {
        ...currentForm,
        size: '',
        tpTriggerPx: '',
        tpGainPercent: '',
        slTriggerPx: '',
        slLossPercent: '',
      });

      await this.updateSubscriptions.call(set, { l2BookOptions });
    },
  );

  updateSubscriptions = contextAtomMethod(
    async (
      get,
      _set,
      overrides?: { l2BookOptions?: IL2BookOptions | null },
    ) => {
      const activeAsset = await perpsActiveAssetAtom.get();
      const currentToken = activeAsset?.coin;
      const currentAccount = await perpsActiveAccountAtom.get();
      const currentUser = currentAccount?.accountAddress;
      const isActive = get(subscriptionActiveAtom());

      if (!isActive) {
        await backgroundApiProxy.serviceHyperliquidSubscription.connect();
      }

      try {
        const payload: {
          currentSymbol: string;
          currentUser?: HL.IHex | null;
          l2BookOptions?: IL2BookOptions | null;
        } = {
          currentSymbol: currentToken,
          currentUser,
        };

        if (overrides?.l2BookOptions !== undefined) {
          payload.l2BookOptions = overrides.l2BookOptions;
        }

        await backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptions(
          payload,
        );
      } catch (error) {
        console.error(
          '[HyperliquidActions.updateSubscriptions] Failed to update subscriptions:',
          error,
        );
      }
    },
  );

  updateL2BookSubscription = contextAtomMethod(
    async (get, set, options?: IL2BookOptions) => {
      const activeAsset = await perpsActiveAssetAtom.get();
      const currentToken = activeAsset?.coin;
      const currentAccount = await perpsActiveAccountAtom.get();
      const currentUser = currentAccount?.accountAddress;
      const isActive = get(subscriptionActiveAtom());

      if (!isActive) {
        await backgroundApiProxy.serviceHyperliquidSubscription.connect();
      }

      try {
        console.log(
          '[HyperliquidActions.updateL2BookSubscription] Updating L2Book subscription with options:',
          options,
        );

        // Use the new dedicated method for L2Book subscription updates
        await backgroundApiProxy.serviceHyperliquidSubscription.updateL2BookSubscription(
          {
            l2BookOptions: options || {},
            currentSymbol: currentToken,
            currentUser,
          },
        );
      } catch (error) {
        console.error(
          '[HyperliquidActions.updateL2BookSubscription] Failed to update L2 book subscription:',
          error,
        );
      }
    },
  );

  startSubscriptions = contextAtomMethod(async (get, set) => {
    set(subscriptionActiveAtom(), true);

    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.connect();
      await this.updateSubscriptions.call(set);

      this.updateConnectionState.call(set, {
        isConnected: true,
        reconnectCount: 0,
      });
    } catch (error) {
      console.error(
        '[HyperliquidActions.startSubscriptions] Failed to start subscriptions:',
        error,
      );
      this.updateConnectionState.call(set, {
        isConnected: false,
      });
    }
  });

  stopSubscriptions = contextAtomMethod(async (get, set) => {
    set(subscriptionActiveAtom(), false);

    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.disconnect();

      this.updateConnectionState.call(set, {
        isConnected: false,
      });
    } catch (error) {
      console.error(
        '[HyperliquidActions.stopSubscriptions] Failed to stop subscriptions:',
        error,
      );
    }
  });

  reconnectSubscriptions = contextAtomMethod(async (get, set) => {
    const current = get(connectionStateAtom());

    this.updateConnectionState.call(set, {
      reconnectCount: current.reconnectCount + 1,
    });

    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.reconnect();
      await this.updateSubscriptions.call(set);

      this.updateConnectionState.call(set, {
        isConnected: true,
      });
    } catch (error) {
      console.error(
        '[HyperliquidActions.reconnectSubscriptions] Failed to reconnect subscriptions:',
        error,
      );
      this.updateConnectionState.call(set, {
        isConnected: false,
      });
    }
  });

  enableTrading = contextAtomMethod(async (_get, _set) => {
    try {
      return await backgroundApiProxy.serviceHyperliquid.enableTrading();
    } catch (error) {
      console.error('Failed to enable trading:', error);
      return { success: false };
    }
  });

  // reset user data
  clearUserData = contextAtomMethod((get, set) => {
    // TODO
  });

  // reset all data
  clearAllData = contextAtomMethod(async (get, set) => {
    set(perpsAllMidsAtom(), null);
    set(perpsAllAssetCtxsAtom(), {
      assetCtxs: [],
    });
    set(l2BookAtom(), null);
    set(subscriptionActiveAtom(), false);
    set(connectionStateAtom(), {
      isConnected: false,
      lastConnected: null,
      reconnectCount: 0,
    });
    await this.changeActiveAsset.call(set, { coin: 'ETH', force: true });
  });

  updateTradingForm = contextAtomMethod(
    (get, set, updates: Partial<ITradingFormData>) => {
      const current = get(tradingFormAtom());
      set(tradingFormAtom(), { ...current, ...updates });
    },
  );

  resetTradingForm = contextAtomMethod((get, set) => {
    const current = get(tradingFormAtom());
    set(tradingFormAtom(), {
      ...current,
      size: '',
      hasTpsl: false,
      tpTriggerPx: '',
      tpGainPercent: '',
      slTriggerPx: '',
      slLossPercent: '',
    });
  });

  setTradingLoading = contextAtomMethod((get, set, loading: boolean) => {
    set(tradingLoadingAtom(), loading);
  });

  placeOrder = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        formData?: ITradingFormData;
        slippage?: number;
      },
    ) => {
      const formData = params.formData || get(tradingFormAtom());
      const slippage = params.slippage;

      return withToast({
        asyncFn: async () => {
          set(tradingLoadingAtom(), true);
          try {
            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.placeOrder({
                assetId: params.assetId,
                isBuy: formData.side === 'long',
                sz: formData.size,
                limitPx: formData.price,
                orderType:
                  formData.type === 'limit'
                    ? { limit: { tif: 'Gtc' } }
                    : { market: {} },
                slippage,
              });
            return result;
          } finally {
            set(tradingLoadingAtom(), false);
          }
        },
        actionType: EActionType.PLACE_ORDER,
      });
    },
  );

  orderOpen = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        formData?: ITradingFormData;
        slippage?: number;
        price: string;
      },
    ) => {
      const formData = params.formData || get(tradingFormAtom());
      const slippage = params.slippage;

      return withToast({
        asyncFn: async () => {
          set(tradingLoadingAtom(), true);
          try {
            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.orderOpen({
                assetId: params.assetId,
                isBuy: formData.side === 'long',
                size: formData.size,
                price: params.price,
                type: formData.type,
                tpTriggerPx: formData.hasTpsl
                  ? formData.tpTriggerPx
                  : undefined,
                slTriggerPx: formData.hasTpsl
                  ? formData.slTriggerPx
                  : undefined,
                slippage,
              });
            return result;
          } finally {
            set(tradingLoadingAtom(), false);
          }
        },
        actionType: EActionType.ORDER_OPEN,
      });
    },
  );

  updateLeverage = contextAtomMethod(
    async (
      get,
      set,
      params: {
        asset: number;
        leverage: number;
        isCross: boolean;
      },
    ): Promise<{ leverage: number; isCross: boolean }> => {
      return withToast({
        asyncFn: async () => {
          void (await backgroundApiProxy.serviceHyperliquidExchange.updateLeverage(
            {
              asset: params.asset,
              leverage: params.leverage,
              isCross: params.isCross,
            },
          ));

          const formData = get(tradingFormAtom());
          set(tradingFormAtom(), { ...formData, leverage: params.leverage });

          return { leverage: params.leverage, isCross: params.isCross };
        },
        actionType: EActionType.UPDATE_LEVERAGE,
        args: [params.leverage, params.isCross ? 'Cross' : 'Isolated'],
      });
    },
  );

  orderClose = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        midPx: string;
        slippage?: number;
      },
    ) => {
      return withToast({
        asyncFn: async () => {
          set(tradingLoadingAtom(), true);
          try {
            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.orderClose({
                assetId: params.assetId,
                isBuy: params.isBuy,
                size: params.size,
                midPx: params.midPx,
                slippage: params.slippage,
              });
            return result;
          } finally {
            set(tradingLoadingAtom(), false);
          }
        },
        actionType: EActionType.ORDER_CLOSE,
      });
    },
  );

  limitOrderClose = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        limitPrice: string;
      },
    ) => {
      return withToast({
        asyncFn: async () => {
          set(tradingLoadingAtom(), true);
          try {
            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.placeOrder({
                assetId: params.assetId,
                isBuy: !params.isBuy,
                sz: params.size,
                limitPx: params.limitPrice,
                orderType: { limit: { tif: 'Gtc' } },
                reduceOnly: true,
              });
            return result;
          } finally {
            set(tradingLoadingAtom(), false);
          }
        },
        actionType: EActionType.LIMIT_ORDER_CLOSE,
      });
    },
  );

  cancelOrder = contextAtomMethod(
    async (
      get,
      set,
      params: {
        orders: Array<{
          assetId: number;
          oid: number;
        }>;
        showToast?: boolean;
      },
    ) => {
      return withToast({
        asyncFn: async () => {
          const result =
            await backgroundApiProxy.serviceHyperliquidExchange.cancelOrder(
              params.orders.map((order) => ({
                assetId: order.assetId,
                oid: order.oid,
              })),
            );
          return result;
        },
        actionType: EActionType.CANCEL_ORDER,
        args: [params.orders.length],
      });
    },
  );

  setPositionTpsl = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        positionSize: string;
        isBuy: boolean;
        tpTriggerPx?: string;
        slTriggerPx?: string;
        slippage?: number;
        showToast?: boolean;
      },
    ) => {
      return withToast({
        asyncFn: async () => {
          set(tradingLoadingAtom(), true);
          try {
            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.setPositionTpsl(
                {
                  assetId: params.assetId,
                  positionSize: params.positionSize,
                  isBuy: params.isBuy,
                  tpTriggerPx: params.tpTriggerPx,
                  slTriggerPx: params.slTriggerPx,
                  slippage: params.slippage,
                },
              );
            return result;
          } finally {
            set(tradingLoadingAtom(), false);
          }
        },
        actionType: EActionType.SET_POSITION_TPSL,
      });
    },
  );

  withdraw = contextAtomMethod(
    async (
      get,
      set,
      params: {
        userAccountId: string;
        amount: string;
        destination: `0x${string}`;
      },
    ) => {
      return withToast({
        asyncFn: async () => {
          await backgroundApiProxy.serviceHyperliquidExchange.withdraw({
            userAccountId: params.userAccountId,
            amount: params.amount,
            destination: params.destination,
          });
        },
        actionType: EActionType.WITHDRAW,
        args: [params.amount],
      });
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsHyperliquid());

export function useHyperliquidActions() {
  const actions = createActions();

  const updateAllMids = actions.updateAllMids.use();
  const updateWebData2 = actions.updateWebData2.use();
  const markAllAssetCtxsRequired = actions.markAllAssetCtxsRequired.use();
  const markAllAssetCtxsNotRequired = actions.markAllAssetCtxsNotRequired.use();
  const updateL2Book = actions.updateL2Book.use();
  const updateConnectionState = actions.updateConnectionState.use();

  const updateSubscriptions = actions.updateSubscriptions.use();
  const updateL2BookSubscription = actions.updateL2BookSubscription.use();
  const startSubscriptions = actions.startSubscriptions.use();
  const stopSubscriptions = actions.stopSubscriptions.use();
  const reconnectSubscriptions = actions.reconnectSubscriptions.use();

  const enableTrading = actions.enableTrading.use();

  const clearUserData = actions.clearUserData.use();
  const clearAllData = actions.clearAllData.use();

  const updateTradingForm = actions.updateTradingForm.use();
  const resetTradingForm = actions.resetTradingForm.use();
  const setTradingLoading = actions.setTradingLoading.use();

  const placeOrder = actions.placeOrder.use();
  const orderOpen = actions.orderOpen.use();
  const updateLeverage = actions.updateLeverage.use();
  const orderClose = actions.orderClose.use();
  const limitOrderClose = actions.limitOrderClose.use();
  const cancelOrder = actions.cancelOrder.use();
  const setPositionTpsl = actions.setPositionTpsl.use();
  const withdraw = actions.withdraw.use();

  const ensureOrderBookTickOptionsLoaded =
    actions.ensureOrderBookTickOptionsLoaded.use();
  const setOrderBookTickOption = actions.setOrderBookTickOption.use();
  const changeActiveAsset = actions.changeActiveAsset.use();

  return useRef({
    updateAllMids,
    markAllAssetCtxsRequired,
    markAllAssetCtxsNotRequired,
    updateWebData2,
    updateL2Book,
    updateConnectionState,
    changeActiveAsset,
    updateSubscriptions,
    updateL2BookSubscription,
    startSubscriptions,
    stopSubscriptions,
    reconnectSubscriptions,
    enableTrading,
    clearUserData,
    clearAllData,

    updateTradingForm,
    resetTradingForm,
    setTradingLoading,

    placeOrder,
    orderOpen,
    updateLeverage,
    orderClose,
    limitOrderClose,
    cancelOrder,
    setPositionTpsl,
    withdraw,

    ensureOrderBookTickOptionsLoaded,
    setOrderBookTickOption,
  });
}
