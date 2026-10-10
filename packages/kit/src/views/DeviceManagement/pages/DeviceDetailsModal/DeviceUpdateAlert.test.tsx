/** @jest-environment jsdom */

import { EDeviceType } from '@onekeyfe/hd-shared';
import { fireEvent, render, screen } from '@testing-library/react';

import { DeviceUpdateAlert } from './DeviceUpdateAlert';

let mockDeviceType: EDeviceType | undefined;
let mockHasUpgrade = true;
let mockEstimatedTransferBytes: number | undefined;
const mockOpenChangeLogModal = jest.fn<Promise<void>, [unknown]>();

jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});

jest.mock('@onekeyhq/components', () => ({
  useMedia: () => ({ gtMd: false }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deviceDetails', () => ({
  useCurrentWalletIdAtom: () => ['hw-wallet-1'],
  useDeviceConnectIdAtom: () => ['ble-1'],
  useDeviceTypeAtom: () => [mockDeviceType],
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isQrWallet: () => false },
}));

jest.mock(
  '../../../FirmwareUpdate/components/HomeFirmwareUpdateReminder',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      FirmwareUpdateReminderAlert: ({
        message,
        onPress,
      }: {
        message: string;
        onPress?: () => void;
      }) =>
        React.createElement(
          'button',
          { type: 'button', onClick: onPress },
          message,
        ),
    };
  },
);

jest.mock('../../../FirmwareUpdate/hooks/useFirmwareUpdateActions', () => ({
  useFirmwareUpdateActions: () => ({
    openChangeLogModal: (params: unknown) => mockOpenChangeLogModal(params),
  }),
}));

jest.mock(
  '../../../FirmwareUpdate/hooks/useFirmwareUpdateDetectStatus',
  () => ({
    useFirmwareUpdateDetectStatus: () => ({
      connectId: 'ble-1',
      hasUpgrade: mockHasUpgrade,
      toVersion: '1.0.2',
      toFirmwareType: undefined,
      toVersionBle: undefined,
      estimatedTransferBytes: mockEstimatedTransferBytes,
    }),
  }),
);

jest.mock('../../../FirmwareUpdate/utils', () => ({
  getTargetFirmwareTypeLabel: () => '',
}));

describe('DeviceUpdateAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeviceType = EDeviceType.Pro2;
    mockHasUpgrade = true;
    mockEstimatedTransferBytes = 22_000_000;
    mockOpenChangeLogModal.mockResolvedValue(undefined);
  });

  it.each([EDeviceType.Pro2, EDeviceType.Neo])(
    'hands over the %s model and the detected size so the USB suggestion can come before the device is reached',
    (deviceType) => {
      mockDeviceType = deviceType;
      render(<DeviceUpdateAlert type="top" />);

      fireEvent.click(screen.getByRole('button'));

      expect(mockOpenChangeLogModal).toHaveBeenCalledTimes(1);
      expect(mockOpenChangeLogModal).toHaveBeenCalledWith({
        connectId: 'ble-1',
        knownUpdate: { deviceType, estimatedTransferBytes: 22_000_000 },
      });
    },
  );

  it('passes an unknown size through when the detection recorded none', () => {
    mockEstimatedTransferBytes = undefined;
    render(<DeviceUpdateAlert type="top" />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockOpenChangeLogModal).toHaveBeenCalledWith({
      connectId: 'ble-1',
      knownUpdate: {
        deviceType: EDeviceType.Pro2,
        estimatedTransferBytes: undefined,
      },
    });
  });

  it('shows nothing to tap when no update has been detected', () => {
    mockHasUpgrade = false;
    render(<DeviceUpdateAlert type="top" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
