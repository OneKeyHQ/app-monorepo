import React, { FC, useMemo } from 'react';

import { NativeBaseProvider, StatusBar, extendTheme } from 'native-base';
import { IntlProvider } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LOCALES, { LocaleSymbol } from '../locale';

import { SCREEN_SIZE, getSize } from './device';
import { Context, useLoadCustomFonts } from './hooks';
import COLORS, { ThemeVariant } from './theme';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  themeVariant: ThemeVariant;
  /**
   * default locale symbol
   */
  locale: LocaleSymbol;
};

const FontProvider: FC = ({ children }) => {
  const [loaded] = useLoadCustomFonts();
  if (loaded) return <>{children}</>;
  if (platformEnv.isNative || platformEnv.isWeb) {
    return null;
  }
  // Web can render if font not loaded
  // but Native will throw error: Unrecognized font family "PlusJakartaSans-Bold"
  return <>{children}</>;
};

const Provider: FC<UIProviderProps> = ({ children, themeVariant, locale }) => {
  const { width, height } = useWindowDimensions();

  const providerValue = useMemo(
    () => ({
      themeVariant,
      locale,
      device: {
        screenWidth: width,
        screenHeight: height,
        size: getSize(width),
      },
    }),
    [themeVariant, locale, width, height],
  );

  const themeVar = useMemo(
    () =>
      extendTheme({
        colors: COLORS[themeVariant],
        breakpoints: {
          base: 0,
          sm: SCREEN_SIZE.MEDIUM,
          md: SCREEN_SIZE.LARGE,
          lg: SCREEN_SIZE.XLARGE,
        },
        shadows: {
          depth: {
            1: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 1,
              },
              shadowOpacity: 0.05,
              shadowRadius: 1.0,
              elevation: 1,
            },
            2: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 0,
              },
              shadowOpacity: 0.15,
              shadowRadius: 2.0,
              elevation: 2,
            },
            3: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.1,
              shadowRadius: 10.0,
              elevation: 4,
            },
            4: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.15,
              shadowRadius: 20.0,
              elevation: 8,
            },
            5: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowOpacity: 0.2,
              shadowRadius: 40.0,
              elevation: 16,
            },
          },
        },
        components: {
          Image: {
            defaultProps: {
              alt: '-',
            },
          },
          ScrollView: {
            defaultProps: {
              // in CSS: packages/shared/src/web/index.css
              // show/hide scrollbar
              showsVerticalScrollIndicator: false,
            },
          },
        },
      }),
    [themeVariant],
  );
  return (
    <FontProvider>
      <Context.Provider value={providerValue}>
        <StatusBar
          barStyle={themeVariant === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={COLORS[themeVariant]['background-default']}
          animated
        />
        <IntlProvider locale={locale} messages={LOCALES[locale]}>
          <NativeBaseProvider theme={themeVar}>{children}</NativeBaseProvider>
        </IntlProvider>
      </Context.Provider>
    </FontProvider>
  );
};

export default Provider;
