import { useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';

import {
  useSwapProInputAmountAtom,
  useSwapProSliderValueAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { formatWithPrecision } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsSlider } from '../../../Perp/components/PerpsSlider';
import { useSwapProInputToken } from '../../hooks/useSwapPro';

const SwapProSlider = () => {
  const inputToken = useSwapProInputToken();
  const [, setSwapProInputAmount] = useSwapProInputAmountAtom();
  const [swapProSliderValue, setSwapProSliderValue] =
    useSwapProSliderValueAtom();
  const handleSliderPercentChange = useCallback(
    (value: number) => {
      let newValue = value;
      if (value > 100) {
        newValue = 100;
      } else if (newValue < 0) {
        newValue = 0;
      }
      setSwapProSliderValue(newValue);
      if (inputToken?.balanceParsed) {
        const balanceBN = new BigNumber(inputToken.balanceParsed);
        const sliderPercentBN = new BigNumber(newValue).dividedBy(100);
        const inputNewAmount = balanceBN
          .multipliedBy(sliderPercentBN)
          .decimalPlaces(inputToken?.decimals, BigNumber.ROUND_DOWN)
          .toFixed();
        setSwapProInputAmount(inputNewAmount);
      }
    },
    [
      inputToken?.balanceParsed,
      inputToken?.decimals,
      setSwapProInputAmount,
      setSwapProSliderValue,
    ],
  );

  return (
    <PerpsSlider
      min={0}
      max={100}
      value={swapProSliderValue}
      showBubble={false}
      onChange={handleSliderPercentChange}
      disabled={false}
      segments={4}
      sliderHeight={2}
    />
  );
};

export default SwapProSlider;
