import React, { FC, useCallback, useEffect, useState } from 'react';

import OneKeyConnect from '@onekeyfe/js-sdk';
import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box, Center, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';
import { UICallback } from '@onekeyhq/kit/src/utils/device/deviceConnection';

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
    OneKeyConnect.on('UI_EVENT', UICallback);
    return () => {
      OneKeyConnect.off('UI_EVENT', UICallback);
    };
  }, []);

  return (
    <Box flex={1}>
      {!appIsReady ? (
        <Center w="full" h="full">
          <Spinner />
        </Center>
      ) : (
        children
      )}
    </Box>
  );
};

export default AppLoading;
