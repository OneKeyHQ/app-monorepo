import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IConnectionState,
  IPerpOrderBookTickOptionPersist,
} from '@onekeyhq/shared/types/hyperliquid/types';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { contextAtomMethod, ProviderJotaiContextHyperliquid };

export const { atom: perpsAllMidsAtom, use: usePerpsAllMidsAtom } =
  contextAtom<HL.IWsAllMids | null>(null);

export const { atom: perpsAllAssetCtxsAtom, use: usePerpsAllAssetCtxsAtom } =
  contextAtom<{
    assetCtxs: HL.IPerpsAssetCtx[];
  }>({
    assetCtxs: [],
  });

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
