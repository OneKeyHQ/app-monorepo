import {
  format as fnsFormat,
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDuration as fnsFormatDuration,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';

import { ETranslations, type ILocaleSymbol } from '../locale';
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
  hideSeconds?: boolean;
  formatTemplate?: string;
};

export type IFormatMonthOptions = {
  hideTheYear?: boolean;
  hideYear?: boolean;
};

export function formatDateFns(date: Date | string, _format?: string) {
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

  const locale = appLocale.getLocale();

  let formatTemplate = 'yyyy/LL/dd, HH:mm:ss';

  if (['de', 'es', 'en-US', 'fr-FR', 'it-IT', 'uk-UA'].includes(locale)) {
    formatTemplate = 'LL/dd/yyyy, HH:mm:ss';
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

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
    formatTemplate = formatTemplate.replace(', HH:mm:ss', '');
  }

  return formatDateFns(parsedDate, formatTemplate) ?? '';
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
    return formatDateFns(parsedDate, 'MMMM') ?? '';
  }
  return formatDateFns(parsedDate, 'MMMM, yyyy') ?? '';
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

export function formatRelativeDate(date: Date) {
  const formatRelativeLocale: Record<string, string> = {
    yesterday: `${appLocale.intl.formatMessage({
      id: ETranslations.global_date_yesterday,
    })}`,
    today: `${appLocale.intl.formatMessage({
      id: ETranslations.global_date_today,
    })}`,
    other: 'LLL dd yyyy',
  };

  let formattedDate;

  if (isToday(date)) {
    formattedDate = formatRelativeLocale.today;
  } else if (isYesterday(date)) {
    formattedDate = formatRelativeLocale.yesterday;
  } else {
    formattedDate = formatDateFns(date, formatRelativeLocale.other);
  }

  return formattedDate;
}

export function formatTime(date: Date | string, options?: IFormatDateOptions) {
  let parsedDate: Date;
  if (typeof date === 'string') {
    parsedDate = parseISO(date);
  } else {
    parsedDate = date;
  }

  let formatTemplate = options?.formatTemplate || 'HH:mm:ss';

  if (options?.hideSeconds) {
    formatTemplate = formatTemplate.replace('HH:mm:ss', 'HH:mm');
  }

  return formatDateFns(parsedDate, formatTemplate) ?? '';
}
