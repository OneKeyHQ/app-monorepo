import { getTokens as coreGetTokens, useTheme } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { VariableVal } from '@tamagui/core';
import type { UseThemeResult } from '@tamagui/web/types/hooks/useTheme';

type ThemeKeys = keyof UseThemeResult;
const getValue = (
  theme: UseThemeResult,
  key: ThemeKeys,
  fallback?: VariableVal,
  isRawValue?: boolean,
): VariableVal => {
  // avoid re-renders
  // https://tamagui.dev/docs/core/use-theme
  const value =
    platformEnv.isNative || isRawValue
      ? theme?.[key]?.val
      : (theme?.[key]?.get() as VariableVal);
  return value || fallback || '';
};

export const getThemeTokens = coreGetTokens;

export function useThemeValue<T extends ThemeKeys[] | ThemeKeys>(
  colorSymbol: T,
  fallback?: VariableVal,
  isRawValue?: boolean,
): T extends ThemeKeys ? string : string[];

export function useThemeValue(
  colorSymbol: ThemeKeys | ThemeKeys[],
  fallback?: VariableVal,
  isRawValue?: boolean,
): VariableVal | VariableVal[] {
  const theme = useTheme();
  if (Array.isArray(colorSymbol)) {
    return colorSymbol.map((c) =>
      getValue(theme, c, fallback, isRawValue),
    ) as string[];
  }
  return getValue(theme, colorSymbol, fallback, isRawValue) as string;
}
