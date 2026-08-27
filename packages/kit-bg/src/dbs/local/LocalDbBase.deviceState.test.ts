import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import { INDEXED_DB_VERSION, REALM_DB_VERSION } from './consts';
import { LocalDbBase, sanitizeDeviceStateForPersistence } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type {
  EIndexedDBBucketNames,
  IDBDevice,
  IDBWallet,
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
  passphraseProtection,
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
  passphraseProtection?: boolean;
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
    },
    status: { mode: 'normal', passphraseProtection },
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
        name: deviceUtils.getDeviceDisplayName({ state }),
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

  it('isolates malformed device state and settings records during hydration', async () => {
    const state = createState({
      revision: 1,
      updatedAt: 100,
      label: 'Healthy device',
      language: 'en-US',
    });
    const db = new DeviceStateTestLocalDb(state);
    db.devices.push({
      ...db.device,
      id: 'device-db-broken',
      deviceState: '{broken',
      features: JSON.stringify({ label: 'Legacy fallback' }),
      settingsRaw: '{broken',
    });

    const { devices } = await db.getAllDevices();

    expect(devices).toHaveLength(2);
    expect(devices[0].deviceStateInfo?.identity.label).toBe('Healthy device');
    expect(devices[1].deviceStateInfo).toBeUndefined();
    expect(devices[1].featuresInfo?.label).toBe('Legacy fallback');
    expect(devices[1].settings).toEqual({});
  });

  it('uses the canonical DeviceState display name for OneKey wallets', async () => {
    const state = createState({
      revision: 1,
      updatedAt: 100,
      label: 'Stale compatibility label',
      language: 'en-US',
    });
    state.identity.label = 'My Pro 2';
    const db = new DeviceStateTestLocalDb(state);
    const wallet: IDBWallet = {
      id: 'hw-wallet-1',
      name: 'Pro2 6136',
      type: 'hw',
      backuped: true,
      accounts: [],
      nextIds: {},
      associatedDevice: db.device.id,
      walletNo: 1,
    };

    const result = await db.refillWalletInfo({
      wallet,
      allDevices: [db.refillDeviceInfo({ device: db.device })],
    });

    expect(result.name).toBe('My Pro 2');
  });

  it('repairs a wallet name previously polluted by the BLE name', async () => {
    const state = createState({
      revision: 1,
      updatedAt: 100,
      label: null,
      bleName: 'Pro2 6136',
      language: 'en-US',
    });
    const db = new DeviceStateTestLocalDb(state);
    const wallet: IDBWallet = {
      id: 'hw-wallet-1',
      name: 'Pro2 6136',
      type: 'hw',
      backuped: true,
      accounts: [],
      nextIds: {},
      associatedDevice: db.device.id,
      walletNo: 1,
    };

    const result = await db.refillWalletInfo({
      wallet,
      allDevices: [db.refillDeviceInfo({ device: db.device })],
    });

    expect(result.name).toBe('OneKey Pro 2');
  });

  it('repairs a canonical Pro 2 wallet name polluted by a compact BLE advertisement', async () => {
    const state = createState({
      revision: 1,
      updatedAt: 100,
      label: null,
      bleName: 'Pro2 6136',
      language: 'en-US',
    });
    const db = new DeviceStateTestLocalDb(state);
    const wallet: IDBWallet = {
      id: 'hw-wallet-1',
      name: 'Pro 2 6136',
      type: 'hw',
      backuped: true,
      accounts: [],
      nextIds: {},
      associatedDevice: db.device.id,
      walletNo: 1,
    };

    const result = await db.refillWalletInfo({
      wallet,
      allDevices: [db.refillDeviceInfo({ device: db.device })],
    });

    expect(result.name).toBe('OneKey Pro 2');
  });

  it('uses the legacy Features label before DeviceState persistence', async () => {
    const state = createState({
      revision: 1,
      updatedAt: 100,
      label: null,
      language: 'en-US',
    });
    const db = new DeviceStateTestLocalDb(state);
    db.device.deviceState = undefined;
    db.device.features = JSON.stringify({ label: 'Legacy OneKey Name' });
    const wallet: IDBWallet = {
      id: 'hw-wallet-legacy',
      name: 'Old Wallet Name',
      type: 'hw',
      backuped: true,
      accounts: [],
      nextIds: {},
      associatedDevice: db.device.id,
      walletNo: 1,
    };

    const result = await db.refillWalletInfo({
      wallet,
      allDevices: [db.refillDeviceInfo({ device: db.device })],
    });

    expect(result.name).toBe('Legacy OneKey Name');
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

  it('sanitizes device state when structuredClone is unavailable on Hermes', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'structuredClone',
    );
    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(
        sanitizeDeviceStateForPersistence(
          createState({
            revision: 2,
            updatedAt: 2,
            label: null,
            language: null,
          }),
        ),
      ).toMatchObject({ revision: 2, updatedAt: 2 });
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'structuredClone', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'structuredClone');
      }
    }
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
      changedKeys: ['identity.bleName', 'versions.firmware'],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.identity.label).toBe('My Pro 2');
    expect(persisted.identity).not.toHaveProperty('displayName');
    expect(persisted.settings.language).toBe('ja-JP');
    expect(persisted.versions.firmware).toBe('1.1.0');
    expect(db.device.connectProtocol).toBe('V2');
    expect(db.device.name).toBe('My Pro 2');
  });

  it('persists the complete SDK settings snapshot after a settings read', async () => {
    const current = createState({
      revision: 1,
      updatedAt: 100,
      label: 'My Pro 2',
      language: 'en-US',
    });
    current.settings.brightness = 30;
    current.settings.autoLockDelayMs = 60_000;

    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'My Pro 2',
      language: 'en-US',
    });
    incoming.settings.brightness = 70;
    incoming.settings.autoLockDelayMs = 300_000;
    const db = new DeviceStateTestLocalDb(current);

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'settings-read',
      changedKeys: ['settings.brightness'],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.settings.brightness).toBe(70);
    expect(persisted.settings.autoLockDelayMs).toBe(300_000);
  });

  it('persists complete V1 device-info versions without matching changedKeys', async () => {
    const current = createState({
      revision: 1,
      updatedAt: 100,
      label: 'Classic',
      language: 'en-US',
      firmware: '4.16.1',
    });
    current.protocol = 'V1';
    current.identity.firmwareType = EFirmwareType.Universal;
    current.versions.ble = '2.3.4';
    current.versions.bootloader = '2.8.2';
    current.securityElements = {
      se01: { type: 'old-type', state: 'old-state' },
    };

    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'Classic',
      language: 'en-US',
      firmware: '4.21.0',
    });
    incoming.protocol = 'V1';
    incoming.identity.firmwareType = EFirmwareType.BitcoinOnly;
    incoming.versions.ble = '2.3.7';
    incoming.versions.bootloader = '2.8.4';
    incoming.securityElements = {
      se01: { type: 'new-type', state: 'new-state' },
    };
    const db = new DeviceStateTestLocalDb(current);

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'device-info',
      changedKeys: ['status.unlocked'],
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.versions).toEqual(incoming.versions);
    expect(persisted.identity.firmwareType).toBe(EFirmwareType.Universal);
    expect(persisted.securityElements).toEqual(current.securityElements);
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

  it('orders SDK events by instance epoch and monotonic sequence', async () => {
    const persistedFutureState = createState({
      revision: 99,
      updatedAt: 9_999_999,
      label: 'Future timestamp',
      language: 'en-US',
    });
    const firstCurrentInstanceState = createState({
      revision: 0,
      updatedAt: 10,
      label: 'Current instance',
      language: 'ja-JP',
    });
    const clockRollbackState = createState({
      revision: 1,
      updatedAt: 5,
      label: 'Clock rolled back',
      language: 'zh-CN',
    });
    const rebuiltSdkState = createState({
      revision: 0,
      updatedAt: 1,
      label: 'Rebuilt SDK',
      language: 'de-DE',
    });
    const db = new DeviceStateTestLocalDb(persistedFutureState);

    await db.updateDeviceState({
      changedKeys: ['*'],
      connectId: 'ABC-DEF',
      revision: firstCurrentInstanceState.revision,
      sdkEventSequence: 1,
      sdkInstanceEpoch: 1,
      source: 'initialize',
      state: firstCurrentInstanceState,
    });
    await db.updateDeviceState({
      changedKeys: ['identity.label', 'settings.language'],
      connectId: 'ABC-DEF',
      revision: clockRollbackState.revision,
      sdkEventSequence: 2,
      sdkInstanceEpoch: 1,
      source: 'device-status',
      state: clockRollbackState,
    });
    await db.updateDeviceState({
      changedKeys: ['identity.label'],
      connectId: 'ABC-DEF',
      revision: firstCurrentInstanceState.revision,
      sdkEventSequence: 1,
      sdkInstanceEpoch: 1,
      source: 'delayed-event',
      state: firstCurrentInstanceState,
    });
    await db.updateDeviceState({
      changedKeys: ['*'],
      connectId: 'ABC-DEF',
      revision: rebuiltSdkState.revision,
      sdkEventSequence: 1,
      sdkInstanceEpoch: 2,
      source: 'initialize',
      state: rebuiltSdkState,
    });

    const persisted = JSON.parse(db.device.deviceState || '{}');
    expect(persisted.identity.label).toBe('Rebuilt SDK');
    expect(persisted.settings.language).toBe('de-DE');
    expect(persisted.updatedAt).toBe(1);
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
    expect(persisted.identity).not.toHaveProperty('displayName');
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
      name: deviceUtils.getDeviceDisplayName({ state: secondState }),
      uuid: 'SERIAL-B',
      deviceState: JSON.stringify(secondState),
    });

    await db.updateDeviceState({
      connectId: 'REUSED-CONNECT-ID',
      state: incoming,
      revision: incoming.revision,
      source: 'apply-settings',
      changedKeys: ['identity.label'],
    });

    expect(JSON.parse(db.devices[0].deviceState || '{}').identity.label).toBe(
      'First device',
    );
    expect(JSON.parse(db.devices[1].deviceState || '{}').identity.label).toBe(
      'Renamed second device',
    );
  });

  it('synchronizes canonical identity without duplicating DeviceState into persisted features', async () => {
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

    expect(db.device.deviceId).toBe('LIVE_DEVICE_ID');
    expect(db.device.uuid).toBe('SERIAL-A');
    expect(db.device.deviceType).toBe(EDeviceType.Pro2);
    expect(JSON.parse(db.device.features)).toEqual({
      $app_firmware_type: 'universal',
    });

    const hydrated = db.refillDeviceInfo({ device: db.device });
    expect(hydrated.featuresInfo?.deviceId).toBe('LIVE_DEVICE_ID');
    expect(hydrated.featuresInfo?.device_id).toBe('LIVE_DEVICE_ID');
    expect(hydrated.featuresInfo?.$app_firmware_type).toBe('universal');
  });

  it('migrates a legacy record matched by connectId despite a stale uuid', async () => {
    const legacyState = createState({
      revision: 1,
      updatedAt: 100,
      label: 'Legacy Pro 2',
      language: 'en-US',
      serialNo: '',
      deviceId: 'DEVICE-A',
    });
    const liveState = createState({
      revision: 2,
      updatedAt: 200,
      label: 'Migrated Pro 2',
      language: 'ja-JP',
      serialNo: 'SERIAL-A',
      deviceId: 'DEVICE-A',
    });
    const db = new DeviceStateTestLocalDb(legacyState);
    db.device.deviceState = undefined;
    db.device.uuid = 'LEGACY-BLE-UUID';
    db.device.deviceId = 'DEVICE-A';
    db.device.features = JSON.stringify({
      label: 'Legacy Pro 2',
      $app_firmware_type: 'universal',
    });

    await expect(
      db.updateDeviceState({
        connectId: 'ABC-DEF',
        state: liveState,
        revision: liveState.revision,
        source: 'initialize',
        changedKeys: ['*'],
      }),
    ).resolves.toMatchObject({
      kind: 'updated',
      deviceDbId: 'device-db-1',
    });

    expect(db.device.uuid).toBe('SERIAL-A');
    expect(db.device.deviceStateInfo?.identity.deviceId).toBe('DEVICE-A');
    expect(JSON.parse(db.device.features)).toEqual({
      $app_firmware_type: 'universal',
    });
  });

  it('refreshes cached DeviceState and legacy passphrase projections before returning', async () => {
    const current = createState({
      revision: 1,
      updatedAt: 100,
      label: 'My Pro 2',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'DEVICE-A',
      passphraseProtection: false,
    });
    const incoming = createState({
      revision: 2,
      updatedAt: 200,
      label: 'My Pro 2',
      language: 'en-US',
      serialNo: 'SERIAL-A',
      deviceId: 'DEVICE-A',
      passphraseProtection: true,
    });
    const db = new DeviceStateTestLocalDb(current);
    db.device.uuid = 'SERIAL-A';
    db.device.deviceId = 'DEVICE-A';
    db.device.features = JSON.stringify({
      passphraseProtection: false,
      $app_firmware_type: 'universal',
    });

    await db.updateDeviceState({
      connectId: 'ABC-DEF',
      state: incoming,
      revision: incoming.revision,
      source: 'apply-settings',
      changedKeys: ['status.passphraseProtection'],
    });

    expect(db.device.deviceStateInfo?.status.passphraseProtection).toBe(true);
    expect(db.device.featuresInfo?.passphraseProtection).toBe(true);
    expect(JSON.parse(db.device.features)).toEqual({
      $app_firmware_type: 'universal',
    });
  });

  it('hydrates legacy Features consumers from DeviceState while preserving only app metadata', () => {
    const state = createState({
      revision: 3,
      updatedAt: 300,
      label: 'Canonical Pro 2',
      language: 'ja-JP',
      firmware: '2.0.0',
      serialNo: 'SERIAL-A',
      deviceId: 'DEVICE-A',
    });
    const db = new DeviceStateTestLocalDb(state);
    db.device.features = JSON.stringify({
      staleField: 'must-not-win',
      $app_firmware_type: 'bitcoinOnly',
    });

    const hydrated = db.refillDeviceInfo({ device: db.device });

    expect(hydrated.featuresInfo).toMatchObject({
      deviceId: 'DEVICE-A',
      serialNo: 'SERIAL-A',
      label: 'Canonical Pro 2',
      language: 'ja-JP',
      firmwareVersion: '2.0.0',
      $app_firmware_type: 'bitcoinOnly',
    });
    expect(hydrated.featuresInfo).not.toHaveProperty('staleField');
  });

  it('matches the exact wallet-lifecycle identity when one serial has multiple records', async () => {
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
      name: deviceUtils.getDeviceDisplayName({ state: currentState }),
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
        changedKeys: ['identity.label'],
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
      name: deviceUtils.getDeviceDisplayName({ state: currentState }),
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
