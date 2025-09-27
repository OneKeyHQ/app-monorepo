import { useEffect, useMemo, useRef } from 'react';

import {
  useHyperliquidActions,
  useL2BookAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import type * as HL from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

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

export function useL2Book(options?: IL2BookOptions): {
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
  const [currentToken] = usePerpsActiveAssetAtom();
  const actions = useHyperliquidActions();
  const prevOptionsRef = useRef<typeof options>(undefined);

  // Monitor precision parameter changes and trigger resubscription
  useEffect(() => {
    const currentOptions = options;
    const prevOptions = prevOptionsRef.current;

    // Check if nSigFigs or mantissa have changed
    const hasChanged =
      currentOptions?.nSigFigs !== prevOptions?.nSigFigs ||
      currentOptions?.mantissa !== prevOptions?.mantissa;

    if (hasChanged && currentToken.coin) {
      // Cancel current subscription and establish new one with updated parameters
      const resubscribe = async () => {
        try {
          // Update subscription with new precision parameters
          await actions.current.updateL2BookSubscription(
            currentOptions || undefined,
          );
        } catch (error) {
          console.error('Failed to update L2Book subscription:', error);
          // Fallback to general subscription update
          await actions.current.updateSubscriptions();
        }
      };

      void resubscribe();
    }

    prevOptionsRef.current = currentOptions;
  }, [
    options?.nSigFigs,
    options?.mantissa,
    currentToken.coin,
    actions,
    options,
  ]);

  const l2Book = useMemo((): IL2BookData | null => {
    if (!l2BookData || !currentToken.coin) return null;

    const [bids, asks] = l2BookData.levels || [[], []];

    return {
      coin: l2BookData.coin,
      time: l2BookData.time,
      levels: l2BookData.levels,
      bids: bids || [],
      asks: asks || [],
    };
  }, [l2BookData, currentToken.coin]);

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
