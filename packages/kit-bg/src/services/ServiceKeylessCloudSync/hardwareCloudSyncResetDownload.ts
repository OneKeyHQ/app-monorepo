import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';

const RESET_DOWNLOAD_PAGE_SIZE = 500;
// A broken endpoint must not keep a destructive operation reading forever.
const MAX_RESET_DOWNLOAD_PAGES = 10_000;

type IResetDownloadPage = { skip: number; limit: number };

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

function isAfter(previous: IServerSyncRecord, item: IServerSyncRecord) {
  return (
    item.key > previous.key ||
    (item.key === previous.key && item.dataType > previous.dataType)
  );
}

/**
 * Only for reset: callers must read the nonce before this and atomically guard
 * the final flush with that nonce and pwdHash. Ordered pages are not a snapshot.
 * Keeps old ciphertext page-sized; the final flush payload still needs O(N).
 */
export async function forEachHardwareCloudSyncResetPage({
  download,
  onPage,
  onRestart,
  assertCurrent,
}: {
  download: (page?: IResetDownloadPage) => Promise<unknown>;
  onPage: (records: IServerSyncRecord[]) => Promise<void>;
  onRestart: () => void;
  assertCurrent: () => void;
}): Promise<{ recordCount: number; pageCount: number; paginated: boolean }> {
  const seen = new Set<string>();
  let previous: IServerSyncRecord | undefined;
  let skip = 0;
  let pageCount = 0;
  while (pageCount < MAX_RESET_DOWNLOAD_PAGES) {
    assertCurrent();
    const response = await download({ skip, limit: RESET_DOWNLOAD_PAGE_SIZE });
    assertCurrent();
    pageCount += 1;
    const records = validateRecords(response, seen);
    if (!records.length) {
      return { recordCount: skip, pageCount, paginated: true };
    }
    let ordered = true;
    for (const record of records) {
      if (previous && !isAfter(previous, record)) ordered = false;
      previous = record;
    }
    if (records.length > RESET_DOWNLOAD_PAGE_SIZE || !ordered) {
      // Older endpoints may ignore limit, and server collation may differ from
      // JS binary ordering. Discard all page output and use the established
      // no-limit endpoint, never a mixture of paged and full results.
      onRestart();
      seen.clear();
      assertCurrent();
      const fullResponse = await download();
      assertCurrent();
      const fullRecords = validateRecords(fullResponse, seen);
      await onPage(fullRecords);
      assertCurrent();
      return {
        recordCount: fullRecords.length,
        pageCount: pageCount + 1,
        paginated: false,
      };
    }
    await onPage(records);
    assertCurrent();
    skip += records.length;
    // Even a short page is followed to exhaustion: older servers may cap a
    // requested limit. Advancing by what was received avoids skipped records.
  }
  throw new OneKeyLocalError('Cloud sync download exceeded the page limit');
}
