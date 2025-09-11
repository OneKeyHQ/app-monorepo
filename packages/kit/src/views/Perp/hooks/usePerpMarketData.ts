import { useMemo } from 'react';

import {
  useActiveAssetCtxAtom,
  useActiveAssetDataAtom,
  useAllMidsAtom,
  useCurrentTokenAtom,
  useL2BookAtom,
  useTradingPanelDataAtom,
  useWebData2Atom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';

import { formatAssetCtx } from '../utils/formatData';

import type { PerpsUniverse } from '@nktkas/hyperliquid';

export interface IPerpMarketDataReturn {
  currentTokenData: any | null;
  allMids: any | null;
  markPrice: string;
  oraclePrice: string;
  volume24h: string;
  openInterest: string;
  fundingRate: string;
  prevDayPrice: string;
  change24hPercent: number;
  hasMarketData: boolean;
  isMarketDataStale: boolean;
  lastUpdate: number | null;
  getTokenPrice: (symbol: string) => string | null;
}

export interface ICurrentTokenData {
  name: string;
  assetId: number;
  szDecimals: number;
  markPx?: string;
  oraclePx?: string;
  dayNtlVlm?: string;
  openInterest?: string;
  funding?: string;
  prevDayPx?: string;
  leverage?: {
    value: number;
  };
  maxLeverage?: number;
  maxTradeSzs?: number[];
}

export function usePerpMarketData(): IPerpMarketDataReturn {
  const [allMids] = useAllMidsAtom();
  const [activeAsset] = useActiveAssetCtxAtom();
  const [currentToken] = useCurrentTokenAtom();

  const currentTokenData = useMemo(() => {
    if (!currentToken) return null;
    return activeAsset?.ctx;
  }, [activeAsset, currentToken]);

  const marketPrices = useMemo(() => {
    const data = currentTokenData;
    const markPrice = data?.markPx || '0';
    const oraclePrice = data?.oraclePx || '0';

    return { markPrice, oraclePrice };
  }, [currentTokenData]);

  const marketStats = useMemo(() => {
    const data = currentTokenData;
    const volume24h = data?.dayNtlVlm || '0';
    const openInterest = data?.openInterest || '0';
    const fundingRate = data?.funding || '0';
    const prevDayPrice = data?.prevDayPx || '0';

    const markPrice = parseFloat(marketPrices.markPrice);
    const prevPrice = parseFloat(prevDayPrice);
    const change24hPercent =
      prevPrice > 0 ? ((markPrice - prevPrice) / prevPrice) * 100 : 0;

    return {
      volume24h,
      openInterest,
      fundingRate,
      prevDayPrice,
      change24hPercent,
    };
  }, [currentTokenData, marketPrices]);

  const dataStatus = useMemo(() => {
    const hasMarketData = currentTokenData !== null;
    const lastUpdate = hasMarketData ? Date.now() : null;
    const isMarketDataStale =
      hasMarketData && lastUpdate ? Date.now() - lastUpdate > 30_000 : false;

    return {
      hasMarketData,
      isMarketDataStale,
      lastUpdate,
    };
  }, [currentTokenData]);

  const getTokenPrice = (symbol: string): string | null => {
    if (!allMids || !allMids?.mids) return null;

    const mids = allMids.mids;
    return mids[symbol] || null;
  };

  return {
    currentTokenData,
    allMids,
    markPrice: marketPrices.markPrice,
    oraclePrice: marketPrices.oraclePrice,
    volume24h: marketStats.volume24h,
    openInterest: marketStats.openInterest,
    fundingRate: marketStats.fundingRate,
    prevDayPrice: marketStats.prevDayPrice,
    change24hPercent: marketStats.change24hPercent,
    hasMarketData: dataStatus.hasMarketData,
    isMarketDataStale: dataStatus.isMarketDataStale,
    lastUpdate: dataStatus.lastUpdate,
    getTokenPrice,
  };
}

export function useCurrentTokenData(): ICurrentTokenData | null {
  const [tradingData] = useTradingPanelDataAtom();
  const [currentToken] = useCurrentTokenAtom();
  const [webData2] = useWebData2Atom();
  const [activeAssetData] = useActiveAssetDataAtom();

  if (!tradingData || !currentToken || !webData2) {
    return null;
  }

  const universe = webData2.meta?.universe || [];
  const assetId = universe.findIndex((token) => token.name === currentToken);
  const tokenFromUniverse: PerpsUniverse | undefined = universe[assetId];

  return {
    ...tradingData,
    name: currentToken,
    assetId,
    szDecimals: tokenFromUniverse?.szDecimals || 2,
    maxLeverage: tokenFromUniverse?.maxLeverage,
    maxTradeSzs: activeAssetData?.maxTradeSzs
      ? [
          Number(activeAssetData.maxTradeSzs[0]),
          Number(activeAssetData.maxTradeSzs[1]),
        ]
      : [0, 0],
  };
}

export function useTokenList() {
  const [webData2] = useWebData2Atom();

  if (!webData2) return { data: [], getTokenInfo: () => null };

  const assetCtxs = webData2.assetCtxs || [];
  const universe = webData2.meta?.universe || [];
  const data = assetCtxs.map((assetCtx, index) => {
    const _universe = universe[index];
    return {
      ..._universe,
      ...formatAssetCtx(assetCtx),
      assetId: index,
    };
  });

  const getTokenInfo = (symbol: string) => {
    return data.find((item) => item.name === symbol);
  };

  return {
    data,
    getTokenInfo,
  };
}

export interface IL2BookData extends HL.IBook {
  bids: HL.IBookLevel[];
  asks: HL.IBookLevel[];
}

export function useL2Book(): {
  l2Book: IL2BookData | null;
  hasOrderBook: boolean;
  getBestBid: () => string | null;
  getBestAsk: () => string | null;
  getSpread: () => number | null;
  getSpreadPercent: () => number | null;
  getTotalBidVolume: (levels?: number) => number;
  getTotalAskVolume: (levels?: number) => number;
} {
  const [l2BookData] = useL2BookAtom();
  const [currentToken] = useCurrentTokenAtom();

  const l2Book = useMemo((): IL2BookData | null => {
    if (!l2BookData || !currentToken) return null;

    const [bids, asks] = l2BookData.levels || [[], []];

    return {
      coin: l2BookData.coin,
      time: l2BookData.time,
      levels: l2BookData.levels,
      bids: bids || [],
      asks: asks || [],
    };
  }, [l2BookData, currentToken]);

  const getBestBid = (): string | null => {
    if (!l2Book?.bids || l2Book.bids.length === 0) return null;
    return l2Book.bids[0]?.px || null;
  };

  const getBestAsk = (): string | null => {
    if (!l2Book?.asks || l2Book.asks.length === 0) return null;
    return l2Book.asks[0]?.px || null;
  };

  const getSpread = (): number | null => {
    const bestBid = getBestBid();
    const bestAsk = getBestAsk();

    if (!bestBid || !bestAsk) return null;

    return parseFloat(bestAsk) - parseFloat(bestBid);
  };

  const getSpreadPercent = (): number | null => {
    const spread = getSpread();
    const bestAsk = getBestAsk();

    if (spread === null || !bestAsk) return null;

    return (spread / parseFloat(bestAsk)) * 100;
  };

  const getTotalBidVolume = (levels = 5): number => {
    if (!l2Book?.bids) return 0;

    return l2Book.bids
      .slice(0, levels)
      .reduce((total, level) => total + parseFloat(level.sz), 0);
  };

  const getTotalAskVolume = (levels = 5): number => {
    if (!l2Book?.asks) return 0;

    return l2Book.asks
      .slice(0, levels)
      .reduce((total, level) => total + parseFloat(level.sz), 0);
  };

  return {
    l2Book,
    hasOrderBook: !!l2Book,
    getBestBid,
    getBestAsk,
    getSpread,
    getSpreadPercent,
    getTotalBidVolume,
    getTotalAskVolume,
  };
}
