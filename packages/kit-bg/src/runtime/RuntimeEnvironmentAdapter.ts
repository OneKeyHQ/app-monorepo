/* eslint-disable max-classes-per-file */
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEffectCapability } from '@onekeyhq/shared/src/travelMode';

type IRuntimeOperation<T> = {
  onUnavailable: () => T | Promise<T>;
  operation: () => Promise<T>;
};

type IRuntimeSyncOperation<T> = {
  onUnavailable: () => T;
  operation: () => T;
};

class RuntimePersistenceAdapter {
  isUnavailable(): boolean {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.runSync({
      operation: () => false,
      onBlocked: () => true,
    });
  }

  run<T>({ operation, onUnavailable }: IRuntimeOperation<T>): Promise<T> {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation,
      onBlocked: onUnavailable,
    });
  }
}

class RuntimeEffectAdapter {
  constructor(private readonly selectEffect: () => IRuntimeEffectCapability) {}

  isSuppressed(): boolean {
    return this.selectEffect().isSuppressed;
  }

  run<T>({ operation, onUnavailable }: IRuntimeOperation<T>): Promise<T> {
    return this.selectEffect().run({
      operation,
      onBlocked: onUnavailable,
    });
  }

  runOrReject<T>(operation: () => Promise<T>): Promise<T> {
    return this.selectEffect().runOrReject(operation);
  }

  runSync<T>({ operation, onUnavailable }: IRuntimeSyncOperation<T>): T {
    return this.selectEffect().runSync({
      operation,
      onBlocked: onUnavailable,
    });
  }
}

export const runtimePersistenceAdapter = new RuntimePersistenceAdapter();

export const runtimeWalletEffectAdapter = new RuntimeEffectAdapter(
  () => travelModeManager.getRuntimeEnvironmentSync().walletEffects,
);
