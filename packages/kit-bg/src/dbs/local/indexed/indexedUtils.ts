import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

function getBucketNameByStoreName(
  storeName: ELocalDBStoreNames,
): EIndexedDBBucketNames {
  switch (storeName) {
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
      return EIndexedDBBucketNames.archive;

    default: {
      const exhaustiveCheck: never = storeName;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(
        `Unsupported indexedDB store name: ${exhaustiveCheck as string}`,
      );
    }
  }
}

function getStoreNamesByBucketName(
  bucketName: EIndexedDBBucketNames,
): ELocalDBStoreNames[] {
  switch (bucketName) {
    case EIndexedDBBucketNames.account:
      return [
        ELocalDBStoreNames.CloudSyncItem,
        ELocalDBStoreNames.Account,
        ELocalDBStoreNames.AccountDerivation,
        ELocalDBStoreNames.IndexedAccount,
        ELocalDBStoreNames.Credential,
        ELocalDBStoreNames.Device,
        ELocalDBStoreNames.Context,
        ELocalDBStoreNames.Wallet,
      ];

    case EIndexedDBBucketNames.address:
      return [ELocalDBStoreNames.Address];

    case EIndexedDBBucketNames.archive:
      return [
        ELocalDBStoreNames.SignedMessage,
        ELocalDBStoreNames.SignedTransaction,
        ELocalDBStoreNames.ConnectedSite,
      ];
    default: {
      const exhaustiveCheck: never = bucketName;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(
        `Unsupported indexedDB store name: ${exhaustiveCheck as string}`,
      );
    }
  }
}
export default {
  getBucketNameByStoreName,
  getStoreNamesByBucketName,
};
