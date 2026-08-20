import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  useHyperliquidActions,
  useOrderBookTickOptionsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getPerpsOrderBookTickOptionsWithCache } from '@onekeyhq/shared/src/utils/perpsOrderBookTickOptionsCache';
import {
  getDisplayPriceScaleDecimals,
  resolveOrderBookSizeDecimals,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IPerpOrderBookTickOptionPersist } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  type ITickParam,
  buildReferenceTickOptions,
  buildTickOptions,
  getDefaultTickOption,
  getTickOptionsDataDuringTransition,
} from './tickSizeUtils';

interface ITickOptionsResult {
  tickOptions: ITickParam[];
  defaultTickOption: ITickParam;
  selectedTickOption: ITickParam;
  setSelectedTickOption: (option: ITickParam) => void;
  priceDecimals: number;
  sizeDecimals: number;
}

const emptyTickOption: ITickParam = {
  targetTick: 0,
  nSigFigs: null,
  apiTick: 0,
  exact: true,
  multiplier: 1,
  label: '',
  value: '',
};

export function useTickOptions({
  symbol,
  bids,
  asks,
  referencePrice,
  szDecimals,
  isSpot,
}: {
  symbol?: string;
  bids: IBookLevel[];
  asks: IBookLevel[];
  referencePrice?: string;
  szDecimals?: number;
  isSpot: boolean;
}): ITickOptionsResult {
  // Use ref to cache tick options calculation results by symbol
  const tickOptionsCache = useRef<{
    symbol: string;
    tickOptions: ITickParam[];
    defaultTickOption: ITickParam;
    priceDecimals: number;
    isFallback?: boolean;
  } | null>(null);

  const [persistedTickOptions] = useOrderBookTickOptionsAtom();
  const persistedTickOptionsForRender = useMemo(
    () => getPerpsOrderBookTickOptionsWithCache(persistedTickOptions),
    [persistedTickOptions],
  );
  const actions = useHyperliquidActions();

  // Seeding makes the first write authoritative, so a seed that lands before
  // the stored preferences finish loading would permanently replace the user's
  // choice rather than transiently shadow it.
  const [hasLoadedPersistedTickOptions, setHasLoadedPersistedTickOptions] =
    useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await actions.current.ensureOrderBookTickOptionsLoaded();
      if (!cancelled) {
        setHasLoadedPersistedTickOptions(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actions]);

  const topBidPrice = bids[0]?.px;
  const topAskPrice = asks[0]?.px;
  const referenceTickOptionsData = useMemo(
    () =>
      symbol
        ? buildReferenceTickOptions({
            symbol,
            price: referencePrice,
            szDecimals,
            isSpot,
          })
        : null,
    [isSpot, referencePrice, symbol, szDecimals],
  );

  const tickOptionsData = useMemo(() => {
    if (!symbol) return null;

    const marketPrice = topBidPrice || topAskPrice || '0';
    const cached =
      tickOptionsCache.current?.symbol === symbol
        ? tickOptionsCache.current
        : null;
    if (marketPrice === '0') {
      return getTickOptionsDataDuringTransition({
        symbol,
        hasMarketData: false,
        cached,
        reference: referenceTickOptionsData,
      });
    }

    const marketTickOptionsData = buildReferenceTickOptions({
      symbol,
      price: marketPrice,
      szDecimals,
      isSpot,
    });
    if (marketTickOptionsData) {
      if (
        cached &&
        !cached.isFallback &&
        marketTickOptionsData.priceDecimals <= cached.priceDecimals
      ) {
        return cached;
      }
      tickOptionsCache.current = marketTickOptionsData;
      return marketTickOptionsData;
    }

    const priceDecimals = getDisplayPriceScaleDecimals(marketPrice);

    if (
      cached &&
      (!cached.isFallback || priceDecimals <= cached.priceDecimals)
    ) {
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
    const tickLabelDecimals =
      new BigNumber(defaultTickOption.label).decimalPlaces() ?? 0;

    // Derived without szDecimals, so it uses a different multiplier set than
    // buildReferenceTickOptions and can label the same tick with a different
    // nSigFigs. Tagged so a later reference list can displace it (OK-59102).
    const result = {
      symbol,
      tickOptions,
      defaultTickOption,
      priceDecimals: Math.max(priceDecimals, tickLabelDecimals),
      isFallback: true,
    };

    // Cache the result
    tickOptionsCache.current = result;

    return result;
  }, [
    isSpot,
    referenceTickOptionsData,
    symbol,
    szDecimals,
    topAskPrice,
    topBidPrice,
  ]);

  const sizeDecimals = useMemo(() => {
    return resolveOrderBookSizeDecimals({
      bids,
      asks,
      szDecimals,
    });
  }, [asks, bids, szDecimals]);

  const baseTickOptionsData = useMemo(() => {
    // Fallback when no data available
    if (!tickOptionsData) {
      return {
        tickOptions: [],
        defaultTickOption: emptyTickOption,
        priceDecimals: 0,
      };
    }

    return tickOptionsData;
  }, [tickOptionsData]);
  const selectedTickOption = useMemo(() => {
    const { tickOptions, defaultTickOption } = baseTickOptionsData;

    if (!symbol) return defaultTickOption;

    const saved = persistedTickOptionsForRender[symbol];
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
  }, [baseTickOptionsData, persistedTickOptionsForRender, symbol]);

  useEffect(() => {
    if (!symbol) return;
    if (!tickOptionsData) return;
    if (!hasLoadedPersistedTickOptions) return;
    // Only derive a tick option from a list built with szDecimals: without it
    // buildReferenceTickOptions bails and the fallback builder labels the same
    // tick with a different nSigFigs, which is what the two books disagreed on.
    if (!Number.isInteger(szDecimals)) return;

    // Seed-only writer. The persisted tick option is a user preference, so an
    // order book adopts it and never writes a derived correction back: two
    // books whose instance-local lists disagree on nSigFigs for the same value
    // would otherwise overwrite each other without ever converging (OK-59102).
    const persisted = persistedTickOptionsForRender[symbol];
    const currentPersist: IPerpOrderBookTickOptionPersist = {
      value: selectedTickOption.value,
      nSigFigs: selectedTickOption.nSigFigs ?? null,
      mantissa: selectedTickOption.mantissa ?? null,
    };

    if (!persisted) {
      void actions.current.setOrderBookTickOption({
        symbol,
        option: currentPersist,
        source: 'seed',
      });
    }
  }, [
    symbol,
    szDecimals,
    hasLoadedPersistedTickOptions,
    persistedTickOptionsForRender,
    selectedTickOption,
    tickOptionsData,
    actions,
  ]);

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
