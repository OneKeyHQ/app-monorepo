import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IDateRange, IDateRangePreset } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function makeRange(getStart: (now: Date) => Date): () => IDateRange {
  return () => {
    const now = new Date();
    return { start: startOfDay(getStart(now)), end: endOfDay(now) };
  };
}

export function useDatePresets(): IDateRangePreset[] {
  const intl = useIntl();

  return useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.date_today }),
        getRange: makeRange((now) => now),
      },
      {
        label: intl.formatMessage({ id: ETranslations.date_yesterday }),
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() - 1);
          return { start: startOfDay(start), end: endOfDay(start) };
        },
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_this_week }),
        getRange: makeRange((now) => {
          const start = new Date(now);
          const day = start.getDay();
          const diff = day === 0 ? 6 : day - 1;
          start.setDate(start.getDate() - diff);
          return start;
        }),
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_this_month }),
        getRange: makeRange(
          (now) => new Date(now.getFullYear(), now.getMonth(), 1),
        ),
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_filter_30 }),
        getRange: makeRange((now) => {
          const start = new Date(now);
          start.setDate(start.getDate() - 29);
          return start;
        }),
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_last_6_months }),
        getRange: makeRange((now) => {
          const start = new Date(now);
          start.setMonth(start.getMonth() - 6);
          return start;
        }),
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_last_1_year }),
        getRange: makeRange((now) => {
          const start = new Date(now);
          start.setFullYear(start.getFullYear() - 1);
          return start;
        }),
      },
      {
        label: intl.formatMessage({
          id: ETranslations.referral_filter_alltime,
        }),
        getRange: makeRange(() => new Date('2024-01-01T00:00:00.000')),
      },
    ],
    [intl],
  );
}
