/* eslint-disable global-require */
import type { FC, PropsWithChildren, ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import { Dimensions } from 'react-native';
import AnimatedSplash from 'react-native-animated-splash-screen';

import { Stack, useThemeValue } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHtmlPreloadSplashLogoRemove } from '@onekeyhq/kit/src/hooks/useHtmlPreloadSplashLogoRemove';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const AnimatedSplashView = memo(
  ({
    bgColor,
    initDataReady,
    children,
  }: {
    bgColor?: string;
    children?: ReactNode | undefined;
    initDataReady: boolean;
  }) => {
    global.$$onekeyPerfTrace?.log({
      name: `AppLoading SplashScreen render`,
      payload: {
        initDataReady,
        bgColor,
      },
    });

    const logoImage = useMemo((): any => {
      if (initDataReady && platformEnv.isExtension) {
        // do not show default splash logo in extension
        return null;
      }
      return platformEnv.isRuntimeBrowser
        ? require('../../assets/splash.svg') // SVG in web env
        : require('../../assets/splash.png');
    }, [initDataReady]);

    const content = useMemo(
      () => (
        <AnimatedSplash
          preload
          disableAppScale={platformEnv.isExtension}
          disableImageBackgroundAnimation={platformEnv.isExtension}
          // imageBackgroundSource
          translucent={!platformEnv.isNativeAndroid}
          isLoaded={initDataReady}
          // isLoaded={false}
          logoImage={logoImage}
          backgroundColor={bgColor}
          // backgroundColor={platformEnv.isExtension ? 'rbga(0,0,0,0)' : bgColor}
          // same size to onekey-index-html-preload-image at index.html.ejs
          //      background img not working
          logoHeight={
            platformEnv.isRuntimeBrowser ? 80 : Dimensions.get('window').height
          }
          logoWidth={
            platformEnv.isRuntimeBrowser ? 80 : Dimensions.get('window').width
          }
        >
          {children}
        </AnimatedSplash>
      ),
      [bgColor, children, initDataReady, logoImage],
    );
    return (
      <Stack flex={1} backgroundColor={bgColor}>
        {content}
      </Stack>
    );
  },
);
AnimatedSplashView.displayName = 'AnimatedSplashView';

const AppLoading = ({ children }: PropsWithChildren<unknown>) => {
  const [initDataReady, setInitDataReady] = useState(false);
  const bgColor = useThemeValue('bg');
  useHtmlPreloadSplashLogoRemove();

  useEffect(() => {
    setTimeout(() => {
      setInitDataReady(true);
    }, 50);
  }, []);

  return (
    <AnimatedSplashView
      initDataReady={initDataReady}
      bgColor={platformEnv.isRuntimeBrowser ? undefined : bgColor}
    >
      {children}
    </AnimatedSplashView>
  );
};

export default AppLoading;
