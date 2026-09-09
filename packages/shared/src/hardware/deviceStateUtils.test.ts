import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';

import {
  mergeDeviceStateEvent,
  projectLegacyDeviceFeaturesFromState,
} from './deviceStateUtils';

import type { IOneKeyDeviceState } from '../../types/device';

function createState({
  revision = 1,
  updatedAt = 1,
  protocolVersion = 1,
  unlocked = false,
}: {
  revision?: number;
  updatedAt?: number;
  protocolVersion?: number;
  unlocked?: boolean;
} = {}): IOneKeyDeviceState {
  return {
    schemaVersion: 1,
    revision,
    updatedAt,
    protocol: 'V2',
    protocolVersion,
    identity: {
      deviceType: 'pro2',
      firmwareType: 'universal',
      model: 'pro2',
      vendor: 'onekey.so',
      deviceId: 'PRO2_DEVICE_ID',
      serialNo: 'PRO2_SERIAL',
      label: null,
      bleName: 'Pro2 6136',
      displayName: 'Pro2 6136',
    },
    status: {
      mode: 'normal',
      initialized: null,
      unlocked,
      firmwarePresent: null,
      backupRequired: null,
      noBackup: null,
      unfinishedBackup: null,
      recoveryMode: null,
      passphraseProtection: null,
      pinProtection: null,
      attachToPinEnabled: null,
      unlockedAttachPin: null,
    },
    settings: {
      language: null,
      bleEnabled: null,
      sdCardPresent: null,
      sdProtection: null,
      wipeCodeProtection: null,
      passphraseAlwaysOnDevice: null,
      safetyChecks: null,
      autoLockDelayMs: null,
      autoShutdownDelayMs: null,
      displayRotation: null,
      experimentalFeatures: null,
      wallpaperPath: null,
      brightness: null,
      animationEnabled: null,
      tapToWake: null,
      hapticFeedback: null,
      deviceNameDisplayEnabled: null,
      airgapMode: null,
      fidoEnabled: null,
      usbLockEnabled: null,
      randomKeypad: null,
    },
    versions: {
      firmware: '1.0.0',
      bootloader: '1.0.0',
      board: null,
      ble: '1.0.20',
      se: null,
    },
    capabilities: [],
    verification: {},
  } as IOneKeyDeviceState;
}

describe('deviceStateUtils', () => {
  it('keeps the wire protocol version separate from the protocol family', () => {
    const features = projectLegacyDeviceFeaturesFromState(
      createState({ protocolVersion: 1 }),
    );

    expect(features.protocol).toBe('V2');
    expect(features.protocolVersion).toBe(1);
  });

  it('uses an explicit unknown version for a legacy V2 snapshot', () => {
    const state = createState();
    delete (state as Partial<IOneKeyDeviceState>).protocolVersion;

    expect(projectLegacyDeviceFeaturesFromState(state).protocolVersion).toBe(
      null,
    );
  });

  it('preserves the single SE version for legacy devices', () => {
    const state = createState();
    state.protocol = 'V1';
    state.identity.deviceType = EDeviceType.Classic1s;
    state.versions.se = '1.1.0.2';
    delete state.versions.se01;

    expect(projectLegacyDeviceFeaturesFromState(state)).toMatchObject({
      onekey_se01_version: '1.1.0.2',
      seVersion: '1.1.0.2',
      se01Version: '1.1.0.2',
    });
  });

  it('updates root protocol metadata while merging a partial event', () => {
    const merged = mergeDeviceStateEvent({
      currentState: createState({ protocolVersion: 1 }),
      incomingState: createState({
        revision: 2,
        updatedAt: 2,
        protocolVersion: 2,
        unlocked: true,
      }),
      changedKeys: ['status.unlocked'],
    });

    expect(merged.status.unlocked).toBe(true);
    expect(merged.protocolVersion).toBe(2);
  });

  it('preserves known protocol metadata when an older event omits it', () => {
    const incomingState = createState({ revision: 2, updatedAt: 2 });
    delete (incomingState as Partial<IOneKeyDeviceState>).protocolVersion;

    const merged = mergeDeviceStateEvent({
      currentState: createState({ protocolVersion: 1 }),
      incomingState,
      changedKeys: ['status.unlocked'],
    });

    expect(merged.protocolVersion).toBe(1);
  });

  it('uses the complete SDK settings snapshot for a settings read', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.settings.brightness = 30;
    currentState.settings.autoLockDelayMs = 60_000;
    currentState.status.unlocked = false;

    const incomingState = createState({
      revision: 2,
      updatedAt: 2,
      unlocked: true,
    });
    incomingState.settings.brightness = 70;
    incomingState.settings.autoLockDelayMs = 300_000;

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['settings.brightness'],
      source: 'settings-read',
    });

    expect(merged.settings.brightness).toBe(70);
    expect(merged.settings.autoLockDelayMs).toBe(300_000);
    // A settings read is authoritative only for the settings section.
    expect(merged.status.unlocked).toBe(false);
  });

  it('uses the complete settings snapshot for a V1 initialize read', () => {
    // BLE initialize can run before SDK event listeners attach, so a
    // device-side change (e.g. language) may already sit in the SDK cache
    // and never appear in changedKeys again. The V1 initialize event still
    // carries the full GetFeatures snapshot and must sync the whole section.
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.settings.language = 'en';

    const incomingState = createState({
      revision: 2,
      updatedAt: 2,
      unlocked: true,
    });
    incomingState.protocol = 'V1';
    incomingState.settings.language = 'zh_hk';

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['status.unlocked'],
      source: 'initialize',
    });

    expect(merged.settings.language).toBe('zh_hk');
    expect(merged.status.unlocked).toBe(true);
  });

  it('syncs settings riding along a V1 settings write', () => {
    // Legacy V1 SDKs patch the cache optimistically after ApplySettings
    // ('settings-write') without a device read-back. The event still carries
    // the cache's full settings (last GetFeatures truth), so a device-side
    // language change known to the cache must reach the DB here as well.
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.settings.language = 'en';
    currentState.settings.autoLockDelayMs = 60_000;

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.protocol = 'V1';
    incomingState.settings.language = 'ja';
    incomingState.settings.autoLockDelayMs = 300_000;

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['settings.autoLockDelayMs'],
      source: 'settings-write',
    });

    expect(merged.settings.autoLockDelayMs).toBe(300_000);
    expect(merged.settings.language).toBe('ja');
  });

  it('keeps sparse patch semantics for a V2 initialize event', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.settings.language = 'en';

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.settings.language = 'zh_hk';

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['status.unlocked'],
      source: 'initialize',
    });

    expect(merged.settings.language).toBe('en');
  });

  it.each(['V1', 'V2'] as const)(
    'uses %s device-info versions as an authoritative snapshot',
    (protocol) => {
      const currentState = createState({ revision: 1, updatedAt: 1 });
      currentState.protocol = protocol;
      currentState.identity.firmwareType = EFirmwareType.Universal;
      currentState.versions.firmware = '4.16.1';
      currentState.versions.ble = '2.3.4';
      currentState.versions.bootloader = '2.8.2';
      currentState.securityElements = {
        se01: { type: 'old-type', state: 'old-state' },
      };
      currentState.verification = { firmwareHash: 'old-firmware-hash' };

      const incomingState = createState({ revision: 2, updatedAt: 2 });
      incomingState.protocol = protocol;
      incomingState.identity.firmwareType = EFirmwareType.BitcoinOnly;
      incomingState.versions.firmware = '4.21.0';
      incomingState.versions.ble = '2.3.7';
      incomingState.versions.bootloader = '2.8.4';
      incomingState.securityElements = {
        se01: { type: 'new-type', state: 'new-state' },
      };
      incomingState.verification = { firmwareHash: 'new-firmware-hash' };

      const merged = mergeDeviceStateEvent({
        currentState,
        incomingState,
        changedKeys:
          protocol === 'V1'
            ? ['status.unlocked']
            : [
                'status.unlocked',
                'versions.firmware',
                'versions.ble',
                'versions.bootloader',
              ],
        source: 'device-info',
      });

      expect(merged.versions).toEqual(incomingState.versions);
      expect(merged.identity.firmwareType).toBe(EFirmwareType.Universal);
      expect(merged.securityElements).toEqual(currentState.securityElements);
      expect(merged.verification).toEqual(currentState.verification);
    },
  );

  it('keeps sparse V2 device-info events from replacing unmarked versions', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.versions.firmware = '1.1.0';

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.versions.firmware = '1.2.0';

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['status.unlocked'],
      source: 'device-info',
    });

    expect(merged.versions.firmware).toBe('1.1.0');
  });

  it('uses V1 initialize versions as authoritative without replacing other sections', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.protocol = 'V1';
    currentState.versions.firmware = '4.16.1';
    currentState.capabilities = ['Capability_Bitcoin'];

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.protocol = 'V1';
    incomingState.versions.firmware = '4.21.0';
    incomingState.capabilities = ['Capability_BLE'];

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['status.unlocked'],
      source: 'initialize',
    });

    expect(merged.versions).toEqual(incomingState.versions);
    expect(merged.capabilities).toEqual(currentState.capabilities);
  });

  it('does not replace persisted V1 versions with an incomplete snapshot', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.protocol = 'V1';
    currentState.identity.firmwareType = EFirmwareType.BitcoinOnly;
    currentState.versions.firmware = '4.21.0';
    currentState.versions.ble = '2.3.7';
    currentState.versions.bootloader = '2.8.4';
    currentState.capabilities = ['Capability_Bitcoin'];

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.protocol = 'V1';
    incomingState.identity.firmwareType = EFirmwareType.Universal;
    incomingState.versions.firmware = '0.0.0';
    incomingState.versions.ble = null;
    incomingState.versions.bootloader = null;
    incomingState.capabilities = [];

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['status.mode'],
      source: 'device-info',
    });

    expect(merged.versions).toEqual(currentState.versions);
    expect(merged.identity.firmwareType).toBe(EFirmwareType.BitcoinOnly);
    expect(merged.capabilities).toEqual(currentState.capabilities);
  });

  it('keeps sparse patch semantics for non-settings-read events', () => {
    const currentState = createState({ revision: 1, updatedAt: 1 });
    currentState.settings.brightness = 30;
    currentState.settings.autoLockDelayMs = 60_000;

    const incomingState = createState({ revision: 2, updatedAt: 2 });
    incomingState.settings.brightness = 70;
    incomingState.settings.autoLockDelayMs = 300_000;

    const merged = mergeDeviceStateEvent({
      currentState,
      incomingState,
      changedKeys: ['settings.brightness'],
      source: 'settings-write',
    });

    expect(merged.settings.brightness).toBe(70);
    expect(merged.settings.autoLockDelayMs).toBe(60_000);
  });

  it('merges state when structuredClone is unavailable on Hermes', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'structuredClone',
    );
    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      value: undefined,
    });

    try {
      const merged = mergeDeviceStateEvent({
        currentState: createState(),
        incomingState: createState({
          revision: 2,
          updatedAt: 2,
          unlocked: true,
        }),
        changedKeys: ['status.unlocked'],
      });
      expect(merged.status.unlocked).toBe(true);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'structuredClone', descriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'structuredClone');
      }
    }
  });
});
