import type { FC, ReactNode } from 'react';
import { createRef, useMemo } from 'react';

import { config } from '@tamagui/config';
import { setupReactNative } from '@tamagui/core';
import { NativeBaseProvider, StatusBar, extendTheme } from 'native-base';
import { IntlProvider } from 'react-intl';
import {
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { TamaguiProvider } from 'tamagui';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LOCALES from '../locale';
import { Body1Props, Body2Props, SubheadingProps } from '../Typography';

import { SCREEN_SIZE, getScreenSize } from './device';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';
import COLORS from './theme';

import type { LocaleSymbol } from '../locale';
import type { ThemeVariant } from './theme';
import type { IntlShape, MessageDescriptor } from 'react-intl';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  themeVariant: ThemeVariant;
  /**
   * default locale symbol
   */
  locale: LocaleSymbol;

  reduxReady?: boolean;

  waitFontLoaded?: boolean;

  leftSidebarCollapsed?: boolean;
  setLeftSidebarCollapsed?: (value: boolean) => void;
};
export type IFontProviderProps = {
  children?: ReactNode;
  waitFontLoaded?: boolean;
};
function FontProvider({ children, waitFontLoaded = true }: IFontProviderProps) {
  const [loaded] = useLoadCustomFonts();
  if (loaded) return <>{children}</>;
  if (waitFontLoaded && (platformEnv.isNative || platformEnv.isWeb)) {
    return null;
  }
  // Web can render if font not loaded
  // but Native will throw error: Unrecognized font family "PlusJakartaSans-Bold"
  return <>{children}</>;
}
export const intlRef = createRef<IntlShape>();

setupReactNative({
  View,
  Text,
});

const Provider: FC<UIProviderProps> = ({
  children,
  themeVariant,
  locale,
  reduxReady,
  waitFontLoaded,
  leftSidebarCollapsed,
  setLeftSidebarCollapsed,
}) => {
  const { width, height } = useWindowDimensions();

  const providerValue = useMemo(
    () => ({
      themeVariant,
      locale,
      reduxReady,
      device: {
        screenWidth: width,
        screenHeight: height,
        size: getScreenSize(width),
      },
      leftSidebarCollapsed,
      setLeftSidebarCollapsed,
    }),
    [
      themeVariant,
      locale,
      reduxReady,
      width,
      height,
      leftSidebarCollapsed,
      setLeftSidebarCollapsed,
    ],
  );

  const themeVar = useMemo(
    () =>
      extendTheme({
        colors: {
          primary: {
            400: COLORS[themeVariant]['interactive-default'],
          },
          ...COLORS[themeVariant],
        },
        breakpoints: {
          base: 0,
          sm: SCREEN_SIZE.MEDIUM,
          md: SCREEN_SIZE.LARGE,
          lg: SCREEN_SIZE.XLARGE,
          xl: SCREEN_SIZE.ULTRALARGE,
        },
        shadows: {
          depth: {
            1: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 0.5,
              },
              shadowOpacity: 0.05,
              shadowRadius: 0.25,
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
          Input: {
            baseStyle: {
              focusOutlineColor: 'interactive-default',
              invalidOutlineColor: 'border-critical-default',
              // This code is a temporary solution to a problem with the NativeBase library, specifically with the selection color of input fields in the ios and android operating systems. https://github.com/GeekyAnts/NativeBase/issues/5420
              _focus: {
                _ios: {
                  selectionColor: 'unset',
                },
                _android: {
                  selectionColor: 'unset',
                },
              },
            },
          },
          Textarea: {
            baseStyle: {
              focusOutlineColor: 'interactive-default',
              invalidOutlineColor: 'border-critical-default',
            },
          },
          ScrollView: {
            defaultProps: {
              // in CSS: packages/shared/src/web/index.css
              // show/hide scrollbar
              showsVerticalScrollIndicator: false,
            },
          },

          Menu: {
            // Official Menu configuration documentation: https://github.com/GeekyAnts/NativeBase/blob/master/src/theme/components/menu.ts
            baseStyle: {
              px: 0,
              py: 1,
              bg: COLORS[themeVariant]['surface-default'],
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: COLORS[themeVariant]['border-subdued'],
              borderRadius: 12,
              shadow: 'depth.3',
              _presenceTransition: {
                animate: {
                  transition: {
                    duration: 100,
                    easing: Easing.bezier(0, 0, 0.2, 1),
                  },
                },
                exit: {
                  transition: {
                    duration: 75,
                    easing: Easing.bezier(0.4, 0, 1, 1),
                  },
                },
              },
            },
          },
          MenuGroup: {
            baseStyle: {
              px: 4,
              pb: 1,
              _title: {
                ...SubheadingProps,
                color: COLORS[themeVariant]['text-subdued'],
              },
            },
          },
          MenuItem: {
            baseStyle: {
              px: 0,
              mx: 1,
              py: platformEnv.isNative ? 2.5 : 2,
              borderRadius: 8,
              _text: {
                ...(platformEnv.isNative ? Body1Props : Body2Props),
                color: COLORS[themeVariant]['text-default'],
              },
              _disabled: {
                _text: {
                  color: COLORS[themeVariant]['text-disabled'],
                },
              },
              _hover: {
                bg: COLORS[themeVariant]['surface-hovered'],
              },
              _focus: {
                bg: COLORS[themeVariant]['surface-hovered'],
              },
              _pressed: {
                bg: COLORS[themeVariant]['surface-pressed'],
              },
              _focusVisible: {
                _web: {
                  bg: COLORS[themeVariant]['surface-pressed'],
                },
              },
              _icon: {
                color: COLORS[themeVariant]['interactive-default'],
              },
            },
            variants: {
              highlight: () => ({
                _text: {
                  color: COLORS[themeVariant]['interactive-default'],
                },
              }),
              destructive: () => ({
                _text: {
                  color: COLORS[themeVariant]['text-critical'],
                },
              }),
            },
          },
        },
      }),
    [themeVariant],
  );
  return (
    <FontProvider waitFontLoaded={waitFontLoaded}>
      <Context.Provider value={providerValue}>
        <StatusBar
          barStyle={themeVariant === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={COLORS[themeVariant]['background-default']}
          animated
        />
        <IntlProvider
          ref={(e) => {
            try {
              // eslint-disable-line
              // @ts-expect-error
              intlRef.current = e?.state?.intl;
            } catch (error) {
              debugLogger.common.error('IntlProvider get ref error:', error);
            }
          }}
          locale={locale}
          // @ts-ignore
          messages={LOCALES[locale]}
        >
          <NativeBaseProvider
            config={{
              suppressColorAccessibilityWarning: true,
            }}
            theme={themeVar}
          >
            <View style={{ flex: 1 }}>
              <TamaguiProvider config={config}>{children}</TamaguiProvider>
            </View>
          </NativeBaseProvider>
        </IntlProvider>
      </Context.Provider>
    </FontProvider>
  );
};

export default Provider;

export function formatMessage(
  descriptor: MessageDescriptor,
  values?: Record<string, any>,
) {
  return intlRef?.current?.formatMessage(descriptor, values);
}
