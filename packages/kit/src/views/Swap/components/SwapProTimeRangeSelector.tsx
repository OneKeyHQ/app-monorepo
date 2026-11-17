import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectRenderTriggerProps } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { defaultTimeRangeItem } from '../../../states/jotai/contexts/swap';

interface ISwapProTimeRangeSelectorProps {
  items: { label: string; value: ESwapProTimeRange }[];
  selectedValue: { label: string; value: ESwapProTimeRange };
  onChange: (value: ESwapProTimeRange) => void;
  disabled?: boolean;
}

const SwapProTimeRangeSelector = ({
  items,
  selectedValue,
  onChange,
  disabled,
}: ISwapProTimeRangeSelectorProps) => {
  const intl = useIntl();

  const renderTrigger = useCallback(
    (props: ISelectRenderTriggerProps) => (
      <XStack
        px="$3"
        cursor="pointer"
        userSelect="none"
        borderRadius="$2"
        onPress={disabled ? undefined : props.onPress}
        h="$8"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgStrong"
        hoverStyle={{
          bg: '$bgStrongHover',
        }}
        pressStyle={{
          bg: '$bgStrongActive',
        }}
        focusStyle={{
          bg: '$bgStrongActive',
        }}
      >
        <SizableText size="$bodyMd">
          {disabled ? defaultTimeRangeItem.label : selectedValue.label}
        </SizableText>
        {disabled ? null : (
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        )}
      </XStack>
    ),
    [disabled, selectedValue.label],
  );

  return (
    <Select
      testID="swap-select"
      items={items}
      value={selectedValue.value}
      onChange={(value) => {
        onChange(value as ESwapProTimeRange);
      }}
      disabled={disabled}
      title={intl.formatMessage({ id: ETranslations.global_time_range })}
      renderTrigger={renderTrigger}
      floatingPanelProps={{
        width: '$56',
      }}
    />
  );
};

export default SwapProTimeRangeSelector;
