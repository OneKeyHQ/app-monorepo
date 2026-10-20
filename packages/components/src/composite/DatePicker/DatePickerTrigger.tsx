import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatDate,
  formatDateFns,
} from '@onekeyhq/shared/src/utils/dateUtils';

import { Input } from '../../forms/Input';

import type { IDatePickerTriggerProps, IDateRange } from './type';
import type { IntlShape } from 'react-intl';

// Localized medium date of the app language (date-fns `PP`): "Jul 1, 2026",
// "2026年7月1日". The numeric `LL/dd/yyyy` form reads
// ambiguously outside en-US.
const formatDay = (date: Date) => formatDateFns(date, 'PP');

const formatTriggerValue = (
  value: Date | Date[] | IDateRange | null | undefined,
  mode: string,
  placeholder: string | undefined,
  intl: IntlShape,
): string => {
  if (!value)
    return (
      placeholder ||
      intl.formatMessage({ id: ETranslations.global_select_date })
    );

  if (mode === 'range') {
    const range = value as IDateRange;
    if (!range.start && !range.end)
      return (
        placeholder ||
        intl.formatMessage({ id: ETranslations.global_select_date_range })
      );
    const startStr = range.start ? formatDay(range.start) : '';
    const endStr = range.end ? formatDay(range.end) : '';
    if (startStr && endStr) {
      // En dash with spaces: the typographic range separator.
      return `${startStr} – ${endStr}`;
    }
    return (
      startStr ||
      endStr ||
      placeholder ||
      intl.formatMessage({ id: ETranslations.global_select_date_range })
    );
  }

  if (mode === 'multiple') {
    const dates = value as Date[];
    if (!dates.length)
      return (
        placeholder ||
        intl.formatMessage({ id: ETranslations.global_select_dates })
      );
    return intl.formatMessage(
      { id: ETranslations.global_number_dates_selected },
      { number: dates.length },
    );
  }

  if (mode === 'year') {
    const date = value as Date;
    return date.getFullYear().toString();
  }

  if (mode === 'month') {
    const date = value as Date;
    return formatDate(date, {
      formatTemplate: 'yyyy-MM',
      hideTimeForever: true,
    });
  }

  return formatDay(value as Date);
};

export const DatePickerTrigger = memo(
  ({
    value,
    mode,
    placeholder,
    disabled,
    onClear,
    size = 'small',
  }: IDatePickerTriggerProps) => {
    const intl = useIntl();
    const displayValue = useMemo(
      () => formatTriggerValue(value, mode, placeholder, intl),
      [value, mode, placeholder, intl],
    );

    const hasValue = useMemo(() => {
      if (!value) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (mode === 'range') {
        const range = value as IDateRange;
        return !!range.start || !!range.end;
      }
      return true;
    }, [value, mode]);

    const handleClearPress = useCallback(
      (e: { stopPropagation: () => void }) => {
        e?.stopPropagation();
        onClear?.();
      },
      [onClear],
    );

    const addOns = useMemo(
      () => [
        hasValue && onClear
          ? {
              iconName: 'XCircleOutline' as const,
              onPress: handleClearPress,
            }
          : {
              iconName: 'CalendarOutline' as const,
            },
      ],
      [hasValue, onClear, handleClearPress],
    );

    return (
      // Read-only trigger; QA targets the wrapping date picker.
      // oxlint-disable-next-line onekey/require-testid
      <Input
        value={hasValue ? displayValue : ''}
        disabled={disabled}
        placeholder={placeholder || displayValue}
        readonly
        size={size}
        addOns={addOns}
      />
    );
  },
);

DatePickerTrigger.displayName = 'DatePickerTrigger';
