import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  useMedia,
  useOrientation,
} from '@onekeyhq/components';
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function useHomePageWidth() {
  const { md } = useMedia();
  const isLandscape = useOrientation();
  const screenWidth = useWindowDimensions().width;
  const screenHeight = useWindowDimensions().height;

  const calScreenWidth = useMemo(() => {
    if (platformEnv.isNativeIOSPad) {
      return isLandscape
        ? Math.max(screenWidth, screenHeight)
        : Math.min(screenWidth, screenHeight);
    }
    return screenWidth;
  }, [isLandscape, screenHeight, screenWidth]);
  const [{ isCollapsed: leftSidebarCollapsed }] = useAppSideBarStatusAtom();
  const sideBarWidth = useMemo(
    () => (leftSidebarCollapsed ? MIN_SIDEBAR_WIDTH : MAX_SIDEBAR_WIDTH),
    [leftSidebarCollapsed],
  );
  const pageWidth = useMemo(() => {
    if (md) {
      return calScreenWidth;
    }

    if (leftSidebarCollapsed) {
      return calScreenWidth;
    }

    if (platformEnv.isNativeIOSPad && !isLandscape) {
      return calScreenWidth;
    }

    return calScreenWidth - sideBarWidth;
  }, [calScreenWidth, isLandscape, leftSidebarCollapsed, md, sideBarWidth]);

  return {
    screenWidth: calScreenWidth,
    pageWidth,
  };
}
