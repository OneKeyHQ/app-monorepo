import { memo, useCallback, useMemo } from 'react';

import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  type ITimeRangeSelectorValue,
  TIME_RANGE_OPTIONS,
} from '../TimeRangeSelector';

interface ITimeRangeDropdownProps {
  value: ITimeRangeSelectorValue;
  onChange: (value: ITimeRangeSelectorValue) => void;
  compact?: boolean;
}

function TimeRangeDropdownContent({
  value,
  onChange,
  closePopover,
}: {
  value: ITimeRangeSelectorValue;
  onChange: (v: ITimeRangeSelectorValue) => void;
  closePopover: () => void;
}) {
  return (
    <YStack p="$2" gap="$1">
      {TIME_RANGE_OPTIONS.map((option) => (
        <XStack
          key={option.value}
          px="$3"
          py="$2"
          borderRadius="$2"
          bg={option.value === value ? '$bgActive' : '$transparent'}
          hoverStyle={{ bg: '$bgHover' }}
          onPress={() => {
            onChange(option.value);
            closePopover();
          }}
          cursor="pointer"
        >
          <SizableText
            size="$bodyMdMedium"
            color={option.value === value ? '$text' : '$textSubdued'}
          >
            {option.label}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}

function TimeRangeDropdownImpl({
  value,
  onChange,
  compact,
}: ITimeRangeDropdownProps) {
  const currentLabel = useMemo(
    () => TIME_RANGE_OPTIONS.find((o) => o.value === value)?.label ?? value,
    [value],
  );

  const renderTrigger = useMemo(
    () => (
      <XStack
        {...(compact
          ? {}
          : { bg: '$bgStrong', borderRadius: '$full', px: '$2.5', py: '$1' })}
        gap={compact ? '$1' : '$2'}
        alignItems="center"
        cursor="pointer"
        userSelect="none"
      >
        <SizableText size="$bodyMdMedium">{currentLabel}</SizableText>
        <Icon name="ChevronDownSmallOutline" size="$4.5" color="$iconSubdued" />
      </XStack>
    ),
    [currentLabel, compact],
  );

  const RenderContent = useCallback(
    ({ closePopover }: { isOpen?: boolean; closePopover: () => void }) => (
      <TimeRangeDropdownContent
        value={value}
        onChange={onChange}
        closePopover={closePopover}
      />
    ),
    [value, onChange],
  );

  return (
    <Popover
      title=""
      showHeader={false}
      placement="bottom-end"
      renderTrigger={renderTrigger}
      renderContent={RenderContent}
    />
  );
}

export const TimeRangeDropdown = memo(TimeRangeDropdownImpl);
