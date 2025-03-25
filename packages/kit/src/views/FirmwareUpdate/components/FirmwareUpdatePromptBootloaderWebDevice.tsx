import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import type { IFirmwareUpdateStepInfo } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function FirmwareUpdatePromptBootloaderWebDevice({
  previousStepInfo,
}: {
  previousStepInfo: IFirmwareUpdateStepInfo;
}) {
  const intl = useIntl();
  const [isConnecting, setIsConnecting] = useState(false);
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();
  const [_, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  // Handle USB connection request
  const handleGrantAccess = useCallback(async () => {
    setIsConnecting(true);
    try {
      const device = await promptWebUsbDeviceAccess();
      await backgroundApiProxy.serviceHardwareUI.sendRequestDeviceInBootloaderForWebDevice(
        {
          deviceId: device.serialNumber ?? '',
        },
      );
      setStepInfo({
        ...previousStepInfo,
      } as IFirmwareUpdateStepInfo);
    } catch (error) {
      console.error('USB device connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [promptWebUsbDeviceAccess, setStepInfo, previousStepInfo]);

  return (
    <Stack flex={1} bg="$bgApp" ai="center" jc="center" p="$5">
      <Stack ai="center" width={337} gap="$5">
        {/* Logo */}
        <Stack mt="$5" alignSelf="flex-start">
          <Image
            source={require('@onekeyhq/kit/assets/logo-mark.svg')}
            size="$7"
            tintColor="white"
          />
        </Stack>

        <YStack gap="$2.5">
          {/* Title */}
          <SizableText size="$headingXl">
            {intl.formatMessage({ id: ETranslations.device_grant_usb_access })}
          </SizableText>

          {/* Description */}
          <SizableText size="$bodyLg" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.device_select_device_popup,
            })}
          </SizableText>
        </YStack>

        {/* Device Selection Illustration */}
        <Stack
          w={337}
          h="$56"
          bg="$bgSubdued"
          pt="$5"
          pl="$32"
          pr="$5"
          pb="$16"
          ai="center"
          jc="center"
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
        >
          {/* Dialog container */}
          <YStack
            bg="$bg"
            width="100%"
            h={140}
            p="$2.5"
            gap="$2.5"
            borderRadius="$2"
            borderColor="$borderSubdued"
            outlineWidth={1}
            outlineColor="$borderSubdued"
            outlineStyle="solid"
            outlineOffset={0}
            elevation={20}
          >
            {/* Dialog header with padding */}
            <Stack
              bg="$neutral5"
              w="$12"
              h="$2"
              borderRadius="$1"
              flexShrink={0}
            />

            {/* Blue selection area */}
            <Stack
              borderRadius="$1"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            >
              <Stack
                bg="$bgInfo"
                p="$2.5"
                borderBottomColor="$borderSubdued"
                borderBottomWidth={StyleSheet.hairlineWidth}
              >
                <Stack bg="$neutral9" h="$2" w="$12" borderRadius="$1" />
              </Stack>
              <Stack bg="$$bg" h={50} w="100%" />
            </Stack>

            {/* Dialog footer */}
            <XStack jc="flex-end" gap="$2.5">
              <Stack
                w="$12"
                h="$3"
                borderRadius="$full"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
              />
              <Stack w="$12" h="$3" borderRadius="$full" bg="$info11" />
            </XStack>
          </YStack>
        </Stack>

        {/* Button */}
        <Button
          variant="primary"
          size="small"
          onPress={handleGrantAccess}
          loading={isConnecting}
          disabled={isConnecting}
          width="100%"
        >
          {intl.formatMessage({ id: ETranslations.device_grant_usb_access })}
        </Button>
      </Stack>
    </Stack>
  );
}
