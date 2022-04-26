import React, { FC, useCallback, useState } from 'react';

import OneKeyConnect from '@onekeyfe/js-sdk';

import {
  Button,
  Center,
  Stack,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

export const connectDevice = async (): Promise<
  ReturnType<typeof OneKeyConnect.getFeatures>
> => {
  const response = await OneKeyConnect.getFeatures();
  console.log('OneKey getFeatures', response.payload);
  return response;
};

const DeviceConnection: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [features, setFeatures] = useState<IOneKeyDeviceFeatures | null>();
  const handlePress = useCallback(async () => {
    setIsLoading(true);
    const response = await connectDevice();
    setFeatures(response.payload as IOneKeyDeviceFeatures);
    setIsLoading(false);
  }, []);

  return (
    <Center flex={1} px="3" bg="brand.100">
      <Button
        isLoading={isLoading}
        disabled={isLoading}
        onPress={handlePress}
        mt="3"
        bg="red.50"
      >
        <Typography.Body2
          bold
          fontSize="xl"
          textAlign="center"
          color="text-subdued"
        >
          Connect Device
        </Typography.Body2>
      </Button>
      {features ? (
        <Stack space={3} alignItems="center">
          <VStack minWidth="500" space={4} alignItems="center">
            <Typography.Heading textAlign="center" my="10">
              Device Info
            </Typography.Heading>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Typography.Body2 bold fontSize="xl" textAlign="center">
                {features.onekey_version}
              </Typography.Body2>
            </Center>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Typography.Body2 bold fontSize="xl" textAlign="center">
                {features.serial_no || features.onekey_serial}
              </Typography.Body2>
            </Center>
            <Center width="100%" px="6" h="20" rounded="md" shadow={3}>
              <Typography.Body2 bold fontSize="xl" textAlign="center">
                {features.serial_no?.includes('MI')
                  ? 'OneKey MINI'
                  : 'OneKey Classic'}
              </Typography.Body2>
            </Center>
          </VStack>
        </Stack>
      ) : null}
    </Center>
  );
};

export default DeviceConnection;
