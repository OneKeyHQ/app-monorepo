/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Dimensions } from 'react-native';

import { Image, Stack, useThemeValue } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHtmlPreloadSplashLogoRemove } from '@onekeyhq/kit/src/hooks/useHtmlPreloadSplashLogoRemove';
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

function SplashView({
  bgColor,
  initDataReady,
  children,
}: PropsWithChildren<{
  bgColor?: string;
  initDataReady: boolean;
}>) {
  const logoImage = useMemo((): any => {
    if (initDataReady && platformEnv.isExtension) {
      // do not show default splash logo in extension
      return null;
    }
    return buildImageSource();
  }, [initDataReady]);
  if (!initDataReady) {
    return children;
  }
  return platformEnv.isRuntimeBrowser ? (
    <Stack flex={1} bg={bgColor} justifyContent="center" alignItems="center">
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

function AppLoading({ children }: PropsWithChildren<unknown>) {
  const [initDataReady, setInitDataReady] = useState(false);
  const bgColor = useThemeValue('bg');
  useHtmlPreloadSplashLogoRemove();

  useEffect(() => {
    setTimeout(() => {
      setInitDataReady(true);
    }, 50);
  }, []);

  return (
    <SplashView
      initDataReady={initDataReady}
      bgColor={platformEnv.isRuntimeBrowser ? undefined : bgColor}
    >
      {children}
    </SplashView>
  );
}

export default AppLoading;
