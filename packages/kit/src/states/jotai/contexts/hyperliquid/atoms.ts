import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IConnectionState,
  IPerpOrderBookTickOptionPersist,
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

export const { atom: perpsAllAssetCtxsAtom, use: usePerpsAllAssetCtxsAtom } =
  contextAtom<{
    allAssetCtxs: HL.IPerpsAssetCtx[];
  }>({
    allAssetCtxs: [],
  });

export const { atom: webData2Atom } = contextAtom<HL.IWsWebData2 | null>(null);

export const { atom: l2BookAtom, use: useL2BookAtom } =
  contextAtom<HL.IBook | null>(null);

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
  leverage?: number;

  // Take Profit / Stop Loss
  hasTpsl: boolean;
  tpTriggerPx: string; // TP Price
  tpGainPercent: string; // Gain %
  slTriggerPx: string; // SL Price
  slLossPercent: string; // Loss %
}

export const { atom: tradingFormAtom, use: useTradingFormAtom } =
  contextAtom<ITradingFormData>({
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

export const { atom: tradingLoadingAtom, use: useTradingLoadingAtom } =
  contextAtom<boolean>(false);

// IPerpsAssetPosition[]
export const { atom: positionListAtom, use: usePositionListAtom } =
  contextAtomComputed((get) => {
    const webData2 = get(webData2Atom());

    if (!webData2?.clearinghouseState?.assetPositions) {
      return [];
    }

    const positions = webData2.clearinghouseState.assetPositions;

    const activePositions = positions.filter((pos) => {
      const size = parseFloat(pos.position?.szi || '0');
      return Math.abs(size) > 0;
    });

    return activePositions;
  });

// IPerpsFrontendOrder[]
export const { atom: openOrdersListAtom, use: useOpenOrdersListAtom } =
  contextAtomComputed((get) => {
    const webData2 = get(webData2Atom());

    if (!webData2?.openOrders) {
      return [];
    }

    return webData2.openOrders;
  });
