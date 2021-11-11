/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useContext, createContext, useMemo } from 'react';
import { useToken } from 'native-base';
import type { ThemeVariant } from './theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  setThemeVariant: (k: ThemeVariant) => void;
};

export const Context = createContext<ContextValue>({} as ContextValue);

export const useTheme = () => {
  const context = useContext(Context);

  return useMemo(
    () => ({
      themeVariant: context.themeVariant,
      setThemeVariant: context.setThemeVariant,
    }),
    [context.themeVariant, context.setThemeVariant],
  );
};

// TODO: 参数从 COLORS 推断强类型
export const useThemeValue = <T extends string | number = any>(
  colorSymbol: T | T[],
  fallback: T | T[],
): T => useToken<T>('colors', colorSymbol, fallback);
