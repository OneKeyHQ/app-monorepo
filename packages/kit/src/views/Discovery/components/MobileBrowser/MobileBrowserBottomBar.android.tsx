import { useCallback, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { ActionList, IconButton, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import { useTakeScreenshot } from '../../hooks/useTakeScreenshot';
import { ESiteMode } from '../../types';

import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';

import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';

// On Android, the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, preventing RN's built-in touch
// system from dispatching events to buttons in this region — even when the
// tab bar is hidden (GONE). RNGH intercepts touches at the
// GestureHandlerRootView (app root) level, bypassing the native view
// hierarchy entirely.

const barStyles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  ...rest
}: IMobileBrowserBottomBarProps) {
  const {
    intl,
    bottom,
    tab,
    hasConnectedAccount,
    displayHomePage,
    handleBookmarkPress,
    handlePinTab,
    handleCloseTab,
    onShare,
    onCopyUrl,
    handleDisconnect,
    handleRefresh,
    handleRequestSiteMode,
    handleGoBack,
    handleGoForward,
    handleBrowserOpen,
    disabledGoBack,
    disabledGoForward,
  } = useMobileBrowserBottomBarData({ id, onGoBackHomePage });

  // Replicate TabCountButton's press logic for RNGH
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const takeScreenshot = useTakeScreenshot(id);

  const handleShowTabList = useCallback(() => {
    void (async () => {
      if (!displayHomePage) {
        await Promise.race([
          takeScreenshot(),
          timerUtils.setTimeoutPromised(undefined, 2000),
        ]);
      }
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.MobileTabList,
      });
    })();
  }, [takeScreenshot, navigation, displayHomePage]);

  // Options button: use ActionList.show() programmatically
  const handleShowOptions = useCallback(() => {
    if (displayHomePage) return;
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.explore_options }),
      sections: [
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.explore_reload,
              }),
              icon: 'RotateClockwiseOutline',
              onPress: handleRefresh,
              testID: 'action-list-item-reload',
            },
            {
              label: intl.formatMessage({
                id: tab?.isBookmark
                  ? ETranslations.explore_remove_bookmark
                  : ETranslations.explore_add_bookmark,
              }),
              icon: tab?.isBookmark ? 'StarSolid' : 'StarOutline',
              onPress: () => handleBookmarkPress(!tab?.isBookmark),
              testID: `action-list-item-${
                !tab?.isBookmark ? 'bookmark' : 'remove-bookmark'
              }`,
            },
            {
              label: intl.formatMessage({
                id: tab?.isPinned
                  ? ETranslations.explore_unpin
                  : ETranslations.explore_pin,
              }),
              icon: tab?.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
              onPress: () => handlePinTab(!tab?.isPinned),
              testID: `action-list-item-${!tab?.isPinned ? 'pin' : 'un-pin'}`,
            },
            {
              label: intl.formatMessage({
                id:
                  tab?.siteMode === ESiteMode.desktop
                    ? ETranslations.browser_request_mobile_site
                    : ETranslations.browser_request_desktop_site,
              }),
              icon:
                tab?.siteMode === ESiteMode.desktop
                  ? 'PhoneOutline'
                  : 'ComputerOutline',
              onPress: () => {
                void handleRequestSiteMode(
                  tab?.siteMode === ESiteMode.desktop
                    ? ESiteMode.mobile
                    : ESiteMode.desktop,
                );
              },
              testID: `action-list-item-${
                tab?.siteMode === ESiteMode.desktop ? 'mobile' : 'desktop'
              }`,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.explore_open_in_browser,
              }),
              icon: 'CompassCircleOutline',
              onPress: handleBrowserOpen,
              testID: 'action-list-item-open-in-browser',
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.global_copy_url,
              }),
              icon: 'LinkOutline',
              onPress: onCopyUrl,
              testID: 'action-list-item-copy',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.explore_share,
              }),
              icon: 'ShareOutline',
              onPress: onShare,
              testID: 'action-list-item-share',
            },
          ],
        },
        {
          items: [
            ...(hasConnectedAccount
              ? [
                  {
                    label: intl.formatMessage({
                      id: ETranslations.explore_disconnect,
                    }),
                    icon: 'BrokenLinkOutline' as const,
                    onPress: handleDisconnect,
                    testID: 'action-list-item-disconnect-in-browser',
                  },
                ]
              : []),
            {
              label: intl.formatMessage({
                id: tab?.isPinned
                  ? ETranslations.explore_close_pin_tab
                  : ETranslations.explore_close_tab,
              }),
              icon: 'CrossedLargeOutline',
              onPress: handleCloseTab,
              testID: 'action-list-item-close-tab-in-browser',
            },
            ...(onGoBackHomePage
              ? [
                  {
                    label: intl.formatMessage({
                      id: ETranslations.explore_back_to_home,
                    }),
                    icon: 'HomeOpenOutline' as const,
                    onPress: onGoBackHomePage,
                    testID: 'action-list-item-back-to-home',
                  },
                ]
              : []),
          ],
        },
      ],
    });
  }, [
    displayHomePage,
    intl,
    handleRefresh,
    tab?.isBookmark,
    tab?.isPinned,
    tab?.siteMode,
    handleBrowserOpen,
    handleBookmarkPress,
    handlePinTab,
    handleRequestSiteMode,
    onCopyUrl,
    onShare,
    hasConnectedAccount,
    handleDisconnect,
    handleCloseTab,
    onGoBackHomePage,
  ]);

  // RNGH Gesture.Tap() for each button
  const goBackGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabledGoBack)
        .onEnd(() => {
          'worklet';

          runOnJS(handleGoBack)();
        }),
    [disabledGoBack, handleGoBack],
  );

  const goForwardGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabledGoForward)
        .onEnd(() => {
          'worklet';

          runOnJS(handleGoForward)();
        }),
    [disabledGoForward, handleGoForward],
  );

  const tabListGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(handleShowTabList)();
      }),
    [handleShowTabList],
  );

  const refreshGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';

        runOnJS(handleRefresh)();
      }),
    [handleRefresh],
  );

  const optionsGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!displayHomePage)
        .onEnd(() => {
          'worklet';

          runOnJS(handleShowOptions)();
        }),
    [displayHomePage, handleShowOptions],
  );

  return (
    <Stack
      flexDirection="row"
      bg="$bgApp"
      h={BROWSER_BOTTOM_BAR_HEIGHT + bottom}
      zIndex={1}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      pb={bottom}
      {...rest}
    >
      <GestureDetector gesture={goBackGesture}>
        <View style={barStyles.buttonContainer}>
          <IconButton
            variant="tertiary"
            size="medium"
            icon="ChevronLeftOutline"
            disabled={disabledGoBack}
            accessible={!disabledGoBack}
            testID="browser-bar-go-back"
          />
        </View>
      </GestureDetector>
      <GestureDetector gesture={goForwardGesture}>
        <View style={barStyles.buttonContainer}>
          <IconButton
            variant="tertiary"
            size="medium"
            icon="ChevronRightOutline"
            disabled={disabledGoForward}
            accessible={!disabledGoForward}
            testID="browser-bar-go-forward"
          />
        </View>
      </GestureDetector>

      <GestureDetector gesture={tabListGesture}>
        <View style={barStyles.buttonContainer}>
          <TabCountButton testID="browser-bar-tabs" />
        </View>
      </GestureDetector>

      <GestureDetector gesture={refreshGesture}>
        <View style={barStyles.buttonContainer}>
          <RefreshButton onRefresh={handleRefresh} />
        </View>
      </GestureDetector>

      <GestureDetector gesture={optionsGesture}>
        <View style={barStyles.buttonContainer}>
          <IconButton
            variant="tertiary"
            size="medium"
            icon="DotHorOutline"
            disabled={displayHomePage}
            testID="browser-bar-options"
          />
        </View>
      </GestureDetector>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
