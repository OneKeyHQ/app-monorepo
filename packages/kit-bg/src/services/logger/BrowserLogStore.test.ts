import { IDBKeyRange as FakeKeyRange, IDBFactory } from 'fake-indexeddb';

import { BROWSER_LOG_DATABASE, BrowserLogDatabase } from './BrowserLogDatabase';
import { BROWSER_LOG_PENDING_BYTES, BrowserLogStore } from './BrowserLogStore';

import type { IBrowserLogDatabase } from './BrowserLogDatabase';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(maxBytes?: number) {
  const factory = new IDBFactory();
  const database = new BrowserLogDatabase(async () => factory, maxBytes);
  return { factory, database, store: new BrowserLogStore(database) };
}

function memoryDatabase() {
  const disk: string[] = [];
  const database = {
    append: jest.fn(async (messages: string[]) => {
      disk.push(...messages);
    }),
    snapshot: jest.fn(async () => new Blob(disk)),
    close: jest.fn(async () => {
      disk.length = 0;
    }),
  } satisfies IBrowserLogDatabase;
  return { database, disk, store: new BrowserLogStore(database) };
}

async function inspect(factory: IDBFactory) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(BROWSER_LOG_DATABASE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const result = await new Promise<{ bytes: number; count: number }>(
    (resolve, reject) => {
      const request = database
        .transaction('meta')
        .objectStore('meta')
        .get('state');
      request.onsuccess = () =>
        resolve(request.result as { bytes: number; count: number });
      request.onerror = () => reject(request.error);
    },
  );
  database.close();
  return result;
}

describe('browser diagnostic log persistence', () => {
  beforeAll(() => {
    globalThis.IDBKeyRange = FakeKeyRange;
  });
  afterEach(() => jest.restoreAllMocks());

  it('retains more than 1000 logs and restores chronological history without loading it on construction', async () => {
    const { factory, database, store } = fixture();
    for (let i = 0; i < 1500; i += 1) await store.add(`log-${i}\n`);
    await database.close();
    const reopened = new BrowserLogDatabase(async () => factory);
    const read = jest.spyOn(reopened, 'snapshot');
    const next = new BrowserLogStore(reopened);
    await next.add('after-restart\n');
    expect(read).not.toHaveBeenCalled();
    expect(await (await next.snapshot()).text()).toBe(
      `${Array.from({ length: 1500 }, (_, i) => `log-${i}\n`).join('')}after-restart\n`,
    );
    await next.stop();
  });

  it('prunes oldest batches atomically by UTF-8 byte budget rather than record count', async () => {
    const capacity = 128 * 1024;
    const { factory, database } = fixture(capacity);
    const text = `${'日志'.repeat(256)}\n`;
    for (let i = 0; i < 120; i += 1) await database.append([`${i}:${text}`]);
    const state = await inspect(factory);
    expect(state.bytes).toBeLessThanOrEqual(capacity);
    expect(state.count).toBeLessThan(120);
    const lines = (await (await database.snapshot()).text()).trim().split('\n');
    expect(lines[0]).not.toMatch(/^0:/);
    expect(lines.at(-1)).toMatch(/^119:/);
    expect(lines).toHaveLength(state.count);
    await database.close(true);
  });

  it('reads only recent ID windows and keeps complete UTF-8 lines within the byte budget', async () => {
    const { database } = fixture();
    const lines = Array.from({ length: 200 }, (_, i) => `${i}:日志🙂\r\n`);
    for (const line of lines) await database.append([line]);
    const expected = lines.slice(-5).join('');
    const budget = new TextEncoder().encode(expected).byteLength;
    const recent = await database.snapshot(budget + 1);
    expect(await recent.text()).toBe(expected);
    expect(recent.size).toBeLessThanOrEqual(budget + 1);
    expect(await (await database.snapshot()).text()).toBe(lines.join(''));
    await database.close(true);
  });

  it('shares the export budget with pending logs without filling a trimmed gap with older history', async () => {
    const { store, database, disk } = memoryDatabase();
    database.snapshot.mockImplementation(async (maxBytes = 0) => {
      const bytes = new TextEncoder().encode(disk.join(''));
      return new Blob([bytes.slice(Math.max(0, bytes.length - maxBytes))]);
    });
    await store.add('old\n');
    database.append.mockRejectedValue(new Error('Unavailable'));
    await store.add('pending\n');
    await store.add('last\n');
    expect(await (await store.snapshot(17)).text()).toBe(
      'old\npending\nlast\n',
    );
    expect(await (await store.snapshot(8)).text()).toBe('last\n');
    expect(database.snapshot).toHaveBeenLastCalledWith(0);
    await store.stop();
  });

  it('coalesces concurrent logs and completes old calls while later batches are still busy', async () => {
    const { database, store } = memoryDatabase();
    const firstGate = deferred();
    const entered = deferred();
    const secondGate = deferred();
    const secondEntered = deferred();
    database.append
      .mockImplementationOnce(async () => {
        entered.resolve();
        await firstGate.promise;
      })
      .mockImplementationOnce(async () => {
        secondEntered.resolve();
        await secondGate.promise;
      });
    const first = store.add('first');
    await entered.promise;
    const more = Array.from({ length: 200 }, (_, i) => store.add(`next-${i}`));
    firstGate.resolve();
    await secondEntered.promise;
    await first;
    expect(database.append).toHaveBeenCalledTimes(2);
    secondGate.resolve();
    await Promise.all(more);
    await store.stop();
  });

  it('preserves history after invalid accounting or chunks and resumes after repair', async () => {
    const { factory, database } = fixture(256);
    await database.append(['old\n']);
    const connection = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open(BROWSER_LOG_DATABASE);
      request.onsuccess = () => resolve(request.result);
    });
    const originalState = { nextId: 2, bytes: 132, count: 1 };
    const originalChunk = { id: 1, text: 'old\n', bytes: 132, count: 1 };
    const change = async (
      state: typeof originalState,
      chunk = originalChunk,
    ) => {
      const transaction = connection.transaction(
        ['chunks', 'meta'],
        'readwrite',
      );
      transaction.objectStore('meta').put(state, 'state');
      transaction.objectStore('chunks').put(chunk);
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
      });
    };
    await change({ ...originalState, bytes: Number.NaN });
    await expect(database.append(['new\n'])).rejects.toThrow('metadata');
    expect(await (await database.snapshot()).text()).toBe('old\n');
    await change(originalState, { ...originalChunk, bytes: Number.NaN });
    await expect(database.append(['new\n'])).rejects.toThrow('chunk');
    expect(await inspect(factory)).toEqual(originalState);
    await change(originalState);
    expect(await (await database.snapshot()).text()).toBe('old\n');
    await database.append(['new\n']);
    expect(await (await database.snapshot()).text()).toBe('new\n');
    connection.close();
    await database.close(true);
  });

  it('keeps a consistent export while writes continue and retention removes old chunks', async () => {
    const { database } = fixture(128 * 1024);
    await database.append(['before\n']);
    const snapshot = await database.snapshot();
    for (let i = 0; i < 4; i += 1)
      await database.append(['x'.repeat(60 * 1024)]);
    expect(await snapshot.text()).toBe('before\n');
    expect(await (await database.snapshot()).text()).not.toContain('before');
    await database.close(true);
  });

  it('bounds failed-write memory, retries the newest logs, and never duplicates a failed transaction', async () => {
    const { database, store } = memoryDatabase();
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    database.append.mockRejectedValueOnce(new Error('Quota exceeded'));
    await store.add('failed\n');
    for (let i = 0; i < 2000; i += 1)
      await store.add(`${i}:${'x'.repeat(2000)}\n`);
    const fallback = await store.snapshot();
    expect(fallback.size).toBeLessThanOrEqual(BROWSER_LOG_PENDING_BYTES);
    expect(await fallback.text()).not.toContain('failed');
    now += 1001;
    await store.add('recovered\n');
    const restored = await (await store.snapshot()).text();
    expect(restored.endsWith('recovered\n')).toBe(true);
    expect(restored.match(/recovered/g)).toHaveLength(1);
    await store.stop();
  });

  it('does not destroy old history after a failed initial open', async () => {
    const { factory, database } = fixture();
    await database.append(['old\n']);
    await database.close();
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const getFactory = jest
      .fn(async () => factory)
      .mockRejectedValueOnce(new Error('Unavailable'));
    const next = new BrowserLogStore(new BrowserLogDatabase(getFactory));
    await next.add('new\n');
    now += 1001;
    await next.add('recovered\n');
    expect(await (await next.snapshot()).text()).toBe('old\nnew\nrecovered\n');
    await next.stop();
  });

  it('does not acknowledge or retain an aborted transaction and can retry it', async () => {
    const { factory, database, store } = fixture();
    await store.add('old\n');
    const original = factory.open.bind(factory);
    // Open another connection and abort the next transaction after its first successful request.
    const connection = await new Promise<IDBDatabase>((resolve) => {
      const request = original(BROWSER_LOG_DATABASE);
      request.onsuccess = () => resolve(request.result);
    });
    const prototype = Object.getPrototypeOf(connection) as IDBDatabase;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Applied with the original receiver below.
    const transaction = prototype.transaction;
    let aborted = false;
    const spy = jest
      .spyOn(prototype, 'transaction')
      .mockImplementation(function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase['transaction']>
      ) {
        const tx = transaction.apply(this, args);
        if (!aborted && args[1] === 'readwrite') {
          aborted = true;
          queueMicrotask(() => tx.abort());
        }
        return tx;
      });
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await store.add('retry\n');
    spy.mockRestore();
    expect(await (await database.snapshot()).text()).toBe('old\n');
    now += 1001;
    await store.add('last\n');
    expect(await (await database.snapshot()).text()).toBe('old\nretry\nlast\n');
    connection.close();
    await store.stop();
  });

  it('waits for a slow open, prevents late writes, and explicitly deletes the log database during reset', async () => {
    const factory = new IDBFactory();
    const gate = deferred();
    const entered = deferred();
    const database = new BrowserLogDatabase(async () => {
      entered.resolve();
      await gate.promise;
      return factory;
    });
    const store = new BrowserLogStore(database);
    const write = store.add('in-flight');
    await entered.promise;
    const stop = store.stop();
    await store.add('after-reset');
    gate.resolve();
    await Promise.all([write, stop]);
    expect(await factory.databases()).toEqual([]);
    expect((await store.snapshot()).size).toBe(0);
  });

  it('invalidates a snapshot still being prepared during reset', async () => {
    const { store, database } = memoryDatabase();
    const gate = deferred();
    const entered = deferred();
    database.snapshot.mockImplementationOnce(async () => {
      entered.resolve();
      await gate.promise;
      return new Blob(['old']);
    });
    const snapshot = store.snapshot();
    await entered.promise;
    const stopped = store.stop();
    gate.resolve();
    expect((await snapshot).size).toBe(0);
    await stopped;
    expect(database.close).toHaveBeenCalledWith(true);
  });

  it('does not persist empty messages and truncates oversized input', async () => {
    const { store, disk } = memoryDatabase();
    await store.add('');
    await store.add('x'.repeat(10_000));
    expect(disk).toHaveLength(1);
    expect(disk[0].length).toBeLessThanOrEqual(2048);
    expect(disk[0]).toContain('...(truncated)');
    await store.stop();
  });
});
