import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import {
  computeMaxTradeSize,
  resolveTradingSizeBN,
  sanitizeManualSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IConnectionState,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { contextAtomMethod, ProviderJotaiContextHyperliquid };

export const { atom: perpsAllMidsAtom, use: usePerpsAllMidsAtom } =
  contextAtom<HL.IWsAllMids | null>(null);

export const {
  atom: perpsAllAssetsFilteredAtom,
  use: usePerpsAllAssetsFilteredAtom,
} = contextAtom<{
  assets: HL.IPerpsUniverse[];
  query: string;
}>({
  assets: [],
  query: '',
});

export const {
  atom: perpsAllAssetsFilteredLengthAtom,
  use: usePerpsAllAssetsFilteredLengthAtom,
} = contextAtomComputed((get) => {
  const perpsAllAssetsFiltered = get(perpsAllAssetsFilteredAtom());
  return perpsAllAssetsFiltered.assets.length;
});

export const { atom: perpsAllAssetCtxsAtom, use: usePerpsAllAssetCtxsAtom } =
  contextAtom<{
    assetCtxs: HL.IPerpsAssetCtx[];
  }>({
    assetCtxs: [],
  });

export const { atom: l2BookAtom, use: useL2BookAtom } =
  contextAtom<HL.IBook | null>(null);

// TODO remove
export const { atom: connectionStateAtom, use: useConnectionStateAtom } =
  contextAtom<IConnectionState>({
    isConnected: false,
    lastConnected: null,
    reconnectCount: 0,
  });

export const {
  atom: orderBookTickOptionsAtom,
  use: useOrderBookTickOptionsAtom,
} = contextAtom<Record<string, IPerpOrderBookTickOptionPersist>>({});

export const { atom: subscriptionActiveAtom, use: useSubscriptionActiveAtom } =
  contextAtom<boolean>(false);

export interface ITradingFormData {
  side: 'long' | 'short';
  type: 'market' | 'limit';
  price: string;
  size: string;
  sizeInputMode: EPerpsSizeInputMode;
  sizePercent: number;
  leverage?: number;

  // Take Profit / Stop Loss
  hasTpsl: boolean;
  tpTriggerPx: string; // TP Price
  tpGainPercent: string; // Gain %
  slTriggerPx: string; // SL Price
  slLossPercent: string; // Loss %

  // New TPSL fields for form input
  tpType?: 'price' | 'percentage';
  tpValue?: string;
  slType?: 'price' | 'percentage';
  slValue?: string;
}

export const { atom: tradingFormAtom, use: useTradingFormAtom } =
  contextAtom<ITradingFormData>({
    side: 'long',
    type: 'market',
    price: '',
    size: '',
    sizeInputMode: EPerpsSizeInputMode.MANUAL,
    sizePercent: 0,
    leverage: 1,
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

export const { atom: tradingLoadingAtom, use: useTradingLoadingAtom } =
  contextAtom<boolean>(false);

export type IPerpsActivePositionAtom = {
  accountAddress: string | undefined;
  activePositions: HL.IPerpsAssetPosition[];
};
export const {
  atom: perpsActivePositionAtom,
  use: usePerpsActivePositionAtom,
} = contextAtom<IPerpsActivePositionAtom>({
  accountAddress: undefined,
  activePositions: [],
});
export const {
  atom: perpsActivePositionLengthAtom,
  use: usePerpsActivePositionLengthAtom,
} = contextAtomComputed((get) => {
  const activePositions = get(perpsActivePositionAtom());
  return activePositions?.activePositions?.length ?? 0;
});

export type IPerpsActiveOpenOrdersAtom = {
  accountAddress: string | undefined;
  openOrders: HL.IPerpsFrontendOrder[];
};
export const {
  atom: perpsActiveOpenOrdersAtom,
  use: usePerpsActiveOpenOrdersAtom,
} = contextAtom<IPerpsActiveOpenOrdersAtom>({
  accountAddress: undefined,
  openOrders: [],
});

export const {
  atom: perpsActiveOpenOrdersLengthAtom,
  use: usePerpsActiveOpenOrdersLengthAtom,
} = contextAtomComputed((get) => {
  const { openOrders } = get(perpsActiveOpenOrdersAtom());
  return openOrders.length ?? 0;
});

export const {
  atom: perpsActiveOpenOrdersMapAtom,
  use: usePerpsActiveOpenOrdersMapAtom,
} = contextAtomComputed<
  Partial<{
    [coin: string]: number[];
  }>
>((get) => {
  const { openOrders } = get(perpsActiveOpenOrdersAtom());
  return openOrders.reduce((acc, order, index) => {
    acc[order.coin] = [...(acc[order.coin] || []), index];
    return acc;
  }, {} as { [coin: string]: number[] });
});

export interface ITradingFormEnv {
  markPrice?: string;
  availableToTrade?: Array<number | string>;
  leverageValue?: number;
  fallbackLeverage?: number;
  szDecimals?: number;
}

export const { atom: tradingFormEnvAtom, use: useTradingFormEnvAtom } =
  contextAtom<ITradingFormEnv>({});

export const {
  atom: tradingFormComputedAtom,
  use: useTradingFormComputedAtom,
} = contextAtomComputed((get) => {
  const form = get(tradingFormAtom());
  const env = get(tradingFormEnvAtom());

  const mode = form.sizeInputMode ?? EPerpsSizeInputMode.MANUAL;
  const percent = form.sizePercent ?? 0;

  const price = form.type === 'limit' ? form.price : '';

  const maxSizeBN = computeMaxTradeSize({
    side: form.side,
    price,
    markPrice: env.markPrice,
    availableToTrade: env.availableToTrade,
    leverageValue: env.leverageValue,
    fallbackLeverage: env.fallbackLeverage,
    szDecimals: env.szDecimals,
  });

  const computedSizeBN = resolveTradingSizeBN({
    sizeInputMode: mode,
    manualSize: form.size,
    sizePercent: percent,
    side: form.side,
    price,
    markPrice: env.markPrice,
    availableToTrade: env.availableToTrade,
    leverageValue: env.leverageValue,
    fallbackLeverage: env.fallbackLeverage,
    szDecimals: env.szDecimals,
  });

  let computedSizeString = '0';
  if (mode === 'slider') {
    computedSizeString = computedSizeBN.isFinite()
      ? computedSizeBN.toFixed()
      : '0';
  } else {
    computedSizeString = sanitizeManualSize(form.size);
  }

  return {
    sizeInputMode: mode,
    sizePercent: percent,
    computedSizeBN,
    computedSizeString,
    maxSizeBN,
    maxSize: maxSizeBN.isFinite() ? maxSizeBN.toNumber() : 0,
    sliderEnabled: maxSizeBN.isFinite() && maxSizeBN.gte(0),
  };
});
