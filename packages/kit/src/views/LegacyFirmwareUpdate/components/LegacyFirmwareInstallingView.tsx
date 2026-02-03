import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import {
  ELegacyFirmwareUpdateSteps,
  useLegacyFirmwareUpdateProgressAtom,
  useLegacyFirmwareUpdateStepAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { FirmwareUpdateProgressBarView } from '../../FirmwareUpdate/componentsV2/FirmwareUpdateProgressBarV2';

interface ILegacyFirmwareInstallingViewProps {
  deviceType: string;
  currentFirmwareVersion: string;
  currentBootloaderVersion: string;
  targetFirmwareVersion?: string;
}

export function LegacyFirmwareInstallingView({
  deviceType: _deviceType,
  currentFirmwareVersion,
  currentBootloaderVersion: _currentBootloaderVersion,
  targetFirmwareVersion,
}: ILegacyFirmwareInstallingViewProps) {
  const intl = useIntl();
  const [stepInfo] = useLegacyFirmwareUpdateStepAtom();
  const [progressInfo] = useLegacyFirmwareUpdateProgressAtom();

  const isDone = stepInfo.step === ELegacyFirmwareUpdateSteps.done;
  const [isDoneInternal, setIsDoneInternal] = useState(false);

  useEffect(() => {
    if (isDone) {
      setTimeout(() => {
        setIsDoneInternal(true);
      }, 1500);
    }
  }, [isDone]);

  // Build version info for the UI
  const versions = useMemo(() => {
    const result = [];

    // Firmware version
    if (currentFirmwareVersion) {
      result.push({
        type: intl.formatMessage({ id: ETranslations.global_firmware }),
        info: {
          title: intl.formatMessage({ id: ETranslations.global_firmware }),
          fromVersion: currentFirmwareVersion,
          toVersion: targetFirmwareVersion || 'Latest',
          verifyVersion: isDoneInternal ? targetFirmwareVersion : undefined,
          hasUpgrade: true,
        },
      });
    }

    return result;
  }, [intl, currentFirmwareVersion, targetFirmwareVersion, isDoneInternal]);

  // Map Legacy step to description
  const getDescription = useCallback(() => {
    switch (stepInfo.step) {
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
        return intl.formatMessage({ id: ETranslations.update_downloading });
      case ELegacyFirmwareUpdateSteps.installingFirmware:
        return intl.formatMessage({ id: ETranslations.update_installing });
      case ELegacyFirmwareUpdateSteps.requestDeviceReselect:
        return intl.formatMessage({
          id: ETranslations.firmware_update_grant_usb_instruction,
        });
      case ELegacyFirmwareUpdateSteps.done:
        return intl.formatMessage({
          id: ETranslations.firmware_update_status_completed,
        });
      default:
        return progressInfo.message || '';
    }
  }, [stepInfo.step, progressInfo.message, intl]);

  // Map Legacy progress to 0-100 range
  const mappedProgress = useMemo(() => {
    if (isDone) return 100;
    // Use progress from atom, clamped to 0-99 until done
    return Math.min(progressInfo.progress, 99);
  }, [isDone, progressInfo.progress]);

  const title = useMemo(() => {
    if (isDoneInternal) {
      return intl.formatMessage({
        id: ETranslations.update_all_updates_complete,
      });
    }
    return intl.formatMessage({
      id: ETranslations.global_installing_firmware,
    });
  }, [isDoneInternal, intl]);

  return (
    <Stack>
      <FirmwareUpdateProgressBarView
        versions={versions}
        title={title}
        progress={mappedProgress}
        desc={getDescription()}
        isDone={isDoneInternal}
        isVerified={isDoneInternal}
      />
    </Stack>
  );
}
