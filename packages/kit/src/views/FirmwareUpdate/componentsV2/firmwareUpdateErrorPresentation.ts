import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE,
  FIRMWARE_UPDATE_BRIDGE_GUIDE,
  FIRMWARE_UPDATE_FULL_RES_GUIDE,
  FIRMWARE_UPDATE_WEB_TOOLS_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  ECustomOneKeyHardwareError,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  classifyFirmwareUpdateFailure,
  shouldHideFirmwareUpdateInternalError,
} from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import type { IntlShape } from 'react-intl';

export type IFirmwareUpdateErrorAction =
  | { kind: 'retry'; text?: string }
  | { kind: 'link'; url: string; text: string }
  | { kind: 'none' };

export type IFirmwareUpdateErrorPresentation = {
  title: string;
  message?: string;
  /** Single sentence for the inline (task-level) error state. */
  sentence: string;
  action: IFirmwareUpdateErrorAction;
  /** Manual-bootloader tutorial link shown under the sentence. */
  tutorialUrl?: string;
};

/**
 * One table for every firmware update error, derived from the legacy
 * `FirmwareUpdateErrors` mapping (the fuller of the two that existed).
 * Pages render `title` + `message` for workflow-level failures and
 * `sentence` for task-level failures.
 */
export function resolveFirmwareUpdateErrorPresentation({
  error,
  result,
  lastFirmwareTipMessage,
  intl,
}: {
  error: IOneKeyError | undefined;
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
  intl: IntlShape;
}): IFirmwareUpdateErrorPresentation {
  const t = (id: ETranslations) => intl.formatMessage({ id });
  const retry: IFirmwareUpdateErrorAction = { kind: 'retry' };
  const build = (
    title: string,
    message: string | undefined,
    action: IFirmwareUpdateErrorAction,
    tutorialUrl?: string,
  ): IFirmwareUpdateErrorPresentation => ({
    title,
    message,
    sentence: message || title,
    action,
    tutorialUrl,
  });

  const is = (code: number | number[]) =>
    isHardwareErrorByCode({ error, code });

  if (
    is([
      HardwareErrorCode.PinCancelled,
      HardwareErrorCode.ActionCancelled,
      HardwareErrorCode.CallQueueActionCancelled,
      HardwareErrorCode.DeviceInterruptedFromOutside,
    ])
  ) {
    return build(
      t(ETranslations.update_operation_canceled),
      t(ETranslations.update_operation_canceled_desc),
      retry,
    );
  }
  if (is(HardwareErrorCode.BleUnavailableWhileUsbConnected)) {
    return build(
      t(ETranslations.global_an_error_occurred),
      t(ETranslations.troubleshooting_desktop_bluetooth_usb_priority),
      retry,
    );
  }
  if (is(HardwareErrorCode.FirmwareUpdateDownloadFailed)) {
    return build(
      t(ETranslations.update_download_failed),
      t(ETranslations.update_check_connection_try_again),
      retry,
    );
  }
  if (
    is(HardwareErrorCode.FirmwareVerificationFailed) &&
    error?.key === ETranslations.global_version_mismatch
  ) {
    return build(
      t(ETranslations.global_update_failed),
      t(ETranslations.firmware_update_version_mismatch__msg),
      retry,
    );
  }
  const firmwareUpdateCode = error?.payload?.params?.firmwareUpdateCode;
  if (
    is(HardwareErrorCode.FirmwareVerificationFailed) ||
    (typeof firmwareUpdateCode === 'string' &&
      firmwareUpdateCode.startsWith('Firmware'))
  ) {
    return build(
      t(ETranslations.global_update_failed),
      t(ETranslations.global_network_doctor_action_contact_support_persist),
      retry,
    );
  }
  if (is(HardwareErrorCode.PinInvalid)) {
    return build(
      t(ETranslations.global_an_error_occurred),
      t(ETranslations.hardware_invalid_pin_error),
      retry,
    );
  }
  if (is(HardwareErrorCode.SelectDevice)) {
    return build(
      t(ETranslations.global_an_error_occurred),
      t(ETranslations.update_only_one_usb_device_supported_for_upgrade),
      retry,
    );
  }
  if (
    is([
      HardwareErrorCode.FirmwareUpdateManuallyEnterBoot,
      HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure,
    ]) ||
    (error &&
      lastFirmwareTipMessage ===
        EFirmwareUpdateTipMessages.AutoRebootToBootloader)
  ) {
    if (result?.deviceType === EDeviceType.Mini) {
      return build(
        t(ETranslations.update_manually_entering_bootloader_mode),
        t(ETranslations.update_manually_entering_bootloader_mode_desc),
        {
          kind: 'retry',
          text: t(ETranslations.update_verify_status_and_continue),
        },
      );
    }
    return build(
      t(ETranslations.update_manually_entering_bootloader_mode),
      undefined,
      retry,
      FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE,
    );
  }
  if (is(HardwareErrorCode.BridgeNetworkError)) {
    return build(
      t(ETranslations.update_bridge_network_error),
      t(ETranslations.update_unable_to_connect_to_bridge),
      retry,
    );
  }
  if (is(HardwareErrorCode.BridgeTimeoutError)) {
    return build(
      t(ETranslations.update_bridge_timeout_error),
      t(ETranslations.update_connection_to_bridge_timed_out),
      retry,
    );
  }
  if (
    is([
      HardwareErrorCode.BridgeNotInstalled,
      ECustomOneKeyHardwareError.NeedOneKeyBridge,
    ])
  ) {
    return build(
      t(ETranslations.update_bridge_not_installed),
      t(ETranslations.update_hardware_update_requires_bridge),
      retry,
    );
  }
  if (is(ECustomOneKeyHardwareError.NeedOneKeyBridgeUpgrade)) {
    return build(
      t(ETranslations.update_outdated_version_detected),
      t(ETranslations.update_hardware_update_requires_bridge),
      {
        kind: 'link',
        url: FIRMWARE_UPDATE_BRIDGE_GUIDE,
        text: t(ETranslations.global_view_tutorial),
      },
    );
  }
  if (is(ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb)) {
    return build(
      t(ETranslations.update_update_in_official_web_tool),
      t(ETranslations.update_update_in_official_web_tool_desc),
      {
        kind: 'link',
        url: FIRMWARE_UPDATE_WEB_TOOLS_URL,
        text: t(ETranslations.global_visit_website),
      },
    );
  }
  if (is(HardwareErrorCode.UseDesktopToUpdateFirmware)) {
    return build(
      t(ETranslations.update_outdated_version_detected),
      t(ETranslations.update_outdated_version_detected_desc),
      {
        kind: 'link',
        url: FIRMWARE_UPDATE_FULL_RES_GUIDE,
        text: t(ETranslations.global_view_tutorial),
      },
    );
  }
  if (is(HardwareErrorCode.FirmwareDowngradeNotAllowed)) {
    return build(
      t(ETranslations.device_firmware_upgrade_disallow_downgrade),
      undefined,
      { kind: 'none' },
    );
  }
  if (is(ECustomOneKeyHardwareError.FirmwareUpdateBatteryTooLow)) {
    return build(
      t(ETranslations.update_insufficient_battery_power),
      t(ETranslations.firmware_update_battery_low__desc),
      retry,
    );
  }
  if (is(ECustomOneKeyHardwareError.FirmwareUpdateRequiresUsbTransport)) {
    return build(
      t(ETranslations.firmware_update_usb_required__title),
      t(ETranslations.firmware_update_usb_required__desc),
      retry,
    );
  }
  if (is(ECustomOneKeyHardwareError.FirmwareUpdateUnsupportedDevice)) {
    return build(
      t(ETranslations.firmware_update_not_available__title),
      t(ETranslations.firmware_update_not_available__desc),
      { kind: 'none' },
    );
  }
  if (classifyFirmwareUpdateFailure(error) === 'transfer') {
    return build(
      t(ETranslations.global_update_failed),
      t(ETranslations.firmware_update_error_transfer_interrupted),
      retry,
    );
  }
  if (classifyFirmwareUpdateFailure(error) === 'timeout') {
    return build(
      t(ETranslations.global_an_error_occurred),
      t(ETranslations.hardware_third_party_operation_timeout),
      retry,
    );
  }
  if (shouldHideFirmwareUpdateInternalError(error)) {
    return build(
      t(ETranslations.hardware_third_party_device_disconnected),
      t(ETranslations.update_device_disconnected_desc),
      retry,
    );
  }
  let message = error?.message;
  if (error?.code === 4500) {
    message = t(ETranslations.feedback_hw_polling_time_out);
  }
  return build(t(ETranslations.global_an_error_occurred), message, retry);
}
