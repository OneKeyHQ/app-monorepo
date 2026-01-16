import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { INDEXED_DB_NAME } from '../consts';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

function buildDbName(bucketName: EIndexedDBBucketNames) {
  return INDEXED_DB_NAME(bucketName);
}

function getBucketNameByStoreName(
  storeName: ELocalDBStoreNames,
): EIndexedDBBucketNames {
  switch (storeName) {
    // case ELocalDBStoreNames.CloudSyncItem:
    // return EIndexedDBBucketNames.cloudSync;

    case ELocalDBStoreNames.CloudSyncItem:
    case ELocalDBStoreNames.Account:
    case ELocalDBStoreNames.AccountDerivation:
    case ELocalDBStoreNames.IndexedAccount:
    case ELocalDBStoreNames.Credential:
    case ELocalDBStoreNames.Device:
    case ELocalDBStoreNames.Context:
    case ELocalDBStoreNames.Wallet:
      return EIndexedDBBucketNames.account;

    case ELocalDBStoreNames.Address:
      return EIndexedDBBucketNames.address;

    case ELocalDBStoreNames.SignedMessage:
    case ELocalDBStoreNames.SignedTransaction:
    case ELocalDBStoreNames.ConnectedSite:
    case ELocalDBStoreNames.HardwareHomeScreen:
      return EIndexedDBBucketNames.archive;

    default: {
      const exhaustiveCheck: never = storeName;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new OneKeyLocalError(
        `Unsupported indexedDB store name: ${exhaustiveCheck as string}`,
      );
    }
  }
}

let bucketNameToStoreNamesMap:
  | Record<EIndexedDBBucketNames, ELocalDBStoreNames[]>
  | undefined;

function getStoreNamesByBucketName(
  bucketName: EIndexedDBBucketNames,
): ELocalDBStoreNames[] {
  if (!bucketNameToStoreNamesMap) {
    bucketNameToStoreNamesMap = {
      [EIndexedDBBucketNames.account]: [],
      [EIndexedDBBucketNames.address]: [],
      [EIndexedDBBucketNames.archive]: [],
      [EIndexedDBBucketNames.backupAccount]: [],
      // [EIndexedDBBucketNames.cloudSync]: [],
    };

    Object.values(ELocalDBStoreNames).forEach((storeName) => {
      if (typeof storeName === 'string') {
        try {
          const _bucketName = getBucketNameByStoreName(
            storeName as ELocalDBStoreNames,
          );
          bucketNameToStoreNamesMap?.[_bucketName].push(
            storeName as ELocalDBStoreNames,
          );
        } catch (error) {
          // ignore
        }
      }
    });
  }
  return bucketNameToStoreNamesMap[bucketName];
}
export default {
  getBucketNameByStoreName,
  getStoreNamesByBucketName,
  buildDbName,
};
