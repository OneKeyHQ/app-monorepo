import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { useSwapSlippagePercentageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

interface ISwapSlippageTriggerContainerProps {
  isLoading: boolean;
  popoverOnOpenChange: (open: boolean) => void;
  renderPopoverContent: () => ReactNode;
}

const SwapSlippageTriggerContainer = ({
  isLoading,
  popoverOnOpenChange,
  renderPopoverContent,
}: ISwapSlippageTriggerContainerProps) => {
  const intl = useIntl();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
  const slippageDisplayValue = useMemo(() => {
    const preText = intl.formatMessage({
      id:
        swapSlippage.key === ESwapSlippageSegmentKey.AUTO
          ? 'form__auto'
          : 'content__custom',
    });

    return `${preText} (${swapSlippage.value}%)`;
  }, [intl, swapSlippage.key, swapSlippage.value]);

  const valueComponent = useMemo(
    () => (
      <SizableText
        size="$bodyMdMedium"
        color={
          swapSlippage.value > swapSlippageWillAheadMinValue
            ? '$textCritical'
            : '$bodyMdMedium'
        }
      >
        {slippageDisplayValue}
      </SizableText>
    ),
    [slippageDisplayValue, swapSlippage.value],
  );
  return (
    <SwapCommonInfoItem
      title="Slippage tolerance"
      isLoading={isLoading}
      onPress={() => {}}
      questionMarkContent="Slippage tolerance is a setting for the amount of price slippage you are willing to accept for a trade."
      valueComponent={valueComponent}
      popoverOnOpenChange={popoverOnOpenChange}
      renderPopoverContent={renderPopoverContent}
    />
  );
};

export default memo(SwapSlippageTriggerContainer);
