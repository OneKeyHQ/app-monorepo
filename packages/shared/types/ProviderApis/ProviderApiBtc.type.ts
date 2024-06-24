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
