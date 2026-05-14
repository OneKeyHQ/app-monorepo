import type { IServerNetwork } from '.';

export type IV4DBAvatarParsed = {
  emoji: string | 'img';
  bgColor: string;
};

export type IV4MigrationBackupItem = {
  backupId: string;
  title: string;
  subTitle: string;
  // `avatar` is a JSON.stringify(IV4DBAvatarParsed); consumers parse it
  // back into the structured shape at render time.
  hdWallet?: { id: string; avatar?: string };
  importedAccount?: { id: string };
  network?: IServerNetwork;
  networkId?: string;
};

export type IV4MigrationBackupSectionDataItem = {
  title: string;
  data: Array<IV4MigrationBackupItem>;
};

export type IV4MigrationBackupSectionData =
  Array<IV4MigrationBackupSectionDataItem>;
