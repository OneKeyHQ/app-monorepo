import { E_ALREADY_LOCKED, Semaphore, tryAcquire } from 'async-mutex';

import { UserCancelFromOutside } from '@onekeyhq/shared/src/errors';

export type IOneKeyHardwareOperationLease = {
  readonly deviceKey: string | undefined;
  readonly owner: symbol;
  readonly signal?: AbortSignal;
};

export type ITryRunExclusiveOneKeyOperationResult<T> =
  | {
      acquired: true;
      result: T;
    }
  | {
      acquired: false;
    };

export class HardwareProcessingManager {
  private cancelCallbacks: Map<string, () => void> = new Map();

  private oneKeyOperationSemaphore = new Semaphore(1);

  private activeOneKeyOperationLease: IOneKeyHardwareOperationLease | undefined;

  private activeAbortController: AbortController | undefined;

  private activeCleanup: Promise<void> | undefined;

  getActiveOneKeyOperationLease() {
    return this.activeOneKeyOperationLease;
  }

  cancelOneKeyOperation(lease: IOneKeyHardwareOperationLease) {
    if (lease === this.activeOneKeyOperationLease) {
      this.activeAbortController?.abort();
    }
  }

  runOneKeyOperationCleanup(
    lease: IOneKeyHardwareOperationLease,
    cleanup: () => Promise<void>,
  ) {
    if (lease !== this.activeOneKeyOperationLease) return Promise.resolve();
    this.activeCleanup ??= Promise.resolve().then(cleanup);
    return this.activeCleanup;
  }

  private async runWithNewOneKeyOperationLease<T>({
    deviceKey,
    operation,
  }: {
    deviceKey?: string;
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>;
  }): Promise<T> {
    const controller = new AbortController();
    const acquiredLease: IOneKeyHardwareOperationLease = Object.freeze({
      deviceKey,
      owner: Symbol('onekey-hardware-operation'),
      signal: controller.signal,
    });
    this.activeOneKeyOperationLease = acquiredLease;
    this.activeAbortController = controller;
    try {
      return await operation(acquiredLease);
    } finally {
      try {
        // Dispatch cancellation before handing the lease to the next caller.
        // The SDK then waits for the old device request to drain before acquire.
        await this.activeCleanup;
      } finally {
        if (this.activeOneKeyOperationLease === acquiredLease) {
          this.activeOneKeyOperationLease = undefined;
          this.activeAbortController = undefined;
          this.activeCleanup = undefined;
        }
      }
    }
  }

  runExclusiveOneKeyOperation<T>({
    deviceKey,
    lease,
    operation,
  }: {
    deviceKey?: string;
    lease?: IOneKeyHardwareOperationLease;
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>;
  }): Promise<T> {
    if (lease && lease === this.activeOneKeyOperationLease) {
      if (lease.signal?.aborted)
        return Promise.reject(new UserCancelFromOutside());
      return operation(lease);
    }

    return this.oneKeyOperationSemaphore.runExclusive(() =>
      this.runWithNewOneKeyOperationLease({
        deviceKey,
        operation,
      }),
    );
  }

  async tryRunExclusiveOneKeyOperation<T>({
    deviceKey,
    lease,
    operation,
  }: {
    deviceKey?: string;
    lease?: IOneKeyHardwareOperationLease;
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>;
  }): Promise<ITryRunExclusiveOneKeyOperationResult<T>> {
    if (lease && lease === this.activeOneKeyOperationLease) {
      if (lease.signal?.aborted) throw new UserCancelFromOutside();
      return {
        acquired: true,
        result: await operation(lease),
      };
    }

    let release: (() => void) | undefined;
    try {
      [, release] = await tryAcquire(this.oneKeyOperationSemaphore).acquire();
    } catch (error) {
      if (error === E_ALREADY_LOCKED) {
        return { acquired: false };
      }
      throw error;
    }

    try {
      return {
        acquired: true,
        result: await this.runWithNewOneKeyOperationLease({
          deviceKey,
          operation,
        }),
      };
    } finally {
      release();
    }
  }

  registerCancelCallback(connectId: string, callback: () => void) {
    this.cancelCallbacks.set(connectId, callback);
  }

  unregisterCancelCallback(connectId: string) {
    this.cancelCallbacks.delete(connectId);
  }

  cancelOperation(connectId: string) {
    const callback = this.cancelCallbacks.get(connectId);
    if (callback) {
      callback();
      this.unregisterCancelCallback(connectId);
    }
  }

  cancelableFn<T>(connectId: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cancelCallback = () => {
        reject(new UserCancelFromOutside());
      };

      this.registerCancelCallback(connectId, cancelCallback);
      void fn()
        .then((result) => {
          resolve(result);
        })
        .then((error) => {
          reject(error);
        })
        .finally(() => {
          this.unregisterCancelCallback(connectId);
        });
    });
  }

  cancelableDelay(connectId: string, ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unregisterCancelCallback(connectId);
        resolve();
      }, ms);

      const cancelCallback = () => {
        clearTimeout(timer);
        reject(new UserCancelFromOutside());
      };

      this.registerCancelCallback(connectId, cancelCallback);
    });
  }
}
