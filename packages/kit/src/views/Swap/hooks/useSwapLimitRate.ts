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
  clampLimitRateDecimals,
  countSignificantRateDecimals,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
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
  const isLimitPriceUseRateForSelectedPair = useMemo(() => {
    if (!limitPriceUseRate.fromToken || !limitPriceUseRate.toToken) {
      return false;
    }
    return (
      equalTokenNoCaseSensitive({
        token1: limitPriceUseRate.fromToken,
        token2: fromSelectToken,
      }) &&
      equalTokenNoCaseSensitive({
        token1: limitPriceUseRate.toToken,
        token2: toSelectToken,
      })
    );
  }, [
    fromSelectToken,
    limitPriceUseRate.fromToken,
    limitPriceUseRate.toToken,
    toSelectToken,
  ]);
  const hasLimitPriceUseRate = useMemo(
    () =>
      Boolean(
        limitPriceUseRate.fromToken ||
        limitPriceUseRate.toToken ||
        limitPriceUseRate.rate ||
        limitPriceUseRate.reverseRate ||
        limitPriceUseRate.inputRate,
      ),
    [
      limitPriceUseRate.fromToken,
      limitPriceUseRate.inputRate,
      limitPriceUseRate.rate,
      limitPriceUseRate.reverseRate,
      limitPriceUseRate.toToken,
    ],
  );
  const canUseLimitPriceMarketPrice = useMemo(() => {
    const rateBN = new BigNumber(limitPriceMarketPrice.rate ?? 0);
    if (
      rateBN.isNaN() ||
      !rateBN.isFinite() ||
      rateBN.lte(0) ||
      !limitPriceMarketPrice.fromToken ||
      !limitPriceMarketPrice.toToken
    ) {
      return false;
    }
    return (
      equalTokenNoCaseSensitive({
        token1: limitPriceMarketPrice.fromToken,
        token2: fromSelectToken,
      }) &&
      equalTokenNoCaseSensitive({
        token1: limitPriceMarketPrice.toToken,
        token2: toSelectToken,
      })
    );
  }, [
    fromSelectToken,
    limitPriceMarketPrice.fromToken,
    limitPriceMarketPrice.rate,
    limitPriceMarketPrice.toToken,
    toSelectToken,
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
      // Sub-1 rates may legitimately carry more decimals than the
      // counterparty token (leading zeros + digits), so widen the validation
      // limit with the same formula clampLimitRateDecimals uses instead of
      // rejecting them. Unknown decimals fall back to 6 (validateAmountInput's
      // own historical default), not 0.
      const rateDecimalsLimit = Number(
        (limitPriceSetReverse
          ? limitPriceMarketPrice.fromToken?.decimals
          : limitPriceMarketPrice.toToken?.decimals) ??
          LIMIT_PRICE_DEFAULT_DECIMALS,
      );
      const textBN = new BigNumber(text || '0');
      // While the user is still typing the leading zeros of a sub-unit rate
      // ("0.0000000…"), the numeric value is exactly 0 and the significant-
      // digits widening can't see it yet — accept the typed zeros themselves
      // and let the significant rule take over at the first non-zero digit.
      const typedDecimals = text.includes('.')
        ? text.length - text.indexOf('.') - 1
        : 0;
      let effectiveDecimalsLimit = rateDecimalsLimit;
      if (textBN.gt(0) && textBN.lt(1)) {
        effectiveDecimalsLimit = countSignificantRateDecimals(
          textBN,
          rateDecimalsLimit,
        );
      } else if (textBN.isZero() && typedDecimals > rateDecimalsLimit) {
        effectiveDecimalsLimit = typedDecimals;
      }
      const isValidate = validateAmountInput(text, effectiveDecimalsLimit);
      if (isValidate) {
        if (textBN.isNaN() || textBN.isZero()) {
          setLimitPriceUseRate((v) => ({
            ...v,
            rate: '0',
            reverseRate: '0',
            inputRate: text,
          }));
        } else {
          const newRate = limitPriceSetReverse
            ? new BigNumber(1).div(textBN)
            : textBN;
          const newReverseRate = limitPriceSetReverse
            ? textBN
            : new BigNumber(1).div(textBN);
          const newReverseRateValue = clampLimitRateDecimals(
            newReverseRate,
            limitPriceMarketPrice.fromToken?.decimals,
          ).toFixed();
          const newRateValue = clampLimitRateDecimals(
            newRate,
            limitPriceMarketPrice.toToken?.decimals,
          ).toFixed();
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
      const formatRate = clampLimitRateDecimals(
        rateBN,
        limitPriceMarketPrice.toToken?.decimals,
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
      if (!canUseLimitPriceMarketPrice) {
        return;
      }
      const percentageBN = new BigNumber(1 + percentage / 100);
      const rateBN = new BigNumber(
        limitPriceMarketPrice.rate ?? '0',
      ).multipliedBy(percentageBN);
      const reverseRateBN = rateBN.isZero()
        ? new BigNumber(0)
        : new BigNumber(1).div(rateBN);
      const formatRate = clampLimitRateDecimals(
        rateBN,
        limitPriceMarketPrice.toToken?.decimals,
      );
      const formatReverseRate = clampLimitRateDecimals(
        reverseRateBN,
        limitPriceMarketPrice.fromToken?.decimals,
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
    [
      canUseLimitPriceMarketPrice,
      setLimitPriceUseRate,
      limitPriceMarketPrice,
      limitPriceSetReverse,
    ],
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
    const isWrappedTokenPair = checkWrappedTokenPair({
      fromToken: fromSelectToken,
      toToken: toSelectToken,
    });
    const shouldClearStaleLimitPrice =
      hasLimitPriceUseRate && !isLimitPriceUseRateForSelectedPair;
    if (isWrappedTokenPair || shouldClearStaleLimitPrice) {
      setLimitPriceUseRate({});
      setLimitPriceSetReverse(false);
    }
  }, [
    fromSelectToken,
    hasLimitPriceUseRate,
    isLimitPriceUseRateForSelectedPair,
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
    canUseLimitPriceMarketPrice,
    limitPriceUseRate,
    limitPriceMarketPrice,
    fromTokenInfo: fromSelectToken,
    toTokenInfo: toSelectToken,
  };
};
