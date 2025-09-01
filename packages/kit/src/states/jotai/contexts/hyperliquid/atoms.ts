import memoizee from 'memoizee';

import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { Hex } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  ConnectionState,
  TokenListItem,
} from '@onekeyhq/shared/types/hyperliquid/types';

import type * as HL from '@nktkas/hyperliquid';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextHyperliquid, contextAtomMethod };

export const { atom: allMidsAtom, use: useAllMidsAtom } =
  contextAtom<HL.WsAllMids | null>(null);

export const { atom: webData2Atom, use: useWebData2Atom } =
  contextAtom<HL.WsWebData2 | null>(null);

export const { atom: activeAssetCtxAtom, use: useActiveAssetCtxAtom } =
  contextAtom<HL.WsActiveAssetCtx | null>(null);

export const { atom: activeAssetDataAtom, use: useActiveAssetDataAtom } =
  contextAtom<HL.ActiveAssetData | null>(null);

export const { atom: connectionStateAtom, use: useConnectionStateAtom } =
  contextAtom<ConnectionState>({
    isConnected: false,
    lastConnected: null,
    reconnectCount: 0,
  });

export const { atom: currentTokenAtom, use: useCurrentTokenAtom } =
  contextAtom<string>('ETH');

export const { atom: currentUserAtom, use: useCurrentUserAtom } =
  contextAtom<Hex | null>(null);

export const { atom: currentAccountAtom, use: useCurrentAccountAtom } =
  contextAtom<string | null>(null);

export const { atom: subscriptionActiveAtom, use: useSubscriptionActiveAtom } =
  contextAtom<boolean>(false);

export const tokenListAtom = () =>
  atom((get): TokenListItem[] => {
    const allMids = get(allMidsAtom());
    const webData2 = get(webData2Atom());
    const currentToken = get(currentTokenAtom());
    const activeAssetCtx = get(activeAssetCtxAtom());

    if (!allMids?.mids) {
      return [];
    }

    const universe = (webData2 as any)?.universe?.slice() || [];

    return Object.entries(allMids.mids)
      .map(([coin, price]) => {
        const universeItem = universe.find((u: any) => u.name === coin);

        const isCurrentToken = coin === currentToken;
        const hasActiveData = isCurrentToken && activeAssetCtx;

        const markPrice = price;
        const indexPrice = hasActiveData
          ? (activeAssetCtx as any)?.markPx || price
          : price;
        const fundingRate = hasActiveData
          ? (activeAssetCtx as any)?.funding || '0'
          : '0';
        const openInterest = hasActiveData
          ? (activeAssetCtx as any)?.openInterest || '0'
          : '0';
        const volume24h = hasActiveData
          ? (activeAssetCtx as any)?.dayNtlVlm || '0'
          : '0';
        const prevDayPx = hasActiveData
          ? (activeAssetCtx as any)?.prevDayPx || price
          : price;

        const change24h = (
          parseFloat(price) - parseFloat(prevDayPx)
        ).toString();
        const change24hPercent =
          prevDayPx !== '0'
            ? ((parseFloat(change24h) / parseFloat(prevDayPx)) * 100).toFixed(2)
            : '0';

        const funding8h = (parseFloat(fundingRate) * 8 * 100).toFixed(4);

        return {
          coin,
          lastPrice: price,
          change24h,
          change24hPercent,
          funding8h,
          volume24h,
          openInterest,
          markPrice,
          indexPrice,
          fundingRate,
        };
      })
      .filter((item) => {
        if (universe.length === 0) return true;
        return universe.some((u: any) => u.name === item.coin);
      })
      .sort((a, b) => {
        const aVolume = parseFloat(a.volume24h) || 0;
        const bVolume = parseFloat(b.volume24h) || 0;
        return bVolume - aVolume;
      });
  });

export const useTokenListAtom = () => tokenListAtom();

export const currentTokenInfoAtom = memoizee(() =>
  atom((get): TokenListItem | null => {
    const currentToken = get(currentTokenAtom());
    const tokenList = get(tokenListAtom());

    return tokenList.find((token) => token.coin === currentToken) || null;
  }),
);

export const accountSummaryAtom = memoizee(() =>
  atom((get) => {
    const webData2 = get(webData2Atom());
    if (!webData2?.clearinghouseState.marginSummary) return null;

    return {
      accountValue: webData2.clearinghouseState.marginSummary.accountValue,
      totalMarginUsed:
        webData2.clearinghouseState.marginSummary.totalMarginUsed,
      totalNtlPos: webData2.clearinghouseState.marginSummary.totalNtlPos,
      totalRawUsd: webData2.clearinghouseState.marginSummary.totalRawUsd,
      withdrawable: webData2.clearinghouseState.withdrawable,
      lastUpdate: Date.now(),
    };
  }),
);

export const useAccountSummaryAtom = () => accountSummaryAtom();

export const requiredSubscriptionsAtom = memoizee(() =>
  atom((get): string[] => {
    const currentToken = get(currentTokenAtom());
    const currentUser = get(currentUserAtom());
    const subscriptions: string[] = ['allMids'];

    if (currentToken) {
      subscriptions.push(`activeAssetCtx:${currentToken}`);
      subscriptions.push(`l2Book:${currentToken}`);
      subscriptions.push(`candles:${currentToken}:1h`);
    }

    if (currentUser) {
      subscriptions.push(`webData2:${currentUser}`);
      subscriptions.push(`userEvents:${currentUser}`);
      subscriptions.push(`userNotifications:${currentUser}`);

      if (currentToken) {
        subscriptions.push(`activeAssetData:${currentUser}:${currentToken}`);
      }
    }

    return subscriptions;
  }),
);

export const useRequiredSubscriptionsAtom = () => requiredSubscriptionsAtom();

// 交易表单状态
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
