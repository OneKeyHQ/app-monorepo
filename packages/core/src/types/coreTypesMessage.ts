import type {
  EMessageTypesAda,
  EMessageTypesAptos,
  EMessageTypesBtc,
  EMessageTypesCommon,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import type { ISignMessageRequest } from '../chains/aptos/types';
import type { SignatureOptions } from 'bitcoinjs-message';

// dapp -> onekey -> external wallet
// dapp -> onekey -> hd, hw, privateKey
// onekey -> external wallet
// onekey -> hd, hw, privateKey
export type IUnsignedMessageEth = {
  type: EMessageTypesEth;
  message: string;
  payload?: any;
};

export type IUnsignedMessageAptos = {
  type: EMessageTypesAptos;
  message: string;
  payload?: ISignMessageRequest;
};

export type IUnsignedMessageAda = {
  type: EMessageTypesAda;
  message: string;
  payload: {
    addr: string;
    payload: string;
  };
};

export type IUnsignedMessageCommon = {
  type: EMessageTypesCommon;
  message: string;
  secure?: boolean;
  payload?: any;
};

export type IUnsignedMessageBtc = {
  type: EMessageTypesBtc;
  message: string;
  sigOptions?: (SignatureOptions & { noScriptType?: boolean }) | null;
  payload?: {
    isFromDApp?: boolean;
  };
};

export type IUnsignedMessageCfx = IUnsignedMessageEth;

export type IUnsignedMessage =
  | IUnsignedMessageCommon
  | IUnsignedMessageEth
  | IUnsignedMessageBtc
  | IUnsignedMessageAptos
  | IUnsignedMessageAda
  | IUnsignedMessageCfx;
