import React, { FC, useEffect, useState } from 'react';

import OneKeyConnect, { UI } from '@onekeyfe/js-sdk';
import * as SplashScreen from 'expo-splash-screen';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import { Box, Center, Spinner } from '@onekeyhq/components';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const EngineApp: FC = ({ children }) => {
  const toast = useToast();
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
    const UICallback = ({ type }: { type: string }) => {
      switch (type) {
        case UI.REQUEST_PIN:
          toast.show({
            title: intl.formatMessage({ id: 'modal__input_pin_code' }),
          });
          OneKeyConnect.uiResponse({
            type: UI.RECEIVE_PIN,
            payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
          });
          break;
        case UI.REQUEST_BUTTON:
          toast.show({
            title: intl.formatMessage({
              id: 'modal__follow_the_instructions_on_your_device_screen',
            }),
          });
          break;
        default:
          break;
      }
    };
    OneKeyConnect.on('UI_EVENT', UICallback);
    return () => {
      OneKeyConnect.off('UI_EVENT', UICallback);
    };
  }, [intl, toast]);

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
