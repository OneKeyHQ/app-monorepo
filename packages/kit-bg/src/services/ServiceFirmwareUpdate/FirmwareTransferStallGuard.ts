import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

export const FIRMWARE_TRANSFER_RESUME_GRACE_MS = 3000;

type IFirmwareTransferUiSnapshot = {
  action?: EHardwareUiStateAction;
  firmwareProgress?: number;
  firmwareProgressType?: 'transferData' | 'installingFirmware';
  firmwareTipMessage?: string;
};

export function getFirmwareTransferUiSnapshot(
  state:
    | {
        action?: EHardwareUiStateAction;
        payload?: {
          firmwareProgress?: number;
          firmwareProgressType?: 'transferData' | 'installingFirmware';
          firmwareTipData?: { message?: string };
        };
      }
    | undefined,
): IFirmwareTransferUiSnapshot {
  return {
    action: state?.action,
    firmwareProgress: state?.payload?.firmwareProgress,
    firmwareProgressType: state?.payload?.firmwareProgressType,
    firmwareTipMessage: state?.payload?.firmwareTipData?.message,
  };
}

export function isFirmwareTransferInProgress(
  snapshot: IFirmwareTransferUiSnapshot | undefined,
): boolean {
  if (!snapshot) {
    return false;
  }
  if (snapshot.firmwareProgressType === 'installingFirmware') {
    return false;
  }
  // A completed 100% transfer stays on the atom while the device erases
  // and writes flash. That sticky transferData value is not live bytes.
  if (
    snapshot.firmwareProgressType === 'transferData' &&
    typeof snapshot.firmwareProgress === 'number' &&
    snapshot.firmwareProgress >= 100
  ) {
    return false;
  }
  if (
    snapshot.action === EHardwareUiStateAction.FIRMWARE_PROGRESS &&
    snapshot.firmwareProgressType === 'transferData'
  ) {
    return true;
  }
  return (
    snapshot.action === EHardwareUiStateAction.FIRMWARE_TIP &&
    snapshot.firmwareTipMessage === EFirmwareUpdateTipMessages.StartTransferData
  );
}

export function didFirmwareTransferResume({
  before,
  after,
}: {
  before: IFirmwareTransferUiSnapshot;
  after: IFirmwareTransferUiSnapshot;
}): boolean {
  if (!isFirmwareTransferInProgress(after)) {
    return true;
  }
  const beforeProgress = before.firmwareProgress;
  const afterProgress = after.firmwareProgress;
  if (typeof afterProgress !== 'number') {
    return false;
  }
  if (typeof beforeProgress !== 'number') {
    return true;
  }
  return afterProgress > beforeProgress;
}
