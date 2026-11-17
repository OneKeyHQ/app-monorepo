import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

import {
  NATIVE_CHART_OPTION_GRID_GAP,
  NATIVE_CHART_OPTION_PILL_LAYOUT_PROPS,
  getNativeChartOptionPillColors,
} from '../utils/NativeChartControlsShared';

import {
  INTERVAL_GRID_COLUMN_COUNT,
  buildIntervalItemTestID,
  formatIntervalOptionDisplayLabel,
  isIntervalOptionDisabled,
} from './NativeIntervalUtils';

import type { ITradingViewIntervalOption } from '../types';

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
  const { color: textColor, ...pillColors } = getNativeChartOptionPillColors({
    isHighlighted: isActive || Boolean(isSelected),
    isDisabled: disabled,
  });

  return (
    <Stack
      key={option.value}
      testID={buildIntervalItemTestID(section, option.value)}
      position="relative"
      {...NATIVE_CHART_OPTION_PILL_LAYOUT_PROPS}
      {...pillColors}
      alignItems="center"
      justifyContent="center"
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
      <SizableText size="$bodyMdMedium" color={textColor} numberOfLines={1}>
        {displayLabel}
      </SizableText>
      {showCheckMark && !disabled ? (
        <Stack
          position="absolute"
          right={0}
          top={0}
          // The design draws a 16px badge offset by -3px behind a clipping
          // parent, so only a 13px corner tab is ever visible.
          w={13}
          h={13}
          borderBottomLeftRadius="$2"
          borderCurve="continuous"
          bg="$borderActive"
          alignItems="center"
          justifyContent="center"
        >
          {/* Checkmark1Small fills ~45% of its 24px viewBox, so $3 draws the
              5.7px glyph the design specifies. */}
          <Icon name="Checkmark1SmallOutline" size="$3" color="$iconInverse" />
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
    <YStack gap={NATIVE_CHART_OPTION_GRID_GAP}>
      {rows.map((row, rowIndex) => {
        const placeholderCount = INTERVAL_GRID_COLUMN_COUNT - row.length;
        return (
          <XStack
            key={`${section}-row-${rowIndex}`}
            gap={NATIVE_CHART_OPTION_GRID_GAP}
          >
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
                  isActive={Boolean(
                    highlightActiveInterval && option.value === activeInterval,
                  )}
                  isSelected={isSelected}
                  showCheckMark={Boolean(showSelectedCheckMarks && isSelected)}
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
                {...NATIVE_CHART_OPTION_PILL_LAYOUT_PROPS}
                borderColor="$transparent"
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
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}
