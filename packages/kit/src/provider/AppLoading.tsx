import React, { FC, useCallback, useEffect, useState } from 'react';

import { CoreApi } from '@onekeyfe/hd-core';
import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box, Center, Spinner, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';
import {
  UIResponse,
  getHardwareSDKInstance,
} from '@onekeyhq/kit/src/utils/hardware';

import { fetchCurrencies } from '../views/FiatPay/Service';

const AppLoading: FC = ({ children }) => {
  const [appIsReady, setAppIsReady] = useState(false);

  const { serviceApp, serviceCronJob } = backgroundApiProxy;

  useSWR('fiat-money', () => serviceCronJob.getFiatMoney(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useSWR('currencies', () => fetchCurrencies());

  const showSplashScreen = async () => {
    try {
      await SplashScreen.preventAutoHideAsync();
    } catch (e) {
      console.log(e);
    }
  };

  const initService = useCallback(async () => {
    try {
      await serviceApp.initApp();
    } catch (e) {
      console.log(e);
    } finally {
      setAppIsReady(true);
      await SplashScreen.hideAsync();
    }
  }, [serviceApp]);

  useEffect(() => {
    async function main() {
      await showSplashScreen();
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
      await initService();
    }
    main();
  }, [initService]);

  useEffect(() => {
    let HardwareSDK: CoreApi;
    getHardwareSDKInstance().then((instance) => {
      HardwareSDK = instance;
      HardwareSDK.on('UI_EVENT', UIResponse);
    });
    return () => {
      HardwareSDK.off('UI_EVENT', UIResponse);
    };
  }, []);

  const bg = useThemeValue('background-default');

  return (
    <Box flex={1}>
      {!appIsReady ? (
        <Center w="full" h="full" bg={bg}>
          <Spinner />
        </Center>
      ) : (
        children
      )}
    </Box>
  );
};

export default AppLoading;
