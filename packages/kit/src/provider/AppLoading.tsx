import React, { FC, useEffect, useState } from 'react';

import OneKeyConnect from '@onekeyfe/js-sdk';
import * as SplashScreen from 'expo-splash-screen';
import useSWR from 'swr';

import { Box, Center, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/kit/src/background/utils';
import store from '@onekeyhq/kit/src/store';
import { UICallback } from '@onekeyhq/kit/src/utils/device/deviceConnection';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const AppLoading: FC = ({ children }) => {
  const [appIsReady, setAppIsReady] = useState(false);
  const { serviceApp, serviceCronJob } = backgroundApiProxy;
  useSWR('fiat-money', () => serviceCronJob.getFiatMoney(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useEffect(() => {
    async function main() {
      try {
        await SplashScreen.preventAutoHideAsync();

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
        await serviceApp.initApp();
      } catch (e) {
        console.log(e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }
    main();
  }, [serviceApp]);

  useEffect(() => {
    if (!platformEnv.isBrowser) return;
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
