import { getTokens as coreGetTokens, useTheme } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { VariableVal } from '@tamagui/core';
import type { UseThemeResult } from '@tamagui/web/src/hooks/useTheme';

type ThemeKeys = keyof UseThemeResult;
const getValue = (
  theme: UseThemeResult,
  key: ThemeKeys,
  fallback?: VariableVal,
): VariableVal => {
  // avoid re-renders
  // https://tamagui.dev/docs/core/use-theme
  const value = platformEnv.isNative
    ? theme?.[key]?.val
    : (theme?.[key]?.get() as VariableVal);
  return value || fallback || '';
};

export const getThemeTokens = coreGetTokens;

export function useThemeValue<T extends ThemeKeys[] | ThemeKeys>(
  colorSymbol: T,
  fallback?: VariableVal,
): T extends ThemeKeys ? VariableVal : VariableVal[];

export function useThemeValue(
  colorSymbol: ThemeKeys | ThemeKeys[],
  fallback?: VariableVal,
): VariableVal | VariableVal[] {
  const theme = useTheme();
  if (Array.isArray(colorSymbol)) {
    return colorSymbol.map((c) => getValue(theme, c, fallback));
  }
  return getValue(theme, colorSymbol, fallback);
}
