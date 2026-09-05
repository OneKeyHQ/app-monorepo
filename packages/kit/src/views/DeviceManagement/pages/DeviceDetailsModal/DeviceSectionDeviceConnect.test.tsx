/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceManagementTestIDs } from '../../testIDs';

import DeviceSectionDeviceConnect from './DeviceSectionDeviceConnect';

const mockRemoveWallet = jest.fn<Promise<void>, unknown[]>();
const mockGetAllWallets = jest.fn<Promise<unknown>, unknown[]>();
const mockShowDialog = jest.fn();
const mockBack = jest.fn();
const currentWallet = {
  wallet: { id: 'hw-current' },
  device: { id: 'db-current', uuid: 'SERIAL', deviceId: 'new-seed' },
};

jest.mock('@onekeyhq/components', () => ({
  Toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAllHwQrWalletWithDevice: (...args: unknown[]) =>
        mockGetAllWallets(...args),
    },
  },
}));
jest.mock(
  '@onekeyhq/kit/src/components/Hardware/TrezorBleBindingDialog',
  () => ({
    showTrezorBleBindingDialog: jest.fn(),
  }),
);
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    onPress,
    testID,
  }: {
    onPress?: () => void;
    testID?: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      Forget
    </button>
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { removeWallet: mockRemoveWallet },
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deviceDetails', () => ({
  useDeviceAtom: () => [currentWallet.device],
  useDeviceDetailsActions: () => ({
    getWalletWithDevice: async () => currentWallet,
  }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { account: { wallet: { deleteWallet: jest.fn() } } },
}));
jest.mock('../../hooks/useDeviceBackNavigation', () => ({
  useDeviceBackNavigation: () => ({ handleBackPress: mockBack }),
}));
jest.mock('../ListItemGroup', () => ({
  ListItemGroup: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./dialog/DialogForgetDevice', () => ({
  useDialogForgetDevice: () => ({ show: mockShowDialog }),
}));
jest.mock('./utils', () => ({ canShowTrezorBleBinding: () => false }));

describe('forgetting a physical device after reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveWallet.mockResolvedValue(undefined);
    mockGetAllWallets.mockResolvedValue({
      old: {
        wallet: { id: 'hw-old', deprecated: true },
        device: {
          id: 'db-old',
          uuid: 'SERIAL',
          deviceId: 'old-seed',
          connectId: '',
        },
      },
      current: currentWallet,
      other: {
        wallet: { id: 'hw-other' },
        device: { id: 'db-other', uuid: 'OTHER' },
      },
      otherVendor: {
        wallet: { id: 'hw-trezor' },
        device: {
          id: 'db-trezor',
          uuid: 'SERIAL',
          vendor: EHardwareVendor.trezor,
        },
      },
    });
  });

  async function confirmForgetDevice() {
    const { getByTestId } = render(<DeviceSectionDeviceConnect />);
    await act(async () => {
      fireEvent.click(getByTestId(DeviceManagementTestIDs.forgetDeviceItem));
    });
    expect(mockRemoveWallet).not.toHaveBeenCalled();
    const { onConfirmForgetDevice } = mockShowDialog.mock.calls[0][0] as {
      onConfirmForgetDevice: () => Promise<void>;
    };
    await act(async () => {
      await onConfirmForgetDevice();
    });
  }

  it('removes current and deprecated standard wallets through the existing removal flow', async () => {
    await confirmForgetDevice();
    expect(mockGetAllWallets).toHaveBeenCalledWith({
      filterHiddenWallet: true,
    });
    expect(mockRemoveWallet.mock.calls).toEqual([
      [{ walletId: 'hw-old', isRemoveToMocked: false }],
      [{ walletId: 'hw-current', isRemoveToMocked: false }],
    ]);
    expect(Toast.success).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('does not report success if removing an associated wallet fails', async () => {
    mockRemoveWallet.mockRejectedValueOnce(new Error('Removal failed'));
    await confirmForgetDevice();
    expect(mockRemoveWallet).toHaveBeenCalledTimes(1);
    expect(Toast.success).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
