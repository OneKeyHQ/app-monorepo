import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import type { Hex } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { ConnectionState, TokenListItem } from '@onekeyhq/shared/types/hyperliquid/types';
import type * as HL from '@nktkas/hyperliquid';
import { ZeroAddress } from 'ethersV6';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  contextAtomComputed,
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

export const tokenListAtom = (() =>
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

        const change24h = (parseFloat(price) - parseFloat(prevDayPx)).toString();
        const change24hPercent = prevDayPx !== '0'
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
      .filter(item => {
        if (universe.length === 0) return true;
        return universe.some((u: any) => u.name === item.coin);
      })
      .sort((a, b) => {
        const aVolume = parseFloat(a.volume24h) || 0;
        const bVolume = parseFloat(b.volume24h) || 0;
        return bVolume - aVolume;
      });
  })
);

export const useTokenListAtom = () => tokenListAtom();

export const { atom: currentTokenInfoAtom, use: useCurrentTokenInfoAtom } = contextAtomComputed((get): TokenListItem | null => {
  const currentToken = get(currentTokenAtom());
  const tokenList = get(tokenListAtom());

  return tokenList.find(token => token.coin === currentToken) || null;
});

export const { atom: accountSummaryAtom, use: useAccountSummaryAtom } = contextAtomComputed((get) => {
  const webData2 = get(webData2Atom());
  if (!webData2?.clearinghouseState.marginSummary) return null;

  return {
    accountValue: webData2.clearinghouseState.marginSummary.accountValue,
    totalMarginUsed: webData2.clearinghouseState.marginSummary.totalMarginUsed,
    totalNtlPos: webData2.clearinghouseState.marginSummary.totalNtlPos,
    totalRawUsd: webData2.clearinghouseState.marginSummary.totalRawUsd,
    withdrawable: webData2.clearinghouseState.withdrawable,
    lastUpdate: Date.now(),
  };
});

export const { atom: requiredSubscriptionsAtom, use: useRequiredSubscriptionsAtom } = contextAtomComputed((get): string[] => {
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
});


export interface ITradingFormData {
  side: 'long' | 'short';
  type: 'market' | 'limit';
  price: string;
  size: string;
  leverage?: number;

  // Take Profit / Stop Loss
  hasTpsl: boolean;
  tpTriggerPx: string;    // TP Price
  tpGainPercent: string;  // Gain %
  slTriggerPx: string;    // SL Price
  slLossPercent: string;  // Loss %
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


export const { atom: currentTokenPriceAtom, use: useCurrentTokenPriceAtom } = contextAtomComputed((get) => {
  const activeAssetCtx = get(activeAssetCtxAtom());
  const currentToken = get(currentTokenAtom());

  if (!activeAssetCtx?.ctx || !currentToken) {
    return {
      markPrice: '0',
      oraclePrice: '0',
      funding: '0',
      openInterest: '0',
      volume24h: '0',
      change24h: '0',
      change24hPercent: 0,
      prevDayPx: '0',
      coin: currentToken,
      lastUpdate: Date.now(),
    };
  }

  const ctx = activeAssetCtx.ctx;
  const markPrice = ctx.markPx || '0';
  const oraclePrice = ctx.oraclePx || '0';
  const funding = ctx.funding || '0';
  const openInterest = ctx.openInterest || '0';
  const volume24h = ctx.dayNtlVlm || '0';
  const prevDayPx = ctx.prevDayPx || markPrice;

  const markPriceNum = parseFloat(markPrice);
  const prevDayPxNum = parseFloat(prevDayPx);
  const change24h = (markPriceNum - prevDayPxNum).toString();
  const change24hPercent = prevDayPxNum > 0
    ? ((markPriceNum - prevDayPxNum) / prevDayPxNum) * 100
    : 0;

  return {
    markPrice,
    oraclePrice,
    funding,
    openInterest,
    volume24h,
    change24h,
    change24hPercent,
    prevDayPx,
    coin: currentToken,
    lastUpdate: Date.now(),
  };
});

export const { atom: positionListAtom, use: usePositionListAtom } = contextAtomComputed((get) => {
  const webData2 = get(webData2Atom());

  if (!webData2?.clearinghouseState?.assetPositions) {
    return [];
  }

  const positions = webData2.clearinghouseState.assetPositions;

  const activePositions = positions.filter((pos: any) => {
    const size = parseFloat(pos.position?.szi || '0');
    return Math.abs(size) > 0;
  });

  return activePositions;
});

export const { atom: openOrdersListAtom, use: useOpenOrdersListAtom } = contextAtomComputed((get) => {
  const webData2 = get(webData2Atom());

  if (!webData2?.openOrders) {
    return [];
  }

  return webData2.openOrders;
});

export const { atom: tradingPanelDataAtom, use: useTradingPanelDataAtom } = contextAtomComputed((get) => {
  const currentToken = get(currentTokenAtom());
  const tokenList = get(tokenListAtom());
  const activeAssetCtx = get(activeAssetCtxAtom());
  const activeAssetData = get(activeAssetDataAtom());

  if (!currentToken) {
    return null;
  }

  const tokenInfo = tokenList.find(token => token.coin === currentToken);
  if (!tokenInfo) {
    return null;
  }

  const ctx = activeAssetCtx?.ctx;
  const markPrice = ctx?.markPx || '0';
  const oraclePrice = ctx?.oraclePx || '0';
  const funding = ctx?.funding || '0';
  const openInterest = ctx?.openInterest || '0';
  const volume24h = ctx?.dayNtlVlm || '0';
  const prevDayPx = ctx?.prevDayPx || markPrice;

  const markPriceNum = parseFloat(markPrice);
  const prevDayPxNum = parseFloat(prevDayPx);
  const change24hPercent = prevDayPxNum > 0
    ? ((markPriceNum - prevDayPxNum) / prevDayPxNum) * 100
    : 0;

  const tradingData = {
    ...tokenInfo,
    ...activeAssetData,
    name: currentToken,
    markPx: markPrice,
    markPrice,
    oraclePrice,
    prevDayPrice: prevDayPx,
    fundingRate: funding,
    openInterest,
    volume24h,
    change24hPercent,
    lastUpdate: Date.now(),
  };

  return tradingData;
});

export const { atom: accountPanelDataAtom, use: useAccountPanelDataAtom } = contextAtomComputed((get) => {
  const webData2 = get(webData2Atom());
  const activeAssetData = get(activeAssetDataAtom());
  const positions = get(positionListAtom());
  const orders = get(openOrdersListAtom());

  if (!webData2) {
    return {
      isLoggedIn: false,
      currentUser: null,
      accountSummary: {
        accountValue: undefined,
        totalMarginUsed: undefined,
        totalNtlPos: undefined,
        totalRawUsd: undefined,
        withdrawable: undefined,
      },
      positions: [],
      orders: [],
      activeAssetData: null,
      hasUserData: false,
    };
  }

  const currentUser = webData2.user === ZeroAddress ? null : webData2.user;
  const isLoggedIn = !!currentUser;
  const hasUserData = isLoggedIn && !!webData2;

  const accountSummary = {
    accountValue: webData2.clearinghouseState?.marginSummary?.accountValue,
    totalMarginUsed: webData2.clearinghouseState?.marginSummary?.totalMarginUsed,
    totalNtlPos: webData2.clearinghouseState?.marginSummary?.totalNtlPos,
    totalRawUsd: webData2.clearinghouseState?.marginSummary?.totalRawUsd,
    withdrawable: webData2.clearinghouseState?.withdrawable,
  };

  const totalPositionValue = positions.reduce((acc: number, pos: any) => {
    return acc + (parseFloat(pos.position?.positionValue || '0'));
  }, 0);

  return {
    isLoggedIn,
    currentUser,
    accountSummary,
    positions,
    orders,
    activeAssetData,
    hasUserData,
    totalPositionValue,
    userWebData2: webData2,
    userPositions: positions,
  };
});
