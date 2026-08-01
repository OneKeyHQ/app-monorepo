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
});
