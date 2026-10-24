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
  hideDay?: boolean;
  hideTimeForever?: boolean;
  hideSeconds?: boolean;
  onlyTime?: boolean;
  formatTemplate?: string;
  hideMilliseconds?: boolean;
  locale?: ILocaleSymbol;
  timeZone?: string;
};

export type IFormatMonthOptions = {
  hideTheYear?: boolean;
  hideYear?: boolean;
  locale?: ILocaleSymbol;
};

const DATE_FORMAT_TEMPLATES: Record<
  Exclude<ILocaleSymbol, 'system'>,
  string
> = {
  'en': 'MM/dd/yyyy',
  'en-US': 'MM/dd/yyyy',
  'zh-CN': 'yyyy/MM/dd',
  'zh-HK': 'dd/MM/yyyy',
  'zh-TW': 'yyyy/MM/dd',
  'ja-JP': 'yyyy/MM/dd',
  'ko-KR': 'yyyy. MM. dd.',
  'bn': 'dd/MM/yyyy',
  'de': 'dd.MM.yyyy',
  'es': 'dd/MM/yyyy',
  'fr-FR': 'dd/MM/yyyy',
  'hi-IN': 'dd/MM/yyyy',
  'id': 'dd/MM/yyyy',
  'it-IT': 'dd/MM/yyyy',
  'pt': 'dd/MM/yyyy',
  'pt-BR': 'dd/MM/yyyy',
  'ru': 'dd.MM.yyyy',
  'th-TH': 'dd/MM/yyyy',
  'uk-UA': 'dd.MM.yyyy',
  'vi': 'dd/MM/yyyy',
};

export function getDateFormatTemplate(
  localeSymbol: string = appLocale.getLocale(),
  options?: Pick<IFormatDateOptions, 'hideYear' | 'hideMonth' | 'hideDay'>,
) {
  const locale = localeSymbol === 'system' ? getDefaultLocale() : localeSymbol;
  const template = Object.hasOwn(DATE_FORMAT_TEMPLATES, locale)
    ? DATE_FORMAT_TEMPLATES[locale as Exclude<ILocaleSymbol, 'system'>]
    : DATE_FORMAT_TEMPLATES.en;
  return omitDateFormatFields(template, options);
}

export function omitDateFormatFields(
  template: string,
  options?: Pick<IFormatDateOptions, 'hideYear' | 'hideMonth' | 'hideDay'>,
) {
  'worklet';

  const parts = template
    .split(/[/. -]+/)
    .filter(
      (part) =>
        part &&
        !(part === 'yyyy' && options?.hideYear) &&
        !(part === 'MM' && options?.hideMonth) &&
        !(part === 'dd' && options?.hideDay),
    );
  let separator = '/';
  if (template.includes('-')) {
    separator = '-';
  } else if (template.includes('.')) {
    separator = '.';
  }
  if (template.includes('. ')) {
    separator = '. ';
  }
  return `${parts.join(separator)}${template.endsWith('.') && parts.length ? '.' : ''}`;
}

type IDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

// Numeric display templates are also used on the native chart UI runtime.
export function formatDateTimeParts(parts: IDateTimeParts, template: string) {
  'worklet';

  const values: Record<string, string> = {
    yyyy: String(parts.year).padStart(4, '0'),
    MM: String(parts.month).padStart(2, '0'),
    dd: String(parts.day).padStart(2, '0'),
    HH: String(parts.hours).padStart(2, '0'),
    mm: String(parts.minutes).padStart(2, '0'),
    ss: String(parts.seconds).padStart(2, '0'),
    SSS: String(parts.milliseconds).padStart(3, '0'),
  };
  return template.replace(/yyyy|MM|dd|HH|mm|ss|SSS/g, (token) => values[token]);
}

export function getDateTimeParts(date: Date): IDateTimeParts {
  'worklet';

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds(),
  };
}

const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();

export function getDateTimePartsInTimeZone(
  date: Date,
  timeZone?: string,
): IDateTimeParts {
  if (!timeZone) {
    return getDateTimeParts(date);
  }
  let formatter = timeZoneFormatters.get(timeZone);
  if (!formatter) {
    // Extract Gregorian/Latin fields only; UI ordering is defined above.
    formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone,
    });
    timeZoneFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
    seconds: get('second'),
    milliseconds: date.getMilliseconds(),
  };
}

export function formatDateFns(
  date: Date | string,
  _format?: string,
  localeSymbol: ILocaleSymbol = appLocale.getLocale(),
) {
  let parsedDate: Date;
  if (typeof date === 'string') {
    parsedDate = parseISO(date);
  } else {
    parsedDate = date;
  }
  try {
    return fnsFormat(
      parsedDate,
      _format ?? `${getDateFormatTemplate(localeSymbol)} HH:mm`,
      {
        locale: parseToDateFnsLocale(localeSymbol),
      },
    );
  } catch (_error) {
    return '-';
  }
}

export function formatLocaleDate(date: Date) {
  return formatDate(date, { hideTimeForever: true });
}

export function formatDate(date: Date | string, options?: IFormatDateOptions) {
  let parsedDate: Date;
  if (typeof date === 'string') {
    parsedDate = parseISO(date);
  } else {
    parsedDate = date;
  }

  if (!Number.isFinite(parsedDate.getTime())) {
    return '-';
  }
  const locale = options?.locale ?? appLocale.getLocale();
  const parts = getDateTimePartsInTimeZone(parsedDate, options?.timeZone);
  const current = getDateTimePartsInTimeZone(new Date(), options?.timeZone);
  const hideYear =
    options?.hideYear || (options?.hideTheYear && current.year === parts.year);
  const hideMonth =
    options?.hideMonth ||
    (options?.hideTheMonth && current.month === parts.month);
  if (!options?.formatTemplate) {
    const dateTemplate = getDateFormatTemplate(locale, {
      hideYear,
      hideMonth,
      hideDay: options?.hideDay,
    });
    const timeTemplate = options?.hideSeconds ? 'HH:mm' : 'HH:mm:ss';
    const template = options?.onlyTime
      ? timeTemplate
      : [dateTemplate, options?.hideTimeForever ? '' : timeTemplate]
          .filter(Boolean)
          .join(' ');
    return formatDateTimeParts(parts, template);
  }

  // Explicit templates are also used for filenames and machine-readable values.
  let formatTemplate = options.formatTemplate;

  if (hideYear) {
    formatTemplate = formatTemplate.replace('yyyy/', '');
    formatTemplate = formatTemplate.replace('/yyyy', '');
  }
  if (hideMonth) {
    formatTemplate = formatTemplate.replace('LL/', '');
  }
  if (options?.hideTimeForever) {
    formatTemplate = formatTemplate.replace(', HH:mm:ss', '');
  }
  if (options?.hideSeconds) {
    formatTemplate = formatTemplate.replace('HH:mm:ss', 'HH:mm');
  }

  if (options.onlyTime) {
    formatTemplate = options.hideSeconds ? 'HH:mm' : 'HH:mm:ss';
  }
  return formatDateFns(parsedDate, formatTemplate, locale) ?? '';
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

  return formatDate(parsedDate, {
    ...options,
    hideDay: true,
    hideTimeForever: true,
  });
}

export function formatDistanceStrict(
  date: Date | number,
  baseDate: Date | number,
  addSuffix?: boolean,
  roundingMethod?: 'floor' | 'ceil' | 'round',
  localeSymbol?: ILocaleSymbol,
) {
  const locale = localeSymbol ?? appLocale.getLocale();
  const distance = fnsFormatDistanceStrict(date, baseDate, {
    locale: parseToDateFnsLocale(locale),
    addSuffix,
    roundingMethod,
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
    yesterday: appLocale.intl.formatMessage({
      id: ETranslations.global_date_yesterday,
    }),
    today: appLocale.intl.formatMessage({
      id: ETranslations.global_date_today,
    }),
  };

  let formattedDate;

  if (isToday(date)) {
    formattedDate = formatRelativeLocale.today;
  } else if (isYesterday(date)) {
    formattedDate = formatRelativeLocale.yesterday;
  } else {
    formattedDate = formatDate(date, { hideTimeForever: true });
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
    // Also hide milliseconds when hiding seconds
    formatTemplate = formatTemplate.replace('.SSS', '');
  } else if (options?.hideMilliseconds) {
    formatTemplate = formatTemplate.replace('.SSS', '');
  }

  if (!Number.isFinite(parsedDate.getTime())) {
    return '-';
  }
  if (options?.timeZone && !options.formatTemplate) {
    return formatDateTimeParts(
      getDateTimePartsInTimeZone(parsedDate, options.timeZone),
      formatTemplate,
    );
  }
  return formatDateFns(parsedDate, formatTemplate, options?.locale) ?? '';
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
