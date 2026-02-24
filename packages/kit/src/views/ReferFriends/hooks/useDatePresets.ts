import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IDateRangePreset } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useDatePresets(): IDateRangePreset[] {
  const intl = useIntl();

  return useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.date_today }),
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: intl.formatMessage({ id: ETranslations.date_yesterday }),
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: 'This week',
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          // Monday as start of week
          const day = start.getDay();
          const diff = day === 0 ? 6 : day - 1;
          start.setDate(start.getDate() - diff);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: 'This month',
        getRange: () => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_filter_30 }),
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() - 29);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: 'Last 6 months',
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setMonth(start.getMonth() - 6);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: 'Last 1 year',
        getRange: () => {
          const now = new Date();
          const start = new Date(now);
          start.setFullYear(start.getFullYear() - 1);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
      {
        label: intl.formatMessage({
          id: ETranslations.referral_filter_alltime,
        }),
        getRange: () => {
          const start = new Date('2024-01-01T00:00:00.000');
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          return { start, end };
        },
      },
    ],
    [intl],
  );
}
