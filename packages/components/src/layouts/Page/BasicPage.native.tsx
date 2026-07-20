import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Dimensions, StatusBar } from 'react-native';

import {
  AnimatePresence,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsModalPage, useIsOverlayPage } from '../../hocs';
import { Spinner, Stack, View, YStack } from '../../primitives';
import { ANIMATE_ONLY_OPACITY } from '../../utils/animationConstants';

import { useIsIpadModalPage, useTabBarHeight } from './hooks';
import {
  iPadModalPageContext,
  useIPadModalPageSizeChange,
} from './iPadModalPageContext';

import type { IBasicPageProps } from './type';

const exitStyleFadeOut = { opacity: 0 };

function Loading() {
  return (
    <Stack flex={1} alignContent="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

// On iOS, in the tab container, when initializing the page,
//  the elements cannot fill the container space, so a minimum height needs to be set
const useMinHeight = (isFullPage: boolean) => {
  const isOverlayPage = useIsOverlayPage();
  const tabHeight = useTabBarHeight();
  return useMemo(() => {
    if (!platformEnv.isNativeIOS) {
      return undefined;
    }
    if (!isFullPage) {
      return undefined;
    }
    if (!isOverlayPage) {
      if (platformEnv.isNativeIOSPad) {
        return (
          Math.max(
            Dimensions.get('window').height,
            Dimensions.get('window').width,
          ) - tabHeight
        );
      }
      return Dimensions.get('window').height - tabHeight;
    }
    return undefined;
  }, [isFullPage, isOverlayPage, tabHeight]);
};

/**
 * Renders a status bar with the appropriate style based on the current theme and whether the page is a modal.
 *
 * Uses a light content style for dark themes or modal pages, and a dark content style otherwise.
 */
function PageStatusBar() {
  const isModalPage = useIsModalPage();
  const themeName: 'light' | 'dark' = useThemeName();

  if (themeName === 'dark') {
    return <StatusBar animated barStyle="light-content" />;
  }

  if (isModalPage) {
    return <StatusBar animated barStyle="light-content" />;
  }
  return <StatusBar animated barStyle="dark-content" />;
}

function AbsoluteContainer({ children }: PropsWithChildren) {
  return (
    <Stack
      bg="$bgApp"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      opacity={1}
      flex={1}
      animation="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      exitStyle={exitStyleFadeOut}
    >
      {children}
    </Stack>
  );
}

// Loading screen for Android only. iOS modal pages use performWithoutAnimation
// (patched in react-native) to prevent Fabric recycled-view frame animations,
// so the loading overlay is no longer needed on iOS.
function LoadingScreenAndroid({
  children,
  fullPage,
}: PropsWithChildren<{ fullPage: boolean }>) {
  const [showLoading, changeLoadingVisibleStatus] = useState(true);
  const [showChildren, changeChildrenVisibleStatus] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      changeChildrenVisibleStatus(true);
      setTimeout(() => {
        requestIdleCallback(() => {
          changeLoadingVisibleStatus(false);
        });
      }, 150);
    }, 10);
  }, []);

  const minHeight = useMinHeight(fullPage);
  return (
    <View flex={1} minHeight={minHeight} bg="$bgApp">
      {showChildren ? children : null}
      <AnimatePresence>
        {showLoading ? (
          <AbsoluteContainer>
            <Loading />
          </AbsoluteContainer>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

function LoadingScreen({
  children,
  fullPage,
}: PropsWithChildren<{ fullPage: boolean }>) {
  // iOS: skip loading overlay — performWithoutAnimation fix handles animation artifacts
  if (platformEnv.isNativeIOS) {
    return <>{children}</>;
  }

  return (
    <LoadingScreenAndroid fullPage={fullPage}>{children}</LoadingScreenAndroid>
  );
}

// iOS: no longer needs loading container — performWithoutAnimation fix
// prevents Fabric recycled-view frame animations during modal transitions.
// Android: was already a passthrough.
const AbsoluteLoadingContainer = ({ children }: PropsWithChildren) => children;

export function BasicPage({
  children,
  lazyLoad = false,
  fullPage = false,
  testID,
}: IBasicPageProps) {
  const { layout, onPageLayout } = useIPadModalPageSizeChange();
  const isIpadModalPage = useIsIpadModalPage();
  const content = useMemo(() => {
    return (
      <Stack bg="$bgApp" flex={1} testID={testID}>
        {platformEnv.isNativeIOS ? <PageStatusBar /> : undefined}
        {lazyLoad ? (
          <LoadingScreen fullPage={fullPage}>{children}</LoadingScreen>
        ) : (
          <AbsoluteLoadingContainer>{children}</AbsoluteLoadingContainer>
        )}
      </Stack>
    );
  }, [children, lazyLoad, fullPage, testID]);
  return isIpadModalPage ? (
    <YStack flex={1} onLayout={onPageLayout}>
      <iPadModalPageContext.Provider value={layout}>
        {content}
      </iPadModalPageContext.Provider>
    </YStack>
  ) : (
    content
  );
}
