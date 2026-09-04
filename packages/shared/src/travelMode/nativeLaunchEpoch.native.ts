import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../errors';

import type { ITravelModeRuntimeProfile } from './runtimeProfile';

export type ITravelModeNativeRuntime = 'background' | 'main';
export type ITravelModeLaunchProfile = ITravelModeRuntimeProfile['kind'];

type ITravelModeLaunchPendingStatus = {
  deadlineAt: number;
  epoch: number;
  status: 'pending';
};

type ITravelModeLaunchTerminalStatus = {
  epoch: number;
  status: 'complete' | 'idle' | 'mismatch' | 'superseded' | 'timed-out';
};

type ITravelModeLaunchStatus =
  | ITravelModeLaunchPendingStatus
  | ITravelModeLaunchTerminalStatus;

interface ITravelModeLaunchEpochNativeModule {
  acknowledgeRuntimeLaunch(
    runtime: ITravelModeNativeRuntime,
    profile: ITravelModeLaunchProfile,
  ): Promise<ITravelModeLaunchStatus>;
  getLaunchStatus(epoch: number): Promise<ITravelModeLaunchStatus>;
  forceDisableForRecovery(): Promise<void>;
  prepareRestart(profile: ITravelModeLaunchProfile): Promise<number>;
}

export type ITravelModeLaunchAcknowledgement = {
  epoch: number;
  status: 'complete' | 'idle';
};

const ACKNOWLEDGEMENT_POLL_INTERVAL_MS = 50;

function getNativeModule(): ITravelModeLaunchEpochNativeModule {
  const nativeModule = NativeModules.OneKeyTravelModeLaunchEpoch as
    | ITravelModeLaunchEpochNativeModule
    | undefined;
  if (!nativeModule) {
    throw new OneKeyLocalError('Unknown error');
  }
  return nativeModule;
}

function parseStatus(value: unknown): ITravelModeLaunchStatus {
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError('Unknown error');
  }
  const status = (value as { status?: unknown }).status;
  const epoch = (value as { epoch?: unknown }).epoch;
  if (!Number.isSafeInteger(epoch) || (epoch as number) < 0) {
    throw new OneKeyLocalError('Unknown error');
  }
  if (
    status === 'complete' ||
    status === 'idle' ||
    status === 'mismatch' ||
    status === 'superseded' ||
    status === 'timed-out'
  ) {
    return { epoch: epoch as number, status };
  }
  const deadlineAt = (value as { deadlineAt?: unknown }).deadlineAt;
  if (
    status !== 'pending' ||
    typeof deadlineAt !== 'number' ||
    !Number.isFinite(deadlineAt)
  ) {
    throw new OneKeyLocalError('Unknown error');
  }
  return { deadlineAt, epoch: epoch as number, status };
}

function waitForNextStatus(deadlineAt: number): Promise<void> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(
      resolve,
      Math.min(ACKNOWLEDGEMENT_POLL_INTERVAL_MS, remainingMs),
    );
    (
      timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
    ).unref?.();
  });
}

function assertTerminalStatus(
  status: ITravelModeLaunchStatus,
  expectedEpoch?: number,
): ITravelModeLaunchAcknowledgement | undefined {
  if (status.status === 'idle') {
    if (expectedEpoch !== undefined) {
      throw new OneKeyLocalError('Unknown error');
    }
    return { epoch: status.epoch, status: 'idle' };
  }
  if (status.status === 'complete') {
    if (expectedEpoch !== undefined && status.epoch !== expectedEpoch) {
      throw new OneKeyLocalError('Unknown error');
    }
    return { epoch: status.epoch, status: 'complete' };
  }
  if (status.status !== 'pending') {
    throw new OneKeyLocalError('Unknown error');
  }
  if (expectedEpoch !== undefined && status.epoch !== expectedEpoch) {
    throw new OneKeyLocalError('Unknown error');
  }
  return undefined;
}

export async function prepareTravelModeRuntimeRestart(
  profile: ITravelModeLaunchProfile,
): Promise<number> {
  const epoch = await getNativeModule().prepareRestart(profile);
  if (!Number.isSafeInteger(epoch) || epoch <= 0) {
    throw new OneKeyLocalError('Unknown error');
  }
  return epoch;
}

export async function forceDisableTravelModeForRecovery(): Promise<void> {
  await getNativeModule().forceDisableForRecovery();
}

export async function acknowledgeTravelModeRuntimeLaunch({
  profile,
  runtime,
}: {
  profile: ITravelModeLaunchProfile;
  runtime: ITravelModeNativeRuntime;
}): Promise<ITravelModeLaunchAcknowledgement> {
  const nativeModule = getNativeModule();
  let status = parseStatus(
    await nativeModule.acknowledgeRuntimeLaunch(runtime, profile),
  );
  const initialResult = assertTerminalStatus(status);
  if (initialResult) {
    return initialResult;
  }
  const expectedEpoch = status.epoch;

  while (status.status === 'pending') {
    await waitForNextStatus(status.deadlineAt);
    status = parseStatus(await nativeModule.getLaunchStatus(expectedEpoch));
    const result = assertTerminalStatus(status, expectedEpoch);
    if (result) {
      return result;
    }
  }

  throw new OneKeyLocalError('Unknown error');
}
