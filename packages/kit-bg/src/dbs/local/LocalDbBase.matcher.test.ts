import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';

import type { IDBDevice, IDBWallet } from './types';

// getExistingDevice drives the private _matchExistingDeviceRecord — the same
// isolation boundary all three vendors share. A prototype-backed stub is
// enough since only getAllDevices/getAllWallets are read here.
function buildDb(
  devices: Partial<IDBDevice>[],
  wallets: Partial<IDBWallet>[] = [],
): LocalDbBase {
  const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
  Object.assign(db, {
    getAllDevices: jest.fn().mockResolvedValue({ devices }),
    getAllWallets: jest.fn().mockResolvedValue({ wallets }),
  });
  return db;
}

describe('LocalDbBase shared device matcher — vendor isolation', () => {
  it('matches a OneKey device by deviceId + uuid, same vendor only', async () => {
    const onekeyDevice = {
      id: 'device-onekey',
      deviceId: 'RAW-1',
      uuid: 'UUID-1',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice;
    const db = buildDb([onekeyDevice]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'RAW-1',
        uuid: 'UUID-1',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe(onekeyDevice);
  });

  it('reuses a reset OneKey device when onboarding restores the same recovery phrase', async () => {
    const previousDevice = {
      id: 'device-onekey-before-reset',
      deviceId: 'RAW-BEFORE-RESET',
      uuid: 'SERIAL-1',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice;
    const previousWallet = {
      id: 'hw-onekey-before-reset',
      associatedDevice: previousDevice.id,
      firstEvmAddress: '0x1234',
    } as IDBWallet;
    const db = buildDb([previousDevice], [previousWallet]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'RAW-AFTER-RESET',
        uuid: 'SERIAL-1',
        getFirstEvmAddressFn: jest.fn().mockResolvedValue('0x1234'),
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe(previousDevice);
  });

  it('creates a new OneKey identity when onboarding uses a different recovery phrase after reset', async () => {
    const previousDevice = {
      id: 'device-onekey-before-reset',
      deviceId: 'RAW-BEFORE-RESET',
      uuid: 'SERIAL-1',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice;
    const previousWallet = {
      id: 'hw-onekey-before-reset',
      associatedDevice: previousDevice.id,
      firstEvmAddress: '0x1234',
    } as IDBWallet;
    const db = buildDb([previousDevice], [previousWallet]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'RAW-AFTER-RESET',
        uuid: 'SERIAL-1',
        getFirstEvmAddressFn: jest.fn().mockResolvedValue('0xabcd'),
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBeUndefined();
  });

  it('never matches a device belonging to a different vendor, same deviceId/uuid', async () => {
    // Same deviceId/uuid could coincide across vendors — the vendor filter is
    // the only thing standing between that and a cross-vendor merge.
    const trezorDevice = {
      id: 'device-trezor',
      deviceId: 'RAW-1',
      uuid: 'UUID-1',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice;
    const db = buildDb([trezorDevice]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: 'RAW-1',
        uuid: 'UUID-1',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBeUndefined();
  });

  it('matches a Ledger device by connectId when it has no rawDeviceId', async () => {
    const ledgerDevice = {
      id: 'device-ledger',
      deviceId: '',
      uuid: '',
      connectId: 'LEDGER-CONNECT-1',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice;
    const db = buildDb([ledgerDevice]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: '',
        uuid: '',
        connectId: 'LEDGER-CONNECT-1',
        vendor: EHardwareVendor.ledger,
      }),
    ).resolves.toBe(ledgerDevice);
  });

  it('never matches a connectId belonging to a different vendor', async () => {
    // A rotated/reissued connectId reused across vendors must not merge
    // records — connectId alone is not identity, vendor must agree too.
    const ledgerDevice = {
      id: 'device-ledger',
      deviceId: '',
      uuid: '',
      connectId: 'SHARED-CONNECT-ID',
      vendor: EHardwareVendor.ledger,
    } as IDBDevice;
    const db = buildDb([ledgerDevice]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: '',
        uuid: '',
        connectId: 'SHARED-CONNECT-ID',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBeUndefined();
  });

  it('matches connectId case-insensitively across usb/ble slots', async () => {
    const trezorDevice = {
      id: 'device-trezor-ble',
      deviceId: '',
      uuid: '',
      connectId: 'fallback',
      bleConnectId: 'AA:BB:CC:DD:EE:FF',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice;
    const db = buildDb([trezorDevice]);

    await expect(
      db.getExistingDevice({
        rawDeviceId: '',
        uuid: '',
        connectId: 'aa:bb:cc:dd:ee:ff',
        vendor: EHardwareVendor.trezor,
      }),
    ).resolves.toBe(trezorDevice);
  });
});

describe('LocalDbBase.getDeviceByQuery — features-only queries never match by vendor alone', () => {
  it('does not return an unrelated OneKey device when the queried features have no computable UUID', async () => {
    // getDeviceUUID reads only OneKey-specific serial fields, so any
    // features lacking them (malformed OneKey features, or a third-party
    // device's features routed here without a vendor) yield an empty UUID.
    // With no connectId/featuresDeviceId to narrow the search, matching by
    // vendor alone would silently return an arbitrary OneKey device.
    const oneKeyDeviceA = {
      id: 'device-onekey-a',
      deviceId: 'RAW-A',
      uuid: 'UUID-A',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice;
    const db = buildDb([oneKeyDeviceA]);

    await expect(
      db.getDeviceByQuery({
        features: { device_id: 'RAW-B' } as never,
      }),
    ).resolves.toBeUndefined();
  });

  it('still matches by UUID when the queried features compute one', async () => {
    const oneKeyDeviceA = {
      id: 'device-onekey-a',
      deviceId: 'RAW-A',
      uuid: 'UUID-A',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice;
    const db = buildDb([oneKeyDeviceA]);

    await expect(
      db.getDeviceByQuery({
        features: { device_id: 'RAW-B', onekey_serial_no: 'UUID-A' } as never,
      }),
    ).resolves.toMatchObject({ id: 'device-onekey-a' });
  });
});
