import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { getTokens, useMedia, useOrientation } from '@onekeyhq/components';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function useHomePageWidth() {
  const { md } = useMedia();
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = useMemo(() => getTokens().size.sideBarWidth.val, []);
  const isLandscape = useOrientation();
  const { leftSidebarCollapsed } = useProviderSideBarValue();
  const pageWidth = useMemo(() => {
    if (md) {
      return screenWidth;
    }

    if (leftSidebarCollapsed) {
      return screenWidth;
    }

    if (platformEnv.isNativeIOSPad && !isLandscape) {
      return screenWidth;
    }

    return screenWidth - sideBarWidth;
  }, [isLandscape, leftSidebarCollapsed, md, screenWidth, sideBarWidth]);
  return {
    screenWidth,
    pageWidth,
  };
}
