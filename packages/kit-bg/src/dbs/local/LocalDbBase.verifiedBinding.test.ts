import { EDeviceType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type { IDBDevice } from './types';
import type { IVerifiedDeviceIdentity } from './verifiedDeviceIdentity';

describe('LocalDbBase verified Ledger binding transaction guard', () => {
  it.each(['ledger', 'trezor'] as const)(
    'rolls back %s binding when cancelled during the transaction',
    async (vendor) => {
      const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
      const record = {
        id: 'db',
        deviceId: 'verified',
        connectId: 'old',
        bleConnectId: 'old',
        updatedAt: 1,
        settingsRaw: JSON.stringify({ vendor }),
      } as IDBDevice;
      const original = { ...record };
      let active = true;
      const assertBindingActive = () => {
        if (!active) throw new OneKeyLocalError('Binding cancelled');
      };
      db.timeNow = async () => {
        active = false;
        return 2;
      };
      db.getDeviceSafe = jest.fn().mockResolvedValue({ ...record, vendor });
      db.getAllDevices = jest.fn().mockResolvedValue({ devices: [] });
      db.withTransaction = async (bucketName, task) => {
        try {
          return await task({ bucketName });
        } catch (error) {
          Object.assign(record, original);
          throw error;
        }
      };
      db.txUpdateRecords = async ({ updater }) => {
        await (updater as (item: IDBDevice) => Promise<IDBDevice>)(record);
      };
      const update =
        vendor === 'ledger'
          ? db.updateDeviceConnectId({
              dbDeviceId: 'db',
              connectId: 'new',
              bleConnectId: 'new',
              assertBindingActive,
            })
          : db.updateDeviceBleConnectIdAndCleanStaleAliases({
              dbDeviceId: 'db',
              bleConnectId: 'new',
              verifiedDeviceId: 'verified',
              assertBindingActive,
            });
      await expect(update).rejects.toThrow('Binding cancelled');
      expect(record).toEqual(original);
    },
  );

  it.each([true, false])(
    'updates only the originating record when two records share a BLE locator (same fingerprint=%s)',
    async (sameFingerprint) => {
      const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
      db.timeNow = async () => 2;
      const deviceA: IDBDevice = {
        id: 'ledger-record-a',
        vendor: EHardwareVendor.ledger,
        name: 'Wallet A device',
        features: '{}',
        connectId: 'shared-old-ble',
        bleConnectId: 'shared-old-ble',
        uuid: '',
        deviceId: '',
        deviceType: EDeviceType.Unknown,
        createdAt: 1,
        updatedAt: 1,
        settingsRaw: JSON.stringify({
          vendor: EHardwareVendor.ledger,
          chainFingerprints: { evm: 'fingerprint-a' },
        }),
      };
      const deviceB: IDBDevice = {
        ...deviceA,
        id: 'ledger-record-b',
        name: 'Wallet B device',
        settingsRaw: JSON.stringify({
          vendor: EHardwareVendor.ledger,
          chainFingerprints: {
            evm: sameFingerprint ? 'fingerprint-a' : 'fingerprint-b',
          },
        }),
      };
      const originalA = { ...deviceA };
      const originalB = { ...deviceB };
      const devices = new Map([
        [deviceA.id, deviceA],
        [deviceB.id, deviceB],
      ]);
      db.withTransaction = async (bucketName, task) => task({ bucketName });
      db.txUpdateRecords = async ({ name, ids, updater }) => {
        expect(name).toBe(ELocalDBStoreNames.Device);
        expect(ids).toEqual([deviceA.id]);
        if (!ids)
          throw new OneKeyLocalError('Explicit device ids are required');
        for (const id of ids) {
          const record = devices.get(id);
          if (!record) throw new OneKeyLocalError('Unexpected device record');
          await (
            updater as (device: IDBDevice) => IDBDevice | Promise<IDBDevice>
          )(record);
        }
      };

      await db.updateDeviceConnectId({
        dbDeviceId: deviceA.id,
        connectId: 'new-ble',
        bleConnectId: 'new-ble',
        verifiedDeviceIdentity: {
          vendor: EHardwareVendor.ledger,
          identity: {
            type: 'chainFingerprint',
            chain: 'evm',
            value: 'fingerprint-a',
          },
        },
      });

      expect(deviceA).toEqual({
        ...originalA,
        connectId: 'new-ble',
        bleConnectId: 'new-ble',
        updatedAt: 2,
      });
      expect(deviceB).toEqual(originalB);
    },
  );

  it.each(['chainFingerprint', 'deviceId', 'walletId'] as const)(
    'rechecks the selected identity strategy inside the transaction (%s)',
    async (type) => {
      const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
      db.timeNow = async () => 2;
      const record: IDBDevice = {
        id: 'identity-record',
        name: 'Test device',
        deviceType: EDeviceType.Unknown,
        features: '{}',
        connectId: 'expected',
        deviceId: 'expected',
        uuid: '',
        createdAt: 1,
        updatedAt: 1,
        settingsRaw: JSON.stringify({
          vendor: EHardwareVendor.ledger,
          chainFingerprints: { evm: 'expected' },
        }),
      };
      db.withTransaction = async (bucketName, task) => task({ bucketName });
      db.txUpdateRecords = async ({ name, ids, updater }) => {
        expect(name).toBe(ELocalDBStoreNames.Device);
        expect(ids).toEqual([record.id]);
        await (
          updater as (device: IDBDevice) => IDBDevice | Promise<IDBDevice>
        )(record);
      };
      const verifiedDeviceIdentity: IVerifiedDeviceIdentity = {
        vendor: EHardwareVendor.ledger,
        identity:
          type === 'chainFingerprint'
            ? { type, chain: 'evm', value: 'expected' }
            : { type, value: 'expected' },
      };
      await db.updateDeviceConnectId({
        dbDeviceId: record.id,
        bleConnectId: 'new-ble',
        verifiedDeviceIdentity,
      });
      expect(record.bleConnectId).toBe('new-ble');
      expect(record.connectId).toBe('expected');
      if (type === 'walletId') {
        await expect(
          db.updateDeviceConnectId({
            dbDeviceId: record.id,
            connectId: 'transport-locator',
            verifiedDeviceIdentity,
          }),
        ).rejects.toThrow('A wallet identity cannot be replaced');
        expect(record.connectId).toBe('expected');
      }

      record.deviceId = 'changed';
      record.connectId = 'changed';
      record.settingsRaw = JSON.stringify({
        vendor: EHardwareVendor.ledger,
        chainFingerprints: { evm: 'changed' },
      });
      await expect(
        db.updateDeviceConnectId({
          dbDeviceId: record.id,
          bleConnectId: 'must-not-bind',
          verifiedDeviceIdentity,
        }),
      ).rejects.toThrow('Verified connection identity no longer matches');
      expect(record.bleConnectId).toBe('new-ble');
    },
  );

  it.each(['matching', 'changed-fingerprint', 'changed-vendor'])(
    'checks the current record inside the update (%s)',
    async (scenario) => {
      const db = Object.create(LocalDbBase.prototype) as LocalDbBase;
      db.timeNow = async () => 2;
      const record: IDBDevice = {
        id: 'ledger-db',
        vendor:
          scenario === 'changed-vendor'
            ? EHardwareVendor.trezor
            : EHardwareVendor.ledger,
        name: 'Test device',
        features: '{}',
        connectId: 'old-ble',
        uuid: '',
        deviceId: '',
        deviceType: EDeviceType.Unknown,
        createdAt: 1,
        updatedAt: 1,
        settingsRaw: JSON.stringify({
          vendor:
            scenario === 'changed-vendor'
              ? EHardwareVendor.trezor
              : EHardwareVendor.ledger,
          chainFingerprints: {
            evm: scenario === 'changed-fingerprint' ? 'other' : 'verified',
          },
        }),
      };
      db.withTransaction = async (bucketName, task) => task({ bucketName });
      db.txUpdateRecords = async ({ name, ids, updater }) => {
        expect(name).toBe(ELocalDBStoreNames.Device);
        expect(ids).toEqual(['ledger-db']);
        await (
          updater as (device: IDBDevice) => IDBDevice | Promise<IDBDevice>
        )(record);
      };
      const update = db.updateDeviceConnectId({
        dbDeviceId: 'ledger-db',
        connectId: 'new-ble',
        bleConnectId: 'new-ble',
        verifiedLedgerFingerprint: { chain: 'evm', fingerprint: 'verified' },
      });
      if (scenario === 'matching') {
        await update;
        expect(record.connectId).toBe('new-ble');
        expect(record.bleConnectId).toBe('new-ble');
      } else {
        await expect(update).rejects.toThrow(
          'Verified Ledger binding no longer matches',
        );
        expect(record.connectId).toBe('old-ble');
        expect(record.bleConnectId).toBeUndefined();
      }
    },
  );
});
