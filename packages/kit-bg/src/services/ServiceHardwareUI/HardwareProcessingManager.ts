import { Semaphore } from 'async-mutex';

import { UserCancelFromOutside } from '@onekeyhq/shared/src/errors';

export class HardwareProcessingManager {
  private cancelCallbacks: Map<string, () => void> = new Map();

  private oneKeyOperationSemaphore = new Semaphore(1);

  runExclusiveOneKeyOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.oneKeyOperationSemaphore.runExclusive(operation);
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
