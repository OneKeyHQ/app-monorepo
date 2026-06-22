import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  SegmentControl,
  Select,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  ITradingViewIntervalConfigData,
  ITradingViewIntervalOption,
} from './types';

const MAX_VISIBLE_INTERVAL_COUNT = 3;

const INTERVAL_UNIT_LABELS = {
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
  M: 'month',
} as const;

interface ITradingViewNativeIntervalSelectorProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  onIntervalChange: (interval: string) => void;
}

function normalizeIntervalOptions(
  options: ITradingViewIntervalOption[] | undefined,
) {
  const seenValues = new Set<string>();
  return (options ?? []).reduce<ITradingViewIntervalOption[]>(
    (result, option) => {
      const value = option.value?.trim();
      const label = option.label?.trim();
      if (!value || !label || seenValues.has(value)) {
        return result;
      }

      seenValues.add(value);
      result.push({ label, value });
      return result;
    },
    [],
  );
}

function getPluralizedIntervalUnit(
  unit: keyof typeof INTERVAL_UNIT_LABELS,
  count: number,
) {
  const unitLabel = INTERVAL_UNIT_LABELS[unit];
  return count === 1 ? unitLabel : `${unitLabel}s`;
}

function getIntervalLabelParts(option: ITradingViewIntervalOption) {
  const labelMatch = option.label.match(/^(\d+)\s*([mhdwHDWM])$/);
  if (labelMatch) {
    const count = Number(labelMatch[1]);
    const rawUnit = labelMatch[2];
    const unit = (
      rawUnit === 'M' ? rawUnit : rawUnit.toLowerCase()
    ) as keyof typeof INTERVAL_UNIT_LABELS;
    if (Number.isFinite(count) && count > 0 && unit in INTERVAL_UNIT_LABELS) {
      return { count, unit };
    }
  }

  const valueMatch = option.value.match(/^(\d+)([HDWM])?$/);
  if (!valueMatch) {
    return null;
  }

  const rawCount = Number(valueMatch[1]);
  if (!Number.isFinite(rawCount) || rawCount <= 0) {
    return null;
  }

  const valueUnit = valueMatch[2];
  if (valueUnit === 'D') {
    return { count: rawCount, unit: 'd' as const };
  }
  if (valueUnit === 'W') {
    return { count: rawCount, unit: 'w' as const };
  }
  if (valueUnit === 'M') {
    return { count: rawCount, unit: 'M' as const };
  }
  if (valueUnit === 'H') {
    return { count: rawCount, unit: 'h' as const };
  }
  if (rawCount >= 60 && rawCount % 60 === 0) {
    return { count: rawCount / 60, unit: 'h' as const };
  }
  return { count: rawCount, unit: 'm' as const };
}

function getFullIntervalLabel(option: ITradingViewIntervalOption) {
  const labelParts = getIntervalLabelParts(option);
  if (!labelParts) {
    return option.label;
  }

  return `${labelParts.count} ${getPluralizedIntervalUnit(
    labelParts.unit,
    labelParts.count,
  )}`;
}

export const TradingViewNativeIntervalSelector = memo(
  ({
    intervalConfig,
    onIntervalChange,
  }: ITradingViewNativeIntervalSelectorProps) => {
    const intl = useIntl();

    const options = useMemo(
      () => normalizeIntervalOptions(intervalConfig?.intervals),
      [intervalConfig?.intervals],
    );

    const activeInterval = useMemo(() => {
      const configuredInterval = intervalConfig?.activeInterval?.trim();
      if (
        configuredInterval &&
        options.some((option) => option.value === configuredInterval)
      ) {
        return configuredInterval;
      }

      return options[0]?.value ?? '';
    }, [intervalConfig?.activeInterval, options]);

    const segmentOptions = useMemo(
      () =>
        options.slice(0, MAX_VISIBLE_INTERVAL_COUNT).map((option) => ({
          label: option.label,
          value: option.value,
        })),
      [options],
    );

    const dropdownShortOptions = useMemo(
      () => options.slice(MAX_VISIBLE_INTERVAL_COUNT),
      [options],
    );

    const dropdownOptions = useMemo<ISelectItem[]>(
      () =>
        dropdownShortOptions.map((option) => ({
          label: getFullIntervalLabel(option),
          value: option.value,
        })),
      [dropdownShortOptions],
    );

    const activeDropdownOption = useMemo(
      () =>
        dropdownShortOptions.find(
          (option) => option.value === activeInterval,
        ) ?? null,
      [activeInterval, dropdownShortOptions],
    );

    const moreLabel = intl.formatMessage({ id: ETranslations.global_more });
    const hasDropdownOptions = dropdownOptions.length > 0;
    const isDropdownActive = Boolean(activeDropdownOption);

    if (segmentOptions.length <= 1 || !activeInterval) {
      return null;
    }

    return (
      <XStack gap="$0" alignItems="center">
        <SegmentControl
          value={isDropdownActive ? '' : activeInterval}
          options={segmentOptions}
          onChange={(value) => {
            if (typeof value === 'string') {
              onIntervalChange(value);
            }
          }}
          slotBackgroundColor="$transparent"
          activeBackgroundColor="$bgStrong"
          activeTextColor="$text"
          inactiveTextColor="$textSubdued"
          h={30}
          p="$0.5"
          segmentControlItemStyleProps={{
            minWidth: 42,
            px: '$2.5',
            py: '$1',
          }}
        />
        {hasDropdownOptions ? (
          <Select
            testID="trading-view-native-interval-selector-more-select"
            title={moreLabel}
            items={dropdownOptions}
            value={
              typeof activeDropdownOption?.value === 'string'
                ? activeDropdownOption.value
                : undefined
            }
            onChange={(value) => {
              if (typeof value === 'string') {
                onIntervalChange(value);
              }
            }}
            placement="bottom-start"
            floatingPanelProps={{ width: '$32' }}
            renderTrigger={({ onPress }) => (
              <XStack
                h={30}
                px="$2.5"
                gap="$1"
                alignItems="center"
                borderRadius="$full"
                borderCurve="continuous"
                bg={isDropdownActive ? '$bgStrong' : '$transparent'}
                hoverStyle={{
                  bg: isDropdownActive ? '$bgStrongHover' : '$bgHover',
                }}
                pressStyle={{
                  bg: isDropdownActive ? '$bgStrongActive' : '$bgActive',
                }}
                onPress={onPress}
                cursor="pointer"
                userSelect="none"
              >
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={1}
                  color={isDropdownActive ? '$text' : '$textSubdued'}
                >
                  {activeDropdownOption?.label ?? moreLabel}
                </SizableText>
                <Icon
                  name="ChevronDownSmallOutline"
                  size="$4"
                  color={isDropdownActive ? '$icon' : '$iconSubdued'}
                />
              </XStack>
            )}
          />
        ) : null}
      </XStack>
    );
  },
);

TradingViewNativeIntervalSelector.displayName =
  'TradingViewNativeIntervalSelector';
