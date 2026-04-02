import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';

import {
  useHyperliquidActions,
  useOrderBookTickOptionsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  analyzeOrderBookPrecision,
  getDisplayPriceScaleDecimals,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IPerpOrderBookTickOptionPersist } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  type ITickParam,
  buildTickOptions,
  getDefaultTickOption,
} from './tickSizeUtils';

interface ITickOptionsResult {
  tickOptions: ITickParam[];
  defaultTickOption: ITickParam;
  selectedTickOption: ITickParam;
  setSelectedTickOption: (option: ITickParam) => void;
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

  const [persistedTickOptions] = useOrderBookTickOptionsAtom();
  const actions = useHyperliquidActions();

  useEffect(() => {
    void actions.current.ensureOrderBookTickOptionsLoaded();
  }, [actions]);

  const topBidPrice = bids[0]?.px;
  const topAskPrice = asks[0]?.px;

  const tickOptionsData = useMemo(() => {
    if (!symbol) return null;

    const marketPrice = topBidPrice || topAskPrice || '0';
    if (marketPrice === '0') return null;

    const priceDecimals = getDisplayPriceScaleDecimals(marketPrice);
    const cached =
      tickOptionsCache.current?.symbol === symbol
        ? tickOptionsCache.current
        : null;

    if (cached && priceDecimals <= cached.priceDecimals) {
      return cached;
    }

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

  const baseTickOptionsData = useMemo(() => {
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
      };
    }

    return tickOptionsData;
  }, [tickOptionsData]);

  const selectedTickOption = useMemo(() => {
    const { tickOptions, defaultTickOption } = baseTickOptionsData;

    if (!symbol) return defaultTickOption;

    const saved = persistedTickOptions[symbol];
    if (saved) {
      const byValue = tickOptions.find(
        (option) => option.value === saved.value,
      );
      if (byValue) return byValue;

      const byParams = tickOptions.find(
        (option) =>
          option.nSigFigs === saved.nSigFigs &&
          (option.nSigFigs === 5 ? option.mantissa === saved.mantissa : true),
      );

      if (byParams) {
        return byParams;
      }
    }

    return defaultTickOption;
  }, [baseTickOptionsData, persistedTickOptions, symbol]);

  useEffect(() => {
    if (!symbol) return;

    const persisted = persistedTickOptions[symbol];
    const currentPersist: IPerpOrderBookTickOptionPersist = {
      value: selectedTickOption.value,
      nSigFigs: selectedTickOption.nSigFigs ?? null,
      mantissa: selectedTickOption.mantissa ?? null,
    };

    if (
      !persisted ||
      persisted.value !== currentPersist.value ||
      persisted.nSigFigs !== currentPersist.nSigFigs ||
      persisted.mantissa !== currentPersist.mantissa
    ) {
      void actions.current.setOrderBookTickOption({
        symbol,
        option: currentPersist,
      });
    }
  }, [symbol, persistedTickOptions, selectedTickOption, actions]);

  const handleSelectTickOption = useCallback(
    (option: ITickParam) => {
      if (!symbol) return;
      if (
        option.value === selectedTickOption.value &&
        option.nSigFigs === selectedTickOption.nSigFigs &&
        option.mantissa === selectedTickOption.mantissa
      ) {
        return;
      }

      void actions.current.setOrderBookTickOption({
        symbol,
        option: {
          value: option.value,
          nSigFigs: option.nSigFigs ?? null,
          mantissa: option.mantissa ?? null,
        },
      });
    },
    [actions, selectedTickOption, symbol],
  );

  return useMemo(() => {
    return {
      tickOptions: baseTickOptionsData.tickOptions,
      defaultTickOption: baseTickOptionsData.defaultTickOption,
      selectedTickOption,
      setSelectedTickOption: handleSelectTickOption,
      priceDecimals: baseTickOptionsData.priceDecimals,
      sizeDecimals,
    };
  }, [
    baseTickOptionsData,
    selectedTickOption,
    handleSelectTickOption,
    sizeDecimals,
  ]);
}
