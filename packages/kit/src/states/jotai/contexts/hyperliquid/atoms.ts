import { BigNumber } from 'bignumber.js';

import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import {
  computeMaxTradeSize,
  getTriggerEffectivePrice,
  resolveTradingSizeBN,
  sanitizeManualSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IConnectionState,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';
import {
  EPerpsSizeInputMode,
  ETriggerOrderType,
} from '@onekeyhq/shared/types/hyperliquid/types';

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
  assetsByDex: HL.IPerpsUniverse[][];
  query: string;
}>({
  assetsByDex: [],
  query: '',
});

export const {
  atom: perpsAllAssetsFilteredLengthAtom,
  use: usePerpsAllAssetsFilteredLengthAtom,
} = contextAtomComputed((get) => {
  const perpsAllAssetsFiltered = get(perpsAllAssetsFilteredAtom());
  return perpsAllAssetsFiltered.assetsByDex.reduce(
    (sum, assets) => sum + assets.length,
    0,
  );
});

export const { atom: perpsAllAssetCtxsAtom, use: usePerpsAllAssetCtxsAtom } =
  contextAtom<{
    assetCtxsByDex: HL.IPerpsAssetCtx[][];
  }>({
    assetCtxsByDex: [],
  });

export const {
  atom: perpsTokenSearchAliasesAtom,
  use: usePerpsTokenSearchAliasesAtom,
} = contextAtom<ITokenSearchAliases | undefined>(undefined);

export const { atom: l2BookAtom, use: useL2BookAtom } =
  contextAtom<HL.IBook | null>(null);

export const { atom: bboAtom, use: useBboAtom } = contextAtom<HL.IWsBbo | null>(
  null,
);

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

export type IBBOPriceMode =
  | null
  | { type: 'counterparty'; level: number }
  | { type: 'queue'; level: number };

export interface ITradingFormData {
  side: 'long' | 'short';
  type: 'market' | 'limit';
  price: string;
  size: string;
  sizeInputMode: EPerpsSizeInputMode;
  sizePercent: number;
  leverage?: number;

  // BBO limit price mode
  bboPriceMode?: IBBOPriceMode;

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

  // ── Standalone Trigger Order Fields ──
  orderMode: 'standard' | 'trigger';
  triggerOrderType?: ETriggerOrderType;
  triggerPrice?: string;
  executionPrice?: string;
  triggerReduceOnly?: boolean;
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
    bboPriceMode: null,
    hasTpsl: false,
    tpTriggerPx: '',
    tpGainPercent: '',
    slTriggerPx: '',
    slLossPercent: '',
    tpType: 'price',
    tpValue: '',
    slType: 'price',
    slValue: '',
    // Standalone trigger defaults
    orderMode: 'standard',
    triggerOrderType: ETriggerOrderType.TRIGGER_MARKET,
    triggerPrice: '',
    executionPrice: '',
    triggerReduceOnly: true,
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

export const {
  atom: positionFilterByCurrentTokenAtom,
  use: usePositionFilterByCurrentTokenAtom,
} = contextAtom<boolean>(false);

export const {
  atom: orderFilterByCurrentTokenAtom,
  use: useOrderFilterByCurrentTokenAtom,
} = contextAtom<boolean>(false);

export type IPerpsActiveOpenOrdersAtom = {
  accountAddress: string | undefined;
  openOrders: HL.IPerpsFrontendOrder[];
  openOrdersByCoin: Record<string, HL.IPerpsFrontendOrder[]>;
};
export const {
  atom: perpsActiveOpenOrdersAtom,
  use: usePerpsActiveOpenOrdersAtom,
} = contextAtom<IPerpsActiveOpenOrdersAtom>({
  accountAddress: undefined,
  openOrders: [],
  openOrdersByCoin: {},
});

export const {
  atom: perpsActiveOpenOrdersLengthAtom,
  use: usePerpsActiveOpenOrdersLengthAtom,
} = contextAtomComputed((get) => {
  const { openOrders } = get(perpsActiveOpenOrdersAtom());
  const filteredOpenOrders = openOrders.filter((o) => !o.coin.startsWith('@'));
  return filteredOpenOrders.length ?? 0;
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
  const filteredOpenOrders = openOrders.filter((o) => !o.coin.startsWith('@'));
  return filteredOpenOrders.reduce(
    (acc, order, index) => {
      acc[order.coin] = [...(acc[order.coin] || []), index];
      return acc;
    },
    {} as { [coin: string]: number[] },
  );
});

export const perpsOpenOrdersByCoinAtomCache = new Map<
  string,
  ReturnType<typeof contextAtomComputed<HL.IPerpsFrontendOrder[]>>
>();

function getOrCreatePerpsOpenOrdersByCoinAtom(coin: string) {
  let entry = perpsOpenOrdersByCoinAtomCache.get(coin);
  if (!entry) {
    entry = contextAtomComputed((get) => {
      const { openOrdersByCoin } = get(perpsActiveOpenOrdersAtom());
      return openOrdersByCoin?.[coin] ?? [];
    });
    perpsOpenOrdersByCoinAtomCache.set(coin, entry);
  }
  return entry;
}

export function usePerpsOpenOrdersByCoin(
  coin: string,
): HL.IPerpsFrontendOrder[] {
  const { use } = getOrCreatePerpsOpenOrdersByCoinAtom(coin);
  const [orders] = use();
  return orders;
}

export type IPerpsLedgerUpdatesAtom = {
  accountAddress: string | undefined;
  updates: HL.IUserNonFundingLedgerUpdate[];
  isSubscribed: boolean;
};
export const { atom: perpsLedgerUpdatesAtom, use: usePerpsLedgerUpdatesAtom } =
  contextAtom<IPerpsLedgerUpdatesAtom>({
    accountAddress: undefined,
    updates: [],
    isSubscribed: false,
  });

export interface ITradingFormEnv {
  markPrice?: string;
  availableToTrade?: Array<number | string>;
  maxTradeSzs?: Array<number | string>;
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

  // In trigger mode, use trigger effective price for size/margin computations
  let price: string;
  if (form.orderMode === 'trigger' && form.triggerOrderType) {
    const triggerEffective = getTriggerEffectivePrice({
      triggerOrderType: form.triggerOrderType,
      triggerPrice: form.triggerPrice,
      executionPrice: form.executionPrice,
      midPrice: env.markPrice,
    });
    price = triggerEffective.gt(0) ? triggerEffective.toFixed() : '';
  } else {
    price = form.type === 'limit' ? form.price : '';
  }

  // Trigger orders don't lock margin at placement, so slider max = balance × leverage / price
  let effectiveMaxTradeSzs = env.maxTradeSzs;
  if (form.orderMode === 'trigger') {
    const effectivePrice = price
      ? new BigNumber(price)
      : new BigNumber(env.markPrice ?? 0);
    const leverageBN = new BigNumber(
      env.leverageValue ?? env.fallbackLeverage ?? 1,
    );
    const availableIdx = form.side === 'long' ? 0 : 1;
    const balanceBN = new BigNumber(env.availableToTrade?.[availableIdx] ?? 0);
    const markPxBN = new BigNumber(env.markPrice ?? 0);
    if (
      effectivePrice.gt(0) &&
      leverageBN.gt(0) &&
      balanceBN.gt(0) &&
      markPxBN.gt(0)
    ) {
      // Produce tokens-at-markPrice so computeMaxTradeSize converts correctly
      const triggerMaxTokens = balanceBN
        .multipliedBy(leverageBN)
        .dividedBy(markPxBN);
      effectiveMaxTradeSzs = [
        form.side === 'long' ? triggerMaxTokens.toFixed() : '0',
        form.side === 'short' ? triggerMaxTokens.toFixed() : '0',
      ];
    }
  }

  const maxSizeBN = computeMaxTradeSize({
    side: form.side,
    price,
    markPrice: env.markPrice,
    maxTradeSzs: effectiveMaxTradeSzs,
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
    maxTradeSzs: effectiveMaxTradeSzs,
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

export const perpsCtxByCoinAtomCache = new Map<
  string,
  ReturnType<typeof contextAtomComputed<HL.IPerpsAssetCtx | null>>
>();

function getOrCreateCtxByCoinAtom(dexIndex: number, assetId: number) {
  const key = `${dexIndex}-${assetId}`;
  let entry = perpsCtxByCoinAtomCache.get(key);
  if (!entry) {
    const ctxIndex = dexIndex === 1 ? assetId - XYZ_ASSET_ID_OFFSET : assetId;
    entry = contextAtomComputed((get) => {
      const { assetCtxsByDex } = get(perpsAllAssetCtxsAtom());
      return assetCtxsByDex?.[dexIndex]?.[ctxIndex] ?? null;
    });
    perpsCtxByCoinAtomCache.set(key, entry);
  }
  return entry;
}

export function usePerpsCtxByCoin(
  dexIndex: number,
  assetId: number,
): HL.IPerpsAssetCtx | null {
  const { use } = getOrCreateCtxByCoinAtom(dexIndex, assetId);
  const [ctx] = use();
  return ctx;
}
