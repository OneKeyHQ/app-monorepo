import { HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { logHardwareCloudSyncDiagnostic } from './hardwareCloudSyncLog';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';
import type { LocalDbBase } from '../../dbs/local/LocalDbBase';
import type { IDBCloudSyncItem } from '../../dbs/local/types';

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

export async function prepareHardwareCloudSyncResetRecords({
  download,
  reencrypt,
  assertCurrent,
  envelope,
  nonce,
  oldPwdHash,
  newPwdHash,
  previousGeneration,
  localItemCount,
  isPrevious,
}: {
  download: () => Promise<unknown>;
  reencrypt: (records: IServerSyncRecord[]) => Promise<IServerSyncRecord[]>;
  assertCurrent: () => void;
  envelope: { dekId: string; createdAt: number; generation: number };
  nonce: number;
  oldPwdHash: string;
  newPwdHash: string;
  previousGeneration: number;
  localItemCount: number;
  isPrevious: (record: IServerSyncRecord) => boolean;
}) {
  // Read the complete rotation input once, then re-encrypt in bounded batches.
  // The pre-download nonce still guards concurrent server writes at flush.
  const envelopeRecords: IServerSyncRecord[] = [];
  const serverItems: IServerSyncRecord[] = [];
  const downloadResult = await forEachHardwareCloudSyncResetPage({
    download,
    onPage: async (records) => {
      const encrypted = await reencrypt(
        records.filter((record) => {
          if (record.dataType !== HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE)
            return true;
          envelopeRecords.push(record);
          return false;
        }),
      );
      assertCurrent();
      for (const record of encrypted) {
        const { key, dataType, data, dataTimestamp, isDeleted } = record;
        serverItems.push({
          key,
          dataType,
          data: data ?? '',
          dataTimestamp,
          isDeleted: !!isDeleted,
        });
      }
    },
    assertCurrent,
  });
  logHardwareCloudSyncDiagnostic('reset_download_received', {
    hasServerDataArray: true,
    returnedCount: downloadResult.recordCount,
    page: downloadResult.pageCount,
    historyCompleteKnown: false,
  });
  const envelopeData = stringUtils.stableStringify(envelope);
  // Keep every earlier envelope; they are tiny and help recovery.
  const envelopeItems = [
    ...envelopeRecords.map(({ key, dataType, data, dataTimestamp }) => ({
      key,
      dataType,
      data,
      dataTimestamp,
      isDeleted: false,
    })),
    {
      key: `dek:${envelope.dekId}`,
      dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
      data: envelopeData,
      dataTimestamp: envelope.createdAt,
      isDeleted: false,
    },
  ];

  logHardwareCloudSyncDiagnostic('rotation_prepared', () => ({
    previousGeneration,
    nextGeneration: envelope.generation,
    localItemCount,
    returnedCount: downloadResult.recordCount,
    inputEnvelopeCount: envelopeRecords.length,
    outputEnvelopeCount: envelopeItems.length,
    previousCurrentEnvelopeIncluded: envelopeRecords.some(isPrevious),
  }));
  return {
    envelopeCount: envelopeItems.length,
    data: {
      nonce: 0,
      pwdHash: newPwdHash,
      expectedPwdHash: oldPwdHash,
      expectedNonce: nonce,
      lock: {
        key: 'lock',
        dataType: 'Lock',
        data: envelopeData,
        dataTimestamp: envelope.createdAt,
      },
      localData: [...serverItems, ...envelopeItems],
    },
  };
}

export function preparePoolRekey(
  originalItems: IDBCloudSyncItem[],
  items: IDBCloudSyncItem[],
  oldHash: string,
  isCurrent: (() => boolean) | undefined,
  conflict: () => Error,
): Parameters<LocalDbBase['updateSyncItem']>[0] {
  const originalsById = new Map(originalItems.map((item) => [item.id, item]));
  const replacementsById = new Map(items.map((item) => [item.id, item]));
  return {
    ids: items.map((item) => item.id),
    isCurrent,
    updater: (record) => {
      const original = originalsById.get(record.id);
      const replacement = replacementsById.get(record.id);
      // A later edit must keep its raw data; the following full sync rebuilds
      // it with the selected key. Compare inside the database transaction.
      if (
        original &&
        replacement &&
        record.pwdHash === original.pwdHash &&
        record.data === original.data &&
        (!isCurrent ||
          (record.dataType === original.dataType &&
            record.rawKey === original.rawKey)) &&
        record.rawData === original.rawData &&
        (record.dataTime ?? undefined) === (original.dataTime ?? undefined) &&
        record.isDeleted === original.isDeleted
      ) {
        record.data = replacement.data;
        record.pwdHash = replacement.pwdHash;
      } else if (isCurrent && record.pwdHash === oldHash) {
        throw conflict();
      }
      return record;
    },
  };
}
