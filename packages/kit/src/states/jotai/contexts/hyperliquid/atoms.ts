import { BigNumber } from 'bignumber.js';
import { selectAtom } from 'jotai/utils';

import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { perpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { getScaleOrderReferencePrice } from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import {
  computeMaxTradeSize,
  getTriggerEffectivePrice,
  isSpotInstrument,
  resolveTradingSizeBN,
  sanitizeManualSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSizeInputMode,
  ETriggerOrderType,
  type IConnectionState,
  type IPerpOrderBookTickOptionPersist,
  type IPerpsFormattedAssetCtx,
  type IScaleOrderSizeDistribution,
  type IScaleOrderTif,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { getScopedOpenOrdersByCoin } from './utils/coldStartMergeUtils';

import type {
  IPerpsBboWithLocalReceivedAt,
  IPerpsL2BookWithLocalReceivedAt,
} from './utils/l2BookUtils';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { contextAtomMethod, ProviderJotaiContextHyperliquid };

export const { atom: perpsAllMidsAtom, use: usePerpsAllMidsAtom } =
  contextAtom<HL.IWsAllMids | null>(null);

export const perpsMidByCoinAtomCache = new Map<
  string,
  ReturnType<typeof contextAtomComputed<string | undefined>>
>();

function getOrCreatePerpsMidByCoinAtom(coin: string) {
  const key = coin || '';
  let entry = perpsMidByCoinAtomCache.get(key);
  if (!entry) {
    const selectedAtom = selectAtom(perpsAllMidsAtom(), (allMids) =>
      key ? allMids?.mids?.[key] : undefined,
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
    perpsMidByCoinAtomCache.set(key, entry);
  }
  return entry;
}

export function usePerpsMidByCoin(coin: string): string | undefined {
  const { use } = getOrCreatePerpsMidByCoinAtom(coin);
  const [mid] = use();
  return mid;
}

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

export type IPerpsAllAssetCtxsAtomValue = {
  assetCtxsByDex: HL.IPerpsAssetCtx[][];
  updatedAt?: number;
};

export const { atom: perpsAllAssetCtxsAtom, use: usePerpsAllAssetCtxsAtom } =
  contextAtom<IPerpsAllAssetCtxsAtomValue>({
    assetCtxsByDex: [],
  });

export const {
  atom: perpsTokenSearchAliasesAtom,
  use: usePerpsTokenSearchAliasesAtom,
} = contextAtom<ITokenSearchAliases | undefined>(undefined, {
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsTokenSearchAliasesAtom,
});

export const { atom: perpsMaxBuilderFeeAtom, use: usePerpsMaxBuilderFeeAtom } =
  contextAtom<number | undefined>(undefined, {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsMaxBuilderFeeAtom,
  });

export type IPerpsActiveAssetCtxColdCacheAtom = Record<
  string,
  {
    data: {
      coin: string;
      assetId: number | undefined;
      ctx: IPerpsFormattedAssetCtx;
    };
    updatedAt: number;
  }
>;

export const {
  atom: perpsActiveAssetCtxColdCacheAtom,
  use: usePerpsActiveAssetCtxColdCacheAtom,
} = contextAtom<IPerpsActiveAssetCtxColdCacheAtom>(
  {},
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveAssetCtxColdCacheAtom,
  },
);

export const { atom: l2BookAtom, use: useL2BookAtom } =
  contextAtom<IPerpsL2BookWithLocalReceivedAt | null>(null);

export const { atom: bboAtom, use: useBboAtom } =
  contextAtom<IPerpsBboWithLocalReceivedAt | null>(null);

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

export type IActiveTradeInstrument =
  | {
      mode: 'perp';
      coin: string;
      assetId: number | undefined;
      universe: HL.IPerpsUniverse | undefined;
    }
  | {
      mode: 'spot';
      coin: string;
      assetId: number | undefined;
      universe: HL.ISpotUniverse | undefined;
    };

export const {
  atom: activeTradeInstrumentAtom,
  use: useActiveTradeInstrumentAtom,
} = contextAtom<IActiveTradeInstrument>(
  {
    mode: 'perp',
    coin: '',
    assetId: undefined,
    universe: undefined,
  },
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveTradeInstrumentAtom,
  },
);

export interface ITradeRouteViewState {
  routeFocused: boolean;
  tokenSelectorOpen: boolean;
  tokenSelectorTab: string;
  infoPanelTab: string;
  favoritesBarSpotActive: boolean;
}

export const {
  atom: tradeRouteViewStateAtom,
  use: useTradeRouteViewStateAtom,
} = contextAtom<ITradeRouteViewState>({
  routeFocused: false,
  tokenSelectorOpen: false,
  tokenSelectorTab: 'all',
  infoPanelTab: 'Positions',
  favoritesBarSpotActive: false,
});

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
  limitTif?: HL.ITIF;

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
  orderMode: 'standard' | 'trigger' | 'scale' | 'twap';
  triggerOrderType?: ETriggerOrderType;
  triggerPrice?: string;
  executionPrice?: string;
  triggerReduceOnly?: boolean;

  // ── Scale Order Fields ──
  scaleLowerPrice?: string;
  scaleUpperPrice?: string;
  scaleOrderCount?: string;
  scaleReduceOnly?: boolean;
  scaleTif?: IScaleOrderTif;
  scaleSizeDistribution?: IScaleOrderSizeDistribution;

  // ── TWAP Order Fields ──
  twapDurationMinutes?: string;
  twapRandomize?: boolean;
  twapReduceOnly?: boolean;
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
    limitTif: 'Gtc',
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
    scaleLowerPrice: '',
    scaleUpperPrice: '',
    scaleOrderCount: '5',
    scaleReduceOnly: false,
    scaleTif: 'Gtc',
    scaleSizeDistribution: 'fixed',
    twapDurationMinutes: '10',
    twapRandomize: true,
    twapReduceOnly: false,
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
} = contextAtom<IPerpsActivePositionAtom>(
  {
    accountAddress: undefined,
    activePositions: [],
  },
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActivePositionAtom,
  },
);
export const {
  atom: perpsActivePositionLengthAtom,
  use: usePerpsActivePositionLengthAtom,
} = contextAtomComputed((get) => {
  const activePositions = get(perpsActivePositionAtom());
  return activePositions?.activePositions?.length ?? 0;
});

const { atom: filterByCurrentTokenAtom, use: useFilterByCurrentTokenAtom } =
  contextAtom<boolean>(false);

export const positionFilterByCurrentTokenAtom = filterByCurrentTokenAtom;
export const usePositionFilterByCurrentTokenAtom = useFilterByCurrentTokenAtom;
export const orderFilterByCurrentTokenAtom = filterByCurrentTokenAtom;
export const useOrderFilterByCurrentTokenAtom = useFilterByCurrentTokenAtom;

export type IPerpsActiveOpenOrdersAtom = {
  accountAddress: string | undefined;
  openOrders: HL.IPerpsFrontendOrder[];
  openOrdersByCoin: Record<string, HL.IPerpsFrontendOrder[]>;
};
export const {
  atom: perpsActiveOpenOrdersAtom,
  use: usePerpsActiveOpenOrdersAtom,
} = contextAtom<IPerpsActiveOpenOrdersAtom>(
  {
    accountAddress: undefined,
    openOrders: [],
    openOrdersByCoin: {},
  },
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.perpsActiveOpenOrdersAtom,
  },
);

export type IPerpsActiveTwapOrder = {
  twapId: number;
  state: HL.ITwapState;
  dex?: string;
};

export type IPerpsActiveTwapOrdersAtom = {
  accountAddress: string | undefined;
  twapOrders: IPerpsActiveTwapOrder[];
  twapOrdersByCoin: Record<string, IPerpsActiveTwapOrder[]>;
};
export const {
  atom: perpsActiveTwapOrdersAtom,
  use: usePerpsActiveTwapOrdersAtom,
} = contextAtom<IPerpsActiveTwapOrdersAtom>({
  accountAddress: undefined,
  twapOrders: [],
  twapOrdersByCoin: {},
});

export type IPerpsTwapHistoryAtom = {
  accountAddress: string | undefined;
  history: HL.ITwapHistoryRecord[];
  isLoaded: boolean;
};
export const { atom: perpsTwapHistoryAtom, use: usePerpsTwapHistoryAtom } =
  contextAtom<IPerpsTwapHistoryAtom>({
    accountAddress: undefined,
    history: [],
    isLoaded: false,
  });

export type IPerpsTwapSliceFillsAtom = {
  accountAddress: string | undefined;
  fills: HL.ITwapSliceFill[];
  isLoaded: boolean;
  latestTime: number;
};
export const {
  atom: perpsTwapSliceFillsAtom,
  use: usePerpsTwapSliceFillsAtom,
} = contextAtom<IPerpsTwapSliceFillsAtom>({
  accountAddress: undefined,
  fills: [],
  isLoaded: false,
  latestTime: 0,
});

export const {
  atom: perpsActiveOpenOrdersLengthAtom,
  use: usePerpsActiveOpenOrdersLengthAtom,
} = contextAtomComputed((get) => {
  const { openOrders } = get(perpsActiveOpenOrdersAtom());
  const filteredOpenOrders = openOrders.filter(
    (o) => !isSpotInstrument(o.coin),
  );
  return filteredOpenOrders.length ?? 0;
});

export const {
  atom: perpsActiveTwapOrdersLengthAtom,
  use: usePerpsActiveTwapOrdersLengthAtom,
} = contextAtomComputed((get) => {
  const { twapOrders } = get(perpsActiveTwapOrdersAtom());
  return twapOrders.length;
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
      const activeAccount = get(perpsActiveAccountAtom.atom());
      const { accountAddress, openOrdersByCoin } = get(
        perpsActiveOpenOrdersAtom(),
      );
      return getScopedOpenOrdersByCoin({
        activeAccountAddress: activeAccount?.accountAddress,
        openOrdersAccountAddress: accountAddress,
        openOrdersByCoin,
        coin,
      });
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
  isLoaded: boolean;
};
export const { atom: perpsLedgerUpdatesAtom, use: usePerpsLedgerUpdatesAtom } =
  contextAtom<IPerpsLedgerUpdatesAtom>({
    accountAddress: undefined,
    updates: [],
    isLoaded: false,
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
  } else if (form.orderMode === 'scale') {
    const referencePrice = getScaleOrderReferencePrice({
      lowerPrice: form.scaleLowerPrice,
      upperPrice: form.scaleUpperPrice,
    });
    price = referencePrice.gt(0) ? referencePrice.toFixed() : '';
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

// Field-by-field equality for IPerpsAssetCtx (all primitive strings + one string[] | null).
// Used by selectAtom to return the previous reference when data is unchanged,
// which causes Jotai to skip the notification chain → derived atoms not
// re-evaluated → row components not re-rendered.
function isPerpsCtxEqual(
  a: HL.IPerpsAssetCtx | null,
  b: HL.IPerpsAssetCtx | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.markPx !== b.markPx ||
    a.midPx !== b.midPx ||
    a.funding !== b.funding ||
    a.openInterest !== b.openInterest ||
    a.prevDayPx !== b.prevDayPx ||
    a.dayNtlVlm !== b.dayNtlVlm ||
    a.oraclePx !== b.oraclePx ||
    a.premium !== b.premium ||
    a.dayBaseVlm !== b.dayBaseVlm
  ) {
    return false;
  }
  // impactPxs: string[] | null
  const ai = a.impactPxs;
  const bi = b.impactPxs;
  if (ai === bi) return true;
  if (!ai || !bi || ai.length !== bi.length) return false;
  for (let i = 0; i < ai.length; i += 1) {
    if (ai[i] !== bi[i]) return false;
  }
  return true;
}

export const perpsCtxByCoinAtomCache = new Map<
  string,
  ReturnType<typeof contextAtomComputed<HL.IPerpsAssetCtx | null>>
>();

function getOrCreateCtxByCoinAtom(dexIndex: number, assetId: number) {
  const key = `${dexIndex}-${assetId}`;
  let entry = perpsCtxByCoinAtomCache.get(key);
  if (!entry) {
    const ctxIndex = dexIndex === 1 ? assetId - XYZ_ASSET_ID_OFFSET : assetId;
    // selectAtom passes prevSlice to the selector. Returning prevSlice when
    // fields are unchanged makes Jotai's Object.is check pass, so the derived
    // atom's value stays the same reference → dependents skip re-evaluation.
    const selectedAtom = selectAtom(
      perpsAllAssetCtxsAtom(),
      (
        { assetCtxsByDex }: { assetCtxsByDex: HL.IPerpsAssetCtx[][] },
        prevCtx?: HL.IPerpsAssetCtx | null,
      ) => {
        const newCtx = assetCtxsByDex?.[dexIndex]?.[ctxIndex] ?? null;
        if (prevCtx !== undefined && isPerpsCtxEqual(prevCtx, newCtx)) {
          return prevCtx;
        }
        return newCtx;
      },
    );
    entry = contextAtomComputed((get) => get(selectedAtom));
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
