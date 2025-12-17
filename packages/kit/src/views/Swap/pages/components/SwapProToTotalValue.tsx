import { useEffect } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
// import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  useSwapProToTotalValueAtom,
  useSwapProTradeTypeAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

const SwapProToTotalValue = () => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProQuoteFetching] = useSwapSpeedQuoteFetchingAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
  const [swapProToTotalValue, setSwapProToTotalValue] =
    useSwapProToTotalValueAtom();

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
      <Stack>
        <SwapCommonInfoItem
          title={intl.formatMessage({ id: ETranslations.dexmarket_total })}
          value={`≈ ${swapProToTotalValue}`}
          titleProps={{
            size: '$bodySm',
          }}
          valueProps={{
            size: '$bodySmMedium',
          }}
          isLoading={swapProQuoteFetching}
          containerProps={{
            py: '$1',
          }}
        />
      </Stack>
    );
  }
  return null;
};

export default SwapProToTotalValue;
