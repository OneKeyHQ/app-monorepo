import { IDBKeyRange as FakeKeyRange, IDBFactory } from 'fake-indexeddb';

import {
  BROWSER_LOG_BUCKET,
  BROWSER_LOG_DATABASE,
  BrowserLogDatabase,
} from './BrowserLogDatabase';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

describe('diagnostic log storage isolation', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );
  const originalIndexedDB = Object.getOwnPropertyDescriptor(
    globalThis,
    'indexedDB',
  );

  beforeEach(() => {
    globalThis.IDBKeyRange = FakeKeyRange;
  });
  afterEach(() => {
    if (originalNavigator)
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalIndexedDB)
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('stores logs in their own bucket and never opens the default IndexedDB factory', async () => {
    const isolated = new IDBFactory();
    const fallback = new IDBFactory();
    const open = jest.fn(async () => ({ indexedDB: isolated }));
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storageBuckets: { open } },
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: fallback,
    });
    const database = new BrowserLogDatabase();
    await Promise.all([
      database.append(['first']),
      database.append(['second']),
    ]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(BROWSER_LOG_BUCKET, {
      durability: 'strict',
      persisted: true,
    });
    expect(await fallback.databases()).toEqual([]);
    expect(await isolated.databases()).toEqual([
      { name: BROWSER_LOG_DATABASE, version: 1 },
    ]);
    await database.close(true);
    expect(await isolated.databases()).toEqual([]);
  });

  it('uses a separately named database only when the bucket API is unsupported', async () => {
    const fallback = new IDBFactory();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: fallback,
    });
    const database = new BrowserLogDatabase();
    await database.append(['fallback']);
    expect(await fallback.databases()).toEqual([
      { name: BROWSER_LOG_DATABASE, version: 1 },
    ]);
    await database.close(true);
  });

  it('does not fork history into default storage when opening the bucket fails', async () => {
    const fallback = new IDBFactory();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        storageBuckets: {
          open: jest.fn().mockRejectedValue(new Error('Unavailable')),
        },
      },
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: fallback,
    });
    const database = new BrowserLogDatabase();
    await expect(database.append(['pending'])).rejects.toThrow('Unavailable');
    expect(await fallback.databases()).toEqual([]);
    await database.close();
  });

  it('serializes independent tab connections without overwriting records or metadata', async () => {
    const factory = new IDBFactory();
    const tabs = [
      new BrowserLogDatabase(async () => factory),
      new BrowserLogDatabase(async () => factory),
    ];
    await Promise.all(
      tabs.map(async (database, tab) => {
        for (let i = 0; i < 600; i += 1)
          await database.append([`tab-${tab}-${i}\n`]);
      }),
    );
    const lines = (await (await tabs[0].snapshot()).text()).trim().split('\n');
    expect(lines).toHaveLength(1200);
    expect(new Set(lines).size).toBe(1200);
    for (let tab = 0; tab < tabs.length; tab += 1) {
      expect(lines.filter((line) => line.startsWith(`tab-${tab}-`))).toEqual(
        Array.from({ length: 600 }, (_, i) => `tab-${tab}-${i}`),
      );
    }
    await tabs[1].close();
    await tabs[0].close(true);
  });

  it('never reopens a connection deleted by another tab', async () => {
    const factory = new IDBFactory();
    const first = new BrowserLogDatabase(async () => factory);
    const second = new BrowserLogDatabase(async () => factory);
    await first.append(['first\n']);
    await second.append(['second\n']);
    await first.close(true);
    await expect(second.append(['stale\n'])).rejects.toThrow('closed');
    expect(await factory.databases()).toEqual([]);
    await second.close();
  });
});
