import { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  Box,
  Button,
  Center,
  Icon,
  IconButton,
  Typography,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import useFloatingBottomTabBarHeight from '@onekeyhq/components/src/Layout/BottomTabs/utils/useBottomTabBarHeight';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  addWebTab,
  closeAllWebTabs,
  homeTab,
  isTabLimitReached,
} from '../../../../store/reducers/webTabs';
import { showOverlay } from '../../../../utils/overlayUtils';
import { OverlayPanel } from '../../../Overlay/OverlayPanel';
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
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();
  const tabBarHeight = useFloatingBottomTabBarHeight();

  const bgColor = useThemeValue('surface-subdued');
  const { canGoForward } = currentTab;
  const { dispatch } = backgroundApiProxy;
  const addNewTab = useCallback(() => {
    dispatch(addWebTab({ ...homeTab }));
  }, [dispatch]);

  const reachedTabLimit = isTabLimitReached(tabs);

  const pageController = (
    <Animated.View
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          flexDirection: 'row',
        },
        useAnimatedStyle(
          () => ({
            zIndex: showTabGridAnim.value === MAX_OR_SHOW ? -1 : 1,
            display: showTabGridAnim.value === MAX_OR_SHOW ? 'none' : 'flex',
            opacity: 1 - showTabGridAnim.value,
          }),
          [],
        ),
      ]}
    >
      <IconButton
        flex={1}
        type="plain"
        disabled={currentTab.url === homeTab.url}
        onPress={goBack}
        name="ChevronLeftOutline"
      />
      <IconButton
        flex={1}
        type="plain"
        disabled={!canGoForward}
        onPress={goForward}
        name="ChevronRightOutline"
      />
      <IconButton
        flex={1}
        type="plain"
        disabled={reachedTabLimit}
        onPress={addNewTab}
        iconSize={26}
        name="PlusCircleMini"
      />
      <Button type="plain" flex={1} onPress={showTabGrid}>
        <Center
          w="20px"
          h="20px"
          borderRadius="2px"
          borderWidth="2px"
          borderColor="icon-pressed"
        >
          <Typography.CaptionStrong
            textAlign="center"
            size="12px"
            lineHeight="13px"
          >
            {tabs.length - 1}
          </Typography.CaptionStrong>
        </Center>
      </Button>
      <IconButton
        flex={1}
        type="plain"
        disabled={currentTab.url === homeTab.url}
        onPress={showWebMoreMenu}
        name="DotsHorizontalOutline"
      />
    </Animated.View>
  );

  const tabController = (
    <Animated.View
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          flexDirection: 'row',
        },
        useAnimatedStyle(
          () => ({
            zIndex: showTabGridAnim.value === MIN_OR_HIDE ? -1 : 1,
            display: showTabGridAnim.value === MIN_OR_HIDE ? 'none' : 'flex',
            opacity: showTabGridAnim.value,
          }),
          [],
        ),
      ]}
    >
      <IconButton
        flex={1}
        type="plain"
        onPress={() => hideTabGrid()}
        name="ChevronLeftOutline"
      />
      <IconButton
        flex={1}
        type="plain"
        disabled={reachedTabLimit}
        onPress={addNewTab}
        iconSize={26}
        name="PlusCircleMini"
      />
      <IconButton
        name="TrashOutline"
        flex={1}
        type="plain"
        onPress={() => {
          showOverlay((closeOverlay) => (
            <OverlayPanel
              closeOverlay={closeOverlay}
              modalProps={{ headerShown: false }}
            >
              <PressableItem
                flexDirection="row"
                alignItems="center"
                py={{ base: '12px', sm: '8px' }}
                px={{ base: '16px', sm: '8px' }}
                bg="transparent"
                borderRadius="12px"
                onPress={() => {
                  closeOverlay();
                  dispatch(closeAllWebTabs());
                }}
              >
                <Icon color="text-critical" size={24} name="XMarkMini" />
                <Typography.Body1Strong ml="12px" color="text-critical">
                  {intl.formatMessage({
                    id: 'action__close_all_tabs',
                  })}
                </Typography.Body1Strong>
              </PressableItem>
            </OverlayPanel>
          ));
        }}
      />
    </Animated.View>
  );
  return (
    <PortalEntry target="BottomTab-Overlay">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          useAnimatedStyle(
            () => ({
              backgroundColor: bgColor,
              zIndex: expandAnim.value === MIN_OR_HIDE ? -1 : 1,
              display: expandAnim.value === MIN_OR_HIDE ? 'none' : 'flex',
              translateY: interpolate(
                expandAnim.value,
                [MIN_OR_HIDE, MAX_OR_SHOW],
                [-tabBarHeight, 0],
              ),
              opacity: expandAnim.value,
            }),
            [bgColor],
          ),
        ]}
      >
        <Box flex={1} flexDirection="row" overflow="hidden" mb={`${bottom}px`}>
          {pageController}
          {tabController}
        </Box>
      </Animated.View>
    </PortalEntry>
  );
};
