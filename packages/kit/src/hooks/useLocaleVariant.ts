import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

import { useSystemLocale } from './useSystemLocale';

export function useLocaleVariant() {
  const [{ locale }] = useSettingsPersistAtom();
  const systemLocale = useSystemLocale();
  return locale === 'system' ? systemLocale : locale;
}
