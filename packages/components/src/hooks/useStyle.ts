import { getTokens as coreGetTokens, useTheme } from '@tamagui/core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { VariableVal } from '@tamagui/core';
import type { UseThemeResult } from '@tamagui/web/types/hooks/useTheme';

export {
  getTokens,
  getTokenValue,
  useTheme,
  useMedia,
  useThemeName,
} from 'tamagui';

export type IThemeColorKeys = keyof UseThemeResult;
const getValue = (
  theme: UseThemeResult,
  key: IThemeColorKeys,
  fallback?: VariableVal,
  isRawValue?: boolean,
): VariableVal => {
  // avoid re-renders
  // https://tamagui.dev/docs/core/use-theme
  const value =
    platformEnv.isNative || isRawValue
      ? theme?.[key]?.val
      : (theme?.[key]?.get() as VariableVal);
  return value || fallback || key;
};

export const getThemeTokens = coreGetTokens;

export function useThemeValue<T extends IThemeColorKeys[] | IThemeColorKeys>(
  colorSymbol: T,
  fallback?: VariableVal,
  isRawValue?: boolean,
): T extends IThemeColorKeys ? string : string[];

export function useThemeValue(
  colorSymbol: IThemeColorKeys | IThemeColorKeys[],
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
