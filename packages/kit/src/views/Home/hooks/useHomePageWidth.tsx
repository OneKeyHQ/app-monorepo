import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { getTokens, useMedia, useOrientation } from '@onekeyhq/components';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
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
  const sideBarWidth = useMemo(() => getTokens().size.sideBarWidth.val, []);
  const { leftSidebarCollapsed } = useProviderSideBarValue();
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
