import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { useSwapSlippagePercentageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  swapSlippageDecimal,
  swapSlippageWillAheadMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

interface ISwapSlippageTriggerContainerProps {
  isLoading: boolean;
  onPress: () => void;
}

const SwapSlippageTriggerContainer = ({
  isLoading,
  onPress,
}: ISwapSlippageTriggerContainerProps) => {
  const intl = useIntl();
  const [{ slippageItem }] = useSwapSlippagePercentageAtom();
  const displaySlippage = useMemo(
    () =>
      new BigNumber(slippageItem.value)
        .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
        .toFixed(),
    [slippageItem.value],
  );
  const slippageDisplayValue = useMemo(
    () =>
      intl.formatMessage(
        {
          id:
            slippageItem.key === ESwapSlippageSegmentKey.AUTO
              ? ETranslations.swap_page_provider_slippage_auto
              : ETranslations.swap_page_provider_custom,
        },
        { number: displaySlippage },
      ),
    [displaySlippage, intl, slippageItem.key],
  );

  const valueComponent = useMemo(
    () => (
      <SizableText
        size="$bodyMdMedium"
        color={
          slippageItem.value > swapSlippageWillAheadMinValue
            ? '$textCritical'
            : '$text'
        }
      >
        {slippageDisplayValue}
      </SizableText>
    ),
    [slippageDisplayValue, slippageItem.value],
  );
  return (
    <SwapCommonInfoItem
      title={intl.formatMessage({
        id: ETranslations.swap_page_provider_slippage_tolerance,
      })}
      isLoading={isLoading}
      onPress={onPress}
      questionMarkContent={intl.formatMessage({
        id: ETranslations.slippage_tolerance_popover,
      })}
      valueComponent={valueComponent}
    />
  );
};

export default memo(SwapSlippageTriggerContainer);
