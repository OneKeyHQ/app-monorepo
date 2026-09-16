import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import {
  didFirmwareTransferResume,
  getFirmwareTransferUiSnapshot,
  isFirmwareTransferInProgress,
} from './FirmwareTransferStallGuard';

describe('FirmwareTransferStallGuard', () => {
  test('treats transferData progress and StartTransferData as transferring', () => {
    expect(
      isFirmwareTransferInProgress(
        getFirmwareTransferUiSnapshot({
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

  test('resume requires later transfer progress; leaving transfer also counts', () => {
    const before = getFirmwareTransferUiSnapshot({
      payload: { firmwareProgressType: 'transferData', firmwareProgress: 35 },
    });
    expect(
      didFirmwareTransferResume({
        before,
        after: getFirmwareTransferUiSnapshot({
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
          payload: {
            firmwareProgressType: 'transferData',
            firmwareProgress: 36,
          },
        }),
      }),
    ).toBe(true);
    expect(
      didFirmwareTransferResume({
        before,
        after: getFirmwareTransferUiSnapshot({
          payload: {
            firmwareProgressType: 'installingFirmware',
            firmwareProgress: 1,
          },
        }),
      }),
    ).toBe(true);
  });
});
