import { useEffect, useMemo, useRef, useState } from 'react';

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

// Smooth progress hook - interpolates progress value for smoother animations
function useSmoothProgress(targetProgress: number, step: number = 1) {
  const [displayProgress, setDisplayProgress] = useState(targetProgress);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    // Animate towards target
    animationRef.current = setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= targetProgress) {
          if (animationRef.current) {
            clearInterval(animationRef.current);
          }
          return targetProgress;
        }
        return Math.min(current + step, targetProgress);
      });
    }, 30);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [targetProgress, step]);

  return displayProgress;
}

export function LegacyUpdateProgress({
  step,
  progress,
  message,
  phase,
}: ILegacyUpdateProgressProps) {
  const intl = useIntl();
  // Use smooth progress for fluid animation
  const smoothProgress = useSmoothProgress(progress, 1);

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
      animation="medium"
      enterStyle={{
        opacity: 0,
        y: 10,
      }}
      opacity={1}
      y={0}
    >
      <XStack
        space="$2"
        alignItems="center"
        animation="quick"
        enterStyle={{
          opacity: 0,
          scale: 0.95,
        }}
        opacity={1}
        scale={1}
      >
        <Spinner size="small" />
        <SizableText size="$headingLg">{stepTitle}</SizableText>
      </XStack>

      <Stack width="100%" maxWidth={400}>
        <Progress value={smoothProgress} size="medium" animated />
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          mt="$2"
          animation="quick"
        >
          {message || stepDescription || `${Math.round(smoothProgress)}%`}
        </SizableText>
      </Stack>

      {step === ELegacyFirmwareUpdateSteps.installingFirmware && (
        <SizableText
          size="$bodySm"
          color="$textCaution"
          textAlign="center"
          mt="$4"
          animation="medium"
          enterStyle={{
            opacity: 0,
          }}
          opacity={1}
        >
          {intl.formatMessage({
            id: ETranslations.update_keep_usb_connected_and_app_active,
          })}
        </SizableText>
      )}
    </YStack>
  );
}
