import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IDisplaySnapshotCommit,
  IDisplaySnapshotStorage,
  IDisplaySnapshotStorageBackend,
  IDisplaySnapshotStorageConfig,
} from './types';

const MAX_KEY_LENGTH = 512;
const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function validateConfig(config: IDisplaySnapshotStorageConfig): void {
  if (!NAMESPACE_PATTERN.test(config.namespace)) {
    throw new OneKeyLocalError(
      'Display snapshot namespace must contain only lowercase letters, numbers, and hyphens',
    );
  }
  if (
    !Number.isSafeInteger(config.maxRecordBytes) ||
    config.maxRecordBytes <= 0
  ) {
    throw new OneKeyLocalError(
      'Display snapshot maxRecordBytes must be a positive integer',
    );
  }
  if (
    !Number.isSafeInteger(config.maxReadBatchSize) ||
    config.maxReadBatchSize <= 0
  ) {
    throw new OneKeyLocalError(
      'Display snapshot maxReadBatchSize must be a positive integer',
    );
  }
}

function validateKey(key: string): void {
  if (
    key.length === 0 ||
    key.length > MAX_KEY_LENGTH ||
    !KEY_PATTERN.test(key)
  ) {
    throw new OneKeyLocalError(`Invalid display snapshot key: ${key}`);
  }
}

function validateKeys(
  keys: readonly string[],
  config: IDisplaySnapshotStorageConfig,
): void {
  if (keys.length > config.maxReadBatchSize) {
    throw new OneKeyLocalError(
      `Display snapshot read batch exceeds ${config.maxReadBatchSize} keys`,
    );
  }
  keys.forEach(validateKey);
  if (new Set(keys).size !== keys.length) {
    throw new OneKeyLocalError(
      'Display snapshot key batches must not contain duplicates',
    );
  }
}

function validateValue(
  value: string,
  config: IDisplaySnapshotStorageConfig,
): void {
  if (getUtf8ByteLength(value) > config.maxRecordBytes) {
    throw new OneKeyLocalError(
      `Display snapshot record exceeds ${config.maxRecordBytes} bytes`,
    );
  }
}

function validateCommit(
  input: IDisplaySnapshotCommit,
  config: IDisplaySnapshotStorageConfig,
): void {
  const entryKeys = input.entries.map((entry) => entry.key);
  const removeKeys = input.removeKeys ?? [];
  validateKeys(entryKeys, {
    ...config,
    maxReadBatchSize: Number.MAX_SAFE_INTEGER,
  });
  validateKeys(removeKeys, {
    ...config,
    maxReadBatchSize: Number.MAX_SAFE_INTEGER,
  });
  validateKey(input.commitMarker.key);
  input.entries.forEach((entry) => validateValue(entry.value, config));
  validateValue(input.commitMarker.value, config);
  if (entryKeys.includes(input.commitMarker.key)) {
    throw new OneKeyLocalError(
      'Display snapshot commit marker must not be included in data entries',
    );
  }
  if (removeKeys.includes(input.commitMarker.key)) {
    throw new OneKeyLocalError(
      'Display snapshot commit marker must not be removed by its own commit',
    );
  }
  if (input.expectedCommitMarker) {
    validateKey(input.expectedCommitMarker.key);
    if (input.expectedCommitMarker.key !== input.commitMarker.key) {
      throw new OneKeyLocalError(
        'Display snapshot marker expectation must target the commit marker key',
      );
    }
  }
}

/**
 * Display Snapshot Storage V2
 *
 * This storage is only for non-sensitive, re-creatable UI snapshots. It is
 * not a source of truth and its contents may be missing, stale, corrupted,
 * or deleted at any time.
 *
 * Snapshot payloads must be page-scoped, explicitly serialized through a
 * size-bounded codec, and loaded by exact key. Implementations intentionally
 * expose no enumeration API so a cold start cannot preload every record into
 * JavaScript memory.
 */
export function createDisplaySnapshotStorageCore(
  config: IDisplaySnapshotStorageConfig,
  loadBackend: () => Promise<IDisplaySnapshotStorageBackend>,
): IDisplaySnapshotStorage {
  validateConfig(config);
  let backendPromise: Promise<IDisplaySnapshotStorageBackend> | undefined;
  let mutationTail: Promise<void> = Promise.resolve();

  const getBackend = () => {
    if (!backendPromise) {
      backendPromise = loadBackend().catch((error) => {
        backendPromise = undefined;
        throw error;
      });
    }
    return backendPromise;
  };

  const enqueueMutation = (operation: () => Promise<void>): Promise<void> => {
    const next = mutationTail.catch(() => undefined).then(operation);
    mutationTail = next;
    return next;
  };

  return {
    async read(key) {
      validateKey(key);
      const value = await (await getBackend()).read(key);
      if (value !== undefined) {
        validateValue(value, config);
      }
      return value;
    },
    async readMany(keys) {
      validateKeys(keys, config);
      const values = await (await getBackend()).readMany(keys);
      values.forEach((value, key) => {
        validateKey(key);
        validateValue(value, config);
      });
      return values;
    },
    async commit(input) {
      validateCommit(input, config);
      await enqueueMutation(async () => {
        await (await getBackend()).commit(input);
      });
    },
    async remove(keys) {
      validateKeys(keys, {
        ...config,
        maxReadBatchSize: Number.MAX_SAFE_INTEGER,
      });
      await enqueueMutation(async () => {
        await (await getBackend()).remove(keys);
      });
    },
    async clearNamespace() {
      await enqueueMutation(async () => {
        await (await getBackend()).clearNamespace();
      });
    },
    async compact() {
      await enqueueMutation(async () => {
        await (await getBackend()).compact();
      });
    },
  };
}
