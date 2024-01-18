import type { PropsWithChildren } from 'react';
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
export type IFontProviderProps = PropsWithChildren;

const MemoizedTamaguiProvider = memo(TamaguiProvider);

function FontProvider({ children }: IFontProviderProps) {
  const [loaded, error] = useLoadCustomFonts();
  if (platformEnv.isNative || platformEnv.isRuntimeBrowser) {
    return loaded || error ? children : null;
  }
  return children;
}

export function ConfigProvider({ children, theme, locale }: IUIProviderProps) {
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
      <FontProvider>
        <Context.Provider value={providerValue}>
          <SidebarStateProvider>
            <SafeAreaProvider>
              <MemoizedTamaguiProvider config={config} defaultTheme={theme}>
                {children}
                <Toaster />
              </MemoizedTamaguiProvider>
            </SafeAreaProvider>
          </SidebarStateProvider>
        </Context.Provider>
      </FontProvider>
    </AppIntlProvider>
  );
}
