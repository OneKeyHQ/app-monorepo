import { useMemo } from 'react';

import { Portal, useMedia } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

const useShowWebBars = () => {
  const { gtMd } = useMedia();
  return gtMd;
};

export const WebPageTabBar = () => {
  const isShowWebBars = useShowWebBars();
  const memoDesktopCustomTabBar = useMemo(() => <DesktopCustomTabBar />, []);
  return isShowWebBars ? (
    <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
      {memoDesktopCustomTabBar}
    </Portal.Body>
  ) : null;
};
