import type { CurveName } from '@onekeyhq/engine/src/secret';
import type { IUnsignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import type { AddressEncodings } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';

import type { SignatureOptions } from 'bitcoinjs-message';

/*
enum ETHMessageTypes {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPED_DATA_V1 = 2,
  TYPED_DATA_V3 = 3,
  TYPED_DATA_V4 = 4,
} 
*/
// TODO use packages/engine/src/types/message.ts
export enum ECoreUnsignedMessageTypeEvm {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPED_DATA_V1 = 2,
  TYPED_DATA_V3 = 3,
  TYPED_DATA_V4 = 4,
}
export enum ECoreUnsignedMessageTypeBtc {
  ECDSA = 'ecdsa',
  BIP322_SIMPLE = 'bip322-simple',
}
export type ICoreUnsignedMessageEvm = {
  type: ECoreUnsignedMessageTypeEvm;
  message: string;
};
export type ICoreUnsignedMessageBtc = {
  type: ECoreUnsignedMessageTypeBtc;
  message: string;
  sigOptions?: (SignatureOptions & { noScriptType?: boolean }) | null;
  payload?: {
    isFromDApp?: boolean;
  };
};

export type ICoreUnsignedMessage =
  | ICoreUnsignedMessageEvm
  | ICoreUnsignedMessageBtc;

// ----------------------------------------------

export type ICoreApiGetAddressesQueryHdBase = {
  template: string;
  hdCredential: ICoreHdCredential;
  password: string;
  indexes: number[];
};
export type ICoreApiGetAddressesQueryHdEvm = ICoreApiGetAddressesQueryHdBase;
export type ICoreApiGetAddressesQueryHdBtc = ICoreApiGetAddressesQueryHdBase & {
  networkChainCode: string;
  addressEncoding: AddressEncodings;
};
export type ICoreApiGetAddressesQueryHd =
  | ICoreApiGetAddressesQueryHdBase
  | ICoreApiGetAddressesQueryHdEvm
  | ICoreApiGetAddressesQueryHdBtc;

export type ICoreApiGetAddressQueryImportedBase = {
  privateKeyRaw: string;
};
export type ICoreApiGetAddressQueryImportedBtc =
  ICoreApiGetAddressQueryImportedBase & {
    networkChainCode: string;
    template?: string; // TODO use addressEncoding?
  };
export type ICoreApiGetAddressQueryImported =
  | ICoreApiGetAddressQueryImportedBase
  | ICoreApiGetAddressQueryImportedBtc;

export type ICoreApiGetAddressItem = {
  address: string;
  publicKey: string;
  path?: string;
  xpub?: string;
  xpubSegwit?: string;
  addresses?: { [relPath: string]: string };
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
  [path: string]: string;
};
export type ICoreApiSignAccount = {
  address: string;
  path: string;
  pubKey?: string;
  template?: string;
  relPaths?: string[]; // used for get privateKey of other address
};
export type ICoreApiSignBasePayload = {
  networkChainCode?: string;
  password: string;
  account: ICoreApiSignAccount;
  credentials: ICoreCredentialsInfo;
  btcExtraInfo?: ICoreApiSignBtcExtraInfo;
};
export type ICoreApiSignBtcExtraInfo = {
  networkImpl: string;
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
  unsignedMsg: ICoreUnsignedMessage;
};
export type ICoreApiGetPrivateKeysMapQuery = {
  account: {
    path: string;
    address: string;
  };
  password: string;
  seed: string;
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
