import { useMemo } from 'react';

import { isValid, parseISO } from 'date-fns';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import {
  formatDateFns,
  getDateFormatTemplate,
} from '@onekeyhq/shared/src/utils/dateUtils';

// Keep the raw value if the server sends a label instead of a date.
export function formatNextDistributionLabel(
  value: string,
  locale: string,
): string {
  const date = parseISO(value);
  if (!isValid(date)) {
    return value;
  }
  return formatDateFns(date, getDateFormatTemplate(locale, { hideYear: true }));
}

export function useNextDistributionLabel(value: string | null | undefined) {
  const locale = useLocaleVariant();
  return useMemo(
    () => (value ? formatNextDistributionLabel(value, locale) : null),
    [locale, value],
  );
}
