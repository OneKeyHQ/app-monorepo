import type { ISimpleDbEntityMarktData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
import type { ISimpleDbEntityUtxoData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { BookmarkItem } from '@onekeyhq/kit/src/views/Discover/type';

import type { Avatar } from '../../utils/emojiUtils';

export type ISimpleDBBackUp = {
  utxoAccounts: Pick<ISimpleDbEntityUtxoData, 'utxos'>;
  market: Pick<ISimpleDbEntityMarktData, 'favorites'>;
};

export type PublicBackupData = {
  contacts: Record<string, { name: string; address: string }>;
  importedAccounts: Record<string, { name: string; address: string }>;
  watchingAccounts: Record<string, { name: string; address: string }>;
  HDWallets: Record<
    string,
    { name: string; avatar?: Avatar; accountUUIDs: Array<string> }
  >;
  simpleDb?: ISimpleDBBackUp;
  discoverBookmarks?: BookmarkItem[];
  // browserHistories?: UserBrowserHistory[];
};

export type IBackupItemSummary = {
  backupUUID: string;
  backupTime: number;
  deviceInfo: { osName: string; deviceName: string };
  numOfHDWallets: number;
  numOfAccounts: number;
};

export type BackupedContacts = Record<
  string,
  { name: string; address: string; networkId: string }
>;
