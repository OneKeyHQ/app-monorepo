import { IDBFactory } from 'fake-indexeddb';

import resetUtils from '../../utils/resetUtils';

import { getOrCreateCryptoKey } from './indexedDbCryptoKeyStore';

function buildDeferredCrypto() {
  let resolveGeneratedKey: ((key: CryptoKey) => void) | undefined;
  const generatedKey = new Promise<CryptoKey>((resolve) => {
    resolveGeneratedKey = resolve;
  });
  const generateKey = jest.fn(() => generatedKey);
  const cryptoGlobal = {
    getRandomValues: jest.fn(),
    subtle: {
      decrypt: jest.fn(),
      encrypt: jest.fn(),
      exportKey: jest.fn(),
      generateKey,
    },
  } as unknown as Crypto;
  return { cryptoGlobal, generateKey, resolveGeneratedKey };
}

describe('indexedDbCryptoKeyStore reset fence', () => {
  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
  });

  it('drains a key generation that entered before reset without recreating its database', async () => {
    const indexedDBInstance = new IDBFactory();
    const { cryptoGlobal, resolveGeneratedKey } = buildDeferredCrypto();
    const keyTask = getOrCreateCryptoKey({
      cryptoGlobal,
      dbName: 'reset-fenced-crypto-key',
      indexedDBInstance,
      keyRef: 'test-key',
    });
    const keyResult = keyTask.catch((error: unknown) => error as Error);

    resetUtils.startResetting();
    let drainSettled = false;
    const drain = resetUtils.waitForResetSensitiveTasksToSettle().then(() => {
      drainSettled = true;
    });
    await Promise.resolve();
    expect(drainSettled).toBe(false);

    resolveGeneratedKey?.({ type: 'secret' } as CryptoKey);

    await expect(keyResult).resolves.toThrow(
      'Operation crossed a reset boundary',
    );
    await drain;
    await expect(indexedDBInstance.databases()).resolves.toEqual([]);
  });

  it('rejects a new key writer while reset owns the runtime', async () => {
    const { cryptoGlobal, generateKey } = buildDeferredCrypto();
    resetUtils.startResetting();

    await expect(
      getOrCreateCryptoKey({
        cryptoGlobal,
        indexedDBInstance: new IDBFactory(),
        keyRef: 'test-key',
      }),
    ).rejects.toThrow('Cannot perform operation while resetting');
    expect(generateKey).not.toHaveBeenCalled();
  });
});
