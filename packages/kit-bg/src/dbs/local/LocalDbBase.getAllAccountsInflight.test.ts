import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';

import type { IDBAccount, ILocalDBGetAllRecordsParams } from './types';

const ACCOUNT = {
  id: "hd-1--m/44'/60'/0'/0/0",
  name: 'Account #1',
  type: 'simple',
  path: "m/44'/60'/0'/0/0",
  coinType: '60',
  impl: 'evm',
  address: '0x5618207d27d78f09f61a5d92190d58c453feb4b7',
  pub: '',
  template: '',
  indexedAccountId: 'hd-1--0',
  pathIndex: 0,
  relPath: '0/0',
} as unknown as IDBAccount;

class InflightTestLocalDb extends LocalDbBase {
  override readyDb = Promise.resolve(this as any);

  reads: string[] = [];

  override async reset(): Promise<void> {}

  override async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<any> {
    this.reads.push(params.name);
    // Simulate an asynchronous store read so concurrent callers overlap.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (params.name === ELocalDBStoreNames.Account) {
      return { records: [{ ...ACCOUNT }] };
    }
    return { records: [] };
  }
}

describe('LocalDbBase.getAllAccounts in-flight sharing', () => {
  it('reads the Account store once for concurrent cold calls', async () => {
    const db = new InflightTestLocalDb();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => db.getAllAccounts()),
    );

    expect(
      db.reads.filter((n) => n === ELocalDBStoreNames.Account),
    ).toHaveLength(1);
    results.forEach(({ accounts }) => {
      expect(accounts.map((a) => a.id)).toEqual([ACCOUNT.id]);
    });
  });

  it('gives each caller its own copy of the shared read', async () => {
    const db = new InflightTestLocalDb();

    const [first, second] = await Promise.all([
      db.getAllAccounts(),
      db.getAllAccounts(),
    ]);
    first.accounts[0].name = 'mutated';

    expect(second.accounts[0].name).toBe(ACCOUNT.name);
  });

  it('starts a fresh read after the cache is flushed mid-flight', async () => {
    const db = new InflightTestLocalDb();

    const pending = db.getAllAccounts();
    db.clearStoreCachedData();
    const afterFlush = db.getAllAccounts();
    await Promise.all([pending, afterFlush]);

    expect(
      db.reads.filter((n) => n === ELocalDBStoreNames.Account),
    ).toHaveLength(2);
  });

  it('does not repopulate the cache from a read that predates a flush', async () => {
    const db = new InflightTestLocalDb();

    const pending = db.getAllAccounts();
    db.clearStoreCachedData();
    await pending;
    // The pre-flush snapshot must not become the warm cache.
    await db.getAllAccounts();

    expect(
      db.reads.filter((n) => n === ELocalDBStoreNames.Account),
    ).toHaveLength(2);
  });

  it('gives the cold caller its own copy, not the cached objects', async () => {
    const db = new InflightTestLocalDb();

    const cold = await db.getAllAccounts();
    cold.accounts[0].name = 'mutated';
    const warm = await db.getAllAccounts();

    expect(warm.accounts[0].name).toBe(ACCOUNT.name);
  });

  it('serves a warm cache without touching the store', async () => {
    const db = new InflightTestLocalDb();

    await db.getAllAccounts();
    await db.getAllAccounts();

    expect(
      db.reads.filter((n) => n === ELocalDBStoreNames.Account),
    ).toHaveLength(1);
  });
});
