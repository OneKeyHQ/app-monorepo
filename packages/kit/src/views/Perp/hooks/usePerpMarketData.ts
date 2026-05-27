import { useMemo } from 'react';

import {
  useActiveTradeInstrumentAtom,
  useL2BookAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  getPerpsL2BookSnapshotCacheKeys,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import { usePerpsMarketDataFreshness } from './usePerpsMarketDataFreshness';

export interface IPerpMarketDataReturn {
  currentTokenData: any | null;
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
}

export interface ICurrentTokenData {
  name: string;
  assetId: number | undefined;
  szDecimals: number;
  markPx?: string;
  oraclePx?: string;
  dayNtlVlm?: string;
  openInterest?: string;
  funding?: string;
  prevDayPx?: string;
  maxLeverage?: number;
}

export interface IL2BookData extends HL.IBook {
  bids: HL.IBookLevel[];
  asks: HL.IBookLevel[];
}

function getFreshL2BookSnapshotFromSwr({
  coin,
  options,
}: {
  coin: string;
  options?: IL2BookOptions;
}) {
  const keys = getPerpsL2BookSnapshotCacheKeys({
    coin,
    nSigFigs: options?.nSigFigs,
    mantissa: options?.mantissa,
  });

  for (const key of keys) {
    const entry = swrCacheUtils.getWithTimestamp<HL.IBook>(key);
    if (
      entry?.data?.coin === coin &&
      Date.now() - entry.updatedAt <= PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS
    ) {
      return entry.data;
    }
  }

  return undefined;
}

export function useL2Book(options?: IL2BookOptions): {
  l2Book: IL2BookData | null;
  hasOrderBook: boolean;
  isMarketDataStale: boolean;
  lastUpdate: number | null;
  getBestBid: () => string | null;
  getBestAsk: () => string | null;
  getSpread: () => number | null;
  getSpreadPercent: () => number | null;
  getTotalBidVolume: (levels?: number) => number;
  getTotalAskVolume: (levels?: number) => number;
} {
  const [l2BookData] = useL2BookAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const expectedCoin = activeTradeInstrument.coin;
  const nSigFigs = options?.nSigFigs;
  const mantissa = options?.mantissa;
  const marketDataFreshness = usePerpsMarketDataFreshness();

  const l2Book = useMemo((): IL2BookData | null => {
    let bookData: HL.IBook | null | undefined;
    if (l2BookData?.coin === expectedCoin) {
      bookData = l2BookData;
    } else if (expectedCoin) {
      bookData = getFreshL2BookSnapshotFromSwr({
        coin: expectedCoin,
        options: {
          nSigFigs,
          mantissa,
        },
      });
    }
    if (!bookData || !expectedCoin) return null;
    if (bookData.coin !== expectedCoin) return null;

    const [bids, asks] = bookData.levels || [[], []];

    return {
      coin: bookData.coin,
      time: bookData.time,
      levels: bookData.levels,
      bids: bids || [],
      asks: asks || [],
    };
  }, [expectedCoin, l2BookData, mantissa, nSigFigs]);

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
    isMarketDataStale: marketDataFreshness.isStale,
    lastUpdate: marketDataFreshness.lastMessageAt,
    getBestBid,
    getBestAsk,
    getSpread,
    getSpreadPercent,
    getTotalBidVolume,
    getTotalAskVolume,
  };
}
