// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
import storageChecker from '../../storageChecker/storageChecker';

// @ts-ignore
if (!globalThis.IDBDatabase.prototype.transactionOriginal_a7c9d6a9) {
  // @ts-ignore
  globalThis.IDBDatabase.prototype.transactionOriginal_a7c9d6a9 =
    // eslint-disable-next-line @typescript-eslint/unbound-method
    globalThis.IDBDatabase.prototype.transaction;
  globalThis.IDBDatabase.prototype.transaction = function (
    storeNames: string | string[],
    mode?: IDBTransactionMode,
    // Kept to mirror the native signature; forwarding happens via `arguments`.
    _options?: IDBTransactionOptions,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    try {
      const isWriteMode = mode !== 'readonly';
      if (isWriteMode) {
        // Measurement only. The blocking guard lives in
        // `IndexedDBPromised.createBucketTransaction`, which is OneKey's own
        // choke point and can tell a space-consuming write apart from a
        // space-freeing delete. Throwing here blocked deletes too, so a raised
        // guard also destroyed the only way out of a full disk.
        void storageChecker.checkIfDiskIsFullDebounced();
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
      storageChecker.handleDiskFullError(error);
      throw error;
    }
  };
}
