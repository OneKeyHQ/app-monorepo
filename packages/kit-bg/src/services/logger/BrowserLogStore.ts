import {
  BROWSER_LOG_CHUNK_BYTES,
  BROWSER_LOG_MAX_BYTES,
} from './BrowserLogDatabase';
import { recentLogBytes } from './recentLogBytes';

import type { IBrowserLogDatabase } from './BrowserLogDatabase';

export const BROWSER_LOG_MESSAGE_LIMIT = 2048;
export const BROWSER_LOG_PENDING_BYTES = 1024 * 1024;
const RETRY_DELAY_MS = 1000;
type IPendingLog = { message: string; bytes: number; revision: number };

/** One queue per service runtime; IndexedDB serializes writes across Web tabs. */
export class BrowserLogStore {
  private pending: IPendingLog[] = [];
  private pendingBytes = 0;
  private revision = 0;
  private flushedRevision = 0;
  private writer: Promise<void> | undefined;
  private operations = Promise.resolve();
  private retryAt = 0;
  private stopped = false;

  constructor(private readonly database: IBrowserLogDatabase) {}

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation);
    this.operations = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  private boundPending() {
    while (this.pendingBytes > BROWSER_LOG_PENDING_BYTES) {
      const removed = this.pending.shift();
      if (removed) this.pendingBytes -= removed.bytes;
    }
  }

  private flush(): Promise<void> {
    if (this.writer) return this.writer;
    if (this.stopped || Date.now() < this.retryAt) return Promise.resolve();
    this.writer = this.exclusive(async () => {
      if (this.stopped || !this.pending.length) return;
      let bytes = 0;
      let length = 0;
      for (const item of this.pending) {
        if (length && bytes + item.bytes > BROWSER_LOG_CHUNK_BYTES) break;
        bytes += item.bytes;
        length += 1;
      }
      const batch = this.pending.splice(0, length);
      this.pendingBytes -= bytes;
      try {
        await this.database.append(batch.map((item) => item.message));
        this.flushedRevision = batch[batch.length - 1].revision;
      } catch {
        // Storage errors must never recurse through the logger or block wallet work.
        if (!this.stopped) {
          this.pending = [...batch, ...this.pending];
          this.pendingBytes += bytes;
          this.boundPending();
          this.retryAt = Date.now() + RETRY_DELAY_MS;
        }
      }
    }).finally(() => {
      this.writer = undefined;
      if (this.pending.length && !this.stopped && Date.now() >= this.retryAt)
        void this.flush();
    });
    return this.writer;
  }

  private async flushThrough(revision: number) {
    while (
      this.flushedRevision < revision &&
      !this.stopped &&
      Date.now() >= this.retryAt
    )
      await this.flush();
  }

  async add(message: string): Promise<void> {
    if (this.stopped || !message) return;
    const bounded =
      message.length > BROWSER_LOG_MESSAGE_LIMIT
        ? `${message.slice(0, BROWSER_LOG_MESSAGE_LIMIT - 16)}...(truncated)\r\n`
        : message;
    this.revision += 1;
    const revision = this.revision;
    const bytes = new TextEncoder().encode(bounded).byteLength + 32;
    this.pending.push({ message: bounded, bytes, revision });
    this.pendingBytes += bytes;
    this.boundPending();
    await this.flushThrough(revision);
  }

  async snapshot(maxBytes = BROWSER_LOG_MAX_BYTES): Promise<Blob> {
    await this.flushThrough(this.revision);
    return this.exclusive(async () => {
      if (this.stopped) return new Blob();
      const pendingBytes = new TextEncoder().encode(
        this.pending.map((item) => item.message).join(''),
      );
      const pending = recentLogBytes(pendingBytes, maxBytes);
      // An unreadable history must fail export rather than silently produce a partial file.
      const persisted = await this.database.snapshot(
        Math.max(0, maxBytes - pendingBytes.byteLength),
      );
      if (this.stopped) return new Blob();
      return new Blob([persisted, pending], { type: 'text/plain' });
    });
  }

  async stop(clear = true): Promise<void> {
    this.stopped = true;
    this.pending = [];
    this.pendingBytes = 0;
    await this.operations;
    await this.database.close(clear);
  }
}
