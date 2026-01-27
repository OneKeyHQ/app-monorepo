import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function WebUsbDeviceReselectPrompt() {
  const intl = useIntl();

  const isNative = platformEnv.isNative;

  const onReselectDevice = useCallback(async () => {
    try {
      // Request device reselection
      // On Web/Extension: triggers browser's WebUSB device picker dialog
      // On Native: triggers Bluetooth device search
      await backgroundApiProxy.serviceHardware.searchDevices();
    } catch (error) {
      console.error('Failed to reselect device:', error);
    }
  }, []);

  // Native (mobile) platforms use Bluetooth - show different UI
  if (isNative) {
    return (
      <YStack
        space="$4"
        p="$4"
        alignItems="center"
        animation="medium"
        enterStyle={{
          opacity: 0,
          y: 10,
        }}
        opacity={1}
        y={0}
      >
        <Alert
          title={intl.formatMessage({
            id: ETranslations.wallet_connect_hardware_wallet,
          })}
          description={intl.formatMessage({
            id: ETranslations.hardware_searching_for_device,
          })}
          type="info"
          fullBleed
        />

        <YStack
          space="$3"
          p="$4"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          width="100%"
          animation="medium"
          enterStyle={{
            opacity: 0,
            y: 5,
          }}
          opacity={1}
          y={0}
        >
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.update_hardware_wallet_in_bootloader_mode,
            })}
          </SizableText>
        </YStack>

        <YStack
          alignItems="center"
          space="$4"
          py="$4"
          animation="slow"
          enterStyle={{
            opacity: 0,
          }}
          opacity={1}
        >
          <Spinner size="large" />
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.hardware_searching_for_device,
            })}
          </SizableText>
        </YStack>
      </YStack>
    );
  }

  // Web/Extension platforms use WebUSB
  return (
    <YStack
      space="$4"
      p="$4"
      alignItems="center"
      animation="medium"
      enterStyle={{
        opacity: 0,
        y: 10,
      }}
      opacity={1}
      y={0}
    >
      <Alert
        title={intl.formatMessage({
          id: ETranslations.wallet_connect_hardware_wallet,
        })}
        description={intl.formatMessage({
          id: ETranslations.hardware_searching_for_device,
        })}
        type="info"
        fullBleed
      />

      <YStack
        space="$3"
        p="$4"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
        width="100%"
        animation="medium"
        enterStyle={{
          opacity: 0,
          y: 5,
        }}
        opacity={1}
        y={0}
      >
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.update_hardware_wallet_in_bootloader_mode,
          })}
        </SizableText>
      </YStack>

      <YStack
        alignItems="center"
        space="$4"
        py="$4"
        animation="slow"
        enterStyle={{
          opacity: 0,
          scale: 0.95,
        }}
        opacity={1}
        scale={1}
      >
        <Icon name="UsbOutline" size="$12" color="$iconSubdued" />

        <Button size="large" onPress={onReselectDevice}>
          <XStack space="$2" alignItems="center">
            <Icon name="SearchOutline" size="$5" />
            <SizableText>
              {intl.formatMessage({
                id: ETranslations.global_retry,
              })}
            </SizableText>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}
