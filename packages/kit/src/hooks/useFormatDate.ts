import { useCallback, useMemo } from 'react';

import {
  format as fnsFormat,
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDuration as fnsFormatDuration,
  parseISO,
} from 'date-fns';

import { parseToDateFnsLocale } from '@onekeyhq/shared/src/utils/dateUtils';

import { useLocaleVariant } from './useLocaleVariant';

import type { Duration } from 'date-fns';

export type IFormatDateOptions = {
  hideTheYear?: boolean;
  hideTheMonth?: boolean;
  hideYear?: boolean;
  hideMonth?: boolean;
  hideTimeForever?: boolean;
  onlyTime?: boolean;
};

export type IFormatMonthOptions = {
  hideTheYear?: boolean;
  hideYear?: boolean;
};

export default function useFormatDate() {
  const locale = useLocaleVariant();

  const format = useCallback(
    (date: Date | string, _format?: string) => {
      let parsedDate: Date;
      if (typeof date === 'string') {
        parsedDate = parseISO(date);
      } else {
        parsedDate = date;
      }

      try {
        return fnsFormat(parsedDate, _format ?? 'PPp', {
          locale: parseToDateFnsLocale(locale),
        });
      } catch (error) {
        return '-';
      }
    },
    [locale],
  );

  const formatDate = useCallback(
    (date: Date | string, options?: IFormatDateOptions) => {
      let parsedDate: Date;
      if (typeof date === 'string') {
        parsedDate = parseISO(date);
      } else {
        parsedDate = date;
      }

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      let formatTemplate = 'yyyy/LL/dd, HH:mm';
      if (['de', 'es', 'en-US', 'fr-FR', 'it-IT', 'uk-UA'].includes(locale)) {
        formatTemplate = 'LL/dd/yyyy, HH:mm';
      }
      if (
        (currentYear === parsedDate.getFullYear() && options?.hideTheYear) ||
        options?.hideYear
      ) {
        formatTemplate = formatTemplate.replace('yyyy/', '');
        formatTemplate = formatTemplate.replace('/yyyy', '');
      }
      if (
        (currentMonth === parsedDate.getMonth() && options?.hideTheMonth) ||
        options?.hideMonth
      ) {
        formatTemplate = formatTemplate.replace('LL/', '');
      }
      if (options?.hideTimeForever) {
        formatTemplate = formatTemplate.replace(', HH:mm', '');
      }
      if (options?.onlyTime) {
        formatTemplate = 'HH:mm';
      }

      return format(parsedDate, formatTemplate) ?? '';
    },
    [format, locale],
  );

  const formatMonth = useCallback(
    (date: Date | string, options?: IFormatMonthOptions) => {
      let parsedDate: Date;
      if (typeof date === 'string') {
        parsedDate = parseISO(date);
      } else {
        parsedDate = date;
      }

      const currentYear = new Date().getFullYear();
      if (
        (currentYear === parsedDate.getFullYear() && options?.hideTheYear) ||
        options?.hideYear
      ) {
        return format(parsedDate, 'MMMM') ?? '';
      }
      return format(parsedDate, 'MMMM, yyyy') ?? '';
    },
    [format],
  );

  const formatDistanceStrict = useCallback(
    (date: Date | number, baseDate: Date | number) =>
      fnsFormatDistanceStrict(date, baseDate, {
        locale: parseToDateFnsLocale(locale),
      }) ?? '',
    [locale],
  );

  const formatDistanceToNow = useCallback(
    (date: Date | number) =>
      fnsFormatDistanceToNow(date, {
        addSuffix: true,
        locale: parseToDateFnsLocale(locale),
      }) ?? '',
    [locale],
  );

  const formatDuration = useCallback(
    (duration: Duration) =>
      fnsFormatDuration(duration, {
        locale: parseToDateFnsLocale(locale),
      }) ?? '',
    [locale],
  );

  return useMemo(
    () => ({
      format,
      formatDate,
      formatMonth,
      formatDistanceToNow,
      formatDuration,
      formatDistanceStrict,
    }),
    [
      format,
      formatDate,
      formatMonth,
      formatDistanceToNow,
      formatDuration,
      formatDistanceStrict,
    ],
  );
}
