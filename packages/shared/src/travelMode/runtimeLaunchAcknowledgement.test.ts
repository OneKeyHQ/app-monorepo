import platformEnv from '../platformEnv';

import { acknowledgeTravelModeRuntimeLaunch } from './nativeLaunchEpoch';
import { completeTravelModeRuntimeLaunchAcknowledgement } from './runtimeLaunchAcknowledgement';
import { TravelModeManager } from './TravelModeManager';

jest.mock('./nativeLaunchEpoch', () => ({
  acknowledgeTravelModeRuntimeLaunch: jest.fn(async () => ({
    epoch: 1,
    status: 'complete',
  })),
}));

function buildManager() {
  return new TravelModeManager(
    {
      getItem: async () =>
        JSON.stringify({
          enabled: true,
          verifyString: '|VS|verifier',
          version: 1,
        }),
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
});
