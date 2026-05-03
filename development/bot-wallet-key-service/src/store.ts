import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { fsBridge } from './fs-bridge';
import {
  type IServicePersistedRecord,
  assertOnlyWhitelistedFields,
} from './persistence-fields';

export type IStoreOptions = {
  /** Absolute path to the JSON persistence file. */
  filePath: string;
};

/**
 * In-memory key-id → record map backed by a single JSON file written via
 * atomic rename (write `.tmp` → fsync → rename). Restart recovery is
 * automatic via `loadFromDisk()` in the constructor.
 *
 * Concurrency model: this PoC service is single-process (one Node process
 * listening on 127.0.0.1:8787). No file lock is required — sync writes
 * serialize the rename. If we ever fork, replace this with proper-lockfile.
 */
export class Store {
  private readonly filePath: string;

  private readonly records: Map<string, IServicePersistedRecord> = new Map();

  constructor(options: IStoreOptions) {
    this.filePath = options.filePath;
    this.loadFromDisk();
  }

  has(keyId: string): boolean {
    return this.records.has(keyId);
  }

  get(keyId: string): IServicePersistedRecord | undefined {
    const record = this.records.get(keyId);
    return record === undefined ? undefined : { ...record };
  }

  /**
   * Insert a brand-new record. Throws if `keyId` already exists (callers must
   * generate unique CSPRNG IDs — see `id.ts`).
   */
  insert(keyId: string, record: IServicePersistedRecord): void {
    if (this.records.has(keyId)) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(`Store.insert: keyId already exists`);
    }
    assertOnlyWhitelistedFields(record);
    const nextRecords = new Map(this.records);
    nextRecords.set(keyId, record);
    this.flushToDisk(nextRecords);
    this.records.set(keyId, record);
  }

  /**
   * Mark a record revoked by setting `revokedAt`. Idempotent — calling on
   * an already-revoked record is a no-op (returns true). Returns false only
   * when the keyId does not exist.
   */
  revoke(keyId: string, revokedAt: number): boolean {
    const existing = this.records.get(keyId);
    if (existing === undefined) {
      return false;
    }
    if (existing.revokedAt !== undefined) {
      if (existing.keyBase64 !== '') {
        const scrubbed: IServicePersistedRecord = {
          ...existing,
          keyBase64: '',
        };
        const nextRecords = new Map(this.records);
        nextRecords.set(keyId, scrubbed);
        this.flushToDisk(nextRecords);
        this.records.set(keyId, scrubbed);
      }
      return true; // idempotent
    }
    const updated: IServicePersistedRecord = {
      ...existing,
      keyBase64: '',
      revokedAt,
    };
    assertOnlyWhitelistedFields(updated);
    const nextRecords = new Map(this.records);
    nextRecords.set(keyId, updated);
    this.flushToDisk(nextRecords);
    this.records.set(keyId, updated);
    return true;
  }

  /** For tests: snapshot a deep copy of all records. */
  snapshot(): Record<string, IServicePersistedRecord> {
    const out: Record<string, IServicePersistedRecord> = {};
    for (const [k, v] of this.records.entries()) {
      out[k] = { ...v };
    }
    return out;
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) {
      return; // first-boot: empty store, no error
    }
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (e) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(
        `Store.loadFromDisk: cannot read ${this.filePath}: ${
          (e as Error).message
        }`,
        { cause: e },
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // fail-secure: corrupted JSON must NOT be silently treated as empty
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(
        `Store.loadFromDisk: corrupt JSON at ${this.filePath}: ${
          (e as Error).message
        }`,
        { cause: e },
      );
    }
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(
        `Store.loadFromDisk: top-level JSON must be an object map at ${this.filePath}`,
      );
    }
    for (const [keyId, record] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      assertOnlyWhitelistedFields(record);
      this.records.set(keyId, record as IServicePersistedRecord);
    }
  }

  private flushToDisk(
    records: ReadonlyMap<string, IServicePersistedRecord>,
  ): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const tmpPath = `${this.filePath}.tmp`;
    const serialized: Record<string, IServicePersistedRecord> = {};
    for (const [k, v] of records.entries()) {
      assertOnlyWhitelistedFields(v);
      serialized[k] = v;
    }
    const json = JSON.stringify(serialized, null, 2);
    // mode 0o600: owner read/write only — matches AR16 / FR14
    const fd = fsBridge.openSync(tmpPath, 'w', 0o600);
    try {
      fsBridge.writeSync(fd, json);
      fsBridge.fsyncSync(fd);
    } finally {
      fsBridge.closeSync(fd);
    }
    try {
      fsBridge.renameSync(tmpPath, this.filePath);
    } catch (e) {
      // Cleanup on rename failure to avoid orphan tmp files
      try {
        fsBridge.unlinkSync(tmpPath);
      } catch {
        // ignore — tmp may already be gone
      }
      throw e;
    }
  }
}
