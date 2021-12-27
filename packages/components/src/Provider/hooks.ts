/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createContext, useContext, useMemo } from 'react';

import { useFonts } from 'expo-font';
import { useToken } from 'native-base';
import { useSafeAreaInsets as useRNSafeAreaInsets } from 'react-native-safe-area-context';

import type { LocaleSymbol } from '../locale';
import type { DeviceState } from './device';
import type { ThemeValues, ThemeVariant } from './theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  setThemeVariant: (k: ThemeVariant) => void;
  locale: LocaleSymbol;
  setLocale: (l: LocaleSymbol) => void;
  device: DeviceState;
  isRootRoute: boolean;
  setIsRootRoute: (value: boolean) => void;
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

type ThemeToken = keyof ThemeValues;

export const useThemeValue = <T extends ThemeToken[] | ThemeToken>(
  colorSymbol: T,
  fallback?: T,
): T extends Array<string> ? string[] : string =>
  useToken<any>('colors', colorSymbol, fallback);

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

const customFont = {
  'PlusJakartaSans-Bold': require('./fonts/PlusJakartaSans-Bold.ttf'),
  'PlusJakartaSans-Medium': require('./fonts/PlusJakartaSans-Medium.ttf'),
  'PlusJakartaSans-SemiBold': require('./fonts/PlusJakartaSans-SemiBold.ttf'),
};

export function useLoadCustomFonts() {
  return useFonts(customFont);
}

export function useSafeAreaInsets() {
  return useRNSafeAreaInsets();
}

export function useIsRootRoute() {
  const context = useContext(Context);
  return useMemo(
    () => ({
      isRootRoute: context.isRootRoute,
      setIsRootRoute: context.setIsRootRoute,
    }),
    [context.isRootRoute, context.setIsRootRoute],
  );
}
