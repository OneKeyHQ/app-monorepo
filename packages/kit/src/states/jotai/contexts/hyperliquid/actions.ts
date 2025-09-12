import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  activeAssetCtxAtom,
  activeAssetDataAtom,
  allMidsAtom,
  connectionStateAtom,
  contextAtomMethod,
  currentAccountAtom,
  currentTokenAtom,
  currentUserAtom,
  l2BookAtom,
  subscriptionActiveAtom,
  tradingFormAtom,
  tradingLoadingAtom,
  webData2Atom,
} from './atoms';

import type { ITradingFormData } from './atoms';

class ContextJotaiActionsHyperliquid extends ContextJotaiActionsBase {
  updateAllMids = contextAtomMethod((_, set, data: HL.IWsAllMids) => {
    set(allMidsAtom(), data);
  });

  updateWebData2 = contextAtomMethod((_, set, data: HL.IWsWebData2) => {
    set(webData2Atom(), data);
  });

  updateActiveAssetCtx = contextAtomMethod(
    (get, set, data: HL.IWsActiveAssetCtx, coin: string) => {
      const currentToken = get(currentTokenAtom());
      if (currentToken !== coin) {
        return;
      }
      set(activeAssetCtxAtom(), { ...data, coin });
    },
  );

  updateActiveAssetData = contextAtomMethod(
    (get, set, data: HL.IActiveAssetData, coin: string) => {
      const currentToken = get(currentTokenAtom());
      if (currentToken !== coin) {
        return;
      }
      set(activeAssetDataAtom(), { ...data, coin });
    },
  );

  updateL2Book = contextAtomMethod((_, set, data: HL.IBook) => {
    set(l2BookAtom(), data);
  });

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

  setCurrentToken = contextAtomMethod(async (get, set, coin: string) => {
    const currentToken = get(currentTokenAtom());
    if (currentToken === coin) return;

    set(currentTokenAtom(), coin);
    await this.updateSubscriptions.call(set);
  });

  setCurrentUser = contextAtomMethod(async (get, set, user: HL.IHex | null) => {
    const currentUser = get(currentUserAtom());
    if (currentUser === user) return;

    set(currentUserAtom(), user);

    if (user !== currentUser) {
      set(webData2Atom(), null);
      set(activeAssetDataAtom(), null);
    }
    await this.updateSubscriptions.call(set);
  });

  setCurrentAccount = contextAtomMethod(
    async (get, set, accountId: string | null) => {
      set(currentAccountAtom(), accountId);
    },
  );

  updateSubscriptions = contextAtomMethod(async (get, set) => {
    const currentToken = get(currentTokenAtom());
    const currentUser = get(currentUserAtom());
    const isActive = get(subscriptionActiveAtom());

    if (!isActive) {
      await backgroundApiProxy.serviceHyperliquidSubscription.connect();
    }

    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptions(
        {
          currentSymbol: currentToken,
          currentUser,
        },
      );
    } catch (error) {
      console.error(
        '[HyperliquidActions.updateSubscriptions] Failed to update subscriptions:',
        error,
      );
    }
  });

  updateL2BookSubscription = contextAtomMethod(
    async (get, set, options?: IL2BookOptions) => {
      const currentToken = get(currentTokenAtom());
      const currentUser = get(currentUserAtom());
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

  setupTradingSession = contextAtomMethod(
    async (
      get,
      set,
      payload: { userAddress: HL.IHex; userAccountId: string },
    ) => {
      try {
        await this.setCurrentUser.call(set, payload.userAddress);

        await backgroundApiProxy.serviceHyperliquidExchange.setup({
          userAddress: payload.userAddress,
          userAccountId: payload.userAccountId,
        });

        return true;
      } catch (error) {
        console.error('Failed to setup trading session:', error);
        return false;
      }
    },
  );

  checkWalletStatus = contextAtomMethod(
    async (get, set, userAddress: HL.IHex) => {
      try {
        return await backgroundApiProxy.serviceHyperliquid.checkWalletStatus({
          userAddress,
        });
      } catch (error) {
        console.error('Failed to check wallet status:', error);
        return null;
      }
    },
  );

  enableTrading = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        userAddress: HL.IHex;
        userAccountId: string;
        approveAgent?: boolean;
        approveBuilderFee?: boolean;
      },
    ) => {
      try {
        return await backgroundApiProxy.serviceHyperliquid.enableTrading(
          payload,
        );
      } catch (error) {
        console.error('Failed to enable trading:', error);
        return { success: false };
      }
    },
  );

  clearUserData = contextAtomMethod((get, set) => {
    set(currentUserAtom(), null);
    set(webData2Atom(), null);
    set(activeAssetDataAtom(), null);
  });

  clearAllData = contextAtomMethod((get, set) => {
    set(allMidsAtom(), null);
    set(webData2Atom(), null);
    set(activeAssetCtxAtom(), null);
    set(activeAssetDataAtom(), null);
    set(l2BookAtom(), null);
    set(currentTokenAtom(), 'ETH');
    set(currentUserAtom(), null);
    set(subscriptionActiveAtom(), false);
    set(connectionStateAtom(), {
      isConnected: false,
      lastConnected: null,
      reconnectCount: 0,
    });
  });

  updateTradingForm = contextAtomMethod(
    (get, set, updates: Partial<ITradingFormData>) => {
      const current = get(tradingFormAtom());
      set(tradingFormAtom(), { ...current, ...updates });
    },
  );

  resetTradingForm = contextAtomMethod((get, set) => {
    set(tradingFormAtom(), {
      side: 'long',
      type: 'market',
      price: '',
      size: '',
      leverage: 1,
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
      const slippage = params.slippage || 0.08;

      try {
        set(tradingLoadingAtom(), true);

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
      } catch (error) {
        console.error(
          '[HyperliquidActions.placeOrder] Failed to place order:',
          error,
        );
        throw error;
      } finally {
        set(tradingLoadingAtom(), false);
      }
    },
  );

  marketOrderOpen = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        formData?: ITradingFormData;
        slippage?: number;
        midPx: string;
      },
    ) => {
      const formData = params.formData || get(tradingFormAtom());
      const slippage = params.slippage || 0.08;

      try {
        set(tradingLoadingAtom(), true);

        const result =
          await backgroundApiProxy.serviceHyperliquidExchange.marketOrderOpen({
            assetId: params.assetId,
            isBuy: formData.side === 'long',
            size: formData.size,
            midPx: params.midPx,
            type: formData.type,
            tpTriggerPx: formData.hasTpsl ? formData.tpTriggerPx : undefined,
            slTriggerPx: formData.hasTpsl ? formData.slTriggerPx : undefined,
            slippage,
          });

        return result;
      } catch (error) {
        console.error(
          '[HyperliquidActions.marketOrderOpen] Failed to place market order:',
          error,
        );
        throw error;
      } finally {
        set(tradingLoadingAtom(), false);
      }
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
    ) => {
      try {
        void (await backgroundApiProxy.serviceHyperliquidExchange.updateLeverage(
          {
            asset: params.asset,
            leverage: params.leverage,
            isCross: params.isCross,
          },
        ));

        const formData = get(tradingFormAtom());
        set(tradingFormAtom(), { ...formData, leverage: params.leverage });
      } catch (error) {
        console.error(
          '[HyperliquidActions.updateLeverage] Failed to update leverage:',
          error,
        );
        throw error;
      }
    },
  );

  marketOrderClose = contextAtomMethod(
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
      try {
        set(tradingLoadingAtom(), true);

        const result =
          await backgroundApiProxy.serviceHyperliquidExchange.marketOrderClose({
            assetId: params.assetId,
            isBuy: params.isBuy,
            size: params.size,
            midPx: params.midPx,
            slippage: params.slippage || 0.08,
          });

        return result;
      } catch (error) {
        console.error(
          '[HyperliquidActions.marketOrderClose] Failed to close position:',
          error,
        );
        throw error;
      } finally {
        set(tradingLoadingAtom(), false);
      }
    },
  );
}

const createActions = memoFn(() => new ContextJotaiActionsHyperliquid());

export function useHyperliquidActions() {
  const actions = createActions();

  const updateAllMids = actions.updateAllMids.use();
  const updateWebData2 = actions.updateWebData2.use();
  const updateActiveAssetCtx = actions.updateActiveAssetCtx.use();
  const updateActiveAssetData = actions.updateActiveAssetData.use();
  const updateL2Book = actions.updateL2Book.use();
  const updateConnectionState = actions.updateConnectionState.use();

  const setCurrentToken = actions.setCurrentToken.use();
  const setCurrentUser = actions.setCurrentUser.use();
  const setCurrentAccount = actions.setCurrentAccount.use();
  const updateSubscriptions = actions.updateSubscriptions.use();
  const updateL2BookSubscription = actions.updateL2BookSubscription.use();
  const startSubscriptions = actions.startSubscriptions.use();
  const stopSubscriptions = actions.stopSubscriptions.use();
  const reconnectSubscriptions = actions.reconnectSubscriptions.use();

  const setupTradingSession = actions.setupTradingSession.use();
  const checkWalletStatus = actions.checkWalletStatus.use();
  const enableTrading = actions.enableTrading.use();

  const clearUserData = actions.clearUserData.use();
  const clearAllData = actions.clearAllData.use();

  const updateTradingForm = actions.updateTradingForm.use();
  const resetTradingForm = actions.resetTradingForm.use();
  const setTradingLoading = actions.setTradingLoading.use();

  const placeOrder = actions.placeOrder.use();
  const marketOrderOpen = actions.marketOrderOpen.use();
  const updateLeverage = actions.updateLeverage.use();
  const marketOrderClose = actions.marketOrderClose.use();

  return useRef({
    updateAllMids,
    updateWebData2,
    updateActiveAssetCtx,
    updateActiveAssetData,
    updateL2Book,
    updateConnectionState,
    setCurrentToken,
    setCurrentUser,
    setCurrentAccount,
    updateSubscriptions,
    updateL2BookSubscription,
    startSubscriptions,
    stopSubscriptions,
    reconnectSubscriptions,
    setupTradingSession,
    checkWalletStatus,
    enableTrading,
    clearUserData,
    clearAllData,

    updateTradingForm,
    resetTradingForm,
    setTradingLoading,

    placeOrder,
    marketOrderOpen,
    updateLeverage,
    marketOrderClose,
  });
}
