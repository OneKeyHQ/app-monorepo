import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useColorScheme } from './useColorScheme';

export function useThemeVariant() {
  const [{ theme }] = useSettingsPersistAtom();
  const colorScheme = useColorScheme();
  const themeVariant = theme === 'system' ? colorScheme ?? 'dark' : theme;
  return themeVariant;
}
