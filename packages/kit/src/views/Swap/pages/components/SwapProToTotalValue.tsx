import { useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';

import { Stack } from '@onekeyhq/components';
import {
  useSwapProToTotalValueAtom,
  useSwapProTradeTypeAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProCenterInput from '../../components/SwapProCenterInput';
import { useSwapProToToken } from '../../hooks/useSwapPro';

const SwapProToTotalValue = () => {
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProQuoteFetching] = useSwapSpeedQuoteFetchingAtom();
  const [toTokenAmount, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [swapProToTotalValue, setSwapProToTotalValue] =
    useSwapProToTotalValueAtom();
  const swapProtoToToken = useSwapProToToken();
  const handleTokenValueChange = useCallback(
    (text: string) => {
      if (swapProTradeType === ESwapProTradeType.LIMIT) {
        setSwapProToTotalValue(text);
        const toAmountValue = new BigNumber(text ?? '0');
        let toTokenAmountValue = '';
        if (toAmountValue.isNaN() || toAmountValue.isZero()) {
          toTokenAmountValue = '';
        } else {
          const toTokenPrice = new BigNumber(swapProtoToToken?.price ?? '0');
          toTokenAmountValue = toAmountValue
            .div(toTokenPrice)
            .decimalPlaces(
              swapProtoToToken?.decimals ?? 0,
              BigNumber.ROUND_DOWN,
            )
            .toFixed();
        }
        setSwapToTokenAmount({
          value: toTokenAmountValue,
          isInput: true,
        });
      }
    },
    [
      setSwapProToTotalValue,
      setSwapToTokenAmount,
      swapProTradeType,
      swapProtoToToken?.decimals,
      swapProtoToToken?.price,
    ],
  );

  useEffect(() => {
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      const toTokenAmountBn = new BigNumber(toTokenAmount.value ?? '0');
      if (
        (toTokenAmountBn.isNaN() || toTokenAmountBn.isZero()) &&
        !toTokenAmount.isInput
      ) {
        setSwapProToTotalValue('');
      }
    }
  }, [
    toTokenAmount.isInput,
    toTokenAmount.value,
    swapProTradeType,
    setSwapProToTotalValue,
  ]);

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
