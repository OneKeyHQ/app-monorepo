import { FC } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Box, Button, Center, Icon, Typography } from '@onekeyhq/components';
import useFloatingBottomTabBarHeight from '@onekeyhq/components/src/Layout/BottomTabs/utils/useBottomTabBarHeight';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { addWebTab, homeTab } from '../../../../store/reducers/webTabs';
import { PortalEntry } from '../../../Overlay/RootPortal';
import { useWebController } from '../Controller/useWebController';
import { showWebMoreMenu } from '../MoreMenu';

export const ControllerBarMobile: FC<{
  expandAnim: Animated.SharedValue<number>;
}> = ({ expandAnim }) => {
  const { currentTab, goBack, goForward, tabs } = useWebController();
  const tabBarHeight = useFloatingBottomTabBarHeight();
  const { canGoForward } = currentTab;
  return (
    <PortalEntry target="BottomTab-Overlay">
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1,
          },
          useAnimatedStyle(
            () => ({
              zIndex: expandAnim.value === 0 ? -1 : 1,
              translateY: interpolate(
                expandAnim.value,
                [0, 1],
                [-tabBarHeight, 0],
              ),
              opacity: expandAnim.value,
            }),
            [],
          ),
        ]}
      >
        <Box bg="surface-subdued" w="full" h="full" flexDirection="row">
          <Button
            flex={1}
            type="plain"
            disabled={currentTab.url === homeTab.url}
            onPress={goBack}
          >
            <Icon color="icon-pressed" name="ChevronLeftSolid" />
          </Button>

          <Button
            flex={1}
            type="plain"
            disabled={!canGoForward}
            onPress={goForward}
          >
            <Icon color="icon-pressed" name="ChevronRightSolid" />
          </Button>

          <Button
            flex={1}
            type="plain"
            onPress={() => {
              backgroundApiProxy.dispatch(addWebTab({ ...homeTab }));
            }}
          >
            <Icon color="icon-pressed" name="PlusCircleSolid" />
          </Button>

          <Button type="plain" flex={1}>
            <Center
              w="18px"
              h="18px"
              borderRadius="2px"
              borderWidth="2px"
              borderColor="icon-pressed"
            >
              <Typography.CaptionStrong
                textAlign="center"
                verticalAlign="center"
                size="12px"
                mb="4px"
              >
                {tabs.length - 1}
              </Typography.CaptionStrong>
            </Center>
          </Button>

          <Button flex={1} type="plain" onPress={showWebMoreMenu}>
            <Icon color="icon-pressed" name="DotsHorizontalSolid" />
          </Button>
        </Box>
      </Animated.View>
    </PortalEntry>
  );
};
