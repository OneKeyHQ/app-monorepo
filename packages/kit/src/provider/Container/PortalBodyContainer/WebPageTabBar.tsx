import { useMemo } from 'react';

import { Portal, useMedia, useOrientation } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

const useShowWebBars = platformEnv.isNativeIOSPad
  ? () => {
      const isLandscape = useOrientation();
      return isLandscape;
    }
  : () => {
      const { gtMd } = useMedia();
      return gtMd;
    };
export const WebPageTabBar =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const isShowWebBars = useShowWebBars();
        const memoDesktopCustomTabBar = useMemo(
          () => <DesktopCustomTabBar />,
          [],
        );
        return isShowWebBars ? (
          <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
            {memoDesktopCustomTabBar}
          </Portal.Body>
        ) : null;
      }
    : () => null;
