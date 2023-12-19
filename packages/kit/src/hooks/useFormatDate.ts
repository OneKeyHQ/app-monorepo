import { useCallback, useMemo } from 'react';

import {
  format as fnsFormat,
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDuration as fnsFormatDuration,
  parseISO,
} from 'date-fns';
import { enUS, ja, ko, zhCN, zhHK } from 'date-fns/locale';

import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';

import { useLocaleVariant } from './useLocaleVariant';

import type { Duration } from 'date-fns';

const parseLocal = (localeSymbol: ILocaleSymbol) => {
  switch (localeSymbol) {
    case 'zh-CN':
      return zhCN;
    case 'en-US':
      return enUS;
    case 'zh-HK':
      return zhHK;
    case 'ja-JP':
      return ja;
    case 'ko-KR':
      return ko;
    default:
      return enUS;
  }
};

export type IFormatDateOptions = {
  hideTheYear?: boolean;
  hideTheMonth?: boolean;
  hideYear?: boolean;
  hideMonth?: boolean;
  hideTimeForever?: boolean;
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
          locale: parseLocal(locale),
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
      let formatTemplate = 'LLL dd yyyy, HH:mm';

      if (
        (currentYear === parsedDate.getFullYear() && options?.hideTheYear) ||
        options?.hideYear
      ) {
        formatTemplate = formatTemplate.replace(' yyyy', '');
      }
      if (
        (currentMonth === parsedDate.getMonth() && options?.hideTheMonth) ||
        options?.hideMonth
      ) {
        formatTemplate = formatTemplate.replace('LLL ', '');
      }
      if (options?.hideTimeForever) {
        formatTemplate = formatTemplate.replace(', HH:mm', '');
      }

      return format(parsedDate, formatTemplate) ?? '';
    },
    [format],
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
        locale: parseLocal(locale),
      }) ?? '',
    [locale],
  );

  const formatDistanceToNow = useCallback(
    (date: Date | number) =>
      fnsFormatDistanceToNow(date, {
        addSuffix: true,
        locale: parseLocal(locale),
      }) ?? '',
    [locale],
  );

  const formatDuration = useCallback(
    (duration: Duration) =>
      fnsFormatDuration(duration, {
        locale: parseLocal(locale),
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
