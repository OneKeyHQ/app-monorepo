import { useCallback } from 'react';

import { Stack } from '@onekeyhq/components';
import {
  useSwapProToTotalValueAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProCenterInput from '../../components/SwapProCenterInput';

const SwapProToTotalValue = () => {
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProToTotalValue, setSwapProToTotalValue] =
    useSwapProToTotalValueAtom();
  const handleTokenValueChange = useCallback(
    (text: string) => {
      if (swapProTradeType === ESwapProTradeType.LIMIT) {
        setSwapProToTotalValue(text);
      }
    },
    [setSwapProToTotalValue, swapProTradeType],
  );
  return (
    <Stack mt="$2">
      <SwapProCenterInput
        title="total value"
        value={swapProToTotalValue}
        onChangeText={handleTokenValueChange}
        inputDisabled={swapProTradeType === ESwapProTradeType.MARKET}
      />
    </Stack>
  );
};

export default SwapProToTotalValue;
