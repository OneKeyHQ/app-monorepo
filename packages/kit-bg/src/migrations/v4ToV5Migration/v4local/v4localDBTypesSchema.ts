/* eslint-disable spellcheck/spell-checker */
import type {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_QR,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';

import type { EV4DBAccountType, EV4TokenRiskLevel } from '../v4types';
import type { IDeviceType } from '@onekeyfe/hd-core';

export type IV4DBWalletId =
  | string // hd-xxx, hw-xxx
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;

export type IV4DBWalletIdSingleton =
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;

export type IV4DBWalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_QR
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;

type IV4DBBaseObject = {
  id: string;
};

type IV4DBBaseObjectWithName = IV4DBBaseObject & {
  name: string;
};

export type IV4DBAccountDerivation = IV4DBBaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};

export type IV4DBWallet = IV4DBBaseObjectWithName & {
  type: IV4DBWalletType;
  backuped: boolean;
  // only for singleton wallet
  accounts: string[];
  // only for singleton wallet
  nextAccountIds: {
    // 'global': 1, // imported, external, watching,
    // purpose + cointype => index
    [template: string]: number; // hd
  };
  associatedDevice?: string; // alias to `dbDeviceId`
  avatar?: IV4DBAvatar; // indexedDB is object, realmDB is string
  //   avatarInfo?: IAvatarInfo; // readonly field
  hiddenWallets?: IV4DBWallet[]; // readonly field
  passphraseState?: string;
  walletOrder?: number;
  deviceType?: string;
  //   airGapAccountsInfo?: IQrWalletAirGapAccountsInfo;
};

export type IV4DBContext = {
  id: string; // DB_MAIN_CONTEXT_ID
  nextHD: number;
  verifyString: string; // DEFAULT_VERIFY_STRING
  networkOrderChanged?: boolean;
  backupUUID: string;
  pendingWallets?: string[];
};

export type IV4DBDevice = IV4DBBaseObjectWithName & {
  features: string; // TODO rename to featuresRaw
  //   featuresInfo?: IOneKeyDeviceFeatures; // readonly field // TODO rename to features
  // TODO make index for better performance (getDeviceByQuery)
  mac: string; // alias connectId/mac\sn, never changed even if device reset
  name: string;
  // TODO make index for better performance (getDeviceByQuery)
  uuid: string;
  deviceId: string; // features.device_id changed after device reset
  deviceType: IDeviceType;
  payloadJson: string; // settingsRaw
  //   settings?: IDBDeviceSettings;
  createdAt: number;
  updatedAt: number;
};

export type IV4DBHdCredentialRaw = {
  entropy: string;
  seed: string;
};
export type IV4DBImportedCredentialRaw = {
  privateKey: string;
};
export type IV4DBCredentialBase = {
  id: string;
  // type: 'imported' | 'hd';
  credential: string;
};

type IV4DBAvatar = string; // stringify(IAvatarInfo)
// IAvatar;
export type IV4DBAvatarParsed = {
  emoji: string | 'img'; // lazy load EmojiTypes
  bgColor: string;
};
type IV4DBBaseAccount = IV4DBBaseObjectWithName & {
  type: EV4DBAccountType | undefined;
  path: string;
  coinType: string;
  template?: string;
};

export type IV4DBSimpleAccount = IV4DBBaseAccount & {
  pub: string;
  address: string;
};
export type IV4DBUtxoAccount = IV4DBBaseAccount & {
  pub?: string; // TODO rename pubKey to pub
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc dynamic custom address
};
export type IV4DBVariantAccount = IV4DBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: networkId -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};
export type IV4DBExternalAccount = IV4DBVariantAccount & {
  address: string; // always be empty if walletconnect account
};
export type IV4DBAccount =
  | IV4DBSimpleAccount
  | IV4DBUtxoAccount
  | IV4DBVariantAccount
  | IV4DBExternalAccount;

export type IV4DBToken = IV4DBBaseObjectWithName & {
  isNative?: boolean;
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  address?: string;
  impl?: string;
  chainId?: string;
  source?: string;
  coingeckoId?: string;
  swftId?: string;
  marketCap?: number;
  addToIndex?: boolean;
  autoDetected?: boolean;
  sendAddress?: string;
  onramperId?: string;
  moonpayId?: string;

  riskLevel?: EV4TokenRiskLevel;
};
