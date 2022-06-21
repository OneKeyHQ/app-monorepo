import React, { FC, useEffect, useState } from 'react';

import { CoreApi } from '@onekeyfe/hd-core';
import useSWR from 'swr';

import { Box, Center, Spinner, useThemeValue } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';
import {
  UIResponse,
  getHardwareSDKInstance,
} from '@onekeyhq/kit/src/utils/hardware';

import { useAppSelector } from '../hooks';
import { fetchCurrencies } from '../views/FiatPay/Service';

const { serviceApp, serviceCronJob } = backgroundApiProxy;

const AppLoading: FC = ({ children }) => {
  const [initDataReady, setInitDataReady] = useState(false);
  // appRenderReady and splashscreen.hideAsync moved to AppLock.tsx
  const isAppRenderReady = useAppSelector((s) => s.data.isAppRenderReady);

  useSWR('fiat-money', () => serviceCronJob.getFiatMoney(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useSWR('currencies', fetchCurrencies);

  const initService = async () => {
    try {
      await serviceApp.initApp();
    } catch (e) {
      console.log(e);
    } finally {
      setInitDataReady(true);
    }
  };

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
      await initService();
    }
    main();
  }, []);

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
    <Box flex={1} bg={bg}>
      {initDataReady && children}
      {!isAppRenderReady && (
        <Center position="absolute" zIndex={1} w="full" h="full" bg={bg}>
          <Spinner />
        </Center>
      )}
    </Box>
  );
};

export default AppLoading;
