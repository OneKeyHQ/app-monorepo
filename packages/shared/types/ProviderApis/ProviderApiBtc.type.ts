import type { EMessageTypesBtc } from '../message';

export enum EBtcDappNetworkTypeEnum {
  MAINNET,
  TESTNET,
  SIGNET,
}

export type IBtcDappNetworkName = 'livenet' | 'testnet' | 'signet';

export const BtcDappNetworkTypes: {
  value: EBtcDappNetworkTypeEnum;
  label: string;
  name: IBtcDappNetworkName;
  validNames: (string | number)[];
}[] = [
  {
    value: EBtcDappNetworkTypeEnum.MAINNET,
    label: 'LIVENET',
    name: 'livenet',
    validNames: [0, 'livenet', 'mainnet'],
  },
  {
    value: EBtcDappNetworkTypeEnum.TESTNET,
    label: 'TESTNET',
    name: 'testnet',
    validNames: ['testnet'],
  },
  {
    value: EBtcDappNetworkTypeEnum.SIGNET,
    label: 'SIGNET',
    name: 'signet',
    validNames: ['signet'],
  },
];

export enum EBtcDappUniSetChainTypeEnum {
  BITCOIN_MAINNET = 'BITCOIN_MAINNET',
  BITCOIN_TESTNET = 'BITCOIN_TESTNET',
  BITCOIN_SIGNET = 'BITCOIN_SIGNET',
}

// https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet/supported-chains
export const BtcDappUniSetChainTypes: Record<
  EBtcDappUniSetChainTypeEnum,
  {
    name: string;
    enum: string;
    network: IBtcDappNetworkName;
  }
> = {
  [EBtcDappUniSetChainTypeEnum.BITCOIN_MAINNET]: {
    name: 'Bitcoin Mainnet',
    enum: EBtcDappUniSetChainTypeEnum.BITCOIN_MAINNET,
    network: 'livenet',
  },
  [EBtcDappUniSetChainTypeEnum.BITCOIN_TESTNET]: {
    name: 'Bitcoin Testnet',
    enum: EBtcDappUniSetChainTypeEnum.BITCOIN_TESTNET,
    network: 'testnet',
  },
  [EBtcDappUniSetChainTypeEnum.BITCOIN_SIGNET]: {
    name: 'Bitcoin Signet',
    enum: EBtcDappUniSetChainTypeEnum.BITCOIN_SIGNET,
    network: 'testnet',
  },
};

export type ISwitchNetworkParams = { network: IBtcDappNetworkName };
export type ISendBitcoinParams = {
  toAddress: string;
  satoshis: string;
  feeRate?: string;
};

export type ISignMessageParams = {
  message: string;
  type: EMessageTypesBtc;
};
