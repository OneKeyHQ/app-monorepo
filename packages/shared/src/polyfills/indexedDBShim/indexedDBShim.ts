import appGlobals from '../../appGlobals';
import { EAppEventBusNames } from '../../eventBus/appEventBusNames';

const diskFullErrorMessage = `Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.`;

// @ts-ignore
globalThis.IDBDatabase.prototype.transactionOriginal_a7c9d6a9 =
  // eslint-disable-next-line @typescript-eslint/unbound-method
  globalThis.IDBDatabase.prototype.transaction;
globalThis.IDBDatabase.prototype.transaction = function (
  storeNames: string | string[],
  mode?: IDBTransactionMode,
  options?: IDBTransactionOptions,
) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;
  try {
    const isWriteMode = mode !== 'readonly';
    if (isWriteMode && globalThis.$onekeySystemDiskIsFull) {
      console.error('IndexedDB==>checkDiskFull ', self, {
        name: self.name,
        storeNames,
        mode,
        options,
      });

      appGlobals?.$appEventBus?.emit(
        EAppEventBusNames.ShowSystemDiskFullWarning,
        undefined,
      );
      // TODO use custom Error
      throw new Error(diskFullErrorMessage);
    }
    const tx =
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      globalThis.IDBDatabase.prototype.transactionOriginal_a7c9d6a9.apply(
        // @ts-ignore
        self,
        // @ts-ignore
        // eslint-disable-next-line prefer-rest-params
        arguments,
      );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return tx;
  } catch (error) {
    const err = error as Error | undefined;
    if (err?.message === diskFullErrorMessage) {
      globalThis.$onekeySystemDiskIsFull = true;
      appGlobals?.$appEventBus?.emit(
        EAppEventBusNames.ShowSystemDiskFullWarning,
        undefined,
      );
    }
    throw error;
  }
};
