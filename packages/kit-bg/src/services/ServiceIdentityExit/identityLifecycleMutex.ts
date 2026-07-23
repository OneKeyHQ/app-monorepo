import { Semaphore } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Serializes identity lifecycle commits that may replace or remove OneKey ID
 * and Keyless authentication state. Network-only OAuth work happens outside
 * this mutex; the final persistence/commit and destructive exits run inside.
 */
const identityLifecycleSemaphore = new Semaphore(1);

type IIdentityRecoveryState = 'pending' | 'ready' | 'failed';

const BOOTSTRAP_RECOVERY_OPERATION_ID = 'identityRecovery:bootstrap';
const pendingIdentityRecoveryOperationIds = new Set<string>(
  platformEnv.isJest ? [] : [BOOTSTRAP_RECOVERY_OPERATION_ID],
);
const failedIdentityRecoveryOperationIds = new Set<string>();
let identityRecoveryState: IIdentityRecoveryState =
  pendingIdentityRecoveryOperationIds.size > 0 ? 'pending' : 'ready';
let resolveIdentityRecovery: (() => void) | undefined;
let identityRecoveryPromise =
  identityRecoveryState === 'ready'
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        resolveIdentityRecovery = resolve;
      });

function transitionIdentityRecoveryState(
  nextState: IIdentityRecoveryState,
): void {
  if (identityRecoveryState === nextState) {
    return;
  }
  identityRecoveryState = nextState;
  if (nextState === 'pending') {
    identityRecoveryPromise = new Promise<void>((resolve) => {
      resolveIdentityRecovery = resolve;
    });
    return;
  }
  resolveIdentityRecovery?.();
  resolveIdentityRecovery = undefined;
}

function refreshIdentityRecoveryState(): void {
  if (failedIdentityRecoveryOperationIds.size > 0) {
    transitionIdentityRecoveryState('failed');
  } else if (pendingIdentityRecoveryOperationIds.size > 0) {
    transitionIdentityRecoveryState('pending');
  } else {
    transitionIdentityRecoveryState('ready');
  }
}

export function markIdentityRecoveryReady(
  operationId = BOOTSTRAP_RECOVERY_OPERATION_ID,
): void {
  pendingIdentityRecoveryOperationIds.delete(operationId);
  failedIdentityRecoveryOperationIds.delete(operationId);
  refreshIdentityRecoveryState();
}

export function markIdentityRecoveryPending(operationId: string): void {
  failedIdentityRecoveryOperationIds.delete(operationId);
  pendingIdentityRecoveryOperationIds.add(operationId);
  refreshIdentityRecoveryState();
}

export function markIdentityRecoveryFailed(
  operationId = BOOTSTRAP_RECOVERY_OPERATION_ID,
): void {
  pendingIdentityRecoveryOperationIds.delete(operationId);
  failedIdentityRecoveryOperationIds.add(operationId);
  refreshIdentityRecoveryState();
}

export function isIdentityRecoveryReady(): boolean {
  return identityRecoveryState === 'ready';
}

export async function waitForIdentityMutationReady(): Promise<void> {
  for (;;) {
    const currentRecoveryPromise = identityRecoveryPromise;
    await currentRecoveryPromise;
    if (identityRecoveryState === 'ready') {
      return;
    }
    if (identityRecoveryState === 'failed') {
      // TODO: i18n
      throw new OneKeyLocalError(
        'Identity recovery did not complete. Restart the app before changing OneKey ID or Keyless state.',
      );
    }
  }
}

export function resetIdentityRecoveryStateForTest(
  state: IIdentityRecoveryState,
): void {
  if (!platformEnv.isJest) {
    throw new OneKeyLocalError(
      'Identity recovery state can only be reset in tests.',
    );
  }
  pendingIdentityRecoveryOperationIds.clear();
  failedIdentityRecoveryOperationIds.clear();
  if (state === 'pending') {
    pendingIdentityRecoveryOperationIds.add(BOOTSTRAP_RECOVERY_OPERATION_ID);
  } else if (state === 'failed') {
    failedIdentityRecoveryOperationIds.add(BOOTSTRAP_RECOVERY_OPERATION_ID);
  }
  identityRecoveryState = state;
  resolveIdentityRecovery = undefined;
  if (state === 'pending') {
    identityRecoveryPromise = new Promise<void>((resolve) => {
      resolveIdentityRecovery = resolve;
    });
  } else {
    identityRecoveryPromise = Promise.resolve();
  }
}

async function runIdentityLifecycleAttempt<T>(
  callback: () => Promise<T> | T,
): Promise<{ status: 'completed'; value: T } | { status: 'retry' }> {
  return identityLifecycleSemaphore.runExclusive(async () => {
    if (identityRecoveryState !== 'ready') {
      return { status: 'retry' } as const;
    }
    return { status: 'completed', value: await callback() } as const;
  });
}

export const identityLifecycleMutex = {
  async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
    for (;;) {
      await waitForIdentityMutationReady();
      const result = await runIdentityLifecycleAttempt(callback);
      if (result.status === 'completed') {
        return result.value;
      }
    }
  },

  async runExclusiveForRecovery<T>(callback: () => Promise<T> | T): Promise<T> {
    return identityLifecycleSemaphore.runExclusive(callback);
  },

  async waitForUnlock(): Promise<void> {
    for (;;) {
      await waitForIdentityMutationReady();
      await identityLifecycleSemaphore.waitForUnlock();
      if (identityRecoveryState === 'ready') {
        return;
      }
    }
  },
};

let activeIdentityExitOperationId: string | undefined;

export function beginIdentityExitReservation(operationId: string): void {
  activeIdentityExitOperationId = operationId;
}

export function endIdentityExitReservation(operationId: string): void {
  if (activeIdentityExitOperationId === operationId) {
    activeIdentityExitOperationId = undefined;
  }
}

export function getActiveIdentityExitOperationId(): string | undefined {
  return activeIdentityExitOperationId;
}
