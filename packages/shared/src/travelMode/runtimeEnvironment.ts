/* eslint-disable max-classes-per-file */
import { OneKeyLocalError } from '../errors';
import timerUtils from '../utils/timerUtils';

import type { ITravelModeRuntimeProfile } from './runtimeProfile';

type IRuntimeAdapterFactories<T> = Readonly<{
  masked: () => T;
  real: () => T;
}>;

type IRuntimeOperation<T> = Readonly<{
  onBlocked: () => T | Promise<T>;
  operation: () => Promise<T>;
}>;

type IRuntimeSyncOperation<T> = Readonly<{
  onBlocked: () => T;
  operation: () => T;
}>;

export type IRuntimeEnvironmentBarrier = Readonly<{
  isBlockedSync: () => boolean;
  runProtectedOperation: <T>(operation: IRuntimeOperation<T>) => Promise<T>;
}>;

export interface IRuntimePersistenceCapability {
  readonly kind: 'masked' | 'real';
  createAdapter<T>(factories: IRuntimeAdapterFactories<T>): T;
  run<T>(operation: IRuntimeOperation<T>): Promise<T>;
  runSync<T>(operation: IRuntimeSyncOperation<T>): T;
}

export interface IRuntimeEffectCapability {
  readonly kind: 'enabled' | 'suppressed';
  readonly isSuppressed: boolean;
  run<T>(operation: IRuntimeOperation<T>): Promise<T>;
  runOrReject<T>(operation: () => Promise<T>): Promise<T>;
  runSync<T>(operation: IRuntimeSyncOperation<T>): T;
}

export interface IRuntimeCommandCapability {
  readonly kind: 'allowed' | 'control-plane-only';
  readonly isBlocked: boolean;
  run<T>(operation: () => Promise<T>): Promise<T>;
  runWithBlockedResult<T>(operation: IRuntimeOperation<T>): Promise<T>;
}

export type IRuntimeEnvironment = Readonly<{
  commands: IRuntimeCommandCapability;
  dappRequests: IRuntimeCommandCapability;
  notifications: IRuntimeEffectCapability;
  persistence: IRuntimePersistenceCapability;
  profile: ITravelModeRuntimeProfile;
  walletEffects: IRuntimeEffectCapability;
}>;

export const TRAVEL_MODE_GATE_REJECTION_DELAY_MS = 600;

export async function runAfterTravelModeGateDelay<T>(
  onBlocked: () => T | Promise<T>,
): Promise<T> {
  await timerUtils.wait(TRAVEL_MODE_GATE_REJECTION_DELAY_MS);
  return onBlocked();
}

export async function rejectTravelModeUnknownError(): Promise<never> {
  return runAfterTravelModeGateDelay(() => {
    throw new OneKeyLocalError('Unknown error');
  });
}

class RuntimePersistenceCapability implements IRuntimePersistenceCapability {
  readonly kind: 'masked' | 'real';

  constructor(
    kind: 'masked' | 'real',
    private readonly barrier: IRuntimeEnvironmentBarrier,
  ) {
    this.kind = kind;
  }

  createAdapter<T>({ masked, real }: IRuntimeAdapterFactories<T>): T {
    return this.kind === 'real' && !this.barrier.isBlockedSync()
      ? real()
      : masked();
  }

  run<T>({ operation, onBlocked }: IRuntimeOperation<T>): Promise<T> {
    if (this.kind === 'masked') {
      return Promise.resolve(onBlocked());
    }
    return this.barrier.runProtectedOperation({ operation, onBlocked });
  }

  runSync<T>({ operation, onBlocked }: IRuntimeSyncOperation<T>): T {
    if (this.kind === 'masked' || this.barrier.isBlockedSync()) {
      return onBlocked();
    }
    return operation();
  }
}

class RuntimeEffectCapability implements IRuntimeEffectCapability {
  readonly kind: 'enabled' | 'suppressed';

  constructor(
    kind: 'enabled' | 'suppressed',
    private readonly barrier: IRuntimeEnvironmentBarrier,
  ) {
    this.kind = kind;
  }

  get isSuppressed(): boolean {
    return this.kind === 'suppressed' || this.barrier.isBlockedSync();
  }

  run<T>({ operation, onBlocked }: IRuntimeOperation<T>): Promise<T> {
    if (this.isSuppressed) {
      return Promise.resolve(onBlocked());
    }
    return this.barrier.runProtectedOperation({ operation, onBlocked });
  }

  runOrReject<T>(operation: () => Promise<T>): Promise<T> {
    return this.run({ operation, onBlocked: rejectTravelModeUnknownError });
  }

  runSync<T>({ operation, onBlocked }: IRuntimeSyncOperation<T>): T {
    if (this.isSuppressed) {
      return onBlocked();
    }
    return operation();
  }
}

class RuntimeCommandCapability implements IRuntimeCommandCapability {
  readonly kind: 'allowed' | 'control-plane-only';

  constructor(
    kind: 'allowed' | 'control-plane-only',
    private readonly barrier: IRuntimeEnvironmentBarrier,
  ) {
    this.kind = kind;
  }

  get isBlocked(): boolean {
    return this.kind === 'control-plane-only' || this.barrier.isBlockedSync();
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    return this.runWithBlockedResult({
      operation,
      onBlocked: rejectTravelModeUnknownError,
    });
  }

  async runWithBlockedResult<T>({
    operation,
    onBlocked,
  }: IRuntimeOperation<T>): Promise<T> {
    if (this.isBlocked) {
      return onBlocked();
    }
    return this.barrier.runProtectedOperation({
      operation,
      onBlocked,
    });
  }
}

export class RuntimeEnvironment {
  static create(
    profile: ITravelModeRuntimeProfile,
    barrier: IRuntimeEnvironmentBarrier,
  ): IRuntimeEnvironment {
    const persistence = new RuntimePersistenceCapability(
      profile.persistence,
      barrier,
    );
    const walletEffects = new RuntimeEffectCapability(
      profile.walletEffects === 'enabled' ? 'enabled' : 'suppressed',
      barrier,
    );
    const notifications = new RuntimeEffectCapability(
      profile.walletEffects === 'enabled' ? 'enabled' : 'suppressed',
      barrier,
    );
    const commands = new RuntimeCommandCapability(
      profile.kind === 'standard' ? 'allowed' : 'control-plane-only',
      barrier,
    );
    const dappRequests = new RuntimeCommandCapability(
      profile.dappRequests === 'allowed' ? 'allowed' : 'control-plane-only',
      barrier,
    );

    Object.freeze(persistence);
    Object.freeze(walletEffects);
    Object.freeze(notifications);
    Object.freeze(commands);
    Object.freeze(dappRequests);

    return Object.freeze({
      commands,
      dappRequests,
      notifications,
      persistence,
      profile,
      walletEffects,
    });
  }
}
