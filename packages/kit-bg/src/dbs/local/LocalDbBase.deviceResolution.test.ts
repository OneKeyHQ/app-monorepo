import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';

// getExistingDevice only reaches getAllDevices/getAllWallets on the paths under
// test, so a prototype-backed stub is enough and avoids standing up a full DB.
function buildDb(overrides: Partial<LocalDbBase>): LocalDbBase {
  const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
  Object.assign(db, overrides);
  return db;
}

describe('LocalDbBase.getExistingDevice failure semantics', () => {
  it('surfaces a DB failure while matching a third-party device', async () => {
    // Swallowing this would turn "the lookup broke" into "no such device" and
    // silently create a duplicate device record.
    const db = buildDb({
      getAllDevices: jest.fn().mockRejectedValue(new Error('db read failed')),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'TREZOR-DEVICE-ID',
        uuid: '',
        vendor: EHardwareVendor.trezor,
      }),
    ).rejects.toThrow('db read failed');
  });

  it('surfaces a DB failure while matching a OneKey device', async () => {
    const db = buildDb({
      getAllDevices: jest.fn().mockRejectedValue(new Error('db read failed')),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'ONEKEY-DEVICE-ID',
        uuid: 'ONEKEY-UUID',
        vendor: EHardwareVendor.onekey,
      }),
    ).rejects.toThrow('db read failed');
  });
});
