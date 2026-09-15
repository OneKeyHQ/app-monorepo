import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IFirmwareUpdateStage,
  IRemainingTimeBucket,
} from './firmwareUpdateInstallViewModel';
import type { IntlShape } from 'react-intl';

/**
 * Copy for the unified install page. Strings without a Lokalise key yet are
 * kept here in one place so the i18n pass can replace them together.
 */
export const firmwareUpdateInstallCopy = {
  pageTitle: 'Firmware update',
  updatingDevice: (deviceName: string) => `Updating ${deviceName}`,
  firmwareUpdated: 'Firmware updated',
  keepDeviceConnected: 'Keep your device connected',
  getHelp: 'Get help',
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
  safeOS: 'SafeOS',
  stage: (stage: IFirmwareUpdateStage): string => {
    switch (stage) {
      case 'preparing':
        return 'Preparing update…';
      case 'downloading':
        return 'Downloading update…';
      case 'enteringUpdateMode':
        return 'Entering update mode…';
      case 'waitingForDevice':
        return 'Waiting for device…';
      case 'installing':
        return 'Installing firmware…';
      case 'verifying':
      default:
        return 'Verifying…';
    }
  },
  /** Right side of the progress row: "74%" or "74% · About 1 min left". */
  progressMeta: (percent: number, remainingTimeText?: string) =>
    remainingTimeText
      ? `${Math.round(percent)}% · ${remainingTimeText}`
      : `${Math.round(percent)}%`,
  remainingTime: (bucket: IRemainingTimeBucket): string => {
    if (bucket.kind === 'minutes') {
      return `About ${bucket.minutes} min left`;
    }
    if (bucket.kind === 'oneMinute') {
      return 'About 1 min left';
    }
    return 'Under 1 min left';
  },
  versionMismatch: 'Installed version doesn’t match. Retry the update.',
  usbRequiredTitle: 'USB required for update',
  usbRequiredDesc: 'Connect your device with a USB cable and try again.',
  updateNotAvailableTitle: 'Update not available',
  updateNotAvailableDesc: 'This device can’t be updated from this app.',
  batteryTooLowDesc: 'Charge your device to at least 25% and try again.',
  webUsbBootloaderInstruction: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_grant_usb_instruction,
    }),
  webUsbSwitchFirmwareInstruction: (intl: IntlShape) =>
    intl.formatMessage({
      id: ETranslations.firmware_update_switch_firmware_reconnect_device,
    }),
};
