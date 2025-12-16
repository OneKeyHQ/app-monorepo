import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { useSwapSlippageActions } from '../../hooks/useSwapSlippageActions';

export interface ISwapProSlippageSettingProps {
  isMEV?: boolean;
}

export function SwapProSlippageSetting({
  isMEV = false,
}: ISwapProSlippageSettingProps) {
  const intl = useIntl();
  const { onSlippageHandleClick, slippageItem } = useSwapSlippageActions();
  const displaySlippageText = useMemo(() => {
    if (slippageItem.key === ESwapSlippageSegmentKey.AUTO) {
      return `${intl.formatMessage({
        id: ETranslations.slippage_tolerance_switch_auto,
      })} (${slippageItem.value}%)`;
    }
    return `${intl.formatMessage({
      id: ETranslations.slippage_tolerance_switch_custom,
    })} (${slippageItem.value}%)`;
  }, [intl, slippageItem]);
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      userSelect="none"
      cursor="pointer"
      onPress={onSlippageHandleClick}
    >
      <XStack alignItems="center" gap="$1">
        <Icon name="ChartTrendingOutline" size="$4" color="$iconSubdued" />
        <SizableText
          size="$bodySm"
          color={
            slippageItem.key === ESwapSlippageSegmentKey.CUSTOM &&
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$textSubdued'
          }
        >
          {displaySlippageText}
        </SizableText>
        {isMEV ? (
          <Icon name="ShieldCheckDoneSolid" size="$4" color="$iconSuccess" />
        ) : null}
      </XStack>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
