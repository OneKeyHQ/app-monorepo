/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Dimensions } from 'react-native';
import { AnimatePresence } from 'tamagui';

import { Image, Stack } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHtmlPreloadSplashLogoRemove } from '@onekeyhq/kit/src/hooks/useHtmlPreloadSplashLogoRemove';
import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ImageSourcePropType } from 'react-native';

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

const buildImageSource = () =>
  platformEnv.isRuntimeBrowser
    ? ({
        uri: require('../../assets/splash.svg'),
        width: '100%',
        height: '100%',
      } as unknown as ImageSourcePropType)
    : (require('../../assets/splash.png') as ImageSourcePropType);

function SplashView() {
  const logoImage = useMemo(() => buildImageSource(), []);
  return platformEnv.isRuntimeBrowser ? (
    <Stack flex={1} justifyContent="center" alignItems="center">
      <Stack w={80} h={80}>
        <Image flex={1} source={logoImage} />
      </Stack>
    </Stack>
  ) : (
    <Image
      flex={1}
      aspectRatio={windowWidth / windowHeight}
      resizeMode="contain"
      source={logoImage}
    />
  );
}

const waitUIReady = () =>
  new Promise<void>((resolve) => {
    setTimeout(() => {
      // TODO：Hide the Splash View only when the UI view is ready.
      resolve();
    }, 100);
  });

function PendingSplashView() {
  const [isVisible, changeVisibleStatus] = useState(true);
  useEffect(() => {
    void waitUIReady().then(() => {
      changeVisibleStatus(false);
    });
  }, []);
  return (
    <AnimatePresence>
      {isVisible && (
        <Stack
          bg="$background"
          animation="quick"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          flex={1}
          enterStyle={{
            opacity: 0,
          }}
          exitStyle={{
            opacity: 0,
          }}
        >
          <SplashView />
        </Stack>
      )}
    </AnimatePresence>
  );
}

const useWaitDataReady = createSuspender(
  () =>
    // TODO：Show the UI View only when data is ready.
    new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    }),
);

const PendingComponent = ({ children }: PropsWithChildren<unknown>) => {
  useWaitDataReady();
  return children;
};

function AppLoading({ children }: PropsWithChildren<unknown>) {
  useHtmlPreloadSplashLogoRemove();
  return (
    <Stack flex={1}>
      <Suspense fallback={null}>
        <PendingComponent>{children}</PendingComponent>
      </Suspense>
      <PendingSplashView />
    </Stack>
  );
}

export default AppLoading;
