import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

/**
 * Shared fallback for rendering the OneKey ID display email: fall back to the
 * localized "Unknown" label when the email is missing.
 */
export function getDisplayEmailOrUnknown({
  intl,
  displayEmail,
}: {
  intl: IntlShape;
  displayEmail: string | undefined;
}): string {
  return (
    displayEmail || intl.formatMessage({ id: ETranslations.global_unknown })
  );
}
