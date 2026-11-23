import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { normalizePublicAccountWalletXfp } from './publicAccountSnapshot';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBWallet,
} from '../../dbs/local/types';

export type IPublicAccountIndexedName = {
  name: string;
  source: IDBCloudSyncItem;
};

// Indexed names have their own timestamped metadata; never derive them from a
// chain account label. Read even acknowledged rows (another same-xfp wallet may
// have consumed them before this wallet's index existed).
export async function preparePublicAccountIndexedNames({
  backgroundApi,
  wallet,
  accounts,
  syncCredential,
}: {
  backgroundApi: IBackgroundApi;
  wallet: IDBWallet;
  accounts: IDBAccount[];
  syncCredential?: ICloudSyncCredential;
}): Promise<Map<string, IPublicAccountIndexedName>> {
  const result = new Map<string, IPublicAccountIndexedName>();
  const manager =
    backgroundApi.servicePrimeCloudSync?.syncManagers?.indexedAccount;
  if (!syncCredential || !manager || !wallet.xfp) return result;
  const indexes = Array.from(
    new Set(
      accounts
        .map((account) => account.pathIndex)
        .filter(
          (index): index is number =>
            Number.isSafeInteger(index) && (index ?? -1) >= 0,
        ),
    ),
  );
  const keys = indexes.map((index) => ({
    index,
    id: accountUtils.buildIndexedAccountId({ walletId: wallet.id, index }),
    rawKey: `${EPrimeCloudSyncDataType.IndexedAccount} >> ${wallet.xfp}__${index}`,
    key: manager.rawKeyToHashKey(
      `${EPrimeCloudSyncDataType.IndexedAccount} >> ${wallet.xfp}__${index}`,
    ),
  }));
  const { records: metadata } = await backgroundApi.localDb.getRecordsByIds({
    name: ELocalDBStoreNames.CloudSyncItem,
    ids: keys.map((entry) => entry.key),
  });
  const byKey = new Map(metadata.filter(Boolean).map((row) => [row.id, row]));
  for (const entry of keys) {
    const item = byKey.get(entry.key);
    if (
      !item ||
      item.isDeleted ||
      item.dataType !== EPrimeCloudSyncDataType.IndexedAccount ||
      item.pwdHash !== cloudSyncItemBuilder.getPwdHash(syncCredential)
    )
      // eslint-disable-next-line no-continue
      continue;
    try {
      const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
        item: { ...item },
        syncCredential,
      });
      if (rawDataJson?.dataType !== EPrimeCloudSyncDataType.IndexedAccount)
        // eslint-disable-next-line no-continue
        continue;
      const payload = rawDataJson.payload;
      if (
        rawDataJson.rawKey !== entry.rawKey ||
        payload.index !== entry.index ||
        normalizePublicAccountWalletXfp(payload.walletXfp) !==
          normalizePublicAccountWalletXfp(wallet.xfp) ||
        typeof payload.name !== 'string' ||
        !payload.name ||
        payload.name.length > 256
      )
        // eslint-disable-next-line no-continue
        continue;
      result.set(entry.id, {
        name: payload.name,
        source: { ...item },
      });
    } catch {
      // Missing/unreadable metadata never blocks importing valid public data.
    }
  }
  return result;
}
