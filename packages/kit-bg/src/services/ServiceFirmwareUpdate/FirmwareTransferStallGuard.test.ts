import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import {
  didFirmwareTransferResume,
  getFirmwareTransferUiSnapshot,
  isFirmwareTransferInProgress,
} from './FirmwareTransferStallGuard';

describe('FirmwareTransferStallGuard', () => {
  test('treats live transferData progress and StartTransferData as transferring', () => {
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 35,
          },
        }),
      ),
    ).toBe(true);
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_TIP,
          payload: {
            firmwareTipData: {
              message: EFirmwareUpdateTipMessages.StartTransferData,
            },
          },
        }),
      ),
    ).toBe(true);
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'installingFirmware',
            firmwareProgress: 10,
            firmwareTipData: {
              message: EFirmwareUpdateTipMessages.StartTransferData,
            },
          },
        }),
      ),
    ).toBe(false);
  });

  test('does not treat a sticky transferData value as a live transfer', () => {
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 100,
          },
        }),
      ),
    ).toBe(false);
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_TIP,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 100,
            firmwareTipData: {
              message: EFirmwareUpdateTipMessages.InstallingFirmware,
            },
          },
        }),
      ),
    ).toBe(false);
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 35,
          },
        }),
      ),
    ).toBe(false);
  });

  test('resume requires later transfer progress; first numeric event also counts', () => {
    const before = getFirmwareTransferUiSnapshot({
      action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
      payload: { firmwareProgressType: 'transferData', firmwareProgress: 35 },
    });
    expect(
      didFirmwareTransferResume({
        before,
        after: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 35,
          },
        }),
      }),
    ).toBe(false);
    expect(
      didFirmwareTransferResume({
        before,
        after: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 36,
          },
        }),
      }),
    ).toBe(true);
    expect(
      didFirmwareTransferResume({
        before: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_TIP,
          payload: {
            firmwareTipData: {
              message: EFirmwareUpdateTipMessages.StartTransferData,
            },
          },
        }),
        after: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 1,
          },
        }),
      }),
    ).toBe(true);
    expect(
      didFirmwareTransferResume({
        before,
        after: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'installingFirmware',
            firmwareProgress: 1,
          },
        }),
      }),
    ).toBe(true);
    expect(
      didFirmwareTransferResume({
        before: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 100,
          },
        }),
        after: getFirmwareTransferUiSnapshot({
          action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 100,
          },
        }),
      }),
    ).toBe(true);
  });
});
