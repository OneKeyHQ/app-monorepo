import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import { INDEXED_DB_VERSION, REALM_DB_VERSION } from './consts';
import { LocalDbBase } from './LocalDbBase';
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
}: {
  revision: number;
  updatedAt: number;
  label: string | null;
  bleName?: string;
  language: string | null;
  firmware?: string;
}): IOneKeyDeviceState =>
  ({
    schemaVersion: 1,
    revision,
    updatedAt,
    protocol: 'V2',
    identity: {
      deviceType: EDeviceType.Pro2,
      firmwareType: EFirmwareType.Universal,
      model: 'pro2',
      vendor: 'onekey.so',
      deviceId: null,
      serialNo: '',
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

  device: IDBDevice;

  constructor(state: IOneKeyDeviceState) {
    super();
    this.device = {
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
    };
  }

  override async reset() {}

  override async getAllDevices() {
    return { devices: [this.refillDeviceInfo({ device: this.device })] };
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
    if (name === ELocalDBStoreNames.Device && ids.includes(this.device.id)) {
      this.device = await (
        updater as (item: IDBDevice) => IDBDevice | Promise<IDBDevice>
      )(this.device);
    }
  }
}

describe('LocalDb DeviceState persistence', () => {
  it('bumps the local database version for the new Realm field', () => {
    expect(INDEXED_DB_VERSION).toBe(20);
    expect(REALM_DB_VERSION).toBe(20);
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
});
