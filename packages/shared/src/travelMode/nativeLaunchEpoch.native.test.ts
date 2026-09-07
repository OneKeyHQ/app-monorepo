import { NativeModules } from 'react-native';

import {
  acknowledgeTravelModeRuntimeLaunch,
  forceDisableTravelModeForRecovery,
  isTravelModeRuntimeLaunchNativeModuleAvailable,
  prepareTravelModeRuntimeRestart,
} from './nativeLaunchEpoch.native';

type ILaunchState = {
  acknowledged: Set<'background' | 'main'>;
  deadlineAt?: number;
  epoch: number;
  profile: 'standard' | 'travel-mode';
  status: 'complete' | 'pending' | 'timed-out';
};

function installNativeModule() {
  let nextEpoch = 0;
  let launchState: ILaunchState | undefined;
  const nativeModule = {
    prepareRestart: jest.fn(
      async (profile: ILaunchState['profile']): Promise<number> => {
        nextEpoch += 1;
        launchState = {
          acknowledged: new Set(),
          epoch: nextEpoch,
          profile,
          status: 'pending',
        };
        return nextEpoch;
      },
    ),
    acknowledgeRuntimeLaunch: jest.fn(
      async (
        runtime: 'background' | 'main',
        profile: ILaunchState['profile'],
      ) => {
        if (!launchState) {
          return { epoch: 0, status: 'idle' as const };
        }
        if (
          launchState.deadlineAt !== undefined &&
          Date.now() >= launchState.deadlineAt
        ) {
          launchState.status = 'timed-out';
          return {
            deadlineAt: launchState.deadlineAt,
            epoch: launchState.epoch,
            status: launchState.status,
          };
        }
        if (profile !== launchState.profile) {
          return { epoch: launchState.epoch, status: 'mismatch' as const };
        }
        launchState.deadlineAt ??= Date.now() + 100;
        launchState.acknowledged.add(runtime);
        if (launchState.acknowledged.size === 2) {
          launchState.status = 'complete';
        }
        return {
          deadlineAt: launchState.deadlineAt,
          epoch: launchState.epoch,
          status: launchState.status,
        };
      },
    ),
    getLaunchStatus: jest.fn(async (epoch: number) => {
      if (!launchState || epoch !== launchState.epoch) {
        return { epoch, status: 'superseded' as const };
      }
      if (
        launchState.status === 'pending' &&
        launchState.deadlineAt !== undefined &&
        Date.now() >= launchState.deadlineAt
      ) {
        launchState.status = 'timed-out';
      }
      return {
        deadlineAt: launchState.deadlineAt,
        epoch: launchState.epoch,
        status: launchState.status,
      };
    }),
    forceDisableForRecovery: jest.fn(async () => true),
  };
  NativeModules.OneKeyTravelModeLaunchEpoch = nativeModule;
  return {
    nativeModule,
    resolveLate() {
      if (launchState) {
        launchState.status = 'complete';
      }
    },
  };
}

describe('native Travel Mode launch epoch acknowledgement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete NativeModules.OneKeyTravelModeLaunchEpoch;
  });

  it('reports whether the native launch module is installed', () => {
    expect(isTravelModeRuntimeLaunchNativeModuleAvailable()).toBe(false);

    installNativeModule();

    expect(isTravelModeRuntimeLaunchNativeModuleAvailable()).toBe(true);
  });

  it('completes one native-owned epoch only after main and background acknowledge the target profile', async () => {
    const { nativeModule } = installNativeModule();

    await expect(prepareTravelModeRuntimeRestart('travel-mode')).resolves.toBe(
      1,
    );
    const mainAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'main',
    });
    const backgroundAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'background',
    });
    await jest.advanceTimersByTimeAsync(50);

    await expect(mainAcknowledgement).resolves.toEqual({
      epoch: 1,
      status: 'complete',
    });
    await expect(backgroundAcknowledgement).resolves.toMatchObject({
      epoch: 1,
      status: 'complete',
    });
    expect(nativeModule.acknowledgeRuntimeLaunch.mock.calls).toEqual([
      ['main', 'travel-mode'],
      ['background', 'travel-mode'],
    ]);
  });

  it('starts the acknowledgement deadline when the first replacement runtime acknowledges', async () => {
    installNativeModule();

    await prepareTravelModeRuntimeRestart('travel-mode');
    await jest.advanceTimersByTimeAsync(1000);

    const mainAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'main',
    });
    const backgroundAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'background',
    });
    await jest.advanceTimersByTimeAsync(50);

    await expect(mainAcknowledgement).resolves.toMatchObject({
      epoch: 1,
      status: 'complete',
    });
    await expect(backgroundAcknowledgement).resolves.toMatchObject({
      epoch: 1,
      status: 'complete',
    });
  });

  it('fails closed when the companion runtime does not acknowledge before the native deadline', async () => {
    installNativeModule();
    await prepareTravelModeRuntimeRestart('standard');

    const acknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'standard',
      runtime: 'main',
    });
    const result = acknowledgement.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(100);

    await expect(result).resolves.toMatchObject({ message: 'Unknown error' });
  });

  it('does not let a late completion change a timed-out result', async () => {
    const native = installNativeModule();
    await prepareTravelModeRuntimeRestart('travel-mode');

    const acknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'background',
    });
    const result = acknowledgement.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toMatchObject({ message: 'Unknown error' });

    native.resolveLate();
    await jest.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toMatchObject({ message: 'Unknown error' });
  });

  it('rejects a replacement runtime that selected a different profile', async () => {
    installNativeModule();
    await prepareTravelModeRuntimeRestart('travel-mode');

    await expect(
      acknowledgeTravelModeRuntimeLaunch({
        profile: 'standard',
        runtime: 'main',
      }),
    ).rejects.toThrow('Unknown error');
  });

  it('starts a fresh epoch for a retry and supersedes the prior attempt', async () => {
    installNativeModule();

    await expect(prepareTravelModeRuntimeRestart('travel-mode')).resolves.toBe(
      1,
    );
    await expect(prepareTravelModeRuntimeRestart('travel-mode')).resolves.toBe(
      2,
    );

    const mainAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'main',
    });
    const backgroundAcknowledgement = acknowledgeTravelModeRuntimeLaunch({
      profile: 'travel-mode',
      runtime: 'background',
    });
    await jest.advanceTimersByTimeAsync(50);

    await expect(mainAcknowledgement).resolves.toMatchObject({ epoch: 2 });
    await expect(backgroundAcknowledgement).resolves.toMatchObject({
      epoch: 2,
    });
  });

  it('forces the persisted profile to standard before a recovery restart', async () => {
    const { nativeModule } = installNativeModule();

    await expect(forceDisableTravelModeForRecovery()).resolves.toBe(true);
    expect(nativeModule.forceDisableForRecovery).toHaveBeenCalledTimes(1);
  });
});
