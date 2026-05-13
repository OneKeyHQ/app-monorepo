import type { IServerNetwork } from '.';

export type IV4DBAvatarParsed = {
  emoji: string | 'img';
  bgColor: string;
};

export type IV4MigrationBackupItem = {
  backupId: string;
  title: string;
  subTitle: string;
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

const V4_NOT_SUPPORT_NETWORKS_INFO: Partial<{
  [networkId: string]: {
    logo: string;
  };
}> = {
  'stc--1': {
    logo: 'https://uni.onekey-asset.com/static/chain/stc.png',
  },
  'stc--251': {
    logo: 'https://uni.onekey-asset.com/static/chain/tstc.png',
  },
  'xmr--0': {
    logo: 'https://common.onekey-asset.com/chain/monero.png',
  },
};

export function getV4NotSupportNetworkInfo({
  networkId,
}: {
  networkId: string;
}) {
  return V4_NOT_SUPPORT_NETWORKS_INFO[networkId];
}
