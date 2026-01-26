import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Progress,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ELegacyFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ILegacyUpdateProgressProps {
  step: ELegacyFirmwareUpdateSteps;
  progress: number;
  message?: string;
  phase?: 'firmware' | 'ble';
}

export function LegacyUpdateProgress({
  step,
  progress,
  message,
  phase,
}: ILegacyUpdateProgressProps) {
  const intl = useIntl();

  const stepTitle = useMemo(() => {
    switch (step) {
      case ELegacyFirmwareUpdateSteps.preparing:
        return intl.formatMessage({ id: ETranslations.global_preparing });
      case ELegacyFirmwareUpdateSteps.checkingBootloader:
        return intl.formatMessage({
          id: ETranslations.update_updating_bootloader,
        });
      case ELegacyFirmwareUpdateSteps.updatingBootloader:
        return intl.formatMessage({
          id: ETranslations.update_updating_bootloader,
        });
      case ELegacyFirmwareUpdateSteps.downloadingFirmware:
        return intl.formatMessage({ id: ETranslations.update_downloading });
      case ELegacyFirmwareUpdateSteps.installingFirmware:
        if (phase === 'ble') {
          return intl.formatMessage(
            { id: ETranslations.global_updating_type },
            {
              type: intl.formatMessage({ id: ETranslations.global_bluetooth }),
            },
          );
        }
        return intl.formatMessage({
          id: ETranslations.global_installing_firmware,
        });
      case ELegacyFirmwareUpdateSteps.requestDeviceReselect:
        return intl.formatMessage({
          id: ETranslations.wallet_connect_hardware_wallet,
        });
      default:
        return intl.formatMessage({ id: ETranslations.global_updating });
    }
  }, [step, phase, intl]);

  const stepDescription = useMemo(() => {
    switch (step) {
      case ELegacyFirmwareUpdateSteps.preparing:
        return intl.formatMessage({
          id: ETranslations.update_checking_device_if_no_restart,
        });
      case ELegacyFirmwareUpdateSteps.checkingBootloader:
        return intl.formatMessage({
          id: ETranslations.update_checking_latest_ui_resources,
        });
      case ELegacyFirmwareUpdateSteps.updatingBootloader:
        return intl.formatMessage({
          id: ETranslations.update_updating_ui_resources,
        });
      case ELegacyFirmwareUpdateSteps.downloadingFirmware:
        return intl.formatMessage({
          id: ETranslations.update_downloading_latest_ui_resources,
        });
      case ELegacyFirmwareUpdateSteps.installingFirmware:
        return intl.formatMessage({
          id: ETranslations.update_transferring_data,
        });
      case ELegacyFirmwareUpdateSteps.requestDeviceReselect:
        return intl.formatMessage({
          id: ETranslations.firmware_update_grant_usb_instruction,
        });
      default:
        return message || '';
    }
  }, [step, message, intl]);

  return (
    <YStack
      space="$6"
      alignItems="center"
      justifyContent="center"
      flex={1}
      py="$8"
    >
      <XStack space="$2" alignItems="center">
        <Spinner size="small" />
        <SizableText size="$headingLg">{stepTitle}</SizableText>
      </XStack>

      <Stack width="100%" maxWidth={400}>
        <Progress value={progress} size="medium" />
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          mt="$2"
        >
          {message || stepDescription || `${progress}%`}
        </SizableText>
      </Stack>

      {step === ELegacyFirmwareUpdateSteps.installingFirmware && (
        <SizableText
          size="$bodySm"
          color="$textCaution"
          textAlign="center"
          mt="$4"
        >
          {intl.formatMessage({
            id: ETranslations.update_keep_usb_connected_and_app_active,
          })}
        </SizableText>
      )}
    </YStack>
  );
}
