import { isLocalWalletStorageUnsupportedError } from './storageSupport';

describe('local wallet storage support', () => {
  it('recognises the code however each runtime carries it', () => {
    expect(
      isLocalWalletStorageUnsupportedError({ code: 'STORAGE_UNSUPPORTED' }),
    ).toBe(true);
    // Zcash, after a carrier hop.
    expect(
      isLocalWalletStorageUnsupportedError({
        payload: { code: 'STORAGE_UNSUPPORTED' },
      }),
    ).toBe(true);
    // Monero.
    expect(
      isLocalWalletStorageUnsupportedError(
        new Error(
          JSON.stringify({
            code: 'STORAGE_UNSUPPORTED',
            params: { missing: 'getDirectory' },
          }),
        ),
      ),
    ).toBe(true);
  });

  it('ignores every other failure', () => {
    expect(
      isLocalWalletStorageUnsupportedError({ code: 'NOT_INITIALIZED' }),
    ).toBe(false);
    expect(isLocalWalletStorageUnsupportedError(new Error('boom'))).toBe(false);
    expect(isLocalWalletStorageUnsupportedError(undefined)).toBe(false);
  });
});
