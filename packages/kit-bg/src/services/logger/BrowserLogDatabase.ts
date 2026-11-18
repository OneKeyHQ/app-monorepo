import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { BROWSER_LOG_MAX_BYTES } from '@onekeyhq/shared/src/logger/types';

import { recentLogBytes } from './recentLogBytes';

export const BROWSER_LOG_BUCKET = 'diagnostic-logs_onekey-bucket';
export const BROWSER_LOG_DATABASE = 'OneKeyDiagnosticLogs';
export { BROWSER_LOG_MAX_BYTES } from '@onekeyhq/shared/src/logger/types';
export const BROWSER_LOG_CHUNK_BYTES = 64 * 1024;
const RECORD_OVERHEAD_BYTES = 128;
const DATABASE_VERSION = 1;

type ILogChunk = { id: number; text: string; bytes: number; count: number };
type ILogMetadata = { nextId: number; bytes: number; count: number };

function isLogChunk(value: ILogChunk, maxBytes: number): boolean {
  return (
    !!value &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.text === 'string' &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes >= value.text.length + RECORD_OVERHEAD_BYTES &&
    value.bytes <= maxBytes &&
    Number.isSafeInteger(value.count) &&
    value.count > 0 &&
    value.count <= value.bytes
  );
}

export interface IBrowserLogDatabase {
  append: (messages: string[]) => Promise<void>;
  snapshot: (maxBytes?: number) => Promise<Blob>;
  close: (clear?: boolean) => Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(
        transaction.error ?? new OneKeyLocalError('Log transaction aborted'),
      );
    transaction.onerror = () => {};
  });
  // A request can reject before its transaction abort event is delivered.
  void done.catch(() => {});
  return done;
}

async function openLogFactory(): Promise<IDBFactory> {
  const buckets = (globalThis.navigator as INavigator | undefined)
    ?.storageBuckets;
  if (!buckets) return globalThis.indexedDB;
  // Only unsupported browsers use the default bucket. An open failure must not
  // silently split history between two storage locations.
  const bucket = await buckets.open(BROWSER_LOG_BUCKET, {
    durability: 'strict',
    persisted: true,
  });
  return bucket.indexedDB;
}

/** Independent from wallet DB transactions and their diagnostic logging hooks. */
export class BrowserLogDatabase implements IBrowserLogDatabase {
  private opening: Promise<IDBDatabase> | undefined;

  private closed = false;

  constructor(
    private readonly getFactory: () => Promise<IDBFactory> = openLogFactory,
    private readonly maxBytes = BROWSER_LOG_MAX_BYTES,
  ) {}

  private async open(): Promise<IDBDatabase> {
    if (this.closed) throw new OneKeyLocalError('Log database closed');
    if (!this.opening) {
      this.opening = this.getFactory()
        .then(
          (factory) =>
            new Promise<IDBDatabase>((resolve, reject) => {
              const request = factory.open(
                BROWSER_LOG_DATABASE,
                DATABASE_VERSION,
              );
              let abandoned = false;
              request.onblocked = () => {
                abandoned = true;
                reject(new OneKeyLocalError('Log database upgrade blocked'));
              };
              request.onerror = () => reject(request.error);
              request.onupgradeneeded = () => {
                const database = request.result;
                database.createObjectStore('chunks', { keyPath: 'id' });
                database
                  .createObjectStore('meta')
                  .put(
                    { nextId: 1, bytes: 0, count: 0 } satisfies ILogMetadata,
                    'state',
                  );
              };
              request.onsuccess = () => {
                const database = request.result;
                if (abandoned || this.closed) {
                  database.close();
                  reject(new OneKeyLocalError('Log database open cancelled'));
                  return;
                }
                const invalidate = () => {
                  database.close();
                  this.opening = undefined;
                };
                database.onversionchange = (event) => {
                  // Another Web tab resetting storage must not revive old pending logs.
                  if (event.newVersion === null) this.closed = true;
                  invalidate();
                };
                database.onclose = invalidate;
                resolve(database);
              };
            }),
        )
        .catch((error: unknown) => {
          this.opening = undefined;
          throw error;
        });
    }
    return this.opening;
  }

  async append(messages: string[]): Promise<void> {
    if (!messages.length) return;
    const database = await this.open();
    const transaction = database.transaction(['chunks', 'meta'], 'readwrite', {
      durability: 'strict',
    });
    const done = transactionDone(transaction);
    try {
      const chunks = transaction.objectStore('chunks');
      const meta = transaction.objectStore('meta');
      const state = await requestResult(
        meta.get('state') as IDBRequest<ILogMetadata | undefined>,
      );
      if (
        !state ||
        !Number.isSafeInteger(state.nextId) ||
        state.nextId < 1 ||
        !Number.isSafeInteger(state.bytes) ||
        state.bytes < 0 ||
        !Number.isSafeInteger(state.count) ||
        state.count < 0
      ) {
        throw new OneKeyLocalError('Invalid log database metadata');
      }
      const text = messages.join('');
      const bytes =
        new TextEncoder().encode(text).byteLength + RECORD_OVERHEAD_BYTES;
      if (bytes > this.maxBytes)
        throw new OneKeyLocalError('Log batch exceeds capacity');
      // Insert, prune and update the accounting in one atomic transaction.
      chunks.add({
        id: state.nextId,
        text,
        bytes,
        count: messages.length,
      } satisfies ILogChunk);
      state.nextId += 1;
      state.bytes += bytes;
      state.count += messages.length;
      if (state.bytes > this.maxBytes) {
        await new Promise<void>((resolve, reject) => {
          const request = chunks.openCursor();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || state.bytes <= this.maxBytes) {
              resolve();
              return;
            }
            const value = cursor.value as ILogChunk;
            if (
              !isLogChunk(value, this.maxBytes) ||
              value.bytes > state.bytes ||
              value.count > state.count
            ) {
              reject(new OneKeyLocalError('Invalid log database chunk'));
              return;
            }
            state.bytes -= value.bytes;
            state.count -= value.count;
            cursor.delete();
            cursor.continue();
          };
        });
      }
      meta.put(state, 'state');
      await done;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        /* Already completed or aborted. */
      }
      await done.catch(() => {});
      throw error;
    }
  }

  async snapshot(maxBytes = BROWSER_LOG_MAX_BYTES): Promise<Blob> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
      throw new OneKeyLocalError('Invalid log export budget');
    if (!maxBytes) return new Blob();
    const database = await this.open();
    const transaction = database.transaction('chunks', 'readonly');
    const done = transactionDone(transaction);
    const store = transaction.objectStore('chunks');
    const parts: Blob[] = [];
    let remaining = maxBytes;
    let cursor = await requestResult(store.openKeyCursor(null, 'prev'));
    let before = cursor ? Number(cursor.key) : 0;
    // All pages share one read transaction: retention cannot remove unread
    // chunks, and later writes cannot leak into the exported snapshot.
    while (before > 0 && remaining > 0) {
      // IDs grow monotonically and normal retention only removes a prefix.
      // Numeric windows preserve batched reads on browsers without reverse getAll.
      const first = Math.max(1, before - 31);
      const page = await requestResult(
        store.getAll(IDBKeyRange.bound(first, before), 32) as IDBRequest<
          ILogChunk[]
        >,
      );
      if (!page.length) {
        // Skip gaps without scanning empty numeric windows.
        cursor = await requestResult(
          store.openKeyCursor(IDBKeyRange.upperBound(first, true), 'prev'),
        );
        before = cursor ? Number(cursor.key) : 0;
      } else {
        if (page.some((chunk) => !isLogChunk(chunk, this.maxBytes))) {
          throw new OneKeyLocalError('Invalid log database chunk');
        }
        const selected: BlobPart[] = [];
        for (let i = page.length - 1; i >= 0 && remaining > 0; i -= 1) {
          const bytes = new TextEncoder().encode(page[i].text);
          if (bytes.byteLength > remaining) {
            selected.push(recentLogBytes(bytes, remaining));
            remaining = 0;
          } else {
            selected.push(bytes);
            remaining -= bytes.byteLength;
          }
        }
        parts.push(new Blob(selected.toReversed()));
        before = first - 1;
      }
    }
    await done;
    return new Blob(parts.toReversed(), { type: 'text/plain' });
  }

  async close(clear = false): Promise<void> {
    this.closed = true;
    const database = await this.opening?.catch(() => undefined);
    database?.close();
    this.opening = undefined;
    if (clear) {
      const factory = await this.getFactory();
      await new Promise<void>((resolve, reject) => {
        const request = factory.deleteDatabase(BROWSER_LOG_DATABASE);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new OneKeyLocalError('Log database deletion blocked'));
      });
    }
  }
}
