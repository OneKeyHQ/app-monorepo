import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '../errors';
import { normalizeErrorProps } from '../errors/utils/errorUtils';
import { ETranslations } from '../locale';

import { DEVICE_STAGE_DEDICATED_DIALOG_CODES } from './deviceStageErrorCodes';

import type { IOneKeyError } from '../errors/types/errorTypes';

export const HARDWARE_CLOUD_SYNC_STANDARD_PIN_REQUIRED = 'standardPinRequired';
export const HARDWARE_CLOUD_SYNC_DIRECT_SDK_ORIGIN = 'directSdk';

export function isHardwareCloudSyncDirectSdkDialogError(error: unknown) {
  const failure = error as
    | IOneKeyError<{ hardwareCloudSyncErrorOrigin?: string }>
    | undefined;
  return (
    failure?.$isHardwareError === true &&
    typeof failure.code === 'number' &&
    DEVICE_STAGE_DEDICATED_DIALOG_CODES.some((code) => code === failure.code) &&
    failure.info?.hardwareCloudSyncErrorOrigin ===
      HARDWARE_CLOUD_SYNC_DIRECT_SDK_ORIGIN
  );
}

// A UI-only context set when the standard-wallet session rejects its PIN
// type. The original SDK error code, class and payload remain intact.
export function isHardwareCloudSyncStandardPinRequired(error: unknown) {
  const failure = error as
    | IOneKeyError<{ hardwareCloudSyncRefusal?: string }>
    | undefined;
  return (
    failure?.$isHardwareError === true &&
    failure.code === HardwareErrorCode.DeviceCheckUnlockTypeError &&
    failure.info?.hardwareCloudSyncRefusal ===
      HARDWARE_CLOUD_SYNC_STANDARD_PIN_REQUIRED
  );
}

const prerequisiteMessages = {
  // Developer settings only, so it stays in English.
  logging:
    'Device debug logging could record the Cloud sync signature. Turn off Settings > Dev mode > App & Firmware Updates > Firmware Update Dev Settings > Show Device Debug Log, then try again.',
  transport:
    'Connect your hardware wallet directly via USB or Bluetooth to sync.',
  compatibility: "Hardware wallet encryption isn't supported on this platform.",
  walletMismatch:
    "This hardware wallet doesn't match the one used for Cloud sync.",
} as const;

const prerequisiteKeys: Partial<
  Record<keyof typeof prerequisiteMessages, ETranslations>
> = {
  transport: ETranslations.cloud_sync_hardware_direct_connection__msg,
  compatibility: ETranslations.cloud_sync_hardware_unavailable__msg,
  walletMismatch: ETranslations.cloud_sync_hardware_wallet_mismatch__msg,
};

export class HardwareCloudKeyPrerequisiteError extends OneKeyLocalError {
  constructor(
    readonly reason: keyof typeof prerequisiteMessages,
    info?: { targetCredentialId: string },
  ) {
    super(
      normalizeErrorProps(
        {
          key: prerequisiteKeys[reason],
          info,
          // The page asks whether to continue with this hardware wallet.
          autoToast: reason === 'walletMismatch' ? false : undefined,
        },
        { defaultMessage: prerequisiteMessages[reason] },
      ),
    );
  }
}
