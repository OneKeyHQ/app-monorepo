import memoizee from 'memoizee';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  // eslint-disable-next-line @typescript-eslint/no-restricted-imports
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { PERPS_EMPTY_ADDRESS } from '@onekeyhq/shared/src/consts/perp';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IConnectionState,
  ITokenListItem,
} from '@onekeyhq/shared/types/hyperliquid/types';

const {
  Provider: ProviderJotaiContextHyperliquid,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { contextAtomMethod, ProviderJotaiContextHyperliquid };

export const { atom: allMidsAtom, use: useAllMidsAtom } =
  contextAtom<HL.IWsAllMids | null>(null);

export const { atom: webData2Atom, use: useWebData2Atom } =
  contextAtom<HL.IWsWebData2 | null>(null);

export const { atom: activeAssetCtxAtom, use: useActiveAssetCtxAtom } =
  contextAtom<(HL.IWsActiveAssetCtx & { coin: string }) | null>(null);

export const { atom: activeAssetDataAtom, use: useActiveAssetDataAtom } =
  contextAtom<(HL.IActiveAssetData & { coin: string }) | null>(null);

export const { atom: l2BookAtom, use: useL2BookAtom } =
  contextAtom<HL.IBook | null>(null);

export const { atom: connectionStateAtom, use: useConnectionStateAtom } =
  contextAtom<IConnectionState>({
    isConnected: false,
    lastConnected: null,
    reconnectCount: 0,
  });

export const {
  atom: basicCurrentTokenAtom,
  useContextAtom: useCurrentTokenContextAtom,
} = contextAtom<string>('ETH');

export const {
  atom: hyperliquidStorageReadyAtom,
  use: useHyperliquidStorageReadyAtom,
} = contextAtom<boolean>(false);

const INIT = Symbol('INIT');
export const currentTokenAtom = memoizee(() =>
  atom(
    (get) => {
      const basicToken = get(basicCurrentTokenAtom());
      return basicToken;
    },
    (get, set, arg: any) => {
      if (arg === INIT) {
        void backgroundApiProxy.simpleDb.perp
          .getCurrentToken()
          .then((token: string) => {
            set(basicCurrentTokenAtom(), token);
            set(hyperliquidStorageReadyAtom(), true);
          });
      } else {
        set(basicCurrentTokenAtom(), arg);
        if (get(hyperliquidStorageReadyAtom())) {
          void backgroundApiProxy.simpleDb.perp.setCurrentToken(arg as string);
        }
      }
    },
  ),
);

currentTokenAtom().onMount = (setAtom) => {
  setAtom(INIT);
};

export const useCurrentTokenAtom = () =>
  useCurrentTokenContextAtom(currentTokenAtom());

export const { atom: currentUserAtom, use: useCurrentUserAtom } =
  contextAtom<HL.IHex | null>(null);

export const { atom: subscriptionActiveAtom, use: useSubscriptionActiveAtom } =
  contextAtom<boolean>(false);

// TODO move to simpleDB
export const { atom: tokenListAtom } = contextAtomComputed(
  (get): ITokenListItem[] => {
    const webData2 = get(webData2Atom());

    const universe = webData2?.meta?.universe?.slice() || [];
    if (!universe?.length) return [];
    const assetCtxs = webData2?.assetCtxs || [];
    return universe.map((u, i) => {
      const assetCtx = assetCtxs[i];
      const mid = assetCtx?.midPx || '0';
      const prevDayPx = assetCtx?.prevDayPx || mid;
      const change24h = (parseFloat(mid) - parseFloat(prevDayPx)).toString();
      const change24hPercent =
        prevDayPx !== '0'
          ? ((parseFloat(change24h) / parseFloat(prevDayPx)) * 100).toFixed(2)
          : '0';
      return {
        assetId: i,
        coin: u.name,
        lastPrice: mid,
        change24h,
        change24hPercent,
        funding8h: assetCtx?.funding || '0',
        volume24h: assetCtx?.dayNtlVlm || '0',
        openInterest: assetCtx?.openInterest || '0',
        markPrice: mid,
        indexPrice: assetCtx?.markPx || mid,
        fundingRate: assetCtx?.funding || '0',
      };
    });
  },
);

export const useTokenListAtom = () => tokenListAtom();

export const { atom: currentTokenInfoAtom, use: useCurrentTokenInfoAtom } =
  contextAtomComputed((get): ITokenListItem | null => {
    const currentToken = get(currentTokenAtom());
    const tokenList = get(tokenListAtom());

    return tokenList.find((token) => token.coin === currentToken) || null;
  });

export const { atom: accountSummaryAtom, use: useAccountSummaryAtom } =
  contextAtomComputed((get) => {
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
  });

export const {
  atom: requiredSubscriptionsAtom,
  use: useRequiredSubscriptionsAtom,
} = contextAtomComputed((get): string[] => {
  const currentToken = get(currentTokenAtom());
  const currentUser = get(currentUserAtom());
  const subscriptions: string[] = ['allMids'];

  if (currentToken) {
    subscriptions.push(`activeAssetCtx:${currentToken}`);
    subscriptions.push(`l2Book:${currentToken}`);
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

export const { atom: currentTokenPriceAtom, use: useCurrentTokenPriceAtom } =
  contextAtomComputed((get) => {
    const activeAssetCtx = get(activeAssetCtxAtom());
    const currentToken = get(currentTokenAtom());

    if (!activeAssetCtx?.ctx || activeAssetCtx.coin !== currentToken) {
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
        isLoading: true,
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
    const change24hPercent =
      prevDayPxNum > 0
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
      isLoading: false,
      lastUpdate: Date.now(),
    };
  });

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

export const { atom: openOrdersListAtom, use: useOpenOrdersListAtom } =
  contextAtomComputed((get) => {
    const webData2 = get(webData2Atom());

    if (!webData2?.openOrders) {
      return [];
    }

    return webData2.openOrders;
  });

export const { atom: tradingPanelDataAtom, use: useTradingPanelDataAtom } =
  contextAtomComputed((get) => {
    const currentToken = get(currentTokenAtom());
    const tokenList = get(tokenListAtom());
    const activeAssetData = get(activeAssetDataAtom());
    const priceData = get(currentTokenPriceAtom());

    if (priceData.isLoading) {
      return null;
    }

    const tokenInfo = tokenList.find((token) => token.coin === currentToken);
    if (!tokenInfo) {
      return null;
    }

    return {
      ...tokenInfo,
      ...activeAssetData,
      ...priceData,
      name: currentToken,
      markPx: priceData.markPrice,
      prevDayPrice: priceData.prevDayPx,
      fundingRate: priceData.funding,
    };
  });

export const { atom: accountPanelDataAtom, use: useAccountPanelDataAtom } =
  contextAtomComputed<{
    currentUser: HL.IHex | null; // current user address in webData2 from websocket message
    isLoggedIn: boolean;
    // TODO separate low frequency data and high frequency data
    accountSummary: {
      accountValue: string | undefined;
      totalMarginUsed: string | undefined;
      totalNtlPos: string | undefined;
      totalRawUsd: string | undefined;
      withdrawable: string | undefined;
    };
    positions: HL.IAssetPosition[];
    orders: HL.IFrontendOrder[];
    activeAssetData: HL.IActiveAssetData | null;
    hasUserData: boolean;
    userWebData2: HL.IWsWebData2 | null;
  }>((get) => {
    const webData2 = get(webData2Atom());
    const activeAssetData = get(activeAssetDataAtom());
    const positions = get(positionListAtom());
    const orders = get(openOrdersListAtom());
    const currentUserInAtom = get(currentUserAtom());

    const currentUser =
      (webData2?.user === PERPS_EMPTY_ADDRESS ? null : webData2?.user) || null;

    if (
      !webData2 ||
      !currentUser ||
      !currentUserInAtom ||
      (currentUserInAtom &&
        currentUser &&
        currentUser?.toLowerCase() !== currentUserInAtom?.toLowerCase())
    ) {
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
        userWebData2: null,
      };
    }

    const isLoggedIn = !!currentUser;
    const hasUserData = isLoggedIn && !!webData2;

    const accountSummary = {
      accountValue: webData2.clearinghouseState?.marginSummary?.accountValue,
      totalMarginUsed:
        webData2.clearinghouseState?.marginSummary?.totalMarginUsed,
      totalNtlPos: webData2.clearinghouseState?.marginSummary?.totalNtlPos,
      totalRawUsd: webData2.clearinghouseState?.marginSummary?.totalRawUsd,
      withdrawable: webData2.clearinghouseState?.withdrawable,
    };

    const totalPositionValue = positions.reduce((acc: number, pos) => {
      return acc + parseFloat(pos.position?.positionValue || '0');
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
