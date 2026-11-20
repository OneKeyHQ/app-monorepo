import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';

const RESET_PROCESSING_BATCH_SIZE = 500;

function validateRecords(
  value: unknown,
  seen: Set<string>,
): IServerSyncRecord[] {
  if (!Array.isArray(value)) {
    throw new OneKeyLocalError('Invalid Cloud sync download response');
  }
  for (const record of value as unknown[]) {
    const item = record as Partial<IServerSyncRecord> | null;
    if (
      !item ||
      typeof item.key !== 'string' ||
      !item.key ||
      typeof item.dataType !== 'string' ||
      !item.dataType ||
      (item.data !== undefined && typeof item.data !== 'string') ||
      (item.dataTimestamp !== undefined &&
        (typeof item.dataTimestamp !== 'number' ||
          !Number.isFinite(item.dataTimestamp))) ||
      (item.isDeleted !== undefined && typeof item.isDeleted !== 'boolean')
    ) {
      throw new OneKeyLocalError('Invalid Cloud sync download record');
    }
    // Length-prefixing avoids collisions without assuming an allowed alphabet.
    const identity = `${item.key.length}:${item.key}${item.dataType}`;
    if (seen.has(identity)) {
      throw new OneKeyLocalError('Duplicate Cloud sync download record');
    }
    seen.add(identity);
  }
  return value as IServerSyncRecord[];
}

/**
 * Rotation replaces the complete server set. Offset pages cannot prove read
 * completeness, even when locally ordered and nonce-guarded. Use the established
 * no-limit response until the server supports snapshot/cursor semantics; only
 * local processing is batched. The caller still guards flush with nonce/pwdHash.
 */
export async function forEachHardwareCloudSyncResetPage({
  download,
  onPage,
  assertCurrent,
}: {
  download: () => Promise<unknown>;
  onPage: (records: IServerSyncRecord[]) => Promise<void>;
  assertCurrent: () => void;
}): Promise<{ recordCount: number; pageCount: number; paginated: boolean }> {
  assertCurrent();
  const response = await download();
  assertCurrent();
  // Validate the whole response before any processing or destructive write.
  const records = validateRecords(response, new Set<string>());
  for (
    let offset = 0;
    offset < records.length;
    offset += RESET_PROCESSING_BATCH_SIZE
  ) {
    assertCurrent();
    await onPage(records.slice(offset, offset + RESET_PROCESSING_BATCH_SIZE));
    assertCurrent();
  }
  return { recordCount: records.length, pageCount: 1, paginated: false };
}
