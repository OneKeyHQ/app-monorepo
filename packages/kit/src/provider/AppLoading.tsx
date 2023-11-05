/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';
import { Suspense, useMemo } from 'react';

import { Dimensions } from 'react-native';

import { Image, Stack, useThemeValue } from '@onekeyhq/components';
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
    <Stack
      flex={1}
      bg="$background"
      justifyContent="center"
      alignItems="center"
    >
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

const useWaitReady = createSuspender(
  () =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 50);
    }),
);

const PendingComponent = ({ children }: PropsWithChildren<unknown>) => {
  useWaitReady();
  return children;
};

function AppLoading({ children }: PropsWithChildren<unknown>) {
  useHtmlPreloadSplashLogoRemove();
  return (
    <Suspense fallback={<SplashView />}>
      <PendingComponent>{children}</PendingComponent>
    </Suspense>
  );
}

export default AppLoading;
