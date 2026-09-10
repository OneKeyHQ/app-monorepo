import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';

import type { IDBDevice, IDBWallet } from './types';

function buildWallet({
  id,
  associatedDevice,
}: {
  id: string;
  associatedDevice: string;
}): IDBWallet {
  return {
    id,
    name: id,
    type: 'hw',
    backuped: true,
    accounts: [],
    nextIds: {},
    associatedDevice,
    walletNo: 1,
  };
}

describe('LocalDbBase hardware vendor downgrade compatibility', () => {
  it('hides wallets from unknown future vendors before refilling them', async () => {
    const supportedWallet = buildWallet({
      id: 'hw-supported-device',
      associatedDevice: 'supported-device',
    });
    const legacyWallet = buildWallet({
      id: 'hw-legacy-device',
      associatedDevice: 'legacy-device',
    });
    const futureWallet = buildWallet({
      id: 'hw-future-device',
      associatedDevice: 'future-device',
    });
    const refillWalletInfo = jest.fn(
      async ({ wallet }: { wallet: IDBWallet }) => wallet,
    );
    const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
    Object.assign(db, {
      getAllWallets: jest.fn(async () => ({
        wallets: [supportedWallet, legacyWallet, futureWallet],
      })),
      getAllDevices: jest.fn(async () => ({
        devices: [
          {
            id: 'supported-device',
            vendor: EHardwareVendor.onekey,
          },
          { id: 'legacy-device' },
          {
            id: 'future-device',
            vendor: 'future-vendor' as EHardwareVendor,
          },
        ] as IDBDevice[],
      })),
      refillWalletInfo,
      walletSortFn: (a: IDBWallet, b: IDBWallet) =>
        (a.walletOrder ?? 0) - (b.walletOrder ?? 0),
    });

    await expect(db.getWallets()).resolves.toEqual({
      wallets: [supportedWallet, legacyWallet],
    });
    expect(refillWalletInfo).toHaveBeenCalledTimes(2);
    expect(refillWalletInfo).not.toHaveBeenCalledWith(
      expect.objectContaining({ wallet: futureWallet }),
    );
  });
});
