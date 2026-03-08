import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { Input } from '../../forms/Input';

import type { IDatePickerTriggerProps, IDateRange } from './type';
import type { IntlShape } from 'react-intl';

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
    const fmt = { hideTimeForever: true };
    const startStr = range.start ? formatDate(range.start, fmt) : '';
    const endStr = range.end ? formatDate(range.end, fmt) : '';
    if (startStr && endStr) {
      return `${startStr}  —  ${endStr}`;
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

  const date = value as Date;
  return formatDate(date, { hideTimeForever: true });
};

export const DatePickerTrigger = memo(
  ({
    value,
    mode,
    placeholder,
    disabled,
    onClear,
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

    return (
      <Input
        value={hasValue ? displayValue : ''}
        disabled={disabled}
        placeholder={placeholder || displayValue}
        readonly
        size="small"
        addOns={[
          hasValue && onClear
            ? {
                iconName: 'XCircleOutline' as const,
                onPress: handleClearPress,
              }
            : {
                iconName: 'CalendarOutline' as const,
              },
        ]}
      />
    );
  },
);

DatePickerTrigger.displayName = 'DatePickerTrigger';
