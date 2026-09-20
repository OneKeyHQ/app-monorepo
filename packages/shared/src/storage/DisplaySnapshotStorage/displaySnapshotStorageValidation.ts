import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IDisplaySnapshotCommit,
  IDisplaySnapshotStorageConfig,
} from './types';

const MAX_KEY_LENGTH = 512;
const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateDisplaySnapshotStorageConfig(
  config: IDisplaySnapshotStorageConfig,
): void {
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

export function validateDisplaySnapshotKey(key: string): void {
  if (
    key.length === 0 ||
    key.length > MAX_KEY_LENGTH ||
    !KEY_PATTERN.test(key)
  ) {
    throw new OneKeyLocalError(`Invalid display snapshot key: ${key}`);
  }
}

export function validateDisplaySnapshotKeys(
  keys: readonly string[],
  config: IDisplaySnapshotStorageConfig,
): void {
  if (keys.length > config.maxReadBatchSize) {
    throw new OneKeyLocalError(
      `Display snapshot read batch exceeds ${config.maxReadBatchSize} keys`,
    );
  }
  keys.forEach(validateDisplaySnapshotKey);
  if (new Set(keys).size !== keys.length) {
    throw new OneKeyLocalError(
      'Display snapshot key batches must not contain duplicates',
    );
  }
}

export function validateDisplaySnapshotValue(
  value: string,
  config: IDisplaySnapshotStorageConfig,
): void {
  if (getUtf8ByteLength(value) > config.maxRecordBytes) {
    throw new OneKeyLocalError(
      `Display snapshot record exceeds ${config.maxRecordBytes} bytes`,
    );
  }
}

export function validateDisplaySnapshotCommit(
  input: IDisplaySnapshotCommit,
  config: IDisplaySnapshotStorageConfig,
): void {
  const entryKeys = input.entries.map((entry) => entry.key);
  const removeKeys = input.removeKeys ?? [];
  const unboundedConfig = {
    ...config,
    maxReadBatchSize: Number.MAX_SAFE_INTEGER,
  };
  validateDisplaySnapshotKeys(entryKeys, unboundedConfig);
  validateDisplaySnapshotKeys(removeKeys, unboundedConfig);
  validateDisplaySnapshotKey(input.commitMarker.key);
  input.entries.forEach((entry) =>
    validateDisplaySnapshotValue(entry.value, config),
  );
  validateDisplaySnapshotValue(input.commitMarker.value, config);
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
    validateDisplaySnapshotKey(input.expectedCommitMarker.key);
    if (input.expectedCommitMarker.key !== input.commitMarker.key) {
      throw new OneKeyLocalError(
        'Display snapshot marker expectation must target the commit marker key',
      );
    }
  }
}
