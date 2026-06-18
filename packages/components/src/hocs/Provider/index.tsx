import type { PropsWithChildren } from 'react';
import { memo, useMemo } from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { setGlassHeaderUIStyle } from '../../primitives/Button/GlassHeaderContext';

import { useAppearanceTheme } from './hooks/useAppearanceTheme';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { SettingConfigContext } from './hooks/useProviderValue';
import { TamaguiProvider } from './TamaguiProvider';

import type { TamaguiConfig } from 'tamagui';

export type IUIProviderProps = PropsWithChildren<{
  /**
   * Resolved theme variant used for rendering.
   */
  theme: 'light' | 'dark';

  /**
   * Raw user theme setting (system/auto vs forced light/dark).
   * Optional for hosts that don't have a persisted settings store.
   */
  themeSetting?: 'light' | 'dark' | 'system';

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
  const shouldBypassFontGate =
    platformEnv.isNativeMainThread && platformEnv.enableNativeBackgroundThread;

  if (shouldBypassFontGate) {
    return children;
  }

  if (platformEnv.isNative || platformEnv.isRuntimeBrowser) {
    return loaded || error ? children : null;
  }
  return children;
}

export function ConfigProvider({
  children,
  theme,
  themeSetting,
  locale,
  HyperlinkText,
  onLocaleChange,
}: IUIProviderProps) {
  // On iOS 26 the Liquid Glass nav bar's light/dark variant is driven by
  // react-navigation's theme, which resolves a frame late on each navigation
  // and makes the bar flash its light variant first. Mirror the resolved app
  // theme — correct on the first frame here, since ConfigProvider is an
  // ancestor of every header — so the patched native-stack paints the right
  // variant immediately. iOS 26 only; elsewhere the global stays unset and
  // native-stack keeps its default behavior.
  if (platformEnv.isNativeIOS26Plus) {
    setGlassHeaderUIStyle(theme);
  }

  const providerValue = useMemo(
    () => ({
      theme,
      themeSetting,
      locale,
      HyperlinkText,
    }),
    [theme, themeSetting, locale, HyperlinkText],
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
