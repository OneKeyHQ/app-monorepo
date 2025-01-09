import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

import { useLocaleVariant } from './useLocaleVariant';
import { useSystemLocale } from './useSystemLocale';

function normalizePath(path?: string) {
  return path ? path.replace(/^\/|\/$/g, '') : '';
}

export function useHelpLink({ path = '' }: { path: string }) {
  const systemLocale = useSystemLocale();
  const locale = useLocaleVariant();
  const currentLocale = locale === 'system' ? systemLocale : locale;
  // Replace all "_" to "-"
  const normalizedLocale = currentLocale.replace(/_/g, '-').toLowerCase();
  // Remove the first and last "/" char
  const normalizedPath = normalizePath(path);
  const finalHref = `${HELP_CENTER_URL}/${normalizedLocale}/${normalizedPath}`;
  // In case there is no path at the end, remove the last '/' char
  return normalizePath(finalHref);
}
