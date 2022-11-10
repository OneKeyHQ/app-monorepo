import { FC } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Box, Button, Center, Icon, Typography } from '@onekeyhq/components';
import useFloatingBottomTabBarHeight from '@onekeyhq/components/src/Layout/BottomTabs/utils/useBottomTabBarHeight';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  addWebTab,
  closeAllWebTabs,
  homeTab,
} from '../../../../store/reducers/webTabs';
import { PortalEntry } from '../../../Overlay/RootPortal';
import { useWebController } from '../Controller/useWebController';
import {
  MAX_OR_SHOW,
  MIN_OR_HIDE,
  expandAnim,
  hideTabGrid,
  showTabGrid,
  showTabGridAnim,
} from '../explorerAnimation';
import { showWebMoreMenu } from '../MoreMenu';

export const ControllerBarMobile: FC = () => {
  const { currentTab, goBack, goForward, tabs } = useWebController();
  const tabBarHeight = useFloatingBottomTabBarHeight();
  const { canGoForward } = currentTab;
  const { dispatch } = backgroundApiProxy;

  const pageController = (
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          flex: 1,
          display: showTabGridAnim.value === MAX_OR_SHOW ? 'none' : 'flex',
          opacity: 1 - showTabGridAnim.value,
        }),
        [],
      )}
    >
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
          dispatch(addWebTab({ ...homeTab }));
        }}
      >
        <Icon color="icon-pressed" name="PlusCircleSolid" />
      </Button>
      <Button type="plain" flex={1} onPress={showTabGrid}>
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
    </Animated.View>
  );

  const tabController = (
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          flex: 1,
          display: showTabGridAnim.value === MIN_OR_HIDE ? 'none' : 'flex',
          opacity: showTabGridAnim.value,
        }),
        [],
      )}
    >
      <Button flex={1} type="plain" onPress={hideTabGrid}>
        <Icon color="icon-pressed" name="ChevronLeftSolid" />
      </Button>
      <Button
        flex={1}
        type="plain"
        onPress={() => {
          dispatch(addWebTab({ ...homeTab }));
        }}
      >
        <Icon color="icon-pressed" name="PlusCircleSolid" />
      </Button>
      <Button
        flex={1}
        type="plain"
        onPress={() => {
          // TODO confirm
          dispatch(closeAllWebTabs());
        }}
      >
        <Icon color="icon-pressed" name="TrashSolid" />
      </Button>
    </Animated.View>
  );
  return (
    <PortalEntry target="BottomTab-Overlay">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          useAnimatedStyle(
            () => ({
              zIndex: expandAnim.value === MIN_OR_HIDE ? -1 : 1,
              translateY: interpolate(
                expandAnim.value,
                [MIN_OR_HIDE, MAX_OR_SHOW],
                [-tabBarHeight, 0],
              ),
              opacity: expandAnim.value,
            }),
            [],
          ),
        ]}
      >
        <Box
          bg="surface-subdued"
          flex={1}
          flexDirection="row"
          overflow="hidden"
        >
          {pageController}
          {tabController}
        </Box>
      </Animated.View>
    </PortalEntry>
  );
};
