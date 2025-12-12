import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  useSwapFromTokenAmountAtom,
  useSwapProInputAmountAtom,
  useSwapProSliderValueAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { PerpsSlider } from '../../../Perp/components/PerpsSlider';
import { useSwapProInputToken } from '../../hooks/useSwapPro';

const SwapProSlider = () => {
  const inputToken = useSwapProInputToken();
  const [, setSwapProInputAmount] = useSwapProInputAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapProSliderValue, setSwapProSliderValue] =
    useSwapProSliderValueAtom();

  const handleSliderPercentChange = useCallback(
    (value: number) => {
      let newValue = value;
      if (value > 100) {
        newValue = 100;
      } else if (value < 0) {
        newValue = 0;
      }
      setSwapProSliderValue(newValue);
      if (inputToken?.balanceParsed) {
        const balanceBN = new BigNumber(inputToken.balanceParsed);
        const sliderPercentBN = new BigNumber(newValue).dividedBy(100);
        const inputNewAmount = balanceBN
          .multipliedBy(sliderPercentBN)
          .decimalPlaces(inputToken?.decimals ?? 0, BigNumber.ROUND_DOWN)
          .toFixed();
        if (swapProTradeType === ESwapProTradeType.LIMIT) {
          setSwapFromTokenAmount({
            value: inputNewAmount,
            isInput: true,
          });
        } else {
          setSwapProInputAmount(inputNewAmount);
        }
      }
    },
    [
      inputToken?.balanceParsed,
      inputToken?.decimals,
      setSwapFromTokenAmount,
      setSwapProInputAmount,
      setSwapProSliderValue,
      swapProTradeType,
    ],
  );

  return (
    <PerpsSlider
      min={0}
      max={100}
      value={swapProSliderValue}
      showBubble={false}
      onChange={handleSliderPercentChange}
      segments={4}
      sliderHeight={2}
    />
  );
};

export default SwapProSlider;
