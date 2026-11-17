import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

// User-facing text for privacy-chain errors and notes, worded in the app's
// language. Background only: the UI formats with its own intl.
export function localWalletText(
  id: ETranslations,
  values?: Record<string, string | number>,
): string {
  return appLocale.intl.formatMessage({ id }, values);
}
