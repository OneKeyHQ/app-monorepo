import type { SignatureOptions } from 'bitcoinjs-message';

export enum EMessageTypesEth {
  ETH_SIGN = 0,
  PERSONAL_SIGN = 1,
  TYPED_DATA_V1 = 2,
  TYPED_DATA_V3 = 3,
  TYPED_DATA_V4 = 4,
}

export enum EMessageTypesAptos {
  SIGN_MESSAGE = 'aptosSignMessage',
}

export enum EMessageTypesCommon {
  SIGN_MESSAGE = 'commonSignMessage',
  SIMPLE_SIGN = 'commonSimpleSign',
}

export enum EMessageTypesBtc {
  ECDSA = 'ecdsa',
  BIP322_SIMPLE = 'bip322-simple',
}

export type IUnsignedMessageEth = {
  type: EMessageTypesEth;
  message: string;
};

export type IUnsignedMessageAptos = {
  type: EMessageTypesAptos;
  message: string;
};

export type IUnsignedMessageCommon = {
  type: EMessageTypesCommon;
  message: string;
  secure?: boolean;
};

export type IUnsignedMessageBtc = {
  type: EMessageTypesBtc;
  message: string;
  sigOptions?: (SignatureOptions & { noScriptType?: boolean }) | null;
  payload?: {
    isFromDApp?: boolean;
  };
};

export type IUnsignedMessage = (
  | IUnsignedMessageCommon
  | IUnsignedMessageEth
  | IUnsignedMessageBtc
  | IUnsignedMessageAptos
) & {
  payload?: any;
};
