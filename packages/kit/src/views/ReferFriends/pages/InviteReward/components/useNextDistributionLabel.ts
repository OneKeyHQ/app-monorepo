import { useMemo } from 'react';

import { isValid, parseISO } from 'date-fns';

import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';

// Month and day in the locale's own order and words: "Nov 10", "11月10日",
// "10 Nov". A date-fns pattern such as 'MMM d' fixes the order and drops
// suffixes like 日. Keeps the raw value if it is not a date.
export function formatNextDistributionLabel(
  value: string,
  locale: string,
): string {
  const date = parseISO(value);
  if (!isValid(date)) {
    return value;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }
}

export function useNextDistributionLabel(value: string | null | undefined) {
  const locale = useLocaleVariant();
  return useMemo(
    () => (value ? formatNextDistributionLabel(value, locale) : null),
    [locale, value],
  );
}
