import { useSwapProTradeTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapProCenterInput from '../../components/SwapProCenterInput';
import { useSwapLimitRate } from '../../hooks/useSwapLimitRate';

const SwapProLimitPriceValue = () => {
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const {
    onLimitRateChange,
    limitPriceUseRate,
    // onSetMarketPrice,
    // limitPriceSetReverse,
    // onChangeReverse,
    // limitPriceEqualMarketPrice,
  } = useSwapLimitRate();
  if (swapProTradeType !== ESwapProTradeType.LIMIT) {
    return null;
  }
  return (
    <SwapProCenterInput
      title="Limit price value"
      value={limitPriceUseRate.inputRate ?? ''}
      onChangeText={onLimitRateChange}
      inputDisabled={false}
    />
  );
};

export default SwapProLimitPriceValue;
