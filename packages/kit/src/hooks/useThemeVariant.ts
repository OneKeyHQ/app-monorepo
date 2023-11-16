import { useMemo } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useColorScheme } from './useColorScheme';
import { useSystemLocale } from './useSystemLocale';

export function useThemeVariant() {
  const [{ theme, locale }] = useSettingsPersistAtom();
  const systemLocale = useSystemLocale();
  const colorScheme = useColorScheme();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  const localeVariant = locale === 'system' ? systemLocale : locale;
  return useMemo(
    () => ({ themeVariant, localeVariant }),
    [themeVariant, localeVariant],
  );
}
