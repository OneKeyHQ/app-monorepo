import type { PropsWithChildren } from 'react';
import { memo, useMemo } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../../tamagui.config';

import { useAppearanceTheme } from './hooks/useAppearanceTheme';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';
import SidebarStateProvider from './SidebarStateProvider';

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

  onLocaleChange?: (locale: ILocaleSymbol) => void;
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

export function ConfigProvider({
  children,
  theme,
  locale,
  onLocaleChange,
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
    <AppIntlProvider locale={locale} onLocaleChange={onLocaleChange}>
      <FontProvider>
        <Context.Provider value={providerValue}>
          <SidebarStateProvider>
            <SafeAreaProvider>
              <MemoizedTamaguiProvider config={config} defaultTheme={theme}>
                {children}
              </MemoizedTamaguiProvider>
            </SafeAreaProvider>
          </SidebarStateProvider>
        </Context.Provider>
      </FontProvider>
    </AppIntlProvider>
  );
}
