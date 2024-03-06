import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components';
import useProviderSideBarValue from '@onekeyhq/components/src/hocs/Provider/hooks/useProviderSideBarValue';
import { getTokens } from '@onekeyhq/components/src/hooks';

export default function useHomePageWidth() {
  const media = useMedia();
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const { leftSidebarCollapsed } = useProviderSideBarValue();
  return {
    screenWidth,
    pageWidth:
      media.md || leftSidebarCollapsed
        ? screenWidth
        : screenWidth - sideBarWidth,
  };
}
