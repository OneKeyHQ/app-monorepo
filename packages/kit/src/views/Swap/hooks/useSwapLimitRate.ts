import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import {
  useSwapActions,
  useSwapLimitPriceMarketPriceAtom,
  useSwapLimitPriceRateReverseAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapProTradeTypeAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
  LimitMarketUpPercentages,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapProInputToken, useSwapProToToken } from './useSwapPro';

export const useSwapLimitRate = () => {
  const [limitPriceUseRate, setLimitPriceUseRate] =
    useSwapLimitPriceUseRateAtom();
  const [limitPriceSetReverse, setLimitPriceSetReverse] =
    useSwapLimitPriceRateReverseAtom();
  const [limitPriceMarketPrice] = useSwapLimitPriceMarketPriceAtom();
  const [swapTypeSwitchValue] = useSwapTypeSwitchAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [fromSelectTokenSwap] = useSwapSelectFromTokenAtom();
  const [toSelectTokenSwap] = useSwapSelectToTokenAtom();
  const fromSelectTokenPro = useSwapProInputToken();
  const toSelectTokenPro = useSwapProToToken();
  const [, setInAppNotification] = useInAppNotificationAtom();
  const {
    limitOrderMarketPriceIntervalAction,
    cleanLimitOrderMarketPriceInterval,
  } = useSwapActions().current;

  const fromSelectToken = useMemo(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapProTradeType === ESwapProTradeType.LIMIT
    ) {
      return fromSelectTokenPro;
    }
    return fromSelectTokenSwap;
  }, [
    fromSelectTokenPro,
    fromSelectTokenSwap,
    swapProTradeType,
    swapTypeSwitchValue,
  ]);
  const toSelectToken = useMemo(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapProTradeType === ESwapProTradeType.LIMIT
    ) {
      return toSelectTokenPro;
    }
    return toSelectTokenSwap;
  }, [
    toSelectTokenPro,
    toSelectTokenSwap,
    swapProTradeType,
    swapTypeSwitchValue,
  ]);
  const fromSelectTokenRef = useRef<ISwapToken | undefined>(fromSelectToken);
  const toSelectTokenRef = useRef<ISwapToken | undefined>(toSelectToken);
  if (fromSelectTokenRef.current !== fromSelectToken) {
    fromSelectTokenRef.current = fromSelectToken;
  }
  if (toSelectTokenRef.current !== toSelectToken) {
    toSelectTokenRef.current = toSelectToken;
  }
  const onLimitRateChange = useCallback(
    (text: string) => {
      const isValidate = validateAmountInput(
        text,
        limitPriceSetReverse
          ? limitPriceMarketPrice.fromToken?.decimals
          : limitPriceMarketPrice.toToken?.decimals,
      );
      if (isValidate) {
        const inputRate = new BigNumber(text);
        if (text === '' || inputRate.isNaN() || inputRate.isZero()) {
          setLimitPriceUseRate((v) => ({
            ...v,
            rate: '0',
            reverseRate: '0',
            inputRate: text,
          }));
        } else {
          const inputBN = new BigNumber(inputRate);
          const newRate = limitPriceSetReverse
            ? new BigNumber(1).div(inputBN)
            : inputBN;
          const newReverseRate = limitPriceSetReverse
            ? inputBN
            : new BigNumber(1).div(inputBN);
          const newReverseRateValue = newReverseRate
            .decimalPlaces(
              limitPriceMarketPrice.fromToken?.decimals ?? 0,
              BigNumber.ROUND_HALF_UP,
            )
            .toFixed();
          const newRateValue = newRate
            .decimalPlaces(
              limitPriceMarketPrice.toToken?.decimals ?? 0,
              BigNumber.ROUND_HALF_UP,
            )
            .toFixed();
          setLimitPriceUseRate((v) => ({
            ...v,
            rate: newRateValue,
            reverseRate: newReverseRateValue,
            inputRate: text,
          }));
        }
      }
    },
    [
      limitPriceMarketPrice.fromToken?.decimals,
      limitPriceMarketPrice.toToken?.decimals,
      limitPriceSetReverse,
      setLimitPriceUseRate,
    ],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const limitOrderMarketPriceIntervalDeb = useCallback(
    debounce(() => {
      void limitOrderMarketPriceIntervalAction(
        fromSelectTokenRef.current,
        toSelectTokenRef.current,
      );
    }, 300),
    [],
  );

  useEffect(() => {
    void limitOrderMarketPriceIntervalDeb();
  }, [
    swapTypeSwitchValue,
    fromSelectToken,
    toSelectToken,
    limitOrderMarketPriceIntervalDeb,
  ]);

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

  const limitPriceEqualMarketPrice = useMemo(() => {
    const equalResult = LimitMarketUpPercentages.map((percentage) => {
      const percentageBN = new BigNumber(1 + percentage / 100);
      const priceMarketBN = new BigNumber(limitPriceMarketPrice.rate ?? '0');
      const useRateBN = new BigNumber(limitPriceUseRate.rate ?? '0');
      const rateBN = priceMarketBN.multipliedBy(percentageBN);
      const formatRate = rateBN.decimalPlaces(
        limitPriceMarketPrice.toToken?.decimals ?? 0,
        BigNumber.ROUND_HALF_UP,
      );
      const limitPriceEqualMarket = useRateBN.eq(formatRate);
      return {
        percentage,
        equal:
          priceMarketBN.isZero() || useRateBN.isZero()
            ? false
            : limitPriceEqualMarket,
      };
    });
    return equalResult;
  }, [
    limitPriceMarketPrice.rate,
    limitPriceMarketPrice.toToken?.decimals,
    limitPriceUseRate.rate,
  ]);

  const onSetMarketPrice = useCallback(
    (percentage: number) => {
      const percentageBN = new BigNumber(1 + percentage / 100);
      const rateBN = new BigNumber(
        limitPriceMarketPrice.rate ?? '0',
      ).multipliedBy(percentageBN);
      const reverseRateBN = rateBN.isZero()
        ? new BigNumber(0)
        : new BigNumber(1).div(rateBN);
      const formatRate = rateBN.decimalPlaces(
        limitPriceMarketPrice.toToken?.decimals ?? 0,
        BigNumber.ROUND_HALF_UP,
      );
      const formatReverseRate = reverseRateBN.decimalPlaces(
        limitPriceMarketPrice.fromToken?.decimals ?? 0,
        BigNumber.ROUND_HALF_UP,
      );
      setLimitPriceUseRate((v) => ({
        ...v,
        rate: formatRate.toFixed(),
        reverseRate: formatReverseRate.toFixed(),
        inputRate: limitPriceSetReverse
          ? formatReverseRate.toFixed()
          : formatRate.toFixed(),
      }));
    },
    [setLimitPriceUseRate, limitPriceMarketPrice, limitPriceSetReverse],
  );

  const onChangeReverse = useCallback(
    (reverse: boolean) => {
      setLimitPriceSetReverse(reverse);
      setLimitPriceUseRate((v) => ({
        ...v,
        inputRate: reverse
          ? limitPriceUseRate.reverseRate
          : limitPriceUseRate.rate,
      }));
    },
    [setLimitPriceSetReverse, setLimitPriceUseRate, limitPriceUseRate],
  );

  useEffect(() => {
    if (
      limitPriceMarketPrice.fromTokenMarketPrice &&
      limitPriceMarketPrice.toTokenMarketPrice
    ) {
      const { fromToken, toToken } = limitPriceUseRate;
      const { fromToken: fromTokenMarket, toToken: toTokenMarket } =
        limitPriceMarketPrice;
      if (
        !equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: fromTokenMarket,
        }) ||
        !equalTokenNoCaseSensitive({
          token1: toToken,
          token2: toTokenMarket,
        })
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
    if (
      !limitPriceMarketPrice.rate ||
      checkWrappedTokenPair({
        fromToken: fromSelectToken,
        toToken: toSelectToken,
      })
    ) {
      setLimitPriceUseRate({});
      setLimitPriceSetReverse(false);
    }
  }, [
    fromSelectToken,
    limitPriceMarketPrice.rate,
    setLimitPriceSetReverse,
    setLimitPriceUseRate,
    toSelectToken,
  ]);

  useEffect(
    () => () => {
      cleanLimitOrderMarketPriceInterval();
      setLimitPriceUseRate({});
      setLimitPriceSetReverse(false);
      setInAppNotification((v) => ({ ...v, swapLimitOrdersLoading: false }));
    },
    [
      setLimitPriceSetReverse,
      setLimitPriceUseRate,
      cleanLimitOrderMarketPriceInterval,
      setInAppNotification,
    ],
  );

  return {
    onLimitRateChange,
    limitPriceEqualMarketPrice,
    limitPriceMarketRate,
    onSetMarketPrice,
    onChangeReverse,
    limitPriceSetReverse,
    limitPriceUseRate,
    limitPriceMarketPrice,
    fromTokenInfo: fromSelectToken,
    toTokenInfo: toSelectToken,
  };
};
