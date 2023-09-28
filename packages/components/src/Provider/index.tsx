import type { FC, ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';

import { Toaster } from 'burnt/web';
import { useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import config from '../../tamagui.config';
import { ToastProvider } from '../Toast';

import { getScreenSize } from './device';
import useLoadCustomFonts from './hooks/useLoadCustomFonts';
import { ContextScreenLayout } from './hooks/useProviderScreenLayoutValue';
import { ContextSideBar } from './hooks/useProviderSideBarValue';
import { Context } from './hooks/useProviderValue';

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
  const media = useMedia();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const { width } = useWindowDimensions();
  const [deviceScreenSize, setDeviceScreenSize] = useState(
    getScreenSize(width),
  );
  const currentScreenSize = getScreenSize(width);
  if (currentScreenSize !== deviceScreenSize) {
    setDeviceScreenSize(currentScreenSize);
  }

  const providerValue = useMemo(
    () => ({
      themeVariant,
      reduxReady,
      deviceScreenSize,
    }),
    [themeVariant, reduxReady, deviceScreenSize],
  );

  const [isVerticalLayout, setIsVerticalLayout] = useState(
    currentScreenSize === 'SMALL',
  );
  if ((currentScreenSize === 'SMALL') !== isVerticalLayout) {
    setIsVerticalLayout(currentScreenSize === 'SMALL');
  }

  const providerScreenValue = useMemo(
    () => ({
      isVerticalLayout,
    }),
    [isVerticalLayout],
  );

  const providerSideBarValue = useMemo(
    () => ({
      leftSidebarCollapsed: isCollapsed,
      setLeftSidebarCollapsed: setIsCollapsed,
    }),
    [isCollapsed],
  );
  return (
    <SafeAreaProvider>
      <FontProvider waitFontLoaded={waitFontLoaded}>
        <Context.Provider value={providerValue}>
          <ContextScreenLayout.Provider value={providerScreenValue}>
            <ContextSideBar.Provider value={providerSideBarValue}>
              <MemoizedTamaguiProvider
                config={config}
                defaultTheme={themeVariant}
              >
                <ToastProvider>{children}</ToastProvider>
                <Toaster
                  {...(media.md
                    ? {
                        position: 'top-center',
                      }
                    : { position: 'bottom-right' })}
                  closeButton
                  theme={themeVariant}
                />
              </MemoizedTamaguiProvider>
            </ContextSideBar.Provider>
          </ContextScreenLayout.Provider>
        </Context.Provider>
      </FontProvider>
    </SafeAreaProvider>
  );
};

export default Provider;
