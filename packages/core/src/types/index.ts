// TODO rename ICoreApi to ICore

import type {
  ISecretPrivateKeyInfo,
  ISecretPublicKeyInfo,
} from '@onekeyhq/core/src/secret';

import type { EAddressEncodings } from './coreEnums';
import type { ICurveName } from './coreTypesBase';
import type { IUnsignedMessage } from './coreTypesMessage';
import type { IUnsignedTxPro } from './coreTypesTx';
import type { IBtcForkNetwork } from '../chains/btc/types';

export * from './coreEnums';
export * from './coreTypesBase';
export * from './coreTypesMessage';
export * from './coreTypesTx';

// ----------------------------------------------

export type ICoreApiNetworkInfo = {
  networkChainCode: string;
  chainId: string;
  networkId: string;
  networkImpl: string;
  addressPrefix?: string;
  curve?: ICurveName;
  isTestnet?: boolean;
};
export type ICoreApiGetAddressesQueryHdBase = {
  networkInfo: ICoreApiNetworkInfo;
  template: string;
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  indexes: number[];
};
export type ICoreApiGetAddressesQueryHdEvm = ICoreApiGetAddressesQueryHdBase;
export type ICoreApiGetAddressesQueryHdBtc = ICoreApiGetAddressesQueryHdBase & {
  addressEncoding: EAddressEncodings;
};
export type ICoreApiGetAddressesQueryHdTon = ICoreApiGetAddressesQueryHdBase & {
  addressEncoding: EAddressEncodings;
};

export type ICoreApiGetAddressesQueryHd =
  | ICoreApiGetAddressesQueryHdBase
  | ICoreApiGetAddressesQueryHdEvm
  | ICoreApiGetAddressesQueryHdBtc;

export type ICoreApiGetAddressQueryImportedBase = {
  networkInfo: ICoreApiNetworkInfo;
  privateKeyRaw: string; // privateKey HEX format
  privateKeyInfo?: ISecretPrivateKeyInfo;
};
export type ICoreApiGetAddressQueryImportedBtc =
  ICoreApiGetAddressQueryImportedBase & {
    addressEncoding: EAddressEncodings | undefined;
  };
export type ICoreApiGetAddressQueryImportedTon =
  ICoreApiGetAddressQueryImportedBase & {
    addressEncoding: EAddressEncodings | undefined;
  };
export type ICoreApiGetAddressQueryImported =
  | ICoreApiGetAddressQueryImportedBase
  | ICoreApiGetAddressQueryImportedBtc;
export type ICoreApiGetAddressQueryPublicKey = {
  networkInfo: ICoreApiNetworkInfo;
  publicKey: string; // xpub in BTC and other UTXO chain
  publicKeyInfo?: ISecretPublicKeyInfo;
  addressEncoding?: EAddressEncodings;
};
export type ICoreApiGetAddressItem = {
  address: string;
  publicKey: string; // TODO rename to pub
  // utxo use accountPrefixPath like    m/49'/0'/1'
  //           but not fullPath like    m/49'/0'/1'/0/0
  path?: string;
  relPath?: string;
  xpub?: string;
  xpubSegwit?: string;
  addresses?: { [relPathOrNetworkId: string]: string };
};
export type ICoreApiGetAddressesResult = {
  addresses: ICoreApiGetAddressItem[];
};
export enum ECoreApiExportedSecretKeyType {
  publicKey = 'publicKey',
  privateKey = 'privateKey',
  xpub = 'xpub',
  xprvt = 'xprvt',
}
export type ICoreApiGetExportedSecretKey = ICoreApiSignBasePayload & {
  keyType: ECoreApiExportedSecretKeyType;
  addressEncoding?: EAddressEncodings;
};
// ----------------------------------------------
export type ICoreApiPrivateKeysMap = {
  // path type
  //   simple: full path
  //     utxo: base path
  // imported: ""
  [path: string]: string; // encryptedPrivateKey by password
};
export type ICoreApiSignAccount = {
  address: string;
  path: string;
  pub?: string;
  pubKey?: string; // TODO rename to pub?
  xpub?: string;
  template?: string;
};
export type ICoreApiValidateXpubParams = {
  xpub: string;
  btcForkNetwork: IBtcForkNetwork;
};
export type ICoreApiValidateXprvtParams = {
  xprvt: string;
  btcForkNetwork: IBtcForkNetwork;
};
export type ICoreApiSignBasePayload = {
  networkInfo: ICoreApiNetworkInfo;
  btcExtraInfo?: ICoreApiSignBtcExtraInfo;

  password: string;
  credentials: ICoreCredentialsInfo;

  account: ICoreApiSignAccount;
  relPaths?: string[]; // used for get privateKey of other utxo address
  signOnly?: boolean;
};
export type ICoreApiSignBtcExtraInfo = {
  inputAddressesEncodings?: Array<EAddressEncodings | undefined>;
  nonWitnessPrevTxs?: {
    [txid: string]: string; // rawTx string
  };
  pathToAddresses: {
    [fullPath: string]: {
      address: string;
      relPath: string;
      fullPath: string;
    };
  };
  addressToPath: {
    [address: string]: {
      address: string;
      relPath: string;
      fullPath: string;
    };
  };
};
export type ICoreApiSignTxPayload = ICoreApiSignBasePayload & {
  unsignedTx: IUnsignedTxPro;
};
export type ICoreApiSignMsgPayload = ICoreApiSignBasePayload & {
  unsignedMsg: IUnsignedMessage;
};
export type ICoreApiGetPrivateKeysMapHdQuery = {
  account: {
    path: string;
    address: string;
  };
  password: string;
  hdCredential: ICoreHdCredentialEncryptHex;
  relPaths?: string[];
};
export type ICoreImportedCredential = {
  // rawPrivateKey
  privateKey: string;
};
export type ICoreImportedCredentialEncryptHex = string;

export type ICoreHdCredential = {
  seed: string; // rawSeed
  entropy: string; // rawEntropy
};
export type ICoreHdCredentialEncryptHex = string;

export enum ECoreCredentialType {
  hd = 'hd',
  imported = 'imported',
}
export type ICoreCredentialsInfo = {
  hd?: ICoreHdCredentialEncryptHex;
  imported?: ICoreImportedCredentialEncryptHex;
};
