/* eslint-disable unicorn/prefer-global-this */
import storageChecker from '../../storageChecker/storageChecker';

// @ts-ignore
if (!global.IDBDatabase.prototype.transactionOriginal_a7c9d6a9) {
  // @ts-ignore
  global.IDBDatabase.prototype.transactionOriginal_a7c9d6a9 =
    // eslint-disable-next-line @typescript-eslint/unbound-method
    global.IDBDatabase.prototype.transaction;
  global.IDBDatabase.prototype.transaction = function (
    storeNames: string | string[],
    mode?: IDBTransactionMode,
    options?: IDBTransactionOptions,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    try {
      const isWriteMode = mode !== 'readonly';
      if (isWriteMode && global.$onekeySystemDiskIsFull) {
        console.error('IndexedDB==>checkDiskFull ', self, {
          name: self.name,
          storeNames,
          mode,
          options,
        });
      }
      if (isWriteMode) {
        storageChecker.checkIfDiskIsFullSync();
        void storageChecker.checkIfDiskIsFullDebounced();
      }
      const tx =
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        global.IDBDatabase.prototype.transactionOriginal_a7c9d6a9.apply(
          // @ts-ignore
          self,
          // @ts-ignore
          // eslint-disable-next-line prefer-rest-params
          arguments,
        );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return tx;
    } catch (error) {
      storageChecker.handleDiskFullError(error);
      throw error;
    }
  };
}
