import { useCallback, useMemo } from 'react';

import {
  formatDistanceStrict as fnsFormatDistanceStrict,
  formatDistanceToNow as fnsFormatDistanceToNow,
  formatDistanceToNowStrict as fnsFormatDistanceToNowStrict,
  formatDuration as fnsFormatDuration,
} from 'date-fns';

import {
  formatDateFns,
  formatDate as formatSharedDate,
  formatMonth as formatSharedMonth,
  parseToDateFnsLocale,
} from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IFormatDateOptions,
  IFormatMonthOptions,
} from '@onekeyhq/shared/src/utils/dateUtils';

import { useLocaleVariant } from './useLocaleVariant';

import type { Duration } from 'date-fns';

export type {
  IFormatDateOptions,
  IFormatMonthOptions,
} from '@onekeyhq/shared/src/utils/dateUtils';

export default function useFormatDate() {
  const locale = useLocaleVariant();

  const format = useCallback(
    (date: Date | string, _format?: string) =>
      formatDateFns(date, _format, locale),
    [locale],
  );

  const formatDate = useCallback(
    (date: Date | string, options?: IFormatDateOptions) =>
      formatSharedDate(date, { hideSeconds: true, ...options, locale }),
    [locale],
  );

  const formatMonth = useCallback(
    (date: Date | string, options?: IFormatMonthOptions) =>
      formatSharedMonth(date, { ...options, locale }),
    [locale],
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

  const formatDistanceToNowStrict = useCallback(
    (date: Date | number) =>
      fnsFormatDistanceToNowStrict(date, {
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
      formatDistanceToNowStrict,
      formatDuration,
      formatDistanceStrict,
    }),
    [
      format,
      formatDate,
      formatMonth,
      formatDistanceToNow,
      formatDistanceToNowStrict,
      formatDuration,
      formatDistanceStrict,
    ],
  );
}
