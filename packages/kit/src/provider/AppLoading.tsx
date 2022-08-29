import React, { FC, useEffect, useState } from 'react';

import * as SplashScreen from 'expo-splash-screen';
// TODO: add .d.ts for react-native-animated-splash-screen
// @ts-expect-error no .d.ts
import AnimatedSplash from 'react-native-animated-splash-screen';
import useSWR from 'swr';

import { Box, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { fetchCurrencies } from '../views/FiatPay/Service';

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

  useSWR(initDataReady ? 'currencies' : null, fetchCurrencies);

  const initService = async () => {
    try {
      await serviceApp.initApp();
    } catch (e) {
      console.log(e);
    }
  };

  const bgColor = useThemeValue('background-default');

  useEffect(() => {
    async function main() {
      await waitForDataLoaded({
        logName: 'WaitBackgroundReady',
        data: async () => {
          const result = await backgroundApiProxy.getState();
          if (result && result.bootstrapped) {
            store.dispatch({
              // TODO use consts
              type: 'REPLACE_WHOLE_STATE',
              payload: result.state,
              $isDispatchFromBackground: true,
            });
            return true;
          }
          return false;
        },
      });
      await Promise.all([
        new Promise((resolve) => {
          setTimeout(resolve, 300);
        }),
        initService(),
      ]);
      setInitDataReady(true);

      // end splash screen to show AnimatedSplash after 50ms to avoid twinkling
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 50);
    }
    main();
  }, []);

  const bg = useThemeValue('background-default');

  return (
    <Box flex={1} bg={bg}>
      <AnimatedSplash
        preload={false}
        disableAppScale={platformEnv.isExtension}
        disableImageBackgroundAnimation={platformEnv.isExtension}
        translucent={!platformEnv.isNativeAndroid}
        isLoaded={initDataReady}
        // eslint-disable-next-line global-require
        logoImage={require('../../assets/splash.png')}
        backgroundColor={bgColor}
        logoHeight="100%"
        logoWidth="100%"
      >
        {children}
      </AnimatedSplash>
    </Box>
  );
};

export default AppLoading;
