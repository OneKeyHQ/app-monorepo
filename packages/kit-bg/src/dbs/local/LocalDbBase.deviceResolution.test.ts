import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';

import type { IDBDevice } from './types';

// getExistingDevice only reaches getAllDevices/getAllWallets on the paths under
// test, so a prototype-backed stub is enough and avoids standing up a full DB.
function buildDb(overrides: Partial<LocalDbBase>): LocalDbBase {
  const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
  Object.assign(db, overrides);
  return db;
}

const trezorParams = {
  rawDeviceId: 'TREZOR-DEVICE-ID',
  uuid: '',
  vendor: EHardwareVendor.trezor,
};

describe('LocalDbBase.getExistingDevice failure semantics', () => {
  it('surfaces a DB failure while matching a third-party device', async () => {
    // Swallowing this would turn "the lookup broke" into "no such device" and
    // silently create a duplicate device record.
    const resolveReuseDeviceFn = jest.fn();
    const db = buildDb({
      getAllDevices: jest.fn().mockRejectedValue(new Error('db read failed')),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({ ...trezorParams, resolveReuseDeviceFn }),
    ).rejects.toThrow('db read failed');
    expect(resolveReuseDeviceFn).not.toHaveBeenCalled();
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

  it('contains a reseed recovery failure and reports no match', async () => {
    const resolveReuseDeviceFn = jest
      .fn()
      .mockRejectedValue(new Error('recovery failed'));
    const db = buildDb({
      getAllDevices: jest.fn().mockResolvedValue({ devices: [] }),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({ ...trezorParams, resolveReuseDeviceFn }),
    ).resolves.toBeUndefined();
    expect(resolveReuseDeviceFn).toHaveBeenCalledTimes(1);
  });

  it('returns the device recovered by reseed recovery', async () => {
    const recovered = { id: 'device-1' } as IDBDevice;
    const db = buildDb({
      getAllDevices: jest.fn().mockResolvedValue({ devices: [] }),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({
        ...trezorParams,
        resolveReuseDeviceFn: jest.fn().mockResolvedValue(recovered),
      }),
    ).resolves.toBe(recovered);
  });

  it('never runs reseed recovery for OneKey', async () => {
    const resolveReuseDeviceFn = jest.fn();
    const db = buildDb({
      getAllDevices: jest.fn().mockResolvedValue({ devices: [] }),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'ONEKEY-DEVICE-ID',
        uuid: 'ONEKEY-UUID',
        vendor: EHardwareVendor.onekey,
        resolveReuseDeviceFn,
      }),
    ).resolves.toBeUndefined();
    expect(resolveReuseDeviceFn).not.toHaveBeenCalled();
  });

  it('never runs reseed recovery for a vendor that does not declare it', async () => {
    const resolveReuseDeviceFn = jest.fn();
    const db = buildDb({
      getAllDevices: jest.fn().mockResolvedValue({ devices: [] }),
    } as unknown as Partial<LocalDbBase>);

    await expect(
      db.getExistingDevice({
        rawDeviceId: '',
        uuid: '',
        connectId: 'LEDGER-CONNECT-ID',
        vendor: EHardwareVendor.ledger,
        resolveReuseDeviceFn,
      }),
    ).resolves.toBeUndefined();
    expect(resolveReuseDeviceFn).not.toHaveBeenCalled();
  });
});
