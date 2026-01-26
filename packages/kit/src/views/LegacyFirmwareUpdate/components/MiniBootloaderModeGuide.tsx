import { useIntl } from 'react-intl';

import { Alert, SizableText, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IMiniBootloaderModeGuideProps {
  deviceType: string;
}

export function MiniBootloaderModeGuide({
  deviceType: _deviceType,
}: IMiniBootloaderModeGuideProps) {
  const intl = useIntl();

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
          <SizableText size="$bodyMd" color="$textSubdued">
            1. Disconnect USB cable from device
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            2. Hold the button and connect USB cable
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            3. Release the button after connecting
          </SizableText>
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
