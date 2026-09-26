/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceManagementTestIDs } from '../../testIDs';

import DeviceSectionSecurity from './DeviceSectionSecurity';

const mockChangePin = jest.fn<
  Promise<void>,
  [{ walletId: string; connectId?: string; remove: boolean }]
>();
const mockGetWalletWithDevice = jest.fn<
  Promise<{
    wallet: { id: string };
    device: {
      vendor: EHardwareVendor;
      connectId: string;
      bleConnectId?: string;
    };
  }>,
  []
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      changePin: (...args: Parameters<typeof mockChangePin>) =>
        mockChangePin(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deviceDetails', () => ({
  useDeviceDetailsActions: () => ({
    getWalletWithDevice: () => mockGetWalletWithDevice(),
  }),
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ onPress, testID }: { onPress: () => void; testID: string }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      Change PIN
    </button>
  ),
}));
jest.mock('../ListItemGroup', () => ({
  ListItemGroup: ({ children }: { children: ReactNode }) => children,
}));

describe('device change PIN entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [EHardwareVendor.trezor, ''],
    [EHardwareVendor.trezor, 'legacy-locator'],
    [EHardwareVendor.onekey, 'onekey-locator'],
  ])(
    'routes %s with locator "%s" using its wallet identity',
    async (vendor, connectId) => {
      mockGetWalletWithDevice.mockResolvedValue({
        wallet: { id: 'hw-current' },
        device: { vendor, connectId, bleConnectId: 'saved-ble' },
      });
      const { getByTestId } = render(<DeviceSectionSecurity />);
      fireEvent.click(getByTestId(DeviceManagementTestIDs.changePinItem));
      await waitFor(() =>
        expect(mockChangePin).toHaveBeenCalledWith({
          walletId: 'hw-current',
          connectId,
          remove: false,
        }),
      );
    },
  );

  it('preserves the OneKey empty-locator guard', async () => {
    mockGetWalletWithDevice.mockResolvedValue({
      wallet: { id: 'hw-current' },
      device: { vendor: EHardwareVendor.onekey, connectId: '' },
    });
    const { getByTestId } = render(<DeviceSectionSecurity />);
    fireEvent.click(getByTestId(DeviceManagementTestIDs.changePinItem));
    await waitFor(() =>
      expect(mockGetWalletWithDevice).toHaveBeenCalledTimes(1),
    );
    expect(mockChangePin).not.toHaveBeenCalled();
  });
});
