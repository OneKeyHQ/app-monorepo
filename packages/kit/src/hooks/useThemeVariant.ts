import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  defaultColorScheme,
  useSystemColorScheme,
} from './useSystemColorScheme';

export function useThemeVariant() {
  const [{ theme }] = useSettingsPersistAtom();
  const colorScheme = useSystemColorScheme();
  const themeVariant =
    theme === 'system' ? colorScheme ?? defaultColorScheme : theme;
  return themeVariant;
}
