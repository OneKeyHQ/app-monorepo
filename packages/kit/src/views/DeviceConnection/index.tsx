// @ts-nocheck
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import React, { FC, useCallback, useState } from 'react';
import OneKeyConnect, {
  DEVICE_EVENT,
  UI_EVENT,
  TRANSPORT_EVENT,
  BLOCKCHAIN_EVENT,
  Features,
} from '@onekeyhq/connect';

import {
  Button,
  Switch,
  Center,
  Stack,
  Heading,
  VStack,
  Text,
  HStack,
  useTheme,
} from '@onekeyhq/components';
import * as buildUtils from '@onekeyhq/shared/src/platformEnv';
// import ble from '../../utils/ble/handler';

const CONNECT_URL = buildUtils.isDev()
  ? 'https://localhost:8088/'
  : 'https://connect.onekey.so/';

let hasInitOneKeyConnect: boolean | null = null;

export const init = async (): Promise<void> => {
  OneKeyConnect.on(DEVICE_EVENT, ({ event: _, ...action }) => {
    // dispatch event as action
    console.log('device action:', action);
  });

  OneKeyConnect.on(UI_EVENT, ({ event: _, ...action }) => {
    // dispatch event as action
    console.log('ui action:', action);
  });

  OneKeyConnect.on(TRANSPORT_EVENT, ({ event: _, ...action }) => {
    // dispatch event as action
    console.log('transport action:', action);
  });

  OneKeyConnect.on(BLOCKCHAIN_EVENT, ({ event: _, ...action }) => {
    // dispatch event as action
    console.log('blockchain action:', action);
  });

  const CONNECT_SRC = buildUtils.isDesktop() ? '/static/connect/' : CONNECT_URL;

  await OneKeyConnect.init({
    connectSrc: CONNECT_SRC,
    transportReconnect: true,
    debug: false,
    popup: false,
    webusb: false,
    env: buildUtils.isNative() ? 'react-native' : 'web',
    // ble: buildUtils.isNative() ? ble : null,
    manifest: {
      email: 'hi@onekey.so',
      appUrl: 'https://onekey.so',
    },
  });
  hasInitOneKeyConnect = true;
};

export const connectDevice = async (): Promise<
  ReturnType<typeof OneKeyConnect.getFeatures>
> => {
  try {
    if (!hasInitOneKeyConnect) {
      await init();
    }
  } catch (e) {
    // ignore
    console.log('--e', e);
  }

  const response = await OneKeyConnect.getFeatures();
  console.log('OneKey getFeatures', response.payload);
  return response;
};

const DeviceConnection: FC = () => {
  const { setThemeVariant, themeVariant } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [features, setFeatures] = useState<Features | null>();
  const handlePress = useCallback(async () => {
    setIsLoading(true);
    const response = await connectDevice();
    setFeatures(response.payload as Features);
    setIsLoading(false);
  }, []);

  return (
    <Center flex={1} px="3" bg="brand.100">
      <Button
        onPress={() => {
          const dappUrl = 'https://4v495.csb.app';
          // const dappUrl = 'https://www.bing.com';
          // window.location.href = dappUrl;
          window.open(dappUrl);
        }}
      >
        Go to dapp
      </Button>
      <HStack alignItems="center">
        <Text bold fontSize="xl" textAlign="center" mr="3" color="text-subdued">
          change theme
        </Text>
        <Switch
          isChecked={themeVariant === 'light'}
          onToggle={() =>
            setThemeVariant(themeVariant === 'light' ? 'dark' : 'light')
          }
          size="md"
        />
      </HStack>
      <Button
        isLoading={isLoading}
        disabled={isLoading}
        onPress={handlePress}
        size="md"
        mt="3"
        bg="red.50"
      >
        <Text bold fontSize="xl" textAlign="center" color="text-subdued">
          Connect Device
        </Text>
      </Button>
      {features ? (
        <Stack space={3} alignItems="center">
          <VStack minWidth="500" space={4} alignItems="center">
            <Heading textAlign="center" my="10">
              Device Info
            </Heading>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Text bold fontSize="xl" textAlign="center">
                {features.onekey_version}
              </Text>
            </Center>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Text bold fontSize="xl" textAlign="center">
                {features.serial_no || features.onekey_serial}
              </Text>
            </Center>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Text bold fontSize="xl" textAlign="center">
                {features.serial_no?.includes('MI')
                  ? 'OneKey MINI'
                  : 'OneKey Classic'}
              </Text>
            </Center>
          </VStack>
        </Stack>
      ) : null}
    </Center>
  );
};

export default DeviceConnection;
