import React, { FC, useEffect, useState } from 'react';

// TODO: add .d.ts for react-native-animated-splash-screen
// @ts-expect-error no .d.ts
import AnimatedSplash from 'react-native-animated-splash-screen';
import useSWR from 'swr';

import { Box, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';

import { useAppSelector } from '../hooks';
import { fetchCurrencies } from '../views/FiatPay/Service';

const { serviceApp, serviceCronJob } = backgroundApiProxy;

const AppLoading: FC = ({ children }) => {
  const [initDataReady, setInitDataReady] = useState(false);
  useSWR('fiat-money', () => serviceCronJob.getFiatMoney(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useSWR('currencies', fetchCurrencies);

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
          setTimeout(resolve, 1000);
        }),
        initService(),
      ]);
      setInitDataReady(true);
    }
    main();
  }, []);

  const bg = useThemeValue('background-default');

  return (
    <Box flex={1} bg={bg}>
      <AnimatedSplash
        translucent
        isLoaded={initDataReady}
        // eslint-disable-next-line global-require
        logoImage={require('../../assets/logo.png')}
        backgroundColor={bgColor}
        logoHeight={100}
        logoWidth={100}
      >
        {children}
      </AnimatedSplash>
    </Box>
  );
};

export default AppLoading;
