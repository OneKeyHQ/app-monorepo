/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/sdk/sparkStorage.test.ts

Web, desktop and the extension keep Breez wallets in IndexedDB, one database
per identity under `<storageDir>/<network>/` plus its `-tree` database.
*/
import { removeSparkStorage } from './sparkStorage';

type IDeleteOutcome = 'success' | 'blocked' | 'error';

function installIndexedDb({
  names,
  outcome = () => 'success',
  withDatabaseList = true,
}: {
  names: string[];
  outcome?: (name: string) => IDeleteOutcome;
  withDatabaseList?: boolean;
}) {
  const deleted: string[] = [];
  const indexedDB = {
    databases: withDatabaseList
      ? jest.fn(async () => names.map((name) => ({ name, version: 1 })))
      : undefined,
    deleteDatabase: jest.fn((name: string) => {
      deleted.push(name);
      const request: {
        error: Error | null;
        onsuccess?: () => void;
        onerror?: () => void;
        onblocked?: () => void;
      } = { error: null };
      setTimeout(() => {
        const result = outcome(name);
        if (result === 'error') {
          request.error = new Error(`cannot delete ${name}`);
          request.onerror?.();
        } else if (result === 'blocked') {
          request.onblocked?.();
        } else {
          request.onsuccess?.();
        }
      }, 0);
      return request;
    }),
  };
  Object.defineProperty(globalThis, 'indexedDB', {
    value: indexedDB,
    configurable: true,
    writable: true,
  });
  return { indexedDB, deleted };
}

const WALLET_1 = 'onekey-breez-mainnet-hd-1';

describe('removeSparkStorage (IndexedDB)', () => {
  const original = globalThis.indexedDB;

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it("deletes a wallet's databases and keeps every other database", async () => {
    const { deleted } = installIndexedDb({
      names: [
        `${WALLET_1}/mainnet/0b5a7fdb`,
        `${WALLET_1}/mainnet/0b5a7fdb-tree`,
        'onekey-breez-mainnet-hd-10/mainnet/1c2d3e4f',
        'onekey-breez-regtest-hd-1/regtest/5a6b7c8d',
        'OneKeyV5-settings',
      ],
    });

    await removeSparkStorage((storageDir) => storageDir === WALLET_1);

    expect(deleted).toEqual([
      `${WALLET_1}/mainnet/0b5a7fdb`,
      `${WALLET_1}/mainnet/0b5a7fdb-tree`,
    ]);
  });

  it('finishes when another tab still holds a database open', async () => {
    const { deleted } = installIndexedDb({
      names: [`${WALLET_1}/mainnet/0b5a7fdb`],
      outcome: () => 'blocked',
    });

    await expect(
      removeSparkStorage((storageDir) => storageDir === WALLET_1),
    ).resolves.toBeUndefined();
    expect(deleted).toEqual([`${WALLET_1}/mainnet/0b5a7fdb`]);
  });

  it('reports a database that cannot be deleted', async () => {
    installIndexedDb({
      names: [`${WALLET_1}/mainnet/0b5a7fdb`],
      outcome: () => 'error',
    });

    await expect(
      removeSparkStorage((storageDir) => storageDir === WALLET_1),
    ).rejects.toThrow(`cannot delete ${WALLET_1}/mainnet/0b5a7fdb`);
  });

  it('does nothing without a database list', async () => {
    const { indexedDB } = installIndexedDb({
      names: [`${WALLET_1}/mainnet/0b5a7fdb`],
      withDatabaseList: false,
    });

    await removeSparkStorage(() => true);

    expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
  });
});
