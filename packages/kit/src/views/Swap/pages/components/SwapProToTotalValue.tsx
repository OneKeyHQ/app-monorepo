import { useCallback } from 'react';

import { Stack } from '@onekeyhq/components';
import {
  useSwapProToTotalValueAtom,
  useSwapProTradeTypeAtom,
  useSwapSpeedQuoteFetchingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProCenterInput from '../../components/SwapProCenterInput';

const SwapProToTotalValue = () => {
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProQuoteFetching] = useSwapSpeedQuoteFetchingAtom();
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
  if (swapProTradeType !== ESwapProTradeType.LIMIT) {
    return (
      <Stack mt="$3">
        <SwapCommonInfoItem
          title="Total Value"
          value={`≈ ${swapProToTotalValue}`}
          titleProps={{
            size: '$bodySm',
          }}
          valueProps={{
            size: '$bodySmMedium',
          }}
          isLoading={swapProQuoteFetching}
        />
      </Stack>
    );
  }

  return (
    <Stack mt="$2">
      <SwapProCenterInput
        title="total value"
        value={swapProToTotalValue}
        onChangeText={handleTokenValueChange}
        inputDisabled={false}
      />
    </Stack>
  );
};

export default SwapProToTotalValue;
