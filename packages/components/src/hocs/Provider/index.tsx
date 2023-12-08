import type { PropsWithChildren, ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../../tamagui.config';
import Toaster from '../../actions/Toast/Toaster';
import { LOCALES } from '../../locale';

import { useAppearanceTheme } from './hooks/useAppearanceTheme';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';
import ScreenSizeProvider from './ScreenSizeProvider';
import SidebarStateProvider from './SidebarStateProvider';

import type { ILocaleSymbol } from '../../locale';

export type IUIProviderProps = PropsWithChildren<{
  /**
   * default theme variant
   */
  theme: 'light' | 'dark';
  /**
   * default locale symbol
   */
  locale: ILocaleSymbol;

  waitFontLoaded?: boolean;
}>;
export type IFontProviderProps = {
  children?: ReactNode;
  waitFontLoaded?: boolean;
};

const MemoizedTamaguiProvider = memo(TamaguiProvider);

function FontProvider({ children, waitFontLoaded = true }: IFontProviderProps) {
  const [loaded] = useLoadCustomFonts();
  if (loaded) return <>{children}</>;
  if (
    waitFontLoaded &&
    (platformEnv.isNative || platformEnv.isRuntimeBrowser)
  ) {
    return null;
  }
  // Web can render if font not loaded
  // but Native will throw error: Unrecognized font family "PlusJakartaSans-Bold"
  return <>{children}</>;
}

export function ConfigProvider({
  children,
  theme,
  locale,
  waitFontLoaded,
}: IUIProviderProps) {
  const providerValue = useMemo(
    () => ({
      theme,
      locale,
    }),
    [theme, locale],
  );

  useAppearanceTheme(theme);
  return (
    <AppIntlProvider
      locale={locale}
      messages={LOCALES[locale] as Record<string, string>}
    >
      <FontProvider waitFontLoaded={waitFontLoaded}>
        <Context.Provider value={providerValue}>
          <ScreenSizeProvider>
            <SidebarStateProvider>
              <SafeAreaProvider>
                <MemoizedTamaguiProvider config={config} defaultTheme={theme}>
                  {children}
                  <Toaster />
                </MemoizedTamaguiProvider>
              </SafeAreaProvider>
            </SidebarStateProvider>
          </ScreenSizeProvider>
        </Context.Provider>
      </FontProvider>
    </AppIntlProvider>
  );
}
