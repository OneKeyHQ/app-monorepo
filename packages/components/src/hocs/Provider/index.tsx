import type { PropsWithChildren } from 'react';
import { memo, useMemo } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppearanceTheme } from './hooks/useAppearanceTheme';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { SettingConfigContext } from './hooks/useProviderValue';
import { TamaguiProvider } from './TamaguiProvider';

import type { TamaguiConfig } from 'tamagui';

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

  HyperlinkText: typeof HyperlinkText;
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
  HyperlinkText,
  onLocaleChange,
}: IUIProviderProps) {
  const providerValue = useMemo(
    () => ({
      theme,
      locale,
      HyperlinkText,
    }),
    [theme, locale, HyperlinkText],
  );

  const config = useMemo(
    () =>
      (
        require('../../../tamagui.config') as {
          default: TamaguiConfig;
        }
      ).default,
    [],
  );

  useAppearanceTheme(theme);
  return (
    <AppIntlProvider locale={locale} onLocaleChange={onLocaleChange}>
      <FontProvider>
        <SettingConfigContext.Provider value={providerValue}>
          <SafeAreaProvider>
            <MemoizedTamaguiProvider config={config} defaultTheme={theme}>
              {children}
            </MemoizedTamaguiProvider>
          </SafeAreaProvider>
        </SettingConfigContext.Provider>
      </FontProvider>
    </AppIntlProvider>
  );
}
