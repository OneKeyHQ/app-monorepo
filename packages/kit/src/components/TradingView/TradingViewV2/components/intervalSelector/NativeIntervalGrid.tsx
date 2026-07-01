import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  INTERVAL_GRID_COLUMN_COUNT,
  INTERVAL_GRID_ITEM_LAYOUT_PROPS,
  buildIntervalItemTestID,
  formatIntervalOptionDisplayLabel,
  isIntervalOptionDisabled,
} from './NativeIntervalUtils';

import type { ITradingViewIntervalOption } from '../../types';

function IntervalPill({
  option,
  displayLabel,
  section,
  isActive,
  isSelected,
  showCheckMark,
  disabled,
  onPress,
}: {
  option: ITradingViewIntervalOption;
  displayLabel: string;
  section: string;
  isActive: boolean;
  isSelected?: boolean;
  showCheckMark?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isHighlighted = isActive || Boolean(isSelected);
  let textColor = '$textSubdued';
  if (disabled) {
    textColor = '$textDisabled';
  } else if (isHighlighted) {
    textColor = '$text';
  }

  return (
    <Stack
      key={option.value}
      testID={buildIntervalItemTestID(section, option.value)}
      position="relative"
      {...INTERVAL_GRID_ITEM_LAYOUT_PROPS}
      borderRadius="$full"
      borderCurve="continuous"
      borderColor={isHighlighted && !disabled ? '$bgReverse' : 'transparent'}
      alignItems="center"
      justifyContent="center"
      bg="$bgStrong"
      overflow="hidden"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      opacity={disabled ? 0.5 : 1}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      onPress={disabled ? undefined : onPress}
    >
      <SizableText
        size="$bodyLgMedium"
        color={textColor}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {displayLabel}
      </SizableText>
      {showCheckMark && !disabled ? (
        <Stack
          position="absolute"
          right={-1}
          top={-1}
          w={19}
          h={19}
          borderBottomLeftRadius={12}
          borderCurve="continuous"
          bg="$bgReverse"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="Checkmark1SmallOutline" size="$4" color="$iconInverse" />
        </Stack>
      ) : null}
    </Stack>
  );
}

export function IntervalGrid({
  options,
  activeInterval,
  selectedValues,
  section,
  showSelectedCheckMarks,
  highlightActiveInterval = true,
  maxSelectedCount,
  onIntervalPress,
}: {
  options: ITradingViewIntervalOption[];
  activeInterval: string;
  selectedValues?: Set<string>;
  section: string;
  showSelectedCheckMarks?: boolean;
  highlightActiveInterval?: boolean;
  maxSelectedCount?: number;
  onIntervalPress: (option: ITradingViewIntervalOption) => void;
}) {
  const intl = useIntl();
  const isSelectionLimitReached =
    maxSelectedCount !== undefined &&
    (selectedValues?.size ?? 0) >= maxSelectedCount;
  const rows = useMemo(() => {
    const result: ITradingViewIntervalOption[][] = [];
    for (
      let index = 0;
      index < options.length;
      index += INTERVAL_GRID_COLUMN_COUNT
    ) {
      result.push(options.slice(index, index + INTERVAL_GRID_COLUMN_COUNT));
    }
    return result;
  }, [options]);

  return (
    <YStack gap="$2.5">
      {rows.map((row, rowIndex) => {
        const placeholderCount = INTERVAL_GRID_COLUMN_COUNT - row.length;
        return (
          <XStack key={`${section}-row-${rowIndex}`} gap="$2.5">
            {row.map((option) => {
              const isSelected = selectedValues?.has(option.value) ?? false;
              const isDisabled =
                isIntervalOptionDisabled(option) ||
                (isSelectionLimitReached && !isSelected);
              return (
                <IntervalPill
                  key={option.value}
                  option={option}
                  displayLabel={formatIntervalOptionDisplayLabel(
                    intl,
                    option.label,
                  )}
                  section={section}
                  isActive={
                    highlightActiveInterval && option.value === activeInterval
                  }
                  isSelected={isSelected}
                  showCheckMark={showSelectedCheckMarks && isSelected}
                  disabled={isDisabled}
                  onPress={() => {
                    if (!isDisabled) {
                      onIntervalPress(option);
                    }
                  }}
                />
              );
            })}
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <Stack
                key={`${section}-placeholder-${rowIndex}-${index}`}
                {...INTERVAL_GRID_ITEM_LAYOUT_PROPS}
                borderColor="transparent"
                opacity={0}
                pointerEvents="none"
              />
            ))}
          </XStack>
        );
      })}
    </YStack>
  );
}

export function IntervalsDialogSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyLg" color="$textSubdued">
          {title}
        </SizableText>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}
