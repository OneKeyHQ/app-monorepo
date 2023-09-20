import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../tamagui.config';

import { getScreenSize } from './device';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { Context } from './hooks/useProviderValue';

import type { ThemeVariant } from './theme';

export type UIProviderProps = {
  /**
   * default theme variant
   */
  themeVariant: ThemeVariant;

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

const Provider: FC<UIProviderProps> = ({
  children,
  themeVariant,
  reduxReady,
  waitFontLoaded,
  leftSidebarCollapsed,
  setLeftSidebarCollapsed,
}) => {
  const { width, height } = useWindowDimensions();
  const providerValue = useMemo(
    () => ({
      themeVariant,
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
      reduxReady,
      width,
      height,
      leftSidebarCollapsed,
      setLeftSidebarCollapsed,
    ],
  );

  return (
    <FontProvider waitFontLoaded={waitFontLoaded}>
      <Context.Provider value={providerValue}>
        <TamaguiProvider config={config} defaultTheme={themeVariant}>
          {children}
        </TamaguiProvider>
      </Context.Provider>
    </FontProvider>
  );
};

export default Provider;
