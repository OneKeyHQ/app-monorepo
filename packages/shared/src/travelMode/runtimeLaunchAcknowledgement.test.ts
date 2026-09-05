import platformEnv from '../platformEnv';

import {
  acknowledgeTravelModeRuntimeLaunch,
  isTravelModeRuntimeLaunchNativeModuleAvailable,
} from './nativeLaunchEpoch';
import { completeTravelModeRuntimeLaunchAcknowledgement } from './runtimeLaunchAcknowledgement';
import { TravelModeManager } from './TravelModeManager';

jest.mock('./nativeLaunchEpoch', () => ({
  acknowledgeTravelModeRuntimeLaunch: jest.fn(async () => ({
    epoch: 1,
    status: 'complete',
  })),
  isTravelModeRuntimeLaunchNativeModuleAvailable: jest.fn(() => true),
}));

function buildManager(
  value: string | null = JSON.stringify({
    enabled: true,
    verifyString: '|VS|verifier',
    version: 1,
  }),
) {
  return new TravelModeManager(
    {
      getItem: async () => value,
      removeItem: async () => undefined,
      setItem: async () => undefined,
    },
    true,
  );
}

describe('completeTravelModeRuntimeLaunchAcknowledgement', () => {
  const originalPlatform = {
    isNative: platformEnv.isNative,
    nativeRuntimeKind: platformEnv.nativeRuntimeKind,
  };

  beforeEach(() => {
    platformEnv.isNative = true;
    platformEnv.nativeRuntimeKind = 'background';
  });

  afterEach(() => {
    platformEnv.isNative = originalPlatform.isNative;
    platformEnv.nativeRuntimeKind = originalPlatform.nativeRuntimeKind;
    jest.mocked(isTravelModeRuntimeLaunchNativeModuleAvailable).mockReset();
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(true);
    jest.mocked(acknowledgeTravelModeRuntimeLaunch).mockReset();
    jest.mocked(acknowledgeTravelModeRuntimeLaunch).mockResolvedValue({
      epoch: 1,
      status: 'complete',
    });
  });

  it('reports the independently selected background profile', async () => {
    const manager = buildManager();

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(true);

    expect(acknowledgeTravelModeRuntimeLaunch).toHaveBeenCalledWith({
      profile: 'travel-mode',
      runtime: 'background',
    });
  });

  it('moves the runtime into recovery when native acknowledgement fails', async () => {
    const manager = buildManager();
    jest
      .mocked(acknowledgeTravelModeRuntimeLaunch)
      .mockRejectedValueOnce(new Error('ack timeout'));

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(false);
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  it('allows a standard launch without the native module when no control record exists', async () => {
    const manager = buildManager(null);
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(false);

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(true);

    expect(acknowledgeTravelModeRuntimeLaunch).not.toHaveBeenCalled();
    await expect(manager.getRuntimeState()).resolves.toBe('inactive');
  });

  it('allows a standard launch without the native module when Travel Mode is explicitly disabled', async () => {
    const manager = buildManager(
      JSON.stringify({
        enabled: false,
        verifyString: '|VS|verifier',
        version: 1,
      }),
    );
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(false);

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(true);

    expect(acknowledgeTravelModeRuntimeLaunch).not.toHaveBeenCalled();
    await expect(manager.getRuntimeState()).resolves.toBe('inactive');
  });

  it('fails closed without the native module when Travel Mode is enabled', async () => {
    const manager = buildManager();
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(false);

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(false);

    expect(acknowledgeTravelModeRuntimeLaunch).not.toHaveBeenCalled();
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  it('fails closed without the native module when the control record is invalid', async () => {
    const manager = buildManager('{"enabled":false}');
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(false);

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(false);

    expect(acknowledgeTravelModeRuntimeLaunch).not.toHaveBeenCalled();
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  it('fails closed without the native module when the control record cannot be read', async () => {
    const manager = new TravelModeManager(
      {
        getItem: async () => Promise.reject(new Error('storage unavailable')),
        removeItem: async () => undefined,
        setItem: async () => undefined,
      },
      true,
    );
    jest
      .mocked(isTravelModeRuntimeLaunchNativeModuleAvailable)
      .mockReturnValue(false);

    await expect(
      completeTravelModeRuntimeLaunchAcknowledgement(manager),
    ).resolves.toBe(false);

    expect(acknowledgeTravelModeRuntimeLaunch).not.toHaveBeenCalled();
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });
});
