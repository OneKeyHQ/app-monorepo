import type { Avatar } from '../../utils/emojiUtils';

export type PublicBackupData = {
  contacts: Record<string, { name: string; address: string }>;
  importedAccounts: Record<string, { name: string; address: string }>;
  watchingAccounts: Record<string, { name: string; address: string }>;
  HDWallets: Record<
    string,
    { name: string; avatar?: Avatar; accountUUIDs: Array<string> }
  >;
};

export type IBackupItemSummary = {
  backupUUID: string;
  backupTime: number;
  deviceInfo: { osName: string; deviceName: string };
  numOfHDWallets: number;
  numOfImportedAccounts: number;
  numOfWatchingAccounts: number;
  numOfContacts: number;
};

export type BackupedContacts = Record<
  string,
  { name: string; address: string; networkId: string }
>;
