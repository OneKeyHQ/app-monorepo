import {
  format as fnsFormat,
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDistanceToNowStrict as fnsFormatDistanceToNowStrict,
  formatDuration as fnsFormatDuration,
  intervalToDuration,
  isToday,
  isYesterday,
  millisecondsToSeconds,
  parseISO,
} from 'date-fns';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ETranslations, type ILocaleSymbol } from '../locale';
import { appLocale } from '../locale/appLocale';
import { DateLocaleMap } from '../locale/dateLocaleMap';
import { getDefaultLocale } from '../locale/getDefaultLocale';

import type { Duration } from 'date-fns';

export const parseToDateFnsLocale = (localeSymbol: ILocaleSymbol) => {
  let locale = localeSymbol;
  if (localeSymbol === 'system') {
    locale = getDefaultLocale();
  }
  const dateLocale = DateLocaleMap[locale as Exclude<ILocaleSymbol, 'system'>];

  if (dateLocale) return dateLocale;

  throw new OneKeyLocalError(`Unhandled localeSymbol: ${localeSymbol}`);
};

export type IFormatDateOptions = {
  hideTheYear?: boolean;
  hideTheMonth?: boolean;
  hideYear?: boolean;
  hideMonth?: boolean;
  hideTimeForever?: boolean;
  hideSeconds?: boolean;
  formatTemplate?: string;
  hideMilliseconds?: boolean;
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
      locale: parseToDateFnsLocale(locale),
    });
  } catch (error) {
    return '-';
  }
}

export function formatLocaleDate(date: Date) {
  return fnsFormat(date, 'PPP', {
    locale: parseToDateFnsLocale(appLocale.getLocale()),
  });
}

export function formatDate(date: Date | string, options?: IFormatDateOptions) {
  let parsedDate: Date;
  if (typeof date === 'string') {
    parsedDate = parseISO(date);
  } else {
    parsedDate = date;
  }

  let formatTemplate = options?.formatTemplate || '';

  if (!formatTemplate) {
    const locale = appLocale.getLocale();
    formatTemplate = 'yyyy/LL/dd, HH:mm:ss';
    if (['de', 'es', 'en-US', 'fr-FR', 'it-IT', 'uk-UA'].includes(locale)) {
      formatTemplate = 'LL/dd/yyyy, HH:mm:ss';
    }
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
  if (options?.hideSeconds) {
    formatTemplate = formatTemplate.replace('HH:mm:ss', 'HH:mm');
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
    locale: parseToDateFnsLocale(locale),
  });

  return distance ?? '';
}

export function formatDistanceToNowStrict(
  date: Date | number,
  params?: {
    addSuffix?: boolean;
    unit?: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
    roundingMethod?: 'floor' | 'ceil' | 'round';
    locale?: Locale;
  },
) {
  const { addSuffix = true, roundingMethod = 'ceil' } = params || {};
  const locale = appLocale.getLocale();
  const distance = fnsFormatDistanceToNowStrict(date, {
    addSuffix,
    roundingMethod,
    locale: parseToDateFnsLocale(locale),
  });
  return distance ?? '';
}

export function formatDistanceToNow(
  date: Date | number,
  params?: {
    includeSeconds?: boolean;
    addSuffix?: boolean;
    locale?: Locale;
  },
) {
  const { addSuffix = true } = params || {};
  const locale = appLocale.getLocale();
  const distance = fnsFormatDistanceToNow(date, {
    addSuffix,
    locale: parseToDateFnsLocale(locale),
  });
  return distance ?? '';
}

export function formatDuration(duration: Duration, zero?: boolean) {
  const locale = appLocale.getLocale();
  const distance = fnsFormatDuration(duration, {
    locale: parseToDateFnsLocale(locale),
    zero,
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
    other: 'yyyy/LL/dd',
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

  // HH:mm:ss.SSS
  let formatTemplate = options?.formatTemplate || 'HH:mm:ss.SSS';

  if (options?.hideSeconds) {
    formatTemplate = formatTemplate.replace('HH:mm:ss', 'HH:mm');
  }

  if (options?.hideMilliseconds) {
    formatTemplate = formatTemplate.replace('.SSS', '');
  }

  return formatDateFns(parsedDate, formatTemplate) ?? '';
}

export function formatMillisecondsToDays(milliseconds: number): number {
  const duration = intervalToDuration({ start: 0, end: milliseconds });
  return duration.days ?? 0;
}

export function formatMillisecondsToBlocks(
  milliseconds: number,
  blockIntervalSeconds = 600,
): number {
  const seconds = millisecondsToSeconds(milliseconds);
  return Math.ceil(seconds / blockIntervalSeconds);
}

export function formatRelativeTimeAbbr(date: Date | number) {
  let timestamp = date;

  // Auto-detect timestamp format: if it's a number with length <= 10, it's in seconds
  if (typeof date === 'number' && date.toString().length <= 10) {
    timestamp = date * 1000;
  }

  const distance = formatDistanceToNowStrict(timestamp, {
    addSuffix: false,
    roundingMethod: 'floor',
  });

  return distance
    .replace(/\d+\s*seconds?/g, (match) => `${match.match(/\d+/)?.[0] || ''}s`)
    .replace(/\d+\s*minutes?/g, (match) => `${match.match(/\d+/)?.[0] || ''}m`)
    .replace(/\d+\s*hours?/g, (match) => `${match.match(/\d+/)?.[0] || ''}h`)
    .replace(/\d+\s*days?/g, (match) => `${match.match(/\d+/)?.[0] || ''}d`)
    .replace(/\d+\s*months?/g, (match) => `${match.match(/\d+/)?.[0] || ''}mo`)
    .replace(/\d+\s*years?/g, (match) => `${match.match(/\d+/)?.[0] || ''}y`);
}

export default {
  formatDate,
  formatMonth,
  formatTime,
};
