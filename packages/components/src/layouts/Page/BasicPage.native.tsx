import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import { Dimensions, StatusBar } from 'react-native';
import { AnimatePresence, useThemeName } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../hocs';
import { Spinner, Stack, View } from '../../primitives';

import { useTabBarHeight } from './hooks';

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
  const pageType = usePageType();
  const tabHeight = useTabBarHeight();
  if (!platformEnv.isNativeIOS) {
    return undefined;
  }
  if (!isFullPage) {
    return undefined;
  }
  if (pageType !== EPageType.modal) {
    return platformEnv.isNativeIOSPad
      ? Dimensions.get('window').height
      : Dimensions.get('window').height - tabHeight;
  }
  return undefined;
};

function PageStatusBar() {
  const pageType = usePageType();
  const themeName: 'light' | 'dark' = useThemeName();

  if (themeName === 'dark') {
    return <StatusBar animated barStyle="light-content" />;
  }

  if (pageType === EPageType.modal) {
    return <StatusBar animated barStyle="light-content" />;
  }
  return <StatusBar animated barStyle="dark-content" />;
}

function LoadingScreen({
  children,
  fullPage,
}: PropsWithChildren<{ fullPage: boolean }>) {
  const [showLoading, changeLoadingVisibleStatus] = useState(true);
  const [showChildren, changeChildrenVisibleStatus] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      changeChildrenVisibleStatus(true);
      setTimeout(() => {
        changeLoadingVisibleStatus(false);
      }, 0);
    }, 0);
  }, []);

  const minHeight = useMinHeight(fullPage);
  return (
    <View flex={1} minHeight={minHeight} bg="$bgApp">
      {showChildren ? children : null}
      <AnimatePresence>
        {showLoading ? (
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
            <Loading />
          </Stack>
        ) : null}
      </AnimatePresence>
    </View>
  );
}

export function BasicPage({
  children,
  skipLoading = false,
  fullPage = false,
}: IBasicPageProps) {
  return (
    <Stack bg="$bgApp" flex={1}>
      {platformEnv.isNativeIOS ? <PageStatusBar /> : undefined}
      {skipLoading ? (
        children
      ) : (
        <LoadingScreen fullPage={fullPage}>{children}</LoadingScreen>
      )}
    </Stack>
  );
}
