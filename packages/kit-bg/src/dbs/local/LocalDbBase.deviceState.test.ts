import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import { INDEXED_DB_VERSION, REALM_DB_VERSION } from './consts';
import { LocalDbBase, sanitizeDeviceStateForPersistence } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBDevice,
  ILocalDBTxUpdateRecordsParams,
} from './types';

const createState = ({
  revision,
  updatedAt,
  label,
  bleName = 'Pro2 6136',
  language,
  firmware = '1.0.0',
  deviceType = EDeviceType.Pro2,
  model = 'pro2',
  serialNo = '',
  deviceId = null,
}: {
  revision: number;
  updatedAt: number;
  label: string | null;
  bleName?: string;
  language: string | null;
  firmware?: string;
  deviceType?: EDeviceType;
  model?: string;
  serialNo?: string;
  deviceId?: string | null;
}): IOneKeyDeviceState =>
  ({
    schemaVersion: 1,
    revision,
    updatedAt,
    protocol: 'V2',
    identity: {
      deviceType,
      firmwareType: EFirmwareType.Universal,
      model,
      vendor: 'onekey.so',
      deviceId,
      serialNo,
      label,
      bleName,
      displayName: label || bleName,
    },
    status: { mode: 'normal' },
    settings: { language },
    versions: { firmware },
    capabilities: [],
  }) as unknown as IOneKeyDeviceState;

class DeviceStateTestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as never);

  devices: IDBDevice[];

  get device() {
    return this.devices[0];
  }

  constructor(state: IOneKeyDeviceState) {
    super();
    this.devices = [
      {
        id: 'device-db-1',
        name: state.identity.displayName,
        features: '{}',
        deviceState: JSON.stringify(state),
        connectId: 'ABC-DEF',
        uuid: '',
        deviceId: '',
        deviceType: EDeviceType.Pro2,
        settingsRaw: JSON.stringify({ vendor: EHardwareVendor.onekey }),
        createdAt: 1,
        updatedAt: 1,
        vendor: EHardwareVendor.onekey,
      },
    ];
  }

  override async reset() {}

  override async getAllDevices() {
    return {
      devices: this.devices.map((device) => this.refillDeviceInfo({ device })),
    };
  }

  override async withTransaction<T>(
    _bucketName: EIndexedDBBucketNames,
    task: (tx: never) => Promise<T>,
  ): Promise<T> {
    return task({} as never);
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>): Promise<void> {
    if (name === ELocalDBStoreNames.Device) {
      for (let index = 0; index < this.devices.length; index += 1) {
        if (ids.includes(this.devices[index].id)) {
          this.devices[index] = await (
            updater as (item: IDBDevice) => IDBDevice | Promise<IDBDevice>
          )(this.devices[index]);
        }
      }
    }
  }
}

describe('LocalDb DeviceState persistence', () => {
  it('bumps the local database version for the new Realm field', () => {
    expect(INDEXED_DB_VERSION).toBe(20);
    expect(REALM_DB_VERSION).toBe(20);
  });

  it('strips SDK-internal raw and session fields before persistence', () => {
    const state = createState({
      revision: 1,
      updatedAt: 1,
      label: 'Safe state',
      language: 'en-US',
    });
    (state as unknown as { raw?: unknown }).raw = { protocolV2DeviceInfo: {} };
    (state as unknown as { session?: unknown }).session = {
      sessionId: 'private-session',
    };

    const persisted = sanitizeDeviceStateForPersistence(state);

    expect(persisted).not.toHaveProperty('raw');
    expect(persisted).not.toHaveProperty('session');
    expect(state).toHaveProperty('session');
  });

  it('merges sparse reconnect state without erasing the persisted label or settings', async () => {
    const current = createState({
      revision: 8,
      updatedAt: 100,
      label: 'My Pro 2',
      language: 'ja-JP',
    });
    const incoming = createState({
      revision: 1,
      updatedAt: 200,
      label: null,
      language: null,
      firmware: '1.1.0',
    });
    const db = new DeviceStateTestLocalDb(current);

    await db.updateDeviceState({
      connectId: 'abc-def',
      state: incoming,
      revision: incoming.revision,
      source: 'transport-reconnect',
      changedKeys: [
        'identity.bleName',
        'identity.displayName',
        'versions.firmware',
      ],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.identity.label).toBe('My Pro 2');
    expect(persisted.identity.displayName).toBe('My Pro 2');
    expect(persisted.settings.language).toBe('ja-JP');
    expect(persisted.versions.firmware).toBe('1.1.0');
    expect(db.device.name).toBe('My Pro 2');
  });

  it('ignores an event older than the persisted state', async () => {
    const current = createState({
      revision: 3,
      updatedAt: 300,
      label: 'Newest',
      language: 'en-US',
    });
    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'Older',
      language: 'zh-CN',
    });
    const db = new DeviceStateTestLocalDb(current);

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'transport-reconnect',
      changedKeys: ['identity.label', 'settings.language'],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.identity.label).toBe('Newest');
    expect(persisted.settings.language).toBe('en-US');
  });

  it('uses the stable product name when a V1 device has no label or BLE name', async () => {
    const current = createState({
      revision: 1,
      updatedAt: 100,
      label: null,
      bleName: '',
      language: null,
      deviceType: EDeviceType.Classic1s,
      model: '1',
    });
    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: null,
      bleName: '',
      language: null,
      deviceType: EDeviceType.Classic1s,
      model: '1',
    });
    const db = new DeviceStateTestLocalDb(current);

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'initialize',
      changedKeys: ['identity.label'],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.identity.displayName).toBe('OneKey Classic 1S');
    expect(db.device.name).toBe('OneKey Classic 1S');
  });

  it('prefers stable serial identity over a reused connect id', async () => {
    const firstState = createState({
      revision: 1,
      updatedAt: 100,
      label: 'First device',
      language: 'en-US',
      serialNo: 'SERIAL-A',
    });
    const secondState = createState({
      revision: 1,
      updatedAt: 100,
      label: 'Second device',
      language: 'en-US',
      serialNo: 'SERIAL-B',
    });
    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'Renamed second device',
      language: 'en-US',
      serialNo: 'SERIAL-B',
    });
    const db = new DeviceStateTestLocalDb(firstState);
    db.devices[0].connectId = 'REUSED-CONNECT-ID';
    db.devices[0].uuid = 'SERIAL-A';
    db.devices.push({
      ...db.devices[0],
      id: 'device-db-2',
      name: secondState.identity.displayName,
      uuid: 'SERIAL-B',
      deviceState: JSON.stringify(secondState),
    });

    await db.updateDeviceState({
      connectId: 'REUSED-CONNECT-ID',
      state: incoming,
      revision: incoming.revision,
      source: 'apply-settings',
      changedKeys: ['identity.label', 'identity.displayName'],
    });

    expect(JSON.parse(db.devices[0].deviceState || '{}').identity.label).toBe(
      'First device',
    );
    expect(JSON.parse(db.devices[1].deviceState || '{}').identity.label).toBe(
      'Renamed second device',
    );
  });

  it('synchronizes canonical identity into legacy device fields and features', async () => {
    const current = createState({
      revision: 1,
      updatedAt: 100,
      label: 'My Pro 2',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: null,
    });
    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'My Pro 2',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'LIVE_DEVICE_ID',
    });
    const db = new DeviceStateTestLocalDb(current);
    db.devices[0].features = JSON.stringify({
      deviceId: 'STALE_DEVICE_ID',
      $app_firmware_type: 'universal',
    });

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'device-status',
      changedKeys: ['identity.deviceId'],
    });

    const features = JSON.parse(db.device.features);
    expect(db.device.deviceId).toBe('LIVE_DEVICE_ID');
    expect(db.device.uuid).toBe('SERIAL-A');
    expect(db.device.deviceType).toBe(EDeviceType.Pro2);
    expect(features.deviceId).toBe('LIVE_DEVICE_ID');
    expect(features.device_id).toBe('LIVE_DEVICE_ID');
    expect(features.$app_firmware_type).toBe('universal');
  });

  it('matches the exact seed identity when one serial has multiple device records', async () => {
    const oldState = createState({
      revision: 5,
      updatedAt: 100,
      label: 'Old wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'OLD_DEVICE_ID',
    });
    const currentState = createState({
      revision: 2,
      updatedAt: 150,
      label: 'Current wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'CURRENT_DEVICE_ID',
    });
    const incoming = createState({
      revision: 3,
      updatedAt: 200,
      label: 'Renamed current wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'CURRENT_DEVICE_ID',
    });
    const db = new DeviceStateTestLocalDb(oldState);
    db.devices[0].uuid = 'SERIAL-A';
    db.devices[0].deviceId = 'OLD_DEVICE_ID';
    db.devices.push({
      ...db.devices[0],
      id: 'device-db-2',
      name: currentState.identity.displayName,
      deviceId: 'CURRENT_DEVICE_ID',
      deviceState: JSON.stringify(currentState),
      updatedAt: 2,
    });

    await expect(
      db.updateDeviceState({
        connectId: 'ABC-DEF',
        state: incoming,
        revision: incoming.revision,
        source: 'apply-settings',
        changedKeys: ['identity.label', 'identity.displayName'],
      }),
    ).resolves.toMatchObject({
      kind: 'updated',
      deviceDbId: 'device-db-2',
    });

    expect(JSON.parse(db.devices[0].deviceState || '{}').identity.label).toBe(
      'Old wallet',
    );
    expect(JSON.parse(db.devices[1].deviceState || '{}').identity.label).toBe(
      'Renamed current wallet',
    );
  });

  it('compares a new reset identity with the latest record for the same serial', async () => {
    const oldState = createState({
      revision: 5,
      updatedAt: 100,
      label: 'Old wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'OLD_DEVICE_ID',
    });
    const currentState = createState({
      revision: 2,
      updatedAt: 150,
      label: 'Current wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'CURRENT_DEVICE_ID',
    });
    const resetState = createState({
      revision: 1,
      updatedAt: 200,
      label: 'Reset again',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'NEXT_DEVICE_ID',
    });
    const db = new DeviceStateTestLocalDb(oldState);
    db.devices[0].uuid = 'SERIAL-A';
    db.devices[0].deviceId = 'OLD_DEVICE_ID';
    db.devices.push({
      ...db.devices[0],
      id: 'device-db-2',
      name: currentState.identity.displayName,
      deviceId: 'CURRENT_DEVICE_ID',
      deviceState: JSON.stringify(currentState),
      updatedAt: 2,
    });

    await expect(
      db.updateDeviceState({
        connectId: 'ABC-DEF',
        state: resetState,
        revision: resetState.revision,
        source: 'device-status',
        changedKeys: ['identity.deviceId'],
      }),
    ).resolves.toMatchObject({
      kind: 'identity-mismatch',
      deviceDbId: 'device-db-2',
      currentDeviceId: 'CURRENT_DEVICE_ID',
      incomingDeviceId: 'NEXT_DEVICE_ID',
    });
  });

  it('isolates a reset identity instead of overwriting the wallet bound to the serial', async () => {
    const current = createState({
      revision: 8,
      updatedAt: 100,
      label: 'Original wallet',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'OLD_DEVICE_ID',
    });
    const incoming = createState({
      revision: 9,
      updatedAt: 200,
      label: 'Reset wallet',
      language: 'ja-JP',
      serialNo: 'SERIAL-A',
      deviceId: 'NEW_DEVICE_ID',
    });
    const db = new DeviceStateTestLocalDb(current);
    db.devices[0].uuid = 'SERIAL-A';
    db.devices[0].deviceId = 'OLD_DEVICE_ID';

    await expect(
      db.updateDeviceState({
        connectId: 'ABC-DEF',
        state: incoming,
        revision: incoming.revision,
        source: 'device-status',
        changedKeys: ['identity.deviceId', 'status.unlocked'],
      }),
    ).resolves.toMatchObject({
      kind: 'identity-mismatch',
      deviceDbId: 'device-db-1',
      currentDeviceId: 'OLD_DEVICE_ID',
      incomingDeviceId: 'NEW_DEVICE_ID',
    });

    expect(JSON.parse(db.device.deviceState || '{}')).toEqual(current);
  });
});
