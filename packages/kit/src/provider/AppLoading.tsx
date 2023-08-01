/* eslint-disable global-require */
import type { FC, ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import { hideAsync as hideSplashScreen } from 'expo-splash-screen';
// TODO: add .d.ts for react-native-animated-splash-screen
// @ts-expect-error no .d.ts
import AnimatedSplash from 'react-native-animated-splash-screen';

import { Box, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { serviceApp, serviceCronJob } = backgroundApiProxy;

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
          logoHeight={platformEnv.isRuntimeBrowser ? '80px' : '100%'}
          logoWidth={platformEnv.isRuntimeBrowser ? '80px' : '100%'}
        >
          {children}
        </AnimatedSplash>
      ),
      [bgColor, children, initDataReady, logoImage],
    );
    return (
      <Box flex={1} bg={bgColor}>
        {content}
      </Box>
    );
  },
);
AnimatedSplashView.displayName = 'AnimatedSplashView';

const AppLoading: FC = ({ children }) => {
  const [initDataReady, setInitDataReady] = useState(false);
  // fiat-money trigger move to init app after endpoint change
  // useSWR(
  //   initDataReady ? 'fiat-money' : null,
  //   () => serviceCronJob.getFiatMoney(),
  //   {
  //     refreshInterval: 5 * 60 * 1000,
  //   },
  // );

  let bgColor: string | undefined = useThemeValue('background-default');
  if (platformEnv.isRuntimeBrowser) {
    bgColor = undefined;
  }

  useEffect(() => {
    function main() {
      // TODO initApp too slow, maybe do not need waiting for initApp in UI
      // await Promise.all([
      //   serviceApp.waitForAppInited({
      //     logName: 'AppLoading',
      //   }),
      // ]);

      // redux ready check move to ThemeApp
      // serviceApp.initApp();

      serviceApp.checkLockStatus();
      setInitDataReady(true);

      // end splash screen to show AnimatedSplash after 50ms to avoid twinkling
      setTimeout(hideSplashScreen, 50);
    }

    main();
  }, []);

  return (
    <AnimatedSplashView initDataReady={initDataReady} bgColor={bgColor}>
      {children}
    </AnimatedSplashView>
  );
};

export default AppLoading;
