import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  ICloudSyncCredential,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { isSupportedCloudSyncDataType } from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';

import { createHardwareCloudSyncDataError } from './hardwareCloudSyncLog';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

type IRecoveredItem = {
  original: IDBCloudSyncItem;
  replacement: IDBCloudSyncItem;
};

// Only call after authenticating and unwrapping the selected hardware source.
// Local plaintext is sufficient to re-encrypt a business version; historical
// envelopes are not required and must not determine which edit wins.
export async function prepareHardwareCloudSyncLocalRecovery({
  items,
  syncCredential,
}: {
  items: IDBCloudSyncItem[];
  syncCredential: ICloudSyncCredential;
}): Promise<IRecoveredItem[]> {
  const currentHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
  const recovered: IRecoveredItem[] = [];
  const candidates = items.filter(
    (item) =>
      isSupportedCloudSyncDataType(item.dataType) &&
      item.dataType !== EPrimeCloudSyncDataType.Lock &&
      (!item.pwdHash ||
        item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX)) &&
      !(item.pwdHash === currentHash && item.data),
  );
  for (const item of candidates) {
    const original = { ...item };
    let raw: unknown;
    try {
      raw = JSON.parse(original.rawData ?? '');
    } catch {
      throw createHardwareCloudSyncDataError(
        'Local hardware sync record cannot be rebuilt',
      );
    }
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('dataType' in raw) ||
      raw.dataType !== original.dataType ||
      !('rawKey' in raw) ||
      typeof raw.rawKey !== 'string' ||
      (original.rawKey && raw.rawKey !== original.rawKey) ||
      !('payload' in raw) ||
      !raw.payload ||
      typeof raw.payload !== 'object'
    ) {
      throw createHardwareCloudSyncDataError(
        'Local hardware sync record has invalid plaintext metadata',
      );
    }
    const replacement = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson(
      {
        key: original.id,
        rawDataJson: raw as ICloudSyncRawDataJson,
        syncCredential,
        dataTime: original.dataTime,
      },
    );
    recovered.push({ original, replacement });
  }
  return recovered;
}

export async function commitHardwareCloudSyncLocalRecovery(
  recovered: IRecoveredItem[],
) {
  if (!recovered.length) return;
  const byId = new Map(recovered.map((item) => [item.original.id, item]));
  await localDb.updateSyncItem({
    ids: [...byId.keys()],
    updater: (record) => {
      const item = byId.get(record.id);
      if (
        item &&
        record.pwdHash === item.original.pwdHash &&
        record.data === item.original.data &&
        record.rawData === item.original.rawData &&
        record.dataTime === item.original.dataTime &&
        record.isDeleted === item.original.isDeleted
      ) {
        // Keep the business version, tombstone and pending scene state. A
        // concurrent edit is left untouched for the following full sync.
        record.data = item.replacement.data;
        record.pwdHash = item.replacement.pwdHash;
        record.serverUploaded = false;
      }
      return record;
    },
  });
}
