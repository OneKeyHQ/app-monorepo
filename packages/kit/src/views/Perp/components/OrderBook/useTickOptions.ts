import { useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import {
  analyzeOrderBookPrecision,
  getDisplayPriceScaleDecimals,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  type ITickParam,
  buildTickOptions,
  getDefaultTickOption,
} from './tickSizeUtils';

interface ITickOptionsResult {
  tickOptions: ITickParam[];
  defaultTickOption: ITickParam;
  priceDecimals: number;
  sizeDecimals: number;
}

export function useTickOptions({
  symbol,
  bids,
  asks,
}: {
  symbol?: string;
  bids: IBookLevel[];
  asks: IBookLevel[];
}): ITickOptionsResult {
  // Use ref to cache tick options calculation results by symbol
  const tickOptionsCache = useRef<{
    symbol: string;
    tickOptions: ITickParam[];
    defaultTickOption: ITickParam;
    priceDecimals: number;
  } | null>(null);

  const topBidPrice = bids[0]?.px;
  const topAskPrice = asks[0]?.px;

  const tickOptionsData = useMemo(() => {
    if (!symbol) return null;

    // Return cached result if symbol hasn't changed and cache exists
    if (tickOptionsCache.current?.symbol === symbol) {
      return tickOptionsCache.current;
    }

    const marketPrice = topBidPrice || topAskPrice || '0';
    if (marketPrice === '0') return null;

    const priceDecimals = getDisplayPriceScaleDecimals(marketPrice);

    // Handle edge case: when priceDecimals = 0, use 1 as base decimal
    const decimalsArg =
      priceDecimals === 0
        ? 0
        : new BigNumber(10).pow(-priceDecimals).toNumber();
    const tickOptions = buildTickOptions(parseFloat(marketPrice), decimalsArg);

    // Use selected option or default
    const defaultTickOption = getDefaultTickOption(tickOptions);

    const result = {
      symbol,
      tickOptions,
      defaultTickOption,
      priceDecimals,
    };

    // Cache the result
    tickOptionsCache.current = result;

    return result;
  }, [symbol, topBidPrice, topAskPrice]);

  // Calculate size decimals separately as it may need to update more frequently
  const sizeDecimals = useMemo(() => {
    const { sizeDecimals: calculatedSizeDecimals } = analyzeOrderBookPrecision(
      bids,
      asks,
    );
    return calculatedSizeDecimals;
  }, [bids, asks]);

  return useMemo(() => {
    // Fallback when no data available
    if (!tickOptionsData) {
      const priceDecimals = 0;
      const decimalsArg = 0;
      const tickOptions = buildTickOptions(1, decimalsArg);
      const defaultTickOption = getDefaultTickOption(tickOptions);

      return {
        tickOptions,
        defaultTickOption,
        priceDecimals,
        sizeDecimals,
      };
    }

    return {
      ...tickOptionsData,
      sizeDecimals,
    };
  }, [tickOptionsData, sizeDecimals]);
}
