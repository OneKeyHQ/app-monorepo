import { useTheme } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { VariableVal } from '@tamagui/core';
import type { ThemeKeys } from '@tamagui/web/src/types';

const useThemeValue = (
  colorSymbol: ThemeKeys,
  fallback?: string | number,
): VariableVal => {
  const theme = useTheme();
  // avoid re-renders
  // https://tamagui.dev/docs/core/use-theme
  const value = platformEnv.isNative
    ? theme?.[colorSymbol]?.val
    : (theme?.[colorSymbol]?.get() as VariableVal);
  return value || fallback || '';
};
export default useThemeValue;
