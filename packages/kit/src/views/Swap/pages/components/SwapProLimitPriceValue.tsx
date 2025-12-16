import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  useSwapLimitPriceMarketPriceAtom,
  useSwapLimitPriceUseRateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import SwapProLimitPriceInput from '../../components/SwapProLimitPriceInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

import SwapProLimitPriceSlider from './SwapProLimitPriceSlider';

const SwapProLimitPriceValue = () => {
  const intl = useIntl();
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapLimitPriceMarketPrice] = useSwapLimitPriceMarketPriceAtom();
  const {
    onLimitRateChange,
    limitPriceUseRate,
    onChangeReverse,
    limitPriceSetReverse,
    fromTokenInfo,
    toTokenInfo,
    limitPriceMarketPrice,
  } = useSwapLimitRate();
  const tokenCurrency = useMemo(
    () => ({
      from: !limitPriceSetReverse
        ? fromTokenInfo?.symbol ?? '-'
        : toTokenInfo?.symbol ?? '-',
      to: !limitPriceSetReverse
        ? toTokenInfo?.symbol ?? '-'
        : fromTokenInfo?.symbol ?? '-',
    }),
    [fromTokenInfo, toTokenInfo, limitPriceSetReverse],
  );

  // Calculate the rate difference between current limit price and market price
  const rateDifferenceInfo = useMemo(() => {
    if (swapLimitPriceUseRate.rate && swapLimitPriceMarketPrice.rate) {
      const useRateBN = new BigNumber(swapLimitPriceUseRate.rate);
      const marketPriceBN = new BigNumber(swapLimitPriceMarketPrice.rate);
      if (marketPriceBN.isZero()) {
        return {
          value: '0%',
          color: '$textSubdued',
          numericValue: 0,
        };
      }
      const rateDifference = useRateBN.minus(marketPriceBN).div(marketPriceBN);
      const rateDifferenceValue = rateDifference.multipliedBy(100).toFixed(2);
      let value = '0';
      let color = '$textSubdued';
      if (new BigNumber(rateDifferenceValue).eq(0)) {
        color = '$textSubdued';
      } else {
        value = rateDifferenceValue;
        if (rateDifference.lt(0)) {
          color = '$textCritical';
        }
        if (rateDifference.gt(0)) {
          color = '$textSuccess';
        }
      }
      return {
        value: `${value}%`,
        color,
        numericValue: parseFloat(rateDifferenceValue),
      };
    }
    return {
      value: '0%',
      color: '$textSubdued',
      numericValue: 0,
    };
  }, [swapLimitPriceMarketPrice.rate, swapLimitPriceUseRate.rate]);

  // Handle percent change from slider or percent input
  // This updates the limit price based on the new percent value
  const onChangePercent = useCallback(
    (value: number) => {
      // Only need market price to calculate new limit rate
      if (swapLimitPriceMarketPrice.rate) {
        const marketPriceBN = new BigNumber(swapLimitPriceMarketPrice.rate);
        if (marketPriceBN.isZero()) {
          return;
        }
        const rateDifferenceChange = new BigNumber(value).dividedBy(100);
        const newLimitRate = new BigNumber(1)
          .plus(rateDifferenceChange)
          .multipliedBy(marketPriceBN);
        // Format the new rate with appropriate decimals
        const decimals = limitPriceSetReverse
          ? limitPriceMarketPrice.fromToken?.decimals ?? 8
          : limitPriceMarketPrice.toToken?.decimals ?? 8;
        const formattedRate = newLimitRate
          .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
          .toFixed();
        onLimitRateChange(formattedRate);
      }
    },
    [
      onLimitRateChange,
      swapLimitPriceMarketPrice.rate,
      limitPriceSetReverse,
      limitPriceMarketPrice.fromToken?.decimals,
      limitPriceMarketPrice.toToken?.decimals,
    ],
  );

  return (
    <>
      <SwapProLimitPriceInput
        title={intl.formatMessage({ id: ETranslations.Limit_limit_price })}
        value={limitPriceUseRate.inputRate ?? ''}
        onChangeText={onLimitRateChange}
        onReverseChange={() => onChangeReverse(!limitPriceSetReverse)}
        fromSymbol={tokenCurrency.from}
        toSymbol={tokenCurrency.to}
      />
      <SwapProLimitPriceSlider
        percentValue={rateDifferenceInfo.value}
        percentValueColor={rateDifferenceInfo.color}
        onChangePercent={onChangePercent}
      />
    </>
  );
};

export default SwapProLimitPriceValue;
