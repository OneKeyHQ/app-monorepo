import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface IMiniBootloaderModeGuideProps {
  deviceType: string;
}

export function MiniBootloaderModeGuide({
  deviceType: _deviceType,
}: IMiniBootloaderModeGuideProps) {
  const intl = useIntl();

  const isNative = platformEnv.isNative;

  const steps = useMemo(() => {
    if (isNative) {
      // Bluetooth connection steps for mobile
      return [
        'Power off the device',
        'Hold the button and power on the device',
        'Release the button when bootloader screen appears',
      ];
    }
    // USB connection steps for Web/Extension
    return [
      'Disconnect USB cable from device',
      'Hold the button and connect USB cable',
      'Release the button after connecting',
    ];
  }, [isNative]);

  return (
    <YStack space="$4" p="$4">
      <Alert
        title={intl.formatMessage({
          id: ETranslations.update_manually_entering_bootloader_mode,
        })}
        description={intl.formatMessage({
          id: ETranslations.update_manually_entering_bootloader_mode_desc,
        })}
        type="warning"
        fullBleed
      />

      <YStack
        space="$3"
        p="$4"
        borderRadius="$3"
        borderWidth={1}
        borderColor="$borderSubdued"
      >
        <SizableText size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.update_reboot_to_bootloader_mode,
          })}
        </SizableText>

        <YStack space="$2">
          {steps.map((step, index) => (
            <SizableText key={index} size="$bodyMd" color="$textSubdued">
              {`${index + 1}. ${step}`}
            </SizableText>
          ))}
        </YStack>
      </YStack>

      <YStack alignItems="center" space="$2" py="$4">
        <Spinner size="large" />
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.wallet_connect_hardware_wallet,
          })}
        </SizableText>
      </YStack>
    </YStack>
  );
}
