import React, { FC, useEffect, useState } from 'react';

import OneKeyConnect from '@onekeyfe/js-sdk';
import * as SplashScreen from 'expo-splash-screen';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import { Box, Center, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UICallback } from '@onekeyhq/kit/src/utils/device/deviceConnection';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const EngineApp: FC = ({ children }) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(true);
  const { serviceApp, serviceCronJob } = backgroundApiProxy;

  useSWR('fiat-money', () => serviceCronJob.getFiatMoney(), {
    refreshInterval: 1 * 60 * 1000,
  });

  useEffect(() => {
    async function main() {
      try {
        await serviceApp.initApp();
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync();
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!platformEnv.isBrowser) return;

    OneKeyConnect.on('UI_EVENT', UICallback);
    return () => {
      OneKeyConnect.off('UI_EVENT', UICallback);
    };
  }, [intl]);

  return (
    <Box flex="1">
      {loading ? (
        <Center w="full" h="full">
          <Spinner />
        </Center>
      ) : (
        children
      )}
    </Box>
  );
};

export default EngineApp;
