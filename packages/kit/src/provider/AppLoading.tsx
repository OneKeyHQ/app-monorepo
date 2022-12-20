/* eslint-disable global-require */
import type { FC } from 'react';
import { useEffect, useState } from 'react';

import * as SplashScreen from 'expo-splash-screen';
// TODO: add .d.ts for react-native-animated-splash-screen
// @ts-expect-error no .d.ts
import AnimatedSplash from 'react-native-animated-splash-screen';
import useSWR from 'swr';

import { Box, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { serviceApp, serviceCronJob } = backgroundApiProxy;

const AppLoading: FC = ({ children }) => {
  const [initDataReady, setInitDataReady] = useState(false);
  useSWR(
    initDataReady ? 'fiat-money' : null,
    () => serviceCronJob.getFiatMoney(),
    {
      refreshInterval: 5 * 60 * 1000,
    },
  );

  const bgColor = useThemeValue('background-default');

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
      setInitDataReady(true);

      // end splash screen to show AnimatedSplash after 50ms to avoid twinkling
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 50);
    }

    main();
  }, []);

  const bg = useThemeValue('background-default');
  useEffect(() => {
    if (initDataReady && platformEnv.isRuntimeBrowser) {
      const img = document.querySelector('.onekey-index-html-preload-image');
      setTimeout(() => img?.remove(), 10);
    }
  }, [initDataReady]);

  global.$$onekeyPerfTrace?.log({
    name: `AppLoading SplashScreen render: ${JSON.stringify({
      initDataReady,
    })}`,
  });

  return (
    <Box flex={1} bg={bg}>
      <AnimatedSplash
        preload={false}
        disableAppScale={platformEnv.isExtension}
        disableImageBackgroundAnimation={platformEnv.isExtension}
        // imageBackgroundSource
        translucent={!platformEnv.isNativeAndroid}
        isLoaded={initDataReady}
        // isLoaded={false}
        logoImage={
          platformEnv.isRuntimeBrowser
            ? require('../../assets/splash.svg')
            : require('../../assets/splash.png')
        }
        backgroundColor={bgColor}
        // backgroundColor={platformEnv.isExtension ? 'rbga(0,0,0,0)' : bgColor}
        // same size to onekey-index-html-preload-image at index.html.ejs
        //      background img not working
        logoHeight={platformEnv.isRuntimeBrowser ? '80px' : '100%'}
        logoWidth={platformEnv.isRuntimeBrowser ? '80px' : '100%'}
      >
        {children}
      </AnimatedSplash>
    </Box>
  );
};

export default AppLoading;
