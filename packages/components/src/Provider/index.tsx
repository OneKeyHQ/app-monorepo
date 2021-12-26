import React, { FC, useMemo, useState } from 'react';

import { StatusBar } from 'expo-status-bar';
import { NativeBaseProvider, extendTheme } from 'native-base';
import { IntlProvider } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LOCALES, { LocaleSymbol, getDefaultLocale } from '../locale';

import { getSize } from './device';
import { Context, useLoadCustomFonts } from './hooks';
import COLORS, { ThemeVariant, getDefaultTheme } from './theme';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  defaultTheme?: ThemeVariant;
  /**
   * default locale symbol
   */
  defaultLocale?: LocaleSymbol;
};

// TODO: use AppLoading with splash screen
const FontProvider: FC = ({ children }) => {
  const [loaded] = useLoadCustomFonts();
  if (loaded) return <>{children}</>;
  if (platformEnv.isNative) {
    return null;
  }
  // Web can render if font not loaded
  // but Native will throw error: Unrecognized font family "PlusJakartaSans-Bold"
  return <>{children}</>;
};

const Provider: FC<UIProviderProps> = ({
  children,
  defaultTheme: initialTheme,
  defaultLocale: initialLocale,
}) => {
  const defaultTheme = getDefaultTheme(initialTheme);
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(defaultTheme);

  const defaultLocale = getDefaultLocale(initialLocale);
  const [locale, setLocale] = useState<LocaleSymbol>(defaultLocale);
  const [isRootRoute, setIsRootRoute] = useState(true);

  const { width, height } = useWindowDimensions();

  const providerValue = useMemo(
    () => ({
      themeVariant,
      setThemeVariant,
      setLocale,
      locale,
      isRootRoute,
      setIsRootRoute,
      device: {
        screenWidth: width,
        screenHeight: height,
        size: getSize(width),
      },
    }),
    [themeVariant, locale, isRootRoute, width, height],
  );

  const themeVar = useMemo(
    () =>
      extendTheme({
        colors: COLORS[themeVariant],
      }),
    [themeVariant],
  );
  return (
    <FontProvider>
      <Context.Provider value={providerValue}>
        <StatusBar style={themeVariant === 'dark' ? 'light' : 'dark'} />
        <IntlProvider locale={locale} messages={LOCALES[locale]}>
          <NativeBaseProvider theme={themeVar}>{children}</NativeBaseProvider>
        </IntlProvider>
      </Context.Provider>
    </FontProvider>
  );
};

export default Provider;
