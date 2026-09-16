import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

export const FIRMWARE_TRANSFER_RESUME_GRACE_MS = 3000;

type IFirmwareTransferUiSnapshot = {
  firmwareProgress?: number;
  firmwareProgressType?: 'transferData' | 'installingFirmware';
  firmwareTipMessage?: string;
};

export function getFirmwareTransferUiSnapshot(
  state:
    | {
        payload?: {
          firmwareProgress?: number;
          firmwareProgressType?: 'transferData' | 'installingFirmware';
          firmwareTipData?: { message?: string };
        };
      }
    | undefined,
): IFirmwareTransferUiSnapshot {
  return {
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
  if (snapshot.firmwareProgressType === 'transferData') {
    return true;
  }
  return (
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
  return (
    typeof afterProgress === 'number' &&
    typeof beforeProgress === 'number' &&
    afterProgress > beforeProgress
  );
}
