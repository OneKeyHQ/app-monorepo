import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class GetDataForBackupScene extends BaseScene {
  @LogToLocal()
  getDataForBackup() {
    return [true];
  }

  @LogToLocal()
  getDataForBackupDone({
    privateDataLength,
    publicDataLength,
    appVersion,
  }: {
    privateDataLength: number;
    publicDataLength: number;
    appVersion: string;
  }) {
    return [privateDataLength, publicDataLength, appVersion];
  }

  @LogToLocal()
  dumpCredentials(credentialsLength: number) {
    return [credentialsLength];
  }

  @LogToLocal()
  getContacts(contactsLength: number) {
    return [contactsLength];
  }

  @LogToLocal()
  getBookmarks(bookmarksLength: number) {
    return [bookmarksLength];
  }

  @LogToLocal()
  getWallets(walletsLength: number) {
    return [walletsLength];
  }

  @LogToLocal()
  getAllAccounts(accountsLength: number) {
    return [accountsLength];
  }

  @LogToLocal()
  getIndexedAccountError({
    accountId,
    indexedAccountId,
    error,
    coinType,
    path,
  }: {
    accountId: string;
    indexedAccountId: string;
    error: unknown;
    coinType: string;
    path: string;
  }) {
    return [
      accountId,
      indexedAccountId,
      (error as Error)?.message,
      coinType,
      path,
    ];
  }
}
