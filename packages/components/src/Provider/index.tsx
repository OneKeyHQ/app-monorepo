import type { FC, PropsWithChildren, ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { IntlProvider } from 'react-intl';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../tamagui.config';
import LOCALES from '../locale';

import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';
import ScreenSizeProvider from './ScreenSizeProvider';
import SidebarStateProvider from './SidebarStateProvider';

import type { ILocaleSymbol } from '../locale';
import type { IntlShape, MessageDescriptor } from 'react-intl';
import Toaster from '../Toast/Toaster';

export type IUIProviderProps = PropsWithChildren<{
  /**
   * default theme variant
   */
  themeVariant: 'light' | 'dark';
  /**
   * default locale symbol
   */
  locale: ILocaleSymbol;

  reduxReady?: boolean;

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
  if (waitFontLoaded && (platformEnv.isNative || platformEnv.isWeb)) {
    return null;
  }
  // Web can render if font not loaded
  // but Native will throw error: Unrecognized font family "PlusJakartaSans-Bold"
  return <>{children}</>;
}

export const intlRef: {
  current: IntlShape | undefined;
} = {
  current: undefined,
};

const Provider: FC<IUIProviderProps> = ({
  children,
  themeVariant,
  locale,
  reduxReady,
  waitFontLoaded,
}) => {
  const providerValue = useMemo(
    () => ({
      themeVariant,
      reduxReady,
    }),
    [themeVariant, reduxReady],
  );

  return (
    <IntlProvider
      ref={(e) => {
        try {
          intlRef.current = e?.state?.intl;
        } catch (error) {
          // debugLogger.common.error('IntlProvider get ref error:', error);
        }
      }}
      locale={locale}
      messages={LOCALES[locale] as Record<string, string>}
    >
      <FontProvider waitFontLoaded={waitFontLoaded}>
        <Context.Provider value={providerValue}>
          <ScreenSizeProvider>
            <SidebarStateProvider>
              <SafeAreaProvider>
                <MemoizedTamaguiProvider
                  config={config}
                  defaultTheme={themeVariant}
                >
                  {children}
                  <Toaster />
                </MemoizedTamaguiProvider>
              </SafeAreaProvider>
            </SidebarStateProvider>
          </ScreenSizeProvider>
        </Context.Provider>
      </FontProvider>
    </IntlProvider>
  );
};

export function formatMessage(
  descriptor: MessageDescriptor,
  values?: Record<string, any>,
) {
  return intlRef?.current?.formatMessage(descriptor, values) || descriptor;
}

export default Provider;
