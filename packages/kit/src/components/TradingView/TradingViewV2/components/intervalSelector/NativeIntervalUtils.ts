import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import type { ITradingViewIntervalOption } from '../../types';
import type { IntlShape } from 'react-intl';

export const MAX_VISIBLE_INTERVAL_COUNT = 4;
export const MAX_PREFERRED_INTERVAL_COUNT = 4;
export const INTERVAL_GRID_COLUMN_COUNT = 4;
export const INTERVAL_GRID_ITEM_LAYOUT_PROPS = {
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

export function buildIntervalItemTestID(
  section: string,
  value: string,
): string {
  return `trading-view-native-interval-${section}-${value
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80)}`;
}

export function normalizeIntervalOptions(
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

export function isIntervalOptionDisabled(option: ITradingViewIntervalOption) {
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

export function formatIntervalOptionDisplayLabel(
  intl: IntlShape,
  label: string,
) {
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

export function getAllIntervalOptions(options: ITradingViewIntervalOption[]) {
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

export function getDefaultPreferredIntervalValues(
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

export function reconcileIntervalValues(
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

export function sortIntervalValues(
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

export async function readStoredPreferredIntervalValues() {
  try {
    const rawValue = await appStorage.getItem(PREFERRED_INTERVAL_STORAGE_KEY);
    return parseStoredPreferredIntervalValues(rawValue);
  } catch {
    return null;
  }
}

export async function saveStoredPreferredIntervalValues(values: string[]) {
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

export function getOptionsByValues(
  values: string[],
  options: ITradingViewIntervalOption[],
) {
  return values
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is ITradingViewIntervalOption => Boolean(option));
}
