import React, { FC, useState, useMemo } from 'react';
import { NativeBaseProvider, extendTheme } from 'native-base';
import { NavigationContainer } from '@react-navigation/native';
import { IntlProvider } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import COLORS, { getDefaultTheme, ThemeVariant } from './theme';
import LOCALES, { getDefaultLocale, LocaleSymbol } from '../locale';

import { Context } from './hooks';
import { getSize } from './device';

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

const Provider: FC<UIProviderProps> = ({
  children,
  defaultTheme: initialTheme,
  defaultTheme: initialLocale,
}) => {
  const defaultTheme = getDefaultTheme(initialTheme);
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(defaultTheme);

  const defaultLocale = getDefaultLocale(initialLocale);
  const [locale, setLocale] = useState<LocaleSymbol>(defaultLocale);

  const { width, height } = useWindowDimensions();

  const providerValue = useMemo(
    () => ({
      themeVariant,
      setThemeVariant,
      setLocale,
      locale,
      device: {
        screenWidth: width,
        screenHeight: height,
        size: getSize(width),
      },
    }),
    [themeVariant, setThemeVariant, setLocale, locale, width, height],
  );

  const themeVar = useMemo(
    () =>
      extendTheme({
        colors: COLORS[themeVariant],
      }),
    [themeVariant],
  );

  return (
    <Context.Provider value={providerValue}>
      <NavigationContainer>
        <IntlProvider locale={locale} messages={LOCALES[locale]}>
          <NativeBaseProvider theme={themeVar}>{children}</NativeBaseProvider>
        </IntlProvider>
      </NavigationContainer>
    </Context.Provider>
  );
};

export default Provider;
