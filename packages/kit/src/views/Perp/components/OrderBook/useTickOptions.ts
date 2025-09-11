import { useMemo } from 'react';

import {
  analyzeOrderBookPrecision,
  getPriceScaleDecimals,
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

export function useTickOptions(
  bids: IBookLevel[],
  asks: IBookLevel[],
): ITickOptionsResult {
  return useMemo(() => {
    const marketPrice = bids[0]?.px || asks[0]?.px || '0';
    const priceDecimals = getPriceScaleDecimals(marketPrice);

    // Handle edge case: when priceDecimals = 0, use 1 as base decimal
    const baseDecimal = priceDecimals > 0 ? 10 ** -priceDecimals : 1;
    const tickOptions = buildTickOptions(parseFloat(marketPrice), baseDecimal);

    // Use selected option or default
    const defaultTickOption = getDefaultTickOption(tickOptions);

    // Analyze size decimal places from raw data
    const { sizeDecimals } = analyzeOrderBookPrecision(bids, asks);

    return {
      tickOptions,
      defaultTickOption,
      priceDecimals,
      sizeDecimals,
    };
  }, [bids, asks]);
}
