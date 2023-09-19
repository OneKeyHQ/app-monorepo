import { useSettings } from './redux';
import { useSystemLocale } from './useSystemLocale';

function normalizePath(path?: string) {
  return path ? path.replace(/^\/|\/$/g, '') : '';
}

export const HELP_LINK = 'https://help.onekey.so/hc';

export function useHelpLink({ path = '' }: { path: string }) {
  const systemLocale = useSystemLocale();
  const { locale } = useSettings();
  const currentLocale = locale === 'system' ? systemLocale : locale;
  // Replace all "_" to "-"
  const normalizedLocale = currentLocale.replace(/_/g, '-').toLowerCase();
  // Remvoe the first and last "/" char
  const normalizedPath = normalizePath(path);
  const finalHref = `${HELP_LINK}/${normalizedLocale}/${normalizedPath}`;
  // In case theres no path at the end, remove the last '/' char
  return normalizePath(finalHref);
}
