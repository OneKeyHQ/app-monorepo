/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useContext, createContext, useMemo } from 'react';

import { useToken } from 'native-base';
import type { ThemeVariant } from './theme';
import type { LocaleSymbol } from '../locale';
import type { DeviceState } from './device';

export type ContextValue = {
  themeVariant: ThemeVariant;
  setThemeVariant: (k: ThemeVariant) => void;
  locale: LocaleSymbol;
  setLocale: (l: LocaleSymbol) => void;
  device: DeviceState;
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
  fallback?: T | T[],
): T => useToken<T>('colors', colorSymbol, fallback);

export const useLocale = () => {
  const context = useContext(Context);

  return useMemo(
    () => ({
      locale: context.locale,
      setLocale: context.setLocale,
    }),
    [context.locale, context.setLocale],
  );
};

export const useUserDevice = () => {
  const context = useContext(Context);
  return useMemo(() => context.device, [context.device]);
};
