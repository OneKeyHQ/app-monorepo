import type { FC, ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { TamaguiProvider } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../tamagui.config';
import SafeAreaProvider from '../SafeAreaProvider';
import { ToastProvider } from '../Toast';
import Toaster from '../Toast/Toaster';

import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';
import ScreenSizeProvider from './ScreenSizeProvider';
import SidebarStateProvider from './SidebarStateProvider';

import type { ThemeVariant } from './theme';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  themeVariant: ThemeVariant;

  reduxReady?: boolean;

  waitFontLoaded?: boolean;
};
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

const Provider: FC<UIProviderProps> = ({
  children,
  themeVariant,
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
    <FontProvider waitFontLoaded={waitFontLoaded}>
      <Context.Provider value={providerValue}>
        <ScreenSizeProvider>
          <SidebarStateProvider>
            <SafeAreaProvider>
              <MemoizedTamaguiProvider
                config={config}
                defaultTheme={themeVariant}
              >
                <ToastProvider>{children}</ToastProvider>
                <Toaster />
              </MemoizedTamaguiProvider>
            </SafeAreaProvider>
          </SidebarStateProvider>
        </ScreenSizeProvider>
      </Context.Provider>
    </FontProvider>
  );
};

export default Provider;
