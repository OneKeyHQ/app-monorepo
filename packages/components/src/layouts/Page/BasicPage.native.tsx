import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Dimensions, StatusBar } from 'react-native';

import {
  AnimatePresence,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import { useIsModalPage, useIsOverlayPage } from '../../hocs';
import { Spinner, Stack, View, YStack } from '../../primitives';
import { rootNavigationRef } from '../Navigation';

import { useIsIpadModalPage, useTabBarHeight } from './hooks';
import {
  iPadModalPageContext,
  useIPadModalPageSizeChange,
} from './iPadModalPageContext';

import type { IBasicPageProps } from './type';

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
      exitStyle={{
        opacity: 0,
      }}
    >
      {children}
    </Stack>
  );
}

function LoadingScreen({
  children,
  fullPage,
}: PropsWithChildren<{ fullPage: boolean }>) {
  const [showLoading, changeLoadingVisibleStatus] = useState(true);
  const [showChildren, changeChildrenVisibleStatus] = useState(false);
  const isModalPage = useIsModalPage();
  const isiOSModalPage = platformEnv.isNativeIOS && isModalPage;

  useEffect(() => {
    setTimeout(
      () => {
        changeChildrenVisibleStatus(true);
        setTimeout(
          () => {
            requestIdleCallback(() => {
              changeLoadingVisibleStatus(false);
            });
          },
          isiOSModalPage ? 380 : 150,
        );
      },
      platformEnv.isNativeAndroid ? 10 : 0,
    );
  }, [isiOSModalPage]);

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

const AbsoluteLoadingContainer = platformEnv.isNativeIOS
  ? ({ children }: PropsWithChildren) => {
      const [showLoading, changeLoadingVisibleStatus] = useState(true);
      const [showChildren, changeChildrenVisibleStatus] = useState(false);
      const isModalPage = useIsModalPage();
      const shouldShowLoading = useMemo(() => {
        if (!isModalPage) {
          return false;
        }
        const rootState = rootNavigationRef.current?.getRootState();
        const modalRoute = rootState?.routes[rootState.index];
        if (modalRoute?.name !== ERootRoutes.Modal) {
          return false;
        }

        // The first modal page pushed hasn't generated its own navigation state yet,
        // so we show blank loading for a smoother transition animation.
        if (!modalRoute.state) {
          return true;
        }
        // Pages within the modal's stack (index > 0) don't need blank loading,
        // only the first modal page (index === 0) requires it.
        if (modalRoute.state?.index === 0) {
          return false;
        }
        return false;
      }, [isModalPage]);
      useEffect(() => {
        setTimeout(() => {
          changeChildrenVisibleStatus(true);
          setTimeout(() => {
            requestIdleCallback(() => {
              changeLoadingVisibleStatus(false);
            });
          }, 380);
        }, 1);
      }, [isModalPage]);

      return shouldShowLoading ? (
        <>
          {showChildren ? children : null}
          {showLoading ? <AbsoluteContainer /> : null}
        </>
      ) : (
        children
      );
    }
  : ({ children }: PropsWithChildren) => children;

export function BasicPage({
  children,
  lazyLoad = false,
  fullPage = false,
}: IBasicPageProps) {
  const { layout, onPageLayout } = useIPadModalPageSizeChange();
  const isIpadModalPage = useIsIpadModalPage();
  const content = useMemo(() => {
    return (
      <Stack bg="$bgApp" flex={1}>
        {platformEnv.isNativeIOS ? <PageStatusBar /> : undefined}
        {lazyLoad ? (
          <LoadingScreen fullPage={fullPage}>{children}</LoadingScreen>
        ) : (
          <AbsoluteLoadingContainer>{children}</AbsoluteLoadingContainer>
        )}
      </Stack>
    );
  }, [children, lazyLoad, fullPage]);
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
