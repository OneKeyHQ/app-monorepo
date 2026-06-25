import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import type {
  ITradingViewIntervalConfigData,
  ITradingViewIntervalOption,
} from './types';

const MAX_VISIBLE_INTERVAL_COUNT = 4;
const MAX_PREFERRED_INTERVAL_COUNT = 4;
const INTERVAL_GRID_COLUMN_COUNT = 4;
const INTERVAL_GRID_ITEM_LAYOUT_PROPS = {
  flex: 1,
  flexBasis: 0,
  h: 32,
  minWidth: 0,
  px: '$3',
  borderWidth: 1,
} as const;
const PREFERRED_INTERVAL_STORAGE_KEY =
  'trading_view_native_preferred_intervals_v1';
const DEFAULT_PREFERRED_INTERVAL_LABELS = ['1m', '15m', '1H', '4H'];
const ALL_INTERVAL_OPTION_TEMPLATES = [
  { label: '1m', fallbackValue: '1' },
  { label: '3m', fallbackValue: '3' },
  { label: '5m', fallbackValue: '5' },
  { label: '15m', fallbackValue: '15' },
  { label: '30m', fallbackValue: '30' },
  { label: '1H', fallbackValue: '60' },
  { label: '2H', fallbackValue: '120' },
  { label: '4H', fallbackValue: '240' },
  { label: '8H', fallbackValue: '480' },
  { label: '12H', fallbackValue: '720' },
  { label: '1D', fallbackValue: '1D' },
  { label: '3D', fallbackValue: '3D' },
  { label: '1W', fallbackValue: '1W' },
  { label: '1M', fallbackValue: '1M' },
] as const;

interface ITradingViewNativeIntervalSelectorProps {
  intervalConfig: ITradingViewIntervalConfigData | null;
  onIntervalChange: (interval: string) => void;
}

function buildIntervalItemTestID(section: string, value: string): string {
  return `trading-view-native-interval-${section}-${value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
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
      result.push({
        label,
        value,
        ...(option.disabled === undefined ? {} : { disabled: option.disabled }),
      });
      return result;
    },
    [],
  );
}

function isIntervalOptionDisabled(option: ITradingViewIntervalOption) {
  return option.disabled === true;
}

function normalizeIntervalLabel(label: string) {
  const normalizedLabel = label.replace(/\s/g, '');
  const labelMatch = normalizedLabel.match(/^(\d+)([a-zA-Z]+)$/);
  if (!labelMatch) {
    return normalizedLabel;
  }

  const [, count, unit] = labelMatch;
  if (unit === 'M') {
    return `${count}M`;
  }

  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === 'm') {
    return `${count}m`;
  }
  if (normalizedUnit === 'h') {
    return `${count}H`;
  }
  if (normalizedUnit === 'd') {
    return `${count}D`;
  }
  if (normalizedUnit === 'w') {
    return `${count}W`;
  }

  return normalizedLabel;
}

function formatIntervalOptionDisplayLabel(intl: IntlShape, label: string) {
  const normalizedLabel = normalizeIntervalLabel(label);
  const labelMatch = normalizedLabel.match(/^(\d+)([mHDWM])$/);
  if (!labelMatch) {
    return label;
  }

  const [, count, unit] = labelMatch;
  const number = Number(count);
  if (!Number.isFinite(number)) {
    return label;
  }

  if (unit === 'm') {
    return intl.formatMessage(
      { id: ETranslations.market_number_minute_abbr },
      { number },
    );
  }
  if (unit === 'H') {
    return intl.formatMessage(
      { id: ETranslations.market_number_hour_abbr },
      { number },
    );
  }
  if (unit === 'D') {
    return intl.formatMessage(
      { id: ETranslations.market_number_day_abbr },
      { number },
    );
  }
  if (unit === 'W') {
    return intl.formatMessage(
      { id: ETranslations.market_number_week_abbr },
      { number },
    );
  }
  if (unit === 'M') {
    return intl.formatMessage(
      { id: ETranslations.market_number_month_abbr },
      { number },
    );
  }

  return label;
}

function getAllIntervalOptions(options: ITradingViewIntervalOption[]) {
  const optionsByLabel = new Map<string, ITradingViewIntervalOption>();
  const optionsByValue = new Map<string, ITradingViewIntervalOption>();
  options.forEach((option) => {
    const normalizedLabel = normalizeIntervalLabel(option.label);
    const existingOption = optionsByLabel.get(normalizedLabel);
    if (!existingOption || isIntervalOptionDisabled(existingOption)) {
      optionsByLabel.set(normalizedLabel, option);
    }

    const existingValueOption = optionsByValue.get(option.value);
    if (!existingValueOption || isIntervalOptionDisabled(existingValueOption)) {
      optionsByValue.set(option.value, option);
    }
  });

  const seenValues = new Set<string>();
  const seenLabels = new Set<string>();
  const allOptions: ITradingViewIntervalOption[] =
    ALL_INTERVAL_OPTION_TEMPLATES.map((template) => {
      const normalizedLabel = normalizeIntervalLabel(template.label);
      const matchedOption =
        optionsByLabel.get(normalizedLabel) ??
        optionsByValue.get(template.fallbackValue);
      const option = matchedOption
        ? {
            ...matchedOption,
            label: template.label,
          }
        : {
            label: template.label,
            value: template.fallbackValue,
            disabled: true,
          };

      seenLabels.add(normalizedLabel);
      seenValues.add(option.value);
      return option;
    });

  options.forEach((option) => {
    const normalizedLabel = normalizeIntervalLabel(option.label);
    if (seenLabels.has(normalizedLabel) || seenValues.has(option.value)) {
      return;
    }
    seenLabels.add(normalizedLabel);
    seenValues.add(option.value);
    allOptions.push(option);
  });

  return allOptions;
}

function getDefaultPreferredIntervalValues(
  options: ITradingViewIntervalOption[],
) {
  const defaultValues = DEFAULT_PREFERRED_INTERVAL_LABELS.reduce<string[]>(
    (result, label) => {
      const normalizedLabel = normalizeIntervalLabel(label);
      const matchedOption = options.find(
        (option) =>
          !isIntervalOptionDisabled(option) &&
          normalizeIntervalLabel(option.label) === normalizedLabel,
      );
      if (matchedOption && !result.includes(matchedOption.value)) {
        result.push(matchedOption.value);
      }
      return result;
    },
    [],
  );

  options.forEach((option) => {
    if (
      defaultValues.length < MAX_PREFERRED_INTERVAL_COUNT &&
      !isIntervalOptionDisabled(option) &&
      !defaultValues.includes(option.value)
    ) {
      defaultValues.push(option.value);
    }
  });

  return defaultValues.slice(0, MAX_PREFERRED_INTERVAL_COUNT);
}

function reconcileIntervalValues(
  values: string[] | null | undefined,
  options: ITradingViewIntervalOption[],
) {
  if (!values?.length) {
    return [];
  }

  const optionValueSet = new Set(
    options
      .filter((option) => !isIntervalOptionDisabled(option))
      .map((option) => option.value),
  );
  const seenValues = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const normalizedValue = value.trim();
    if (
      !normalizedValue ||
      seenValues.has(normalizedValue) ||
      !optionValueSet.has(normalizedValue)
    ) {
      return result;
    }

    seenValues.add(normalizedValue);
    result.push(normalizedValue);
    return result;
  }, []);
}

function sortIntervalValues(
  values: string[],
  options: ITradingViewIntervalOption[],
) {
  const optionOrderMap = new Map<string, number>();
  options.forEach((option, index) => {
    optionOrderMap.set(option.value, index);
  });

  return values.toSorted(
    (valueA, valueB) =>
      (optionOrderMap.get(valueA) ?? Number.MAX_SAFE_INTEGER) -
      (optionOrderMap.get(valueB) ?? Number.MAX_SAFE_INTEGER),
  );
}

function parseStoredPreferredIntervalValues(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as
      | { values?: unknown }
      | unknown[];
    const values = Array.isArray(parsedValue)
      ? parsedValue
      : parsedValue.values;
    if (!Array.isArray(values)) {
      return null;
    }

    return values.filter((value): value is string => typeof value === 'string');
  } catch {
    return null;
  }
}

async function readStoredPreferredIntervalValues() {
  try {
    const rawValue = await appStorage.getItem(PREFERRED_INTERVAL_STORAGE_KEY);
    return parseStoredPreferredIntervalValues(rawValue);
  } catch {
    return null;
  }
}

async function saveStoredPreferredIntervalValues(values: string[]) {
  try {
    await appStorage.setItem(
      PREFERRED_INTERVAL_STORAGE_KEY,
      JSON.stringify({
        values,
      }),
    );
  } catch {
    // UI preference only; keep the in-memory state if storage is unavailable.
  }
}

function getOptionsByValues(
  values: string[],
  options: ITradingViewIntervalOption[],
) {
  return values
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is ITradingViewIntervalOption => Boolean(option));
}

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

function IntervalGrid({
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

function IntervalsDialogSection({
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

function IntervalsDialogContent({
  options,
  editableOptions,
  activeInterval,
  preferredValues,
  defaultPreferredValues,
  onIntervalChange,
  onPreferredValuesChange,
}: {
  options: ITradingViewIntervalOption[];
  editableOptions: ITradingViewIntervalOption[];
  activeInterval: string;
  preferredValues: string[];
  defaultPreferredValues: string[];
  onIntervalChange: (interval: string) => void;
  onPreferredValuesChange: (values: string[]) => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [isEditing, setIsEditing] = useState(false);
  const [draftPreferredValues, setDraftPreferredValues] =
    useState(preferredValues);
  const draftPreferredValueSet = useMemo(
    () => new Set(draftPreferredValues),
    [draftPreferredValues],
  );
  const preferredOptions = useMemo(
    () => getOptionsByValues(preferredValues, options),
    [options, preferredValues],
  );
  const reconciledDraftPreferredValues = useMemo(
    () => reconcileIntervalValues(draftPreferredValues, editableOptions),
    [draftPreferredValues, editableOptions],
  );

  const handleIntervalPress = useCallback(
    (option: ITradingViewIntervalOption) => {
      if (isIntervalOptionDisabled(option)) {
        return;
      }
      onIntervalChange(option.value);
      void dialog.close();
    },
    [dialog, onIntervalChange],
  );

  const handleDraftIntervalPress = useCallback(
    (option: ITradingViewIntervalOption) => {
      if (isIntervalOptionDisabled(option)) {
        return;
      }
      setDraftPreferredValues((currentValues) => {
        if (currentValues.includes(option.value)) {
          return currentValues.filter((value) => value !== option.value);
        }

        if (currentValues.length >= MAX_PREFERRED_INTERVAL_COUNT) {
          return currentValues;
        }

        return [...currentValues, option.value];
      });
    },
    [],
  );

  const handleResetPress = useCallback(() => {
    setDraftPreferredValues(defaultPreferredValues);
  }, [defaultPreferredValues]);

  const handleConfirmPress = useCallback(() => {
    if (reconciledDraftPreferredValues.length) {
      onPreferredValuesChange(
        sortIntervalValues(
          reconciledDraftPreferredValues,
          editableOptions,
        ).slice(0, MAX_PREFERRED_INTERVAL_COUNT),
      );
      void dialog.close();
    }
  }, [
    dialog,
    editableOptions,
    onPreferredValuesChange,
    reconciledDraftPreferredValues,
  ]);

  if (isEditing) {
    return (
      <YStack gap="$5">
        <SizableText size="$bodyLg" color="$text">
          {intl.formatMessage(
            { id: ETranslations.market_select_preferred_intervals },
            { number: draftPreferredValues.length },
          )}
        </SizableText>
        <IntervalGrid
          options={editableOptions}
          activeInterval={activeInterval}
          selectedValues={draftPreferredValueSet}
          section="edit"
          showSelectedCheckMarks
          highlightActiveInterval={false}
          maxSelectedCount={MAX_PREFERRED_INTERVAL_COUNT}
          onIntervalPress={handleDraftIntervalPress}
        />
        <XStack gap="$3" pt="$2">
          <Button
            flex={1}
            size="large"
            variant="secondary"
            testID="trading-view-native-intervals-reset-button"
            onPress={handleResetPress}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
          <Button
            flex={1}
            size="large"
            variant="primary"
            testID="trading-view-native-intervals-confirm-button"
            disabled={!reconciledDraftPreferredValues.length}
            onPress={handleConfirmPress}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$6">
      {preferredOptions.length ? (
        <IntervalsDialogSection
          title={intl.formatMessage({
            id: ETranslations.market_preferred_intervals,
          })}
        >
          <IntervalGrid
            options={preferredOptions}
            activeInterval={activeInterval}
            section="preferred"
            onIntervalPress={handleIntervalPress}
          />
        </IntervalsDialogSection>
      ) : null}

      <IntervalsDialogSection
        title={intl.formatMessage({ id: ETranslations.market_all_intervals })}
        action={
          <XStack
            testID="trading-view-native-intervals-edit-button"
            alignItems="center"
            gap="$1"
            px="$1"
            py="$1"
            cursor="pointer"
            userSelect="none"
            onPress={() => {
              setDraftPreferredValues(preferredValues);
              setIsEditing(true);
            }}
          >
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.market_edit_preferred_intervals,
              })}
            </SizableText>
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        }
      >
        <IntervalGrid
          options={options}
          activeInterval={activeInterval}
          section="all"
          onIntervalPress={handleIntervalPress}
        />
      </IntervalsDialogSection>
    </YStack>
  );
}

export const TradingViewNativeIntervalSelector = memo(
  ({
    intervalConfig,
    onIntervalChange,
  }: ITradingViewNativeIntervalSelectorProps) => {
    const intl = useIntl();
    const [storedPreferredIntervalValues, setStoredPreferredIntervalValues] =
      useState<string[] | null>(null);
    const [
      hasLoadedStoredPreferredIntervals,
      setHasLoadedStoredPreferredIntervals,
    ] = useState(false);
    const hasUpdatedPreferredIntervalsRef = useRef(false);
    const intervalsDialogRef = useRef<ReturnType<typeof Dialog.show> | null>(
      null,
    );

    const closeIntervalsDialog = useCallback(() => {
      const dialogInstance = intervalsDialogRef.current;
      intervalsDialogRef.current = null;
      void dialogInstance?.close();
    }, []);

    const options = useMemo(
      () => normalizeIntervalOptions(intervalConfig?.intervals),
      [intervalConfig?.intervals],
    );

    useEffect(() => {
      let isMounted = true;
      void readStoredPreferredIntervalValues()
        .then((values) => {
          if (isMounted && !hasUpdatedPreferredIntervalsRef.current) {
            setStoredPreferredIntervalValues(values);
          }
        })
        .finally(() => {
          if (isMounted) {
            setHasLoadedStoredPreferredIntervals(true);
          }
        });

      return () => {
        isMounted = false;
      };
    }, []);

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

    const defaultPreferredIntervalValues = useMemo(
      () => getDefaultPreferredIntervalValues(options),
      [options],
    );

    const dialogOptions = useMemo(
      () => getAllIntervalOptions(options),
      [options],
    );

    const preferredIntervalValues = useMemo(() => {
      const storedValues = hasLoadedStoredPreferredIntervals
        ? storedPreferredIntervalValues
        : null;
      const reconciledStoredValues = reconcileIntervalValues(
        storedValues,
        options,
      );
      return reconciledStoredValues.length
        ? sortIntervalValues(reconciledStoredValues, dialogOptions).slice(
            0,
            MAX_PREFERRED_INTERVAL_COUNT,
          )
        : defaultPreferredIntervalValues;
    }, [
      defaultPreferredIntervalValues,
      hasLoadedStoredPreferredIntervals,
      dialogOptions,
      options,
      storedPreferredIntervalValues,
    ]);

    const preferredOptions = useMemo(
      () => getOptionsByValues(preferredIntervalValues, options),
      [options, preferredIntervalValues],
    );

    const segmentOptions = useMemo(
      () =>
        preferredOptions.slice(0, MAX_VISIBLE_INTERVAL_COUNT).map((option) => ({
          label: formatIntervalOptionDisplayLabel(intl, option.label),
          value: option.value,
          disabled: isIntervalOptionDisabled(option),
        })),
      [intl, preferredOptions],
    );

    const visibleSegmentValueSet = useMemo(
      () => new Set(segmentOptions.map((option) => option.value)),
      [segmentOptions],
    );

    const activeOption = useMemo(
      () => options.find((option) => option.value === activeInterval) ?? null,
      [activeInterval, options],
    );

    const handlePreferredValuesChange = useCallback(
      (values: string[]) => {
        const reconciledValues = reconcileIntervalValues(values, options);
        const sortedValues = sortIntervalValues(
          reconciledValues,
          dialogOptions,
        ).slice(0, MAX_PREFERRED_INTERVAL_COUNT);
        hasUpdatedPreferredIntervalsRef.current = true;
        setStoredPreferredIntervalValues(sortedValues);
        setHasLoadedStoredPreferredIntervals(true);
        void saveStoredPreferredIntervalValues(sortedValues);
      },
      [dialogOptions, options],
    );

    const moreLabel = intl.formatMessage({ id: ETranslations.global_more });
    const isMoreTriggerActive =
      Boolean(activeOption) && !visibleSegmentValueSet.has(activeInterval);
    let moreTriggerLabel = moreLabel;
    if (isMoreTriggerActive && activeOption) {
      moreTriggerLabel = formatIntervalOptionDisplayLabel(
        intl,
        activeOption.label,
      );
    }

    const showIntervalsDialog = useCallback(() => {
      closeIntervalsDialog();
      const dialogInstance = Dialog.show({
        title: intl.formatMessage({ id: ETranslations.market_intervals }),
        showFooter: false,
        testID: 'trading-view-native-intervals-dialog',
        onClose: () => {
          if (intervalsDialogRef.current === dialogInstance) {
            intervalsDialogRef.current = null;
          }
        },
        renderContent: (
          <IntervalsDialogContent
            options={options}
            editableOptions={dialogOptions}
            activeInterval={activeInterval}
            preferredValues={preferredIntervalValues}
            defaultPreferredValues={defaultPreferredIntervalValues}
            onIntervalChange={onIntervalChange}
            onPreferredValuesChange={handlePreferredValuesChange}
          />
        ),
      });
      intervalsDialogRef.current = dialogInstance;
    }, [
      activeInterval,
      closeIntervalsDialog,
      defaultPreferredIntervalValues,
      dialogOptions,
      handlePreferredValuesChange,
      intl,
      onIntervalChange,
      options,
      preferredIntervalValues,
    ]);

    useEffect(() => closeIntervalsDialog, [closeIntervalsDialog]);

    if (options.length <= 1 || !activeInterval) {
      return null;
    }

    return (
      <XStack gap="$0" alignItems="center">
        {segmentOptions.length ? (
          <SegmentControl
            value={
              visibleSegmentValueSet.has(activeInterval) ? activeInterval : ''
            }
            options={segmentOptions}
            onChange={(value) => {
              const nextOption = options.find(
                (option) => option.value === value,
              );
              if (
                typeof value === 'string' &&
                nextOption &&
                !isIntervalOptionDisabled(nextOption)
              ) {
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
        ) : null}
        {options.length > segmentOptions.length ? (
          <XStack
            testID="trading-view-native-interval-selector-more-select"
            h={30}
            px="$2.5"
            gap="$1"
            alignItems="center"
            borderRadius="$full"
            borderCurve="continuous"
            bg={isMoreTriggerActive ? '$bgStrong' : '$transparent'}
            hoverStyle={{
              bg: isMoreTriggerActive ? '$bgStrongHover' : '$bgHover',
            }}
            pressStyle={{
              bg: isMoreTriggerActive ? '$bgStrongActive' : '$bgActive',
            }}
            onPress={showIntervalsDialog}
            cursor="pointer"
            userSelect="none"
          >
            <SizableText
              size="$bodyMdMedium"
              numberOfLines={1}
              color={isMoreTriggerActive ? '$text' : '$textSubdued'}
            >
              {moreTriggerLabel}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color={isMoreTriggerActive ? '$icon' : '$iconSubdued'}
            />
          </XStack>
        ) : null}
      </XStack>
    );
  },
);

TradingViewNativeIntervalSelector.displayName =
  'TradingViewNativeIntervalSelector';
