import { FC } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Box } from '@onekeyhq/components';

import { PortalEntry } from '../../../Overlay/RootPortal';
import { useWebController } from '../Controller/useWebController';

export const ControllerBarMobile: FC<{
  expandAnim: Animated.SharedValue<number>;
}> = ({ expandAnim }) => {
  const {
    openMatchDApp,
    gotoSite,
    currentTab,
    stopLoading,
    goBack,
    goForward,
    reload,
  } = useWebController();
  const { loading, canGoBack, canGoForward } = currentTab;
  return (
    <PortalEntry target="BottomTab-Overlay">
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1,
          },
          useAnimatedStyle(
            () => ({
              height: interpolate(expandAnim.value, [0, 1], [0, 54]),
              opacity: expandAnim.value,
            }),
            [],
          ),
        ]}
      >
        <Box w="full" h="54px" bg="red.500" />
      </Animated.View>
    </PortalEntry>
  );
};
