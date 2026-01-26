import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function WebUsbDeviceReselectPrompt() {
  const intl = useIntl();

  const onReselectDevice = useCallback(async () => {
    try {
      // Request WebUSB device reselection
      // This will trigger the browser's device picker dialog
      await backgroundApiProxy.serviceHardware.searchDevices();
    } catch (error) {
      console.error('Failed to reselect device:', error);
    }
  }, []);

  return (
    <YStack space="$4" p="$4" alignItems="center">
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
      >
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.update_hardware_wallet_in_bootloader_mode,
          })}
        </SizableText>
      </YStack>

      <YStack alignItems="center" space="$4" py="$4">
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
