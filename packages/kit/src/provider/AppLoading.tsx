import React, { FC, useCallback, useEffect, useState } from 'react';

import { CoreApi } from '@onekeyfe/hd-core';
import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box } from '@onekeyhq/components';
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

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  return (
    <Box flex={1} onLayout={onLayoutRootView}>
      {children}
    </Box>
  );
};

export default AppLoading;
