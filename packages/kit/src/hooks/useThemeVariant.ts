import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { defaultColorScheme } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSystemColorScheme } from './useSystemColorScheme';

export function useThemeVariant() {
  const [{ theme }] = useSettingsPersistAtom();
  // startup theme on web: apps/ext/src/assets/preload-html-head.js

  const colorScheme = useSystemColorScheme(
    platformEnv.isDesktop ? 0 : undefined,
  );
  const themeVariant =
    theme === 'system' ? (colorScheme ?? defaultColorScheme) : theme;
  return themeVariant;
}
