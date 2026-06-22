import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  useIPadModalPageWidth,
  useIsIpadModalPage,
  useIsSplitView,
  useMedia,
} from '@onekeyhq/components';
import {
  DESKTOP_MODE_UI_PAGE_BORDER_WIDTH,
  DESKTOP_MODE_UI_PAGE_MARGIN,
  MIN_SIDEBAR_WIDTH,
} from '@onekeyhq/components/src/utils/sidebar';
import {
  isDualScreenDevice,
  useDualScreenWidth,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useShouldUseSplitView } from './useShouldUseSplitView';

const useNativeTabContainerWidth = isDualScreenDevice()
  ? () => {
      const dualScreenWidth = useDualScreenWidth();
      return dualScreenWidth;
    }
  : () => {
      const isLandscape = useIsSplitView();
      const shouldUseSplitView = useShouldUseSplitView();
      const { width } = useWindowDimensions();
      const isIpadModalPage = useIsIpadModalPage();
      const ipadModalPageWidth = useIPadModalPageWidth();
      if (isIpadModalPage) {
        return ipadModalPageWidth || 640;
      }
      // shouldUseSplitView already implies isNativeTablet() && enableSplitView.
      // Only halve the width when the split layout is actually rendering.
      if (shouldUseSplitView && isLandscape) {
        return width / 2;
      }
      return width;
    };

export const useTabContainerWidth = platformEnv.isNative
  ? useNativeTabContainerWidth
  : () => {
      const { md } = useMedia();
      return useMemo(() => {
        if (platformEnv.isWebDappMode || md) {
          return `calc(100vw)`;
        }
        return `calc(100vw - ${
          MIN_SIDEBAR_WIDTH +
          DESKTOP_MODE_UI_PAGE_MARGIN +
          DESKTOP_MODE_UI_PAGE_BORDER_WIDTH * 2
        }px)`;
      }, [md]);
    };
