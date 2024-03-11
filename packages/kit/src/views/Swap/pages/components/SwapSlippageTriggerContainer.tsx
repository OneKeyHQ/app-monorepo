import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useSwapSlippagePercentageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

const SwapSlippageTriggerContainer = () => {
  const intl = useIntl();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
  const slippageDisplayValue = useMemo(() => {
    const preText = intl.formatMessage({
      id:
        swapSlippage.key === ESwapSlippageSegmentKey.AUTO
          ? 'form__auto'
          : 'content__custom',
    });

    return `${preText}(${swapSlippage.value}%)`;
  }, [intl, swapSlippage.key, swapSlippage.value]);
  return (
    <SwapCommonInfoItem
      title="Slippage tolerance"
      onPress={() => {}}
      questionMarkContent="Slippage tolerance is a setting for the amount of price slippage you are willing to accept for a trade."
      value={slippageDisplayValue}
    />
  );
};

export default memo(SwapSlippageTriggerContainer);
