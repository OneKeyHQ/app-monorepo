import { useRef } from 'react';

import { BigNumber } from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { showEnableTradingDialog } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/EnableTradingModal';
import {
  perpsActiveAccountAtom,
  perpsActiveAccountIsAgentReadyAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsActiveAccountSummaryAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { resolveTradingSize } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsAssetPosition } from '@onekeyhq/shared/types/hyperliquid';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSizeInputMode,
  type IL2BookOptions,
  type IOrderCloseParams,
  type IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  connectionStateAtom,
  contextAtomMethod,
  l2BookAtom,
  orderBookTickOptionsAtom,
  perpsActiveOpenOrdersAtom,
  perpsActivePositionAtom,
  perpsAllAssetCtxsAtom,
  perpsAllAssetsFilteredAtom,
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

  updateAllAssetsFiltered = contextAtomMethod(
    (_, set, data: { allAssets: HL.IPerpsUniverse[]; query: string }) => {
      const { allAssets, query } = data;
      const searchQuery = query?.trim()?.toLowerCase();
      let assets = allAssets;
      if (!searchQuery) {
        assets = allAssets.filter((token) => !token.isDelisted);
      } else {
        assets = allAssets.filter(
          (token) =>
            token.name?.toLowerCase().includes(searchQuery) &&
            !token.isDelisted,
        );
      }

      set(perpsAllAssetsFilteredAtom(), {
        assets,
        query,
      });
    },
  );

  updateWebData2 = contextAtomMethod(async (get, set, data: HL.IWsWebData2) => {
    this.updateAllAssetCtxs.call(set, data);

    const activeAccount = await perpsActiveAccountAtom.get();
    const dataUser = data?.user?.toLowerCase();
    const activeAccountAddress = activeAccount?.accountAddress?.toLowerCase();

    if (activeAccountAddress === dataUser) {
      // Update active positions from webData2
      const positions = data?.clearinghouseState?.assetPositions || [];
      const activePositions = positions
        .filter((pos) => {
          const size = parseFloat(pos.position?.szi || '0');
          return Math.abs(size) > 0;
        })
        .sort(
          (a, b) =>
            parseFloat(b.position.positionValue || '0') -
            parseFloat(a.position.positionValue || '0'),
        );

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
      if (activeAsset?.coin === coin && !force) {
        return;
      }

      await this.clearActiveAssetData.call(set);
      await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
        coin,
      });
    },
  );

  changeActivePerpsAccount = contextAtomMethod(
    async (
      get,
      set,
      params: {
        accountId: string | null;
        indexedAccountId: string | null;
        deriveType: IAccountDeriveTypes;
      },
    ) => {
      await this.clearActiveAccountData.call(set);
      const account =
        await backgroundApiProxy.serviceHyperliquid.changeActivePerpsAccount(
          params,
        );
      return account;
    },
  );

  updateSubscriptions = contextAtomMethod(async (get, _set) => {
    const isActive = get(subscriptionActiveAtom());
    if (!isActive) {
      await backgroundApiProxy.serviceHyperliquidSubscription.connect();
    }
    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptions();
    } catch (error) {
      console.error(
        '[HyperliquidActions.updateSubscriptions] Failed to update subscriptions:',
        error,
      );
    }
  });

  startSubscriptions = contextAtomMethod(async (get, set) => {
    set(subscriptionActiveAtom(), true);

    try {
      await backgroundApiProxy.serviceHyperliquidSubscription.connect();

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

  clearActiveAssetData = contextAtomMethod(async (get, set) => {
    set(l2BookAtom(), null);
    await perpsActiveAssetCtxAtom.set(undefined);
    await perpsActiveAssetDataAtom.set(undefined);

    set(
      tradingFormAtom(),
      (prev): ITradingFormData => ({
        ...prev,
        size: '',
        tpTriggerPx: '',
        tpGainPercent: '',
        slTriggerPx: '',
        slLossPercent: '',
      }),
    );
  });

  clearActiveAccountData = contextAtomMethod(async (get, set) => {
    set(perpsActivePositionAtom(), {
      accountAddress: undefined,
      activePositions: [],
    });
    set(perpsActiveOpenOrdersAtom(), {
      accountAddress: undefined,
      openOrders: [],
    });
    await perpsActiveAccountSummaryAtom.set(undefined);
    await perpsActiveAccountStatusInfoAtom.set(undefined);
    await perpsActiveAssetDataAtom.set(undefined);
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
      sizeInputMode: EPerpsSizeInputMode.MANUAL,
      sizePercent: 0,
      hasTpsl: false,
      tpTriggerPx: '',
      tpGainPercent: '',
      slTriggerPx: '',
      slLossPercent: '',
      tpType: 'price',
      tpValue: '',
      slType: 'price',
      slValue: '',
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
            const [
              activeAssetValue,
              activeAssetCtxValue,
              activeAssetDataValue,
            ] = await Promise.all([
              perpsActiveAssetAtom.get(),
              perpsActiveAssetCtxAtom.get(),
              perpsActiveAssetDataAtom.get(),
            ]);

            const resolvedSize = resolveTradingSize({
              sizeInputMode: formData.sizeInputMode,
              manualSize: formData.size,
              sizePercent: formData.sizePercent,
              side: formData.side,
              price: formData.type === 'limit' ? formData.price : '',
              markPrice: activeAssetCtxValue?.ctx?.markPrice,
              availableToTrade: activeAssetDataValue?.availableToTrade,
              leverageValue: activeAssetDataValue?.leverage?.value,
              fallbackLeverage: activeAssetValue?.universe?.maxLeverage,
              szDecimals: activeAssetValue?.universe?.szDecimals,
            });

            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.placeOrder({
                assetId: params.assetId,
                isBuy: formData.side === 'long',
                sz: resolvedSize,
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
            const [
              activeAssetValue,
              activeAssetCtxValue,
              activeAssetDataValue,
            ] = await Promise.all([
              perpsActiveAssetAtom.get(),
              perpsActiveAssetCtxAtom.get(),
              perpsActiveAssetDataAtom.get(),
            ]);

            const resolvedSize = resolveTradingSize({
              sizeInputMode: formData.sizeInputMode,
              manualSize: formData.size,
              sizePercent: formData.sizePercent,
              side: formData.side,
              price: params.price,
              markPrice: activeAssetCtxValue?.ctx?.markPrice,
              availableToTrade: activeAssetDataValue?.availableToTrade,
              leverageValue: activeAssetDataValue?.leverage?.value,
              fallbackLeverage: activeAssetValue?.universe?.maxLeverage,
              szDecimals: activeAssetValue?.universe?.szDecimals,
            });

            const result =
              await backgroundApiProxy.serviceHyperliquidExchange.orderOpen({
                assetId: params.assetId,
                isBuy: formData.side === 'long',
                size: resolvedSize,
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
          await backgroundApiProxy.serviceHyperliquidExchange.updateLeverage({
            asset: params.asset,
            leverage: params.leverage,
            isCross: params.isCross,
          });

          const formData = get(tradingFormAtom());
          set(tradingFormAtom(), { ...formData, leverage: params.leverage });

          return { leverage: params.leverage, isCross: params.isCross };
        },
        actionType: EActionType.UPDATE_LEVERAGE,
        args: [params.isCross ? 'Cross' : 'Isolated', params.leverage],
      });
    },
  );

  updateIsolatedMargin = contextAtomMethod(
    async (
      get,
      set,
      params: {
        asset: number;
        isBuy: boolean;
        ntli: number;
      },
    ): Promise<void> => {
      return withToast({
        asyncFn: async () => {
          await backgroundApiProxy.serviceHyperliquidExchange.updateIsolatedMargin(
            {
              asset: params.asset,
              isBuy: params.isBuy,
              ntli: params.ntli,
            },
          );
        },
        actionType: EActionType.UPDATE_ISOLATED_MARGIN,
      });
    },
  );

  ordersClose = contextAtomMethod(
    async (
      get,
      set,
      params: {
        assetId: number;
        isBuy: boolean;
        size: string;
        midPx: string;
        slippage?: number;
      }[],
    ) => {
      return withToast({
        asyncFn: async () => {
          const result =
            await backgroundApiProxy.serviceHyperliquidExchange.ordersClose(
              params,
            );
          return result;
        },
        actionType: EActionType.ORDERS_CLOSE,
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

  ensureTradingEnabled = contextAtomMethod(async (get, _set) => {
    const info = await perpsActiveAccountIsAgentReadyAtom.get();
    if (info.isAgentReady === false) {
      showEnableTradingDialog();
      throw new OneKeyLocalError('Trading not enabled');
    }
  });

  closeAllPositions = contextAtomMethod(async (get, set) => {
    return withToast({
      asyncFn: async () => {
        await this.ensureTradingEnabled.call(set);
        const { activePositions: positions } = get(perpsActivePositionAtom());

        if (positions.length === 0) {
          console.warn('No positions to close');
          return;
        }

        // Get symbol metadata for all positions
        const symbolsMetaMap =
          await backgroundApiProxy.serviceHyperliquid.getSymbolsMetaMap({
            coins: positions.map((p) => p.position.coin),
          });

        // Get current mid prices for all positions
        const midPrices = await Promise.all(
          positions.map(async (p) => {
            try {
              const midPrice =
                await backgroundApiProxy.serviceHyperliquid.getSymbolMidValue({
                  coin: p.position.coin,
                });
              return { coin: p.position.coin, midPrice };
            } catch (error) {
              console.warn(
                `Failed to get mid price for ${p.position.coin}:`,
                error,
              );
              return { coin: p.position.coin, midPrice: null };
            }
          }),
        );

        const midPriceMap = Object.fromEntries(
          midPrices.map((item) => [item.coin, item.midPrice]),
        );

        // Prepare close orders for all positions
        const positionsToClose = positions
          .map((positionItem) => {
            const position = positionItem.position;
            const tokenInfo = symbolsMetaMap[position.coin];
            const midPrice = midPriceMap[position.coin];

            if (!tokenInfo || !midPrice) {
              console.warn(`Missing data for position ${position.coin}`);
              return null;
            }

            const positionSize = new BigNumber(position.szi || '0')
              .abs()
              .toFixed();
            const isLongPosition = new BigNumber(position.szi || '0').gte(0);

            return {
              assetId: tokenInfo.assetId,
              isBuy: isLongPosition,
              size: positionSize,
              midPx: midPrice,
            };
          })
          .filter(Boolean);

        if (positionsToClose.length === 0) {
          console.warn('No valid positions to close or data unavailable');
          return;
        }

        await this.ordersClose.call(set, positionsToClose);
      },
      actionType: EActionType.ORDERS_CLOSE,
    });
  });

  showSetPositionTpslUI = contextAtomMethod(
    async (
      _get,
      _set,
      params: {
        position: IPerpsAssetPosition['position'];
        isMobile: boolean;
        onShowDialog: (params: {
          coin: string;
          szDecimals: number;
          assetId: number;
        }) => void;
        navigation: IAppNavigation;
      },
    ) => {
      const { position, isMobile, onShowDialog } = params;

      const tokenInfo =
        await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin: position.coin,
        });

      if (!tokenInfo) {
        console.error(
          '[HyperliquidActions.showSetPositionTpslUI] Token info not found for',
          position.coin,
        );
        return;
      }

      const tpslParams = {
        coin: position.coin,
        szDecimals: tokenInfo.universe?.szDecimals ?? 2,
        assetId: tokenInfo.assetId,
      };

      if (isMobile) {
        params.navigation.pushModal(EModalRoutes.PerpModal, {
          screen: EModalPerpRoutes.MobileSetTpsl,
          params: tpslParams,
        });
      } else {
        onShowDialog(tpslParams);
      }
    },
  );

  // refreshAllPerpsData
  refreshAllPerpsData = contextAtomMethod(async (get, set) => {
    // TODO
  });
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
  const startSubscriptions = actions.startSubscriptions.use();
  const stopSubscriptions = actions.stopSubscriptions.use();
  const reconnectSubscriptions = actions.reconnectSubscriptions.use();

  const enableTrading = actions.enableTrading.use();

  const clearAllData = actions.clearAllData.use();

  const updateTradingForm = actions.updateTradingForm.use();
  const resetTradingForm = actions.resetTradingForm.use();
  const setTradingLoading = actions.setTradingLoading.use();

  const placeOrder = actions.placeOrder.use();
  const orderOpen = actions.orderOpen.use();
  const updateLeverage = actions.updateLeverage.use();
  const updateIsolatedMargin = actions.updateIsolatedMargin.use();
  const ordersClose = actions.ordersClose.use();
  const limitOrderClose = actions.limitOrderClose.use();
  const cancelOrder = actions.cancelOrder.use();
  const setPositionTpsl = actions.setPositionTpsl.use();
  const withdraw = actions.withdraw.use();
  const closeAllPositions = actions.closeAllPositions.use();
  const showSetPositionTpslUI = actions.showSetPositionTpslUI.use();

  const ensureOrderBookTickOptionsLoaded =
    actions.ensureOrderBookTickOptionsLoaded.use();
  const setOrderBookTickOption = actions.setOrderBookTickOption.use();
  const changeActiveAsset = actions.changeActiveAsset.use();
  const changeActivePerpsAccount = actions.changeActivePerpsAccount.use();
  const updateAllAssetsFiltered = actions.updateAllAssetsFiltered.use();
  const ensureTradingEnabled = actions.ensureTradingEnabled.use();
  const refreshAllPerpsData = actions.refreshAllPerpsData.use();

  return useRef({
    updateAllAssetsFiltered,
    updateAllMids,
    markAllAssetCtxsRequired,
    markAllAssetCtxsNotRequired,
    updateWebData2,
    updateL2Book,
    updateConnectionState,
    changeActiveAsset,
    changeActivePerpsAccount,

    updateSubscriptions,
    startSubscriptions,
    stopSubscriptions,
    reconnectSubscriptions,
    enableTrading,
    clearAllData,

    updateTradingForm,
    resetTradingForm,
    setTradingLoading,

    placeOrder,
    orderOpen,
    updateLeverage,
    updateIsolatedMargin,
    ordersClose,
    limitOrderClose,
    cancelOrder,
    setPositionTpsl,
    withdraw,
    closeAllPositions,
    showSetPositionTpslUI,
    ensureTradingEnabled,
    ensureOrderBookTickOptionsLoaded,
    setOrderBookTickOption,
    refreshAllPerpsData,
  });
}
