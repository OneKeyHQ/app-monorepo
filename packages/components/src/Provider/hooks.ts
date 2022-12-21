/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createContext, useContext, useMemo } from 'react';

import { useFonts } from 'expo-font';
import { useToken } from 'native-base';
import { useSafeAreaInsets as useRNSafeAreaInsets } from 'react-native-safe-area-context';

import type { LocaleSymbol } from '../locale';
import type { DeviceState } from './device';
import type { ThemeToken, ThemeVariant } from './theme';

export type ContextValue = {
  themeVariant: ThemeVariant;
  locale: LocaleSymbol;
  device: DeviceState;
  hapticsEnabled: boolean;
};

export const Context = createContext<ContextValue>({} as ContextValue);

export const useProviderValue = () => useContext(Context);

export const useTheme = () => {
  const context = useContext(Context);

  return useMemo(
    () => ({
      themeVariant: context.themeVariant,
      isLight: context.themeVariant === 'light',
      isDark: context.themeVariant === 'dark',
    }),
    [context.themeVariant],
  );
};
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
    }),
    [context.locale],
  );
};
export const useUserDevice = () => {
  const context = useContext(Context);
  return useMemo(() => context.device || {}, [context.device]);
};

export const useIsVerticalLayout = () => {
  const { size } = useUserDevice();
  return useMemo(() => ['SMALL'].includes(size), [size]);
};

const customFont = {
  // 'PlusJakartaSans-Bold': require('./fonts/PlusJakartaSans-Bold.ttf'),
  // 'PlusJakartaSans-Medium': require('./fonts/PlusJakartaSans-Medium.ttf'),
  // 'PlusJakartaSans-SemiBold': require('./fonts/PlusJakartaSans-SemiBold.ttf'),
  'Roboto-Mono': require('./fonts/RobotoMono-Regular.ttf'),
};

export function useLoadCustomFonts() {
  return useFonts(customFont);
}

export const useSafeAreaInsets = useRNSafeAreaInsets;
