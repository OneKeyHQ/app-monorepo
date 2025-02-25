import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  useSwapLimitPriceMarketPriceAtom,
  useSwapLimitPriceRateReverseAtom,
  useSwapLimitPriceUseRateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import { validateAmountInputInfiniteDecimal } from '../utils/utils';

export const useSwapLimitRate = () => {
  const [limitPriceUseRate, setLimitPriceUseRate] =
    useSwapLimitPriceUseRateAtom();
  const [limitPriceSetReverse, setLimitPriceSetReverse] =
    useSwapLimitPriceRateReverseAtom();
  const [limitPriceMarketPrice] = useSwapLimitPriceMarketPriceAtom();

  const onLimitRateChange = useCallback(
    (text: string) => {
      const isValidate = validateAmountInputInfiniteDecimal(text);
      if (isValidate) {
        const inputRate = new BigNumber(text);
        if (text === '' || inputRate.isNaN() || inputRate.isZero()) {
          setLimitPriceUseRate({
            ...limitPriceUseRate,
            rate: '0',
            reverseRate: '0',
            inputRate: text,
          });
        } else {
          const newRate = limitPriceSetReverse
            ? new BigNumber(1).div(inputRate)
            : inputRate;
          const newReverseRate = limitPriceSetReverse
            ? inputRate
            : new BigNumber(1).div(inputRate);
          let newReverseRateValue = newReverseRate.toFixed();
          let newRateValue = newRate.toFixed();
          if (!limitPriceSetReverse) {
            const newReverseRateFormat = formatBalance(
              newReverseRate.toFixed(),
            );
            newReverseRateValue =
              newReverseRateFormat.meta.roundValue ??
              newReverseRateFormat.meta.value;
            if (newReverseRateFormat.meta.unit) {
              newReverseRateValue = newReverseRateFormat.meta.value;
            }
          } else {
            const newRateFormat = formatBalance(newRate.toFixed());
            newRateValue =
              newRateFormat.meta.roundValue ?? newRateFormat.meta.value;
            if (newRateFormat.meta.unit) {
              newRateValue = newRateFormat.meta.value;
            }
          }
          setLimitPriceUseRate({
            ...limitPriceUseRate,
            rate: newRateValue,
            reverseRate: newReverseRateValue,
            inputRate: text,
          });
        }
      }
    },
    [limitPriceSetReverse, limitPriceUseRate, setLimitPriceUseRate],
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

  const onSetMarketPrice = useCallback(
    (percentage: number) => {
      const percentageBN = new BigNumber(1 + percentage / 100);
      const rateBN = new BigNumber(
        limitPriceMarketPrice.rate ?? '0',
      ).multipliedBy(percentageBN);
      const reverseRateBN = new BigNumber(1).div(rateBN);
      const formatRate = formatBalance(rateBN.toFixed());
      const formatReverseRate = formatBalance(reverseRateBN.toFixed());
      let rateValue = formatRate.meta.roundValue ?? formatRate.meta.value;
      let reverseRateValue =
        formatReverseRate.meta.roundValue ?? formatReverseRate.meta.value;
      if (formatRate.meta.unit) {
        rateValue = formatRate.meta.value;
      }
      if (formatReverseRate.meta.unit) {
        reverseRateValue = formatReverseRate.meta.value;
      }
      setLimitPriceUseRate({
        ...limitPriceMarketPrice,
        rate: rateValue,
        reverseRate: reverseRateValue,
        inputRate: limitPriceSetReverse ? reverseRateValue : rateValue,
      });
    },
    [setLimitPriceUseRate, limitPriceMarketPrice, limitPriceSetReverse],
  );

  const onChangeReverse = useCallback(
    (reverse: boolean) => {
      setLimitPriceSetReverse(reverse);
      setLimitPriceUseRate({
        ...limitPriceUseRate,
        inputRate: reverse
          ? limitPriceUseRate.reverseRate
          : limitPriceUseRate.rate,
      });
    },
    [setLimitPriceSetReverse, setLimitPriceUseRate, limitPriceUseRate],
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
          inputRate: limitPriceSetReverse
            ? limitPriceMarketPrice.reverseRate
            : limitPriceMarketPrice.rate,
        });
        setLimitPriceSetReverse(false);
      }
    }
  }, [
    limitPriceMarketPrice,
    limitPriceSetReverse,
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
