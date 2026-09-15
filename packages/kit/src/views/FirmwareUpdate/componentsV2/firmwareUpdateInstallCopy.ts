import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IFirmwareUpdateStage,
  IRemainingTimeBucket,
} from './firmwareUpdateInstallViewModel';
import type { IntlShape } from 'react-intl';

/** Copy for the unified install page, keyed for every locale. */
export const firmwareUpdateInstallCopy = {
  pageTitle: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_install_page__title,
    }),
  updatingDevice: (intl: IntlShape, deviceName: string) =>
    intl.formatMessage(
      { id: ETranslations.firmware_update_updating_device__title },
      { device: deviceName },
    ),
  firmwareUpdated: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.firmware_update_done__title }),
  keepDeviceConnected: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_keep_device_connected__msg,
    }),
  getHelp: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.firmware_update_get_help__action }),
  grantUsbAccess: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.device_grant_usb_access }),
  details: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.global_details }),
  retry: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.global_retry }),
  done: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.global_done }),
  importWallet: (intl: IntlShape) =>
    intl.formatMessage({ id: ETranslations.global_import_wallet }),
  /** Product name, not translated. */
  safeOS: 'SafeOS',
  stage: (intl: IntlShape, stage: IFirmwareUpdateStage): string => {
    switch (stage) {
      case 'preparing':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_preparing__msg,
        });
      case 'downloading':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_downloading__msg,
        });
      case 'enteringUpdateMode':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_entering_update_mode__msg,
        });
      case 'waitingForDevice':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_waiting_for_device__msg,
        });
      case 'installing':
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_installing__msg,
        });
      case 'verifying':
      default:
        return intl.formatMessage({
          id: ETranslations.firmware_update_stage_verifying__msg,
        });
    }
  },
  /** Right side of the progress row: "74%" or "74% · About 1 min left". */
  progressMeta: (percent: number, remainingTimeText?: string) =>
    remainingTimeText
      ? `${Math.round(percent)}% · ${remainingTimeText}`
      : `${Math.round(percent)}%`,
  remainingTime: (intl: IntlShape, bucket: IRemainingTimeBucket): string => {
    if (bucket.kind === 'minutes') {
      return intl.formatMessage(
        { id: ETranslations.firmware_update_time_left_about_min__msg },
        { count: bucket.minutes },
      );
    }
    if (bucket.kind === 'oneMinute') {
      return intl.formatMessage({
        id: ETranslations.firmware_update_time_left_about_one_min__msg,
      });
    }
    return intl.formatMessage({
      id: ETranslations.firmware_update_time_left_under_one_min__msg,
    });
  },
  webUsbBootloaderInstruction: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_grant_usb_instruction,
    }),
  webUsbSwitchFirmwareInstruction: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_switch_firmware_reconnect_device,
    }),
};
