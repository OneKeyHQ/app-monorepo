import { useCallback } from 'react';

import {
  useSwapProLimitPriceValueAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProCenterInput from '../../components/SwapProCenterInput';

const SwapProLimitPriceValue = () => {
  const [swapProLimitPriceValue, setSwapProLimitPriceValue] =
    useSwapProLimitPriceValueAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();

  const handleTokenValueChange = useCallback(
    (text: string) => {
      if (swapProTradeType === ESwapProTradeType.LIMIT) {
        setSwapProLimitPriceValue(text);
      }
    },
    [setSwapProLimitPriceValue, swapProTradeType],
  );

  if (swapProTradeType !== ESwapProTradeType.LIMIT) {
    return null;
  }
  return (
    <SwapProCenterInput
      title="Limit price value"
      value={swapProLimitPriceValue}
      onChangeText={handleTokenValueChange}
      inputDisabled={false}
    />
  );
};

export default SwapProLimitPriceValue;
