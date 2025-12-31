import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  useSwapLimitPriceUseRateAtom,
  useSwapProDirectionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import SwapProLimitPriceInput from '../../components/SwapProLimitPriceInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

// import SwapProLimitPriceSlider from './SwapProLimitPriceSlider';

interface ISwapProLimitPriceValueProps {
  externalTokenPrice?: { value: string; change: boolean };
}
const SwapProLimitPriceValue = ({
  externalTokenPrice,
}: ISwapProLimitPriceValueProps) => {
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [settings] = useSettingsPersistAtom();
  const {
    onLimitRateChange,
    fromTokenInfo,
    onSetMarketPrice,
    toTokenInfo,
    limitPriceMarketPrice,
  } = useSwapLimitRate();
  const isInitializedRef = useRef(false);
  const [inputValue, setInputValue] = useState('');
  const prevExternalChangeRef = useRef<boolean | undefined>(undefined);
  // Flag to prevent useEffect from overwriting user input after blur
  const skipNextSyncRef = useRef(false);

  // Determine which token's price to display based on buy/sell direction
  // BUY: show toToken price, SELL: show fromToken price
  const targetToken = useMemo(() => {
    return swapProDirection === ESwapDirection.BUY
      ? toTokenInfo
      : fromTokenInfo;
  }, [swapProDirection, fromTokenInfo, toTokenInfo]);

  const currencySymbol = settings?.currencyInfo?.symbol ?? '$';

  // Calculate token price from limit price
  // limit price = fromToken price / toToken price (1 fromToken = rate toToken)
  // If BUY: show toToken price, toToken price = fromToken price / limit price
  // If SELL: show fromToken price, fromToken price = toToken price * limit price
  const currentTokenPrice = useMemo(() => {
    if (!swapLimitPriceUseRate.rate || !targetToken) {
      return '';
    }

    const limitRateBN = new BigNumber(swapLimitPriceUseRate.rate);
    if (limitRateBN.isZero()) {
      return '';
    }

    if (swapProDirection === ESwapDirection.BUY) {
      // BUY: show toToken price
      // limit price = fromToken price / toToken price
      // so: toToken price = fromToken price / limit price
      const fromTokenPriceBN = new BigNumber(
        limitPriceMarketPrice.fromTokenMarketPrice ?? '0',
      );
      if (fromTokenPriceBN.isZero()) {
        return '';
      }
      const toTokenPrice = fromTokenPriceBN.dividedBy(limitRateBN);
      return toTokenPrice.decimalPlaces(6, BigNumber.ROUND_HALF_UP).toFixed();
    }
    // SELL: show fromToken price
    // limit price = fromToken price / toToken price
    // so: fromToken price = toToken price * limit price
    const toTokenPriceBN = new BigNumber(
      limitPriceMarketPrice.toTokenMarketPrice ?? '0',
    );
    if (toTokenPriceBN.isZero()) {
      return '';
    }
    const fromTokenPrice = toTokenPriceBN.multipliedBy(limitRateBN);
    return fromTokenPrice.decimalPlaces(6, BigNumber.ROUND_HALF_UP).toFixed();
  }, [
    swapLimitPriceUseRate.rate,
    swapProDirection,
    targetToken,
    limitPriceMarketPrice.fromTokenMarketPrice,
    limitPriceMarketPrice.toTokenMarketPrice,
  ]);

  // Calculate market token price from market limit price
  // market limit price = fromToken price / toToken price
  const marketTokenPrice = useMemo(() => {
    if (!limitPriceMarketPrice.rate || !targetToken) {
      return '';
    }

    const marketRateBN = new BigNumber(limitPriceMarketPrice.rate);
    if (marketRateBN.isZero()) {
      return '';
    }

    if (swapProDirection === ESwapDirection.BUY) {
      // BUY: show toToken market price
      // market limit price = fromToken price / toToken price
      // so: toToken market price = fromToken price / market limit price
      const fromTokenPriceBN = new BigNumber(
        limitPriceMarketPrice.fromTokenMarketPrice ?? '0',
      );
      if (fromTokenPriceBN.isZero()) {
        return '';
      }
      const toTokenMarketPrice = fromTokenPriceBN.dividedBy(marketRateBN);
      return toTokenMarketPrice
        .decimalPlaces(6, BigNumber.ROUND_HALF_UP)
        .toFixed();
    }
    // SELL: show fromToken market price
    // market limit price = fromToken price / toToken price
    // so: fromToken market price = toToken price * market limit price
    const toTokenPriceBN = new BigNumber(
      limitPriceMarketPrice.toTokenMarketPrice ?? '0',
    );
    if (toTokenPriceBN.isZero()) {
      return '';
    }
    const fromTokenMarketPrice = toTokenPriceBN.multipliedBy(marketRateBN);
    return fromTokenMarketPrice
      .decimalPlaces(6, BigNumber.ROUND_HALF_UP)
      .toFixed();
  }, [
    limitPriceMarketPrice.rate,
    swapProDirection,
    targetToken,
    limitPriceMarketPrice.fromTokenMarketPrice,
    limitPriceMarketPrice.toTokenMarketPrice,
  ]);

  // // Calculate the rate difference between current limit price and market price
  // const rateDifferenceInfo = useMemo(() => {
  //   if (swapLimitPriceUseRate.rate && limitPriceMarketPrice.rate) {
  //     const useRateBN = new BigNumber(swapLimitPriceUseRate.rate);
  //     const marketPriceBN = new BigNumber(limitPriceMarketPrice.rate);
  //     if (marketPriceBN.isZero()) {
  //       return {
  //         value: '0%',
  //         color: '$textSubdued',
  //         numericValue: 0,
  //       };
  //     }
  //     const rateDifference = useRateBN.minus(marketPriceBN).div(marketPriceBN);
  //     const rateDifferenceValue = rateDifference.multipliedBy(100).toFixed(2);
  //     let value = '0';
  //     let color = '$textSubdued';
  //     if (new BigNumber(rateDifferenceValue).eq(0)) {
  //       color = '$textSubdued';
  //     } else {
  //       value = rateDifferenceValue;
  //       if (rateDifference.lt(0)) {
  //         color = '$textCritical';
  //       }
  //       if (rateDifference.gt(0)) {
  //         color = '$textSuccess';
  //       }
  //     }
  //     return {
  //       value: `${value}%`,
  //       color,
  //       numericValue: parseFloat(rateDifferenceValue),
  //     };
  //   }
  //   return {
  //     value: '0%',
  //     color: '$textSubdued',
  //     numericValue: 0,
  //   };
  // }, [limitPriceMarketPrice.rate, swapLimitPriceUseRate.rate]);

  // Handle token price input change - only update local state, don't calculate
  const onTokenPriceInputChange = useCallback((text: string) => {
    // Validate input is a valid number format (only check if it's numeric, no decimal limit)
    if (text && !/^[0-9]*\.?[0-9]*$/.test(text)) {
      return;
    }
    // Update local input value
    setInputValue(text);
  }, []);

  // Handle external token price change - convert to limit price
  const handleExternalTokenPrice = useCallback(
    (tokenPriceValue: string) => {
      if (!targetToken || !fromTokenInfo || !toTokenInfo) {
        return;
      }

      const text = tokenPriceValue.trim();

      // Allow empty string or just decimal point
      if (text === '' || text === '.') {
        return;
      }

      const tokenPriceBN = new BigNumber(text);
      // Check if the number is valid and not zero
      if (tokenPriceBN.isNaN() || tokenPriceBN.isZero()) {
        // If invalid or zero, set limit price to 0
        onLimitRateChange('0');
        setInputValue('');
        return;
      }

      if (swapProDirection === ESwapDirection.BUY) {
        // BUY: user modifies toToken price
        // limit price = fromToken price / toToken price
        const fromTokenPriceBN = new BigNumber(
          limitPriceMarketPrice.fromTokenMarketPrice ?? '0',
        );
        if (fromTokenPriceBN.isZero()) {
          return;
        }
        const newLimitRate = fromTokenPriceBN.dividedBy(tokenPriceBN);
        const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
        const formattedRate = newLimitRate
          .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
          .toFixed();
        onLimitRateChange(formattedRate);
        setInputValue(text);
        return;
      }
      // SELL: user modifies fromToken price
      // limit price = fromToken price / toToken price
      const toTokenPriceBN = new BigNumber(
        limitPriceMarketPrice.toTokenMarketPrice ?? '0',
      );
      if (toTokenPriceBN.isZero()) {
        return;
      }
      const newLimitRate = tokenPriceBN.dividedBy(toTokenPriceBN);
      const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
      const formattedRate = newLimitRate
        .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
        .toFixed();
      onLimitRateChange(formattedRate);
      setInputValue(text);
    },
    [
      targetToken,
      fromTokenInfo,
      toTokenInfo,
      swapProDirection,
      onLimitRateChange,
      limitPriceMarketPrice.toToken?.decimals,
      limitPriceMarketPrice.fromTokenMarketPrice,
      limitPriceMarketPrice.toTokenMarketPrice,
    ],
  );

  // Handle token price change on blur - convert to limit price
  const onTokenPriceBlur = useCallback(() => {
    if (!targetToken || !fromTokenInfo || !toTokenInfo) {
      return;
    }

    const text = inputValue.trim();

    // Allow empty string or just decimal point (user is still typing)
    if (text === '' || text === '.') {
      // Reset to current calculated price
      setInputValue(currentTokenPrice);
      return;
    }

    const tokenPriceBN = new BigNumber(text);
    // Check if the number is valid and not zero
    if (tokenPriceBN.isNaN() || tokenPriceBN.isZero()) {
      // If invalid or zero, set limit price to 0
      onLimitRateChange('0');
      setInputValue('');
      return;
    }

    if (swapProDirection === ESwapDirection.BUY) {
      // BUY: user modifies toToken price
      // limit price = fromToken price / toToken price
      const fromTokenPriceBN = new BigNumber(
        limitPriceMarketPrice.fromTokenMarketPrice ?? '0',
      );
      if (fromTokenPriceBN.isZero()) {
        setInputValue(currentTokenPrice);
        return;
      }
      const newLimitRate = fromTokenPriceBN.dividedBy(tokenPriceBN);
      const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
      const formattedRate = newLimitRate
        .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
        .toFixed();
      // Skip next sync to preserve user input
      skipNextSyncRef.current = true;
      onLimitRateChange(formattedRate);
      return;
    }
    // SELL: user modifies fromToken price
    // limit price = fromToken price / toToken price
    const toTokenPriceBN = new BigNumber(
      limitPriceMarketPrice.toTokenMarketPrice ?? '0',
    );
    if (toTokenPriceBN.isZero()) {
      setInputValue(currentTokenPrice);
      return;
    }
    const newLimitRate = tokenPriceBN.dividedBy(toTokenPriceBN);
    const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
    const formattedRate = newLimitRate
      .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
      .toFixed();
    // Skip next sync to preserve user input
    skipNextSyncRef.current = true;
    onLimitRateChange(formattedRate);
  }, [
    inputValue,
    targetToken,
    fromTokenInfo,
    toTokenInfo,
    swapProDirection,
    onLimitRateChange,
    limitPriceMarketPrice.toToken?.decimals,
    limitPriceMarketPrice.fromTokenMarketPrice,
    limitPriceMarketPrice.toTokenMarketPrice,
    currentTokenPrice,
  ]);

  // Sync input value with calculated token price when it changes externally
  useEffect(() => {
    // Skip sync if user just blurred (preserve user input)
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    // Only update if input is not focused (user is not typing)
    setInputValue(currentTokenPrice);
  }, [currentTokenPrice]);

  // Handle percent change from slider or percent input
  // This updates the token price based on the market token price percentage change, then calculates the new limit price
  const onChangePercent = useCallback(
    (value: number) => {
      if (!targetToken || !fromTokenInfo || !toTokenInfo) {
        return;
      }

      // Get market token price (not current limit price token price)
      const marketTokenPriceBN = new BigNumber(marketTokenPrice || '0');
      if (marketTokenPriceBN.isZero() || marketTokenPriceBN.isNaN()) {
        return;
      }

      // Calculate new token price based on percentage change from market price
      const percentChange = new BigNumber(value).dividedBy(100);
      const newTokenPrice = marketTokenPriceBN.multipliedBy(
        new BigNumber(1).plus(percentChange),
      );

      // Calculate new limit rate based on new token price
      if (swapProDirection === ESwapDirection.BUY) {
        // BUY: user modifies toToken price
        // limit price = fromToken price / toToken price
        const fromTokenPriceBN = new BigNumber(
          limitPriceMarketPrice.fromTokenMarketPrice ?? '0',
        );
        if (fromTokenPriceBN.isZero()) {
          return;
        }
        const newLimitRate = fromTokenPriceBN.dividedBy(newTokenPrice);
        const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
        const formattedRate = newLimitRate
          .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
          .toFixed();
        onLimitRateChange(formattedRate);
        return;
      }
      // SELL: user modifies fromToken price
      // limit price = fromToken price / toToken price
      const toTokenPriceBN = new BigNumber(
        limitPriceMarketPrice.toTokenMarketPrice ?? '0',
      );
      if (toTokenPriceBN.isZero()) {
        return;
      }
      const newLimitRate = newTokenPrice.dividedBy(toTokenPriceBN);
      const decimals = limitPriceMarketPrice.toToken?.decimals ?? 8;
      const formattedRate = newLimitRate
        .decimalPlaces(decimals, BigNumber.ROUND_HALF_UP)
        .toFixed();
      onLimitRateChange(formattedRate);
    },
    [
      onLimitRateChange,
      targetToken,
      fromTokenInfo,
      toTokenInfo,
      swapProDirection,
      marketTokenPrice,
      limitPriceMarketPrice.fromTokenMarketPrice,
      limitPriceMarketPrice.toTokenMarketPrice,
      limitPriceMarketPrice.toToken?.decimals,
    ],
  );

  // Initialize with market price on first render
  useEffect(() => {
    if (
      !isInitializedRef.current &&
      marketTokenPrice &&
      limitPriceMarketPrice.rate &&
      (!swapLimitPriceUseRate.rate ||
        new BigNumber(swapLimitPriceUseRate.rate).isZero())
    ) {
      isInitializedRef.current = true;
      // Set limit price to market price (which will calculate token price)
      onSetMarketPrice(0);
    }
  }, [
    marketTokenPrice,
    limitPriceMarketPrice.rate,
    swapLimitPriceUseRate.rate,
    onSetMarketPrice,
  ]);

  // Handle external token price change when change prop changes
  useEffect(() => {
    if (!externalTokenPrice) {
      return;
    }

    const prevChange = prevExternalChangeRef.current;
    const currentChange = externalTokenPrice.change;

    // Check if change has changed (true -> false or false -> true)
    if (prevChange !== undefined && prevChange !== currentChange) {
      // If value exists, apply it as token price
      if (externalTokenPrice.value && externalTokenPrice.value.trim() !== '') {
        handleExternalTokenPrice(externalTokenPrice.value);
      }
    }

    // Update ref for next comparison
    prevExternalChangeRef.current = currentChange;
  }, [externalTokenPrice, handleExternalTokenPrice]);

  return (
    <>
      <SwapProLimitPriceInput
        value={inputValue}
        currencySymbol={currencySymbol}
        onChangeText={onTokenPriceInputChange}
        onBlur={onTokenPriceBlur}
        onSelectPercentageStage={onChangePercent}
      />
      {/* <SwapProLimitPriceSlider
        percentValue={rateDifferenceInfo.value}
        percentValueColor={rateDifferenceInfo.color}
        onChangePercent={onChangePercent}
      /> */}
    </>
  );
};

export default SwapProLimitPriceValue;
