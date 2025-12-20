// import type { ISimpleDbEntityMarktData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
// import type { ISimpleDbEntityUtxoData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import type { ICoreImportedCredential } from '@onekeyhq/core/src/types';
import type { EDBAccountType } from '@onekeyhq/kit-bg/src/dbs/local/consts';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
// export type ISimpleDBBackUp = {
//   utxoAccounts: Pick<ISimpleDbEntityUtxoData, 'utxos'>;
//   market: Pick<ISimpleDbEntityMarktData, 'favorites'>;
// };
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDeviceKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

import type { IAllWalletAvatarImageNamesWithoutDividers } from '../../src/utils/avatarUtils';

export enum EPrimeTransferDataType {
  keylessWallet = 'keylessWallet',
  allWallet = 'allWallet',
}

export enum EPrimeTransferServerType {
  OFFICIAL = 'official',
  CUSTOM = 'custom',
}

type IHasVersion = {
  version: number;
};

export type IPrimeTransferHDAccount = {
  id: string;
  name: string;
  address: string;
  pathIndex: number | undefined;
  indexedAccountId: string | undefined;
  template: string | undefined;
  path: string | undefined;
  createAtNetwork: string | undefined;
  networks: string[] | undefined;
  impl: string | undefined;
  coinType: string | undefined;
};

export type IPrimeTransferHDWalletCreateNetworkParams = {
  index: number;
  customNetworks:
    | {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[]
    | undefined;
}[];
export type IPrimeTransferHDWalletIndexedAccountNames = {
  [index: number]: string;
};
export type IPrimeTransferHDWallet = Omit<
  IDBWallet,
  | 'accounts'
  | 'associatedDevice'
  | 'deviceType'
  | 'nextIndex'
  | 'walletNo'
  | 'avatar'
> & {
  accounts: Array<IPrimeTransferHDAccount> | undefined;
  accountIds: Array<string> | undefined; // UUIDs of accounts
  accountIdsLength: number;
  indexedAccountUUIDs: Array<string> | undefined;
  indexedAccountUUIDsLength: number;
  avatarInfo?: IAvatarInfo;
  createNetworkParams?: IPrimeTransferHDWalletCreateNetworkParams;
  indexedAccountNames?: IPrimeTransferHDWalletIndexedAccountNames;
} & IHasVersion;

export type IPrimeTransferAccount = {
  address: string;
  type: EDBAccountType | undefined;
  id: string;
  template: string | undefined;
  path: string | undefined;
  name: string;
  createAtNetwork: string | undefined;
  networks: string[] | undefined;
  impl: string | undefined;
  coinType: string | undefined;
  accountOrder: number | undefined; // readonly field
  accountOrderSaved: number | undefined; // db field
  pub: string | undefined;
  xpub: string | undefined;
  xpubSegwit: string | undefined;
} & IHasVersion;

export type IPrimeTransferPublicDataWalletDetail = {
  name: string;
  avatar: IAllWalletAvatarImageNamesWithoutDividers;
  accountsCount: number;
  walletXfp: string | undefined;
};
export type IPrimeTransferPublicData = {
  dataTime: number;
  dataVersion?: number;
  totalWalletsCount: number;
  totalAccountsCount: number;
  walletDetails: Array<IPrimeTransferPublicDataWalletDetail>;
};

export type IPrimeTransferDecryptedCredentials = Record<
  string,
  ICoreImportedCredential | IBip39RevealableSeed
>;
export type IPrimeTransferPrivateData = {
  // WalletID/ImportedAccountID -> encrypted credential
  credentials: Record<string, string> | undefined;
  decryptedCredentialsHex?: string;
  decryptedCredentials?: IPrimeTransferDecryptedCredentials;
  // UUID -> DBAccount
  importedAccounts: Record<string, IPrimeTransferAccount>;
  // UUID -> DBAccount
  watchingAccounts: Record<string, IPrimeTransferAccount>;
  // UUID -> ImportableHDWallet
  wallets: Record<string, IPrimeTransferHDWallet>;
  // DeviceKeyPack for keyless wallet transfer
  deviceKeyPack?: IDeviceKeyPack;
  // simpleDb?: {
  //   utxoAccounts?: ISimpleDbEntityUtxoData;
  //   market?: ISimpleDbEntityMarktData;
  // };
};

export type IPrimeTransferData = {
  privateData: IPrimeTransferPrivateData;
  publicData: IPrimeTransferPublicData | undefined;
  isEmptyData: boolean;
  isWatchingOnly: boolean;
  appVersion: string;
};

export type IPrimeTransferSelectedItemMapInfo = {
  [id: string]: {
    checked: boolean;
    disabled: boolean;
  };
};
export type IPrimeTransferSelectedItemMap = {
  wallet: IPrimeTransferSelectedItemMapInfo;
  importedAccount: IPrimeTransferSelectedItemMapInfo;
  watchingAccount: IPrimeTransferSelectedItemMapInfo;
};

export type IPrimeTransferSelectedDataItem<T> = {
  item: T;
  credential?: string;
  credentialDecrypted?: ICoreImportedCredential | IBip39RevealableSeed;
  tonMnemonicCredential?: string;
  tonMnemonicCredentialDecrypted?: IBip39RevealableSeed;
  id: string;
};
export type IPrimeTransferSelectedData = {
  wallets: IPrimeTransferSelectedDataItem<IPrimeTransferHDWallet>[];
  importedAccounts: IPrimeTransferSelectedDataItem<IPrimeTransferAccount>[];
  watchingAccounts: IPrimeTransferSelectedDataItem<IPrimeTransferAccount>[];
};

export interface IE2EESocketUserInfo {
  id: string;
  socketId: string | undefined;
  joinedAt: Date;
  appPlatform: string;
  appPlatformName: string;
  appVersion: string;
  appBuildNumber: string;
  appDeviceName: string;
}
