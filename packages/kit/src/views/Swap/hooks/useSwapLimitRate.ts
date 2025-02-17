import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  useSwapLimitPriceMarketPriceAtom,
  useSwapLimitPriceRateReverseAtom,
  useSwapLimitPriceUseRateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import { validateAmountInputNoDecimal } from '../utils/utils';

export const useSwapLimitRate = () => {
  const [limitPriceUseRate, setLimitPriceUseRate] =
    useSwapLimitPriceUseRateAtom();
  const [limitPriceSetReverse, setLimitPriceSetReverse] =
    useSwapLimitPriceRateReverseAtom();
  const [limitPriceMarketPrice] = useSwapLimitPriceMarketPriceAtom();

  const onLimitRateChange = useCallback(
    (text: string) => {
      if (validateAmountInputNoDecimal(text)) {
        const newRate = new BigNumber(text);
        const newReverseRate = new BigNumber(1).div(newRate);
        const newReverseRateFormat = formatBalance(newReverseRate.toFixed());
        setLimitPriceUseRate({
          ...limitPriceUseRate,
          rate: newRate.toFixed(),
          reverseRate: newReverseRateFormat.formattedValue,
        });
      }
    },
    [limitPriceUseRate, setLimitPriceUseRate],
  );

  const limitPriceMarketRate = useMemo(
    () =>
      limitPriceSetReverse
        ? limitPriceMarketPrice.reverseRate
        : limitPriceMarketPrice.rate,
    [
      limitPriceMarketPrice.rate,
      limitPriceMarketPrice.reverseRate,
      limitPriceSetReverse,
    ],
  );

  const limitPriceEqualMarketPrice = useMemo(
    () =>
      new BigNumber(limitPriceUseRate.rate ?? '0').eq(
        new BigNumber(limitPriceMarketPrice.rate ?? '0'),
      ),
    [limitPriceMarketPrice.rate, limitPriceUseRate.rate],
  );

  const onSetMarketPrice = useCallback(() => {
    if (!limitPriceEqualMarketPrice) {
      setLimitPriceUseRate({
        ...limitPriceMarketPrice,
      });
    }
  }, [limitPriceEqualMarketPrice, setLimitPriceUseRate, limitPriceMarketPrice]);

  const onChangeReverse = useCallback(
    (reverse: boolean) => {
      setLimitPriceSetReverse(reverse);
    },
    [setLimitPriceSetReverse],
  );

  useEffect(() => {
    if (limitPriceMarketPrice.fromTokenMarketPrice) {
      const { fromToken, toToken, provider } = limitPriceUseRate;
      const {
        fromToken: fromTokenMarket,
        toToken: toTokenMarket,
        provider: providerMarket,
      } = limitPriceMarketPrice;
      if (
        !equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: fromTokenMarket,
        }) ||
        !equalTokenNoCaseSensitive({
          token1: toToken,
          token2: toTokenMarket,
        }) ||
        provider !== providerMarket
      ) {
        setLimitPriceUseRate({
          ...limitPriceMarketPrice,
        });
        setLimitPriceSetReverse(false);
      }
    }
  }, [
    limitPriceMarketPrice,
    limitPriceUseRate,
    setLimitPriceSetReverse,
    setLimitPriceUseRate,
  ]);

  useEffect(() => {
    if (!limitPriceMarketPrice.rate) {
      setLimitPriceUseRate({});
      setLimitPriceSetReverse(false);
    }
  }, [
    limitPriceMarketPrice.rate,
    setLimitPriceSetReverse,
    setLimitPriceUseRate,
  ]);

  return {
    onLimitRateChange,
    limitPriceEqualMarketPrice,
    limitPriceMarketRate,
    onSetMarketPrice,
    onChangeReverse,
    limitPriceSetReverse,
    limitPriceUseRate,
    limitPriceMarketPrice,
  };
};
