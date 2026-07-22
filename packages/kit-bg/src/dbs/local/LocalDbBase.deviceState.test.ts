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
});
