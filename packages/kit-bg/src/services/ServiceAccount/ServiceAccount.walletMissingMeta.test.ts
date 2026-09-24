import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import ServiceAccount from './ServiceAccount';

import type { IDBDevice, IDBWallet } from '../../dbs/local/types';

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
    getWalletSafe: jest.fn(),
    getWalletDeviceSafe: jest.fn(),
  },
}));

describe('ServiceAccount.generateWalletsMissingMetaWithUserInteraction', () => {
  const mockedLocalDb = jest.mocked(localDb);

  it.each([
    [EHardwareVendor.keystone, false],
    [EHardwareVendor.ledger, false],
    [EHardwareVendor.trezor, true],
  ] as const)(
    'opens the hardware flow for a %s wallet only if it can derive an xfp',
    async (vendor, expectsHardwareFlow) => {
      mockedLocalDb.getWalletSafe.mockResolvedValue({
        id: 'hw-missing-xfp',
      } as IDBWallet);
      mockedLocalDb.getWalletDeviceSafe.mockResolvedValue({
        id: 'device-1',
        vendor,
      } as IDBDevice);
      const withHardwareProcessing = jest.fn().mockResolvedValue(undefined);
      const service = new ServiceAccount({
        backgroundApi: {
          serviceHardwareUI: { withHardwareProcessing },
        },
      } as never);

      await service.generateWalletsMissingMetaWithUserInteraction({
        walletId: 'hw-missing-xfp',
      });

      expect(withHardwareProcessing).toHaveBeenCalledTimes(
        expectsHardwareFlow ? 1 : 0,
      );
    },
  );
});
