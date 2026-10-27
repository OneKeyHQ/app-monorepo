import type { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// Server-provided labels: a translation key when the client knows it, with
// the server's own text as the fallback.
export function getDisplayLabel(
  intl: IntlShape,
  labelKey?: string,
  fallback?: string,
): string {
  if (labelKey) {
    return intl.formatMessage({
      id: labelKey as ETranslations,
      defaultMessage: fallback,
    });
  }
  return fallback ?? '';
}
