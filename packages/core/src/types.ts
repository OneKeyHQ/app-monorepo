import type { ICurveName } from '@onekeyhq/engine/src/secret';
import type { IUnsignedMessage } from '@onekeyhq/engine/src/types/message';
import type { IUnsignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import type { AddressEncodings } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';

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
  hdCredential: ICoreHdCredential;
  password: string;
  indexes: number[];
};
export type ICoreApiGetAddressesQueryHdEvm = ICoreApiGetAddressesQueryHdBase;
export type ICoreApiGetAddressesQueryHdBtc = ICoreApiGetAddressesQueryHdBase & {
  addressEncoding: AddressEncodings;
};

export type ICoreApiGetAddressesQueryHd =
  | ICoreApiGetAddressesQueryHdBase
  | ICoreApiGetAddressesQueryHdEvm
  | ICoreApiGetAddressesQueryHdBtc;

export type ICoreApiGetAddressQueryImportedBase = {
  networkInfo: ICoreApiNetworkInfo;
  privateKeyRaw: string;
};
export type ICoreApiGetAddressQueryImportedBtc =
  ICoreApiGetAddressQueryImportedBase & {
    template?: string; // TODO use addressEncoding?
  };
export type ICoreApiGetAddressQueryImported =
  | ICoreApiGetAddressQueryImportedBase
  | ICoreApiGetAddressQueryImportedBtc;
export type ICoreApiGetAddressQueryPublicKey = {
  networkInfo: ICoreApiNetworkInfo;
  publicKey: string;
};
export type ICoreApiGetAddressItem = {
  address: string;
  publicKey: string; // TODO rename to pub
  path?: string;
  xpub?: string;
  xpubSegwit?: string;
  addresses?: { [relPathOrNetworkId: string]: string };
};
export type ICoreApiGetAddressesResult = {
  addresses: ICoreApiGetAddressItem[];
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
  template?: string;
  relPaths?: string[]; // used for get privateKey of other address
};
export type ICoreApiSignBasePayload = {
  networkInfo: ICoreApiNetworkInfo;
  password: string;
  account: ICoreApiSignAccount;
  credentials: ICoreCredentialsInfo;
  btcExtraInfo?: ICoreApiSignBtcExtraInfo;
};
export type ICoreApiSignBtcExtraInfo = {
  inputAddressesEncodings?: string[];
  nonWitnessPrevTxs?: { [txid: string]: string };
  pathToAddresses: {
    [path: string]: {
      address: string;
      relPath: string;
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
  hdCredential: ICoreHdCredential;
  relPaths?: string[];
};
export type ICoreImportedCredential = {
  // encryptedPrivateKey
  privateKey: string;
};
export type ICoreHdCredential = {
  // encryptedSeed
  seed: string;
  entropy: string;
};
export type ICoreCredentialsInfo = {
  hd?: ICoreHdCredential;
  imported?: ICoreImportedCredential;
};
