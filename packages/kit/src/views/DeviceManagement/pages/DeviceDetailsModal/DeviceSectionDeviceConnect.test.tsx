/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { DeviceManagementTestIDs } from '../../testIDs';

import DeviceSectionDeviceConnect from './DeviceSectionDeviceConnect';

const mockRemoveWallet = jest.fn<Promise<void>, unknown[]>();
const mockShowDialog = jest.fn();
const mockBack = jest.fn();
const mockRebindBleDevice = jest.fn<Promise<void>, unknown[]>();
const mockRefresh = jest.fn<Promise<void>, unknown[]>();
// Only the fields DeviceSectionDeviceConnect reads off the device atom.
interface IMockDevice {
  id: string;
  uuid: string;
  deviceId: string;
  vendor?: EHardwareVendor;
  bleConnectId?: string;
  connectId?: string;
  settings?: { vendorModel: string };
}
const defaultDevice: IMockDevice = {
  id: 'db-current',
  uuid: 'SERIAL',
  deviceId: 'new-seed',
};
let currentDevice: IMockDevice = defaultDevice;
const currentWallet = {
  wallet: { id: 'hw-current' },
  device: defaultDevice,
};

jest.mock('@onekeyhq/components', () => ({
  Toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isSupportDesktopBle: false },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceThirdPartyHardware: {
      rebindBleDevice: (...args: unknown[]) => mockRebindBleDevice(...args),
    },
  },
}));
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
  useDeviceAtom: () => [currentDevice],
  useDeviceDetailsActions: () => ({
    getWalletWithDevice: async () => currentWallet,
    refresh: (...args: unknown[]) => mockRefresh(...args),
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

describe('forgetting a physical device after reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentDevice = defaultDevice;
    mockRemoveWallet.mockResolvedValue(undefined);
    mockRebindBleDevice.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
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

  it('forgets the device in a single background removal operation', async () => {
    await confirmForgetDevice();
    expect(mockRemoveWallet).toHaveBeenCalledTimes(1);
    expect(mockRemoveWallet).toHaveBeenCalledWith({
      walletId: 'hw-current',
      isRemoveToMocked: false,
      removeSameDeviceWallets: true,
    });
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

describe('rebinding bluetooth from the device connection section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentDevice = defaultDevice;
    mockRebindBleDevice.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [true, false, EHardwareVendor.ledger, 'nanoX', true],
    [false, true, EHardwareVendor.ledger, 'nanoX', true],
    [false, true, EHardwareVendor.ledger, 'nanoS', false],
    [false, false, EHardwareVendor.ledger, 'nanoX', false],
    [true, false, EHardwareVendor.trezor, 'T3W1', true],
    [false, true, EHardwareVendor.trezor, 'T3W1', true],
    [false, true, EHardwareVendor.trezor, 'T2T1', false],
    [false, true, EHardwareVendor.keystone, 'nanoX', false],
  ] as const)(
    'shows binding by platform and model, before and after binding (%s, %s, %s, %s)',
    async (isNative, isSupportDesktopBle, vendor, vendorModel, visible) => {
      jest.replaceProperty(platformEnv, 'isNative', isNative);
      jest.replaceProperty(
        platformEnv,
        'isSupportDesktopBle',
        isSupportDesktopBle,
      );
      currentDevice = {
        ...defaultDevice,
        vendor,
        settings: { vendorModel },
      };
      const view = render(<DeviceSectionDeviceConnect />);
      const entry = view.queryByTestId(DeviceManagementTestIDs.rebindBleItem);
      expect(Boolean(entry)).toBe(visible);
      if (entry) {
        await act(async () => {
          fireEvent.click(entry);
        });
        expect(mockRebindBleDevice).toHaveBeenCalledWith({
          dbDeviceId: 'db-current',
        });
      }
      currentDevice = { ...currentDevice, bleConnectId: 'bound-ble' };
      view.rerender(<DeviceSectionDeviceConnect />);
      // Existing Ledger BLE records retain access even if model metadata is stale.
      expect(
        Boolean(view.queryByTestId(DeviceManagementTestIDs.rebindBleItem)),
      ).toBe(
        (isNative || isSupportDesktopBle) &&
          (vendor === EHardwareVendor.ledger || visible),
      );
    },
  );

  it('hides the bluetooth entry for a device with no bluetooth endpoint', () => {
    const { queryByTestId } = render(<DeviceSectionDeviceConnect />);
    expect(queryByTestId(DeviceManagementTestIDs.rebindBleItem)).toBeNull();
  });

  it('rebinds through the background service and refreshes the details', async () => {
    currentDevice = {
      ...defaultDevice,
      vendor: EHardwareVendor.ledger,
      bleConnectId: 'ble-endpoint',
    };
    const { getByTestId } = render(<DeviceSectionDeviceConnect />);
    await act(async () => {
      fireEvent.click(getByTestId(DeviceManagementTestIDs.rebindBleItem));
    });
    expect(mockRebindBleDevice).toHaveBeenCalledTimes(1);
    expect(mockRebindBleDevice).toHaveBeenCalledWith({
      dbDeviceId: 'db-current',
    });
    expect(mockRefresh).toHaveBeenCalledWith(undefined, {
      skipDeviceStateSnapshot: true,
    });
  });
});
