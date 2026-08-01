import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import ServiceAccount from './ServiceAccount';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    updateDeviceConnectProtocol: jest.fn(),
  },
}));

describe('ServiceAccount device reset isolation', () => {
  it('rejects hardware calls from a wallet deprecated by device reset', async () => {
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    });
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      deprecated: true,
      associatedDevice: 'db-device-1',
    });
    const getWalletDevice = jest.fn().mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_USB',
      deviceId: 'OLD_DEVICE_ID',
    });
    service.getWalletDevice = getWalletDevice;

    await expect(
      service.getWalletDeviceParams({
        walletId: 'hw-wallet-1',
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      }),
    ).rejects.toThrow('Hardware wallet is unavailable after device reset');
    expect(getWalletDevice).not.toHaveBeenCalled();
  });
});
