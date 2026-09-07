import platformEnv from '../platformEnv';

import {
  installTravelModeRuntimeLaunchGate,
  resetTravelModeRuntimeLaunchGateForTesting,
  waitForTravelModeRuntimeLaunchGate,
} from './runtimeLaunchGate';

describe('Travel Mode runtime launch gate', () => {
  const originalPlatform = {
    enableNativeBackgroundThread: platformEnv.enableNativeBackgroundThread,
    isNativeBackgroundThread: platformEnv.isNativeBackgroundThread,
  };

  beforeEach(() => {
    platformEnv.enableNativeBackgroundThread = true;
    platformEnv.isNativeBackgroundThread = true;
    resetTravelModeRuntimeLaunchGateForTesting();
  });

  afterEach(() => {
    platformEnv.enableNativeBackgroundThread =
      originalPlatform.enableNativeBackgroundThread;
    platformEnv.isNativeBackgroundThread =
      originalPlatform.isNativeBackgroundThread;
    resetTravelModeRuntimeLaunchGateForTesting();
  });

  it('fails closed before the background entry publishes its gate', async () => {
    await expect(waitForTravelModeRuntimeLaunchGate()).resolves.toBe(false);
  });

  it('shares one immutable acknowledgement promise with background startup', async () => {
    let resolveGate: ((acknowledged: boolean) => void) | undefined;
    const gate = new Promise<boolean>((resolve) => {
      resolveGate = resolve;
    });

    expect(installTravelModeRuntimeLaunchGate(gate)).toBe(true);
    expect(installTravelModeRuntimeLaunchGate(Promise.resolve(true))).toBe(
      false,
    );
    const result = waitForTravelModeRuntimeLaunchGate();
    resolveGate?.(true);
    await expect(result).resolves.toBe(true);
  });

  it('converts a rejected acknowledgement into a closed gate', async () => {
    installTravelModeRuntimeLaunchGate(Promise.reject(new Error('timeout')));

    await expect(waitForTravelModeRuntimeLaunchGate()).resolves.toBe(false);
  });
});
