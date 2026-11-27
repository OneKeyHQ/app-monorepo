import { IndexedDBPromised } from './IndexedDBPromised';

function createFakeDB() {
  const listeners = new Map<string, (() => void)[]>();
  const fakeDB = {
    close: jest.fn(),
    addEventListener: jest.fn((type: string, listener: () => void) => {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    }),
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
  };
  return fakeDB;
}

function createFakeFactory(db: ReturnType<typeof createFakeDB>) {
  const open = jest.fn(() => {
    const req: {
      result: unknown;
      onsuccess: ((ev: { target: unknown }) => void) | null;
      onerror: ((ev: { target: unknown }) => void) | null;
      onupgradeneeded: ((ev: unknown) => void) | null;
    } = {
      result: db,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => {
      req.onsuccess?.({ target: req });
    });
    return req;
  });
  return {
    factory: { open } as unknown as IDBFactory,
    open,
  };
}

describe('IndexedDBPromised bucket invalidation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops nativeDBFactory when a connection closes so reopen fetches a fresh bucket', async () => {
    const firstDB = createFakeDB();
    const secondDB = createFakeDB();
    const first = createFakeFactory(firstDB);
    const second = createFakeFactory(secondDB);

    const getFactorySpy = jest
      .spyOn(IndexedDBPromised, 'getBucketIndexedDBFactory')
      .mockResolvedValueOnce(first.factory)
      .mockResolvedValueOnce(second.factory);

    const db = new IndexedDBPromised({
      name: 'onekey-ui-snapshot',
      bucketName: 'onekey-ui-snapshot',
      version: 1,
    });

    await expect(db.open()).resolves.toBe(firstDB);
    expect(getFactorySpy).toHaveBeenCalledTimes(1);

    // Simulate browser closing the connection after Storage Bucket deletion.
    firstDB.emit('close');

    await expect(db.open()).resolves.toBe(secondDB);
    expect(getFactorySpy).toHaveBeenCalledTimes(2);
    expect(second.open).toHaveBeenCalledTimes(1);
  });
});
