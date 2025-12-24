import { useMedia } from '@onekeyhq/components';

import DesktopCustomTabBar from '../../../views/Discovery/pages/DesktopCustomTabBar';

const useShowWebBars = () => {
  const { gtMd } = useMedia();
  return gtMd;
};

export const WebPageTabBar = () => {
  const isShowWebBars = useShowWebBars();
  return isShowWebBars ? <DesktopCustomTabBar /> : null;
};
