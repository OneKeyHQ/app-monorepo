import {
  format as fnsFormat,
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDuration as fnsFormatDuration,
  formatRelative,
  parseISO,
} from 'date-fns';

import type { ILocaleSymbol } from '@onekeyhq/components/src/locale';

import { appLocale } from '../locale/appLocale';
import { DateLocaleMap } from '../locale/dateLocaleMap';
import { getDefaultLocale } from '../locale/getDefaultLocale';

import type { Duration } from 'date-fns';

const parseLocal = (localeSymbol: ILocaleSymbol) => {
  let locale = localeSymbol;
  if (localeSymbol === 'system') {
    locale = getDefaultLocale();
  }
  const dateLocale = DateLocaleMap[locale as Exclude<ILocaleSymbol, 'system'>];

  if (dateLocale) return dateLocale;

  throw new Error(`Unhandled localeSymbol: ${localeSymbol}`);
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

function format(date: Date | string, _format?: string) {
  let parsedDate: Date;
  const locale = appLocale.getLocale();
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
}

export function formatDate(date: Date | string, options?: IFormatDateOptions) {
  let parsedDate: Date;
  if (typeof date === 'string') {
    parsedDate = parseISO(date);
  } else {
    parsedDate = date;
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  let formatTemplate = 'LLL dd yyyy, HH:mm:ss';

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
    formatTemplate = formatTemplate.replace(', HH:mm:ss', '');
  }

  return format(parsedDate, formatTemplate) ?? '';
}

export function formatMonth(
  date: Date | string,
  options?: IFormatMonthOptions,
) {
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
}

export function formatDistanceStrict(
  date: Date | number,
  baseDate: Date | number,
) {
  const locale = appLocale.getLocale();
  const distance = fnsFormatDistanceStrict(date, baseDate, {
    locale: parseLocal(locale),
  });

  return distance ?? '';
}

export function formatDistanceToNow(date: Date | number) {
  const locale = appLocale.getLocale();
  const distance = fnsFormatDistanceToNow(date, {
    addSuffix: true,
    locale: parseLocal(locale),
  });

  return distance ?? '';
}

export function formatDuration(duration: Duration) {
  const locale = appLocale.getLocale();
  const distance = fnsFormatDuration(duration, {
    locale: parseLocal(locale),
  });

  return distance ?? '';
}

export function formatRelativeDate(date: Date | number) {
  const parsedLocal = parseLocal(appLocale.getLocale());
  const formatRelativeLocale: Record<string, string> = {
    yesterday: `'${appLocale.intl.formatMessage({
      id: 'content__yesterday',
    })}'`,
    today: `'${appLocale.intl.formatMessage({ id: 'content__today' })}'`,
    other: 'LLL dd yyyy',
  };

  const locale = {
    ...parsedLocal,
    formatRelative: (token: string) => formatRelativeLocale[token],
  };

  try {
    const relativeDate = formatRelative(date, new Date(), { locale });
    return relativeDate ?? '';
  } catch (error) {
    console.error(error);
    return `ParseError:${date.toString()}`;
  }
}
