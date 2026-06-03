import { useEffect, useMemo, useRef, useState } from 'react';

import {
  useActiveTradeInstrumentAtom,
  useL2BookAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  getPerpsMarketDataLocalReceivedAt,
  withPerpsL2BookLocalReceivedAt,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import { PERPS_L2_BOOK_SWR_CACHE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  getPerpsL2BookSnapshotCacheKeys,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  getPerpsL2BookInteractiveRefreshDelayMs,
  isPerpsL2BookInteractive,
} from '../utils/l2BookFreshness';

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
  localReceivedAt?: number;
}

export function getFreshL2BookSnapshotFromSwr({
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
      return withPerpsL2BookLocalReceivedAt(entry.data, entry.updatedAt);
    }
  }

  return undefined;
}

export function normalizeL2BookData({
  bookData,
  expectedCoin,
}: {
  bookData: HL.IBook | null | undefined;
  expectedCoin: string | undefined;
}): IL2BookData | null {
  if (!bookData || !expectedCoin) return null;
  if (bookData.coin !== expectedCoin) return null;

  const [bids, asks] = bookData.levels || [[], []];

  return {
    coin: bookData.coin,
    time: bookData.time,
    levels: bookData.levels,
    localReceivedAt: getPerpsMarketDataLocalReceivedAt(bookData),
    bids: bids || [],
    asks: asks || [],
  };
}

export function useL2Book(options?: IL2BookOptions): {
  l2Book: IL2BookData | null;
  hasOrderBook: boolean;
  isOrderBookInteractive: boolean;
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
  const normalizedNSigFigs = nSigFigs ?? null;
  const normalizedMantissa = mantissa ?? null;
  const [, refreshL2BookInteractivity] = useState(0);
  const lastL2BookRef = useRef<
    | {
        coin: string;
        nSigFigs: number | null;
        mantissa: number | null;
        data: HL.IBook;
      }
    | undefined
  >(undefined);

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
    const lastL2Book = lastL2BookRef.current;
    if (
      !bookData &&
      lastL2Book?.coin === expectedCoin &&
      lastL2Book.nSigFigs === normalizedNSigFigs &&
      lastL2Book.mantissa === normalizedMantissa
    ) {
      bookData = lastL2Book.data;
    }
    return normalizeL2BookData({ bookData, expectedCoin });
  }, [
    expectedCoin,
    l2BookData,
    mantissa,
    nSigFigs,
    normalizedMantissa,
    normalizedNSigFigs,
  ]);

  useEffect(() => {
    if (!l2Book) {
      return;
    }
    lastL2BookRef.current = {
      coin: l2Book.coin,
      nSigFigs: normalizedNSigFigs,
      mantissa: normalizedMantissa,
      data: l2Book,
    };
  }, [l2Book, normalizedMantissa, normalizedNSigFigs]);

  const isOrderBookInteractive = isPerpsL2BookInteractive({
    bookTime: l2Book?.time,
    bookReceivedAt: l2Book?.localReceivedAt,
  });

  useEffect(() => {
    const refreshDelayMs = getPerpsL2BookInteractiveRefreshDelayMs({
      bookTime: l2Book?.time,
      bookReceivedAt: l2Book?.localReceivedAt,
    });
    if (refreshDelayMs === undefined) {
      return undefined;
    }

    const timer = setTimeout(() => {
      refreshL2BookInteractivity((value) => value + 1);
    }, refreshDelayMs);

    return () => clearTimeout(timer);
  }, [l2Book?.localReceivedAt, l2Book?.time]);

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
    isOrderBookInteractive,
    isMarketDataStale: !isOrderBookInteractive,
    lastUpdate: l2Book?.localReceivedAt ?? null,
    getBestBid,
    getBestAsk,
    getSpread,
    getSpreadPercent,
    getTotalBidVolume,
    getTotalAskVolume,
  };
}
