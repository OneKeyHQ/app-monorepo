import { useCallback, useMemo } from 'react';

import { format as fnsFormat, parseISO } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';

import { useLocale } from '@onekeyhq/components';
import { LocaleSymbol } from '@onekeyhq/components/src/locale';

const parseLocal = (localeSymbol: LocaleSymbol) => {
  switch (localeSymbol) {
    case 'zh-CN':
      return zhCN;
    case 'en-US':
      return enUS;
    default:
      return enUS;
  }
};

export type FormatDateOptions = {
  hideTheYear?: boolean;
  hideTheMonth?: boolean;
  hideYear?: boolean;
  hideMonth?: boolean;
  hideTimeForever?: boolean;
};

export type FormatMonthOptions = {
  hideTheYear?: boolean;
  hideYear?: boolean;
};

export default function useFormatDate() {
  const { locale } = useLocale();

  const format = useCallback(
    (date: Date | string, _format?: string) => {
      let parsedDate: Date;
      if (typeof date === 'string') {
        parsedDate = parseISO(date);
      } else {
        parsedDate = date;
      }

      return fnsFormat(parsedDate, _format ?? 'PPp', {
        locale: parseLocal(locale),
      });
    },
    [locale],
  );

  const formatDate = useCallback(
    (date: Date | string, options?: FormatDateOptions) => {
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
    (date: Date | string, options?: FormatMonthOptions) => {
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

  return useMemo(
    () => ({ format, formatDate, formatMonth }),
    [format, formatDate, formatMonth],
  );
}
