import type { BtcMessageTypes } from '@onekeyhq/engine/src/types/message';

export enum NetworkTypeEnum {
  MAINNET,
  TESTNET,
}

export type NetworkType = 'livenet' | 'testnet';

export const NETWORK_TYPES = [
  {
    value: NetworkTypeEnum.MAINNET,
    label: 'LIVENET',
    name: 'livenet',
    validNames: [0, 'livenet', 'mainnet'],
  },
  {
    value: NetworkTypeEnum.TESTNET,
    label: 'TESTNET',
    name: 'testnet',
    validNames: ['testnet'],
  },
];

export type SwitchNetworkParams = { network: NetworkType };
export type GetInscriptionParams = { cursor: number; size: number };
export type SendBitcoinParams = {
  toAddress: string;
  satoshis: string;
  feeRate?: string;
};
export type SendInscriptionParams = {
  toAddress: string;
  inscriptionId: string;
  feeRate?: string;
};
export type SignMessageParams = {
  message: string;
  type: BtcMessageTypes;
};
export type PushTxParams = {
  rawTx: string;
};
export type SignPsbtParams = {
  psbtHex: string;
  options: { autoFinalized: boolean };
};

export type SignPsbtsParams = {
  psbtHexs: string[];
  options: { autoFinalized: boolean };
};

export type PushPsbtParams = {
  psbtHex: string;
};

export type InscribeTransferParams = {
  ticker: string;
  amount: string;
};

export type InputToSign = {
  index: number;
  publicKey: string;
  address: string;
  sighashTypes?: number[];
};

export type Inscription = {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  preview: string;
  content: string;
  contentLength: number;
  contentType: string;
  contentBody: string;
  timestamp: number;
  genesisTransaction: string;
  location: string;
  output: string;
  offset: number;
};

export type DecodedPsbt = {
  inputInfos: {
    txid: string;
    vout: number;
    address: string;
    value: number;
    sighashType?: number;
    inscriptions: Inscription[];
  }[];
  outputInfos: {
    address: string;
    value: number;
    inscriptions: Inscription[];
  }[];
  inscriptions: Record<string, Inscription>;
  feeRate: string;
  fee: string;
  hasScammerAddress: boolean;
  warning: string;
};
