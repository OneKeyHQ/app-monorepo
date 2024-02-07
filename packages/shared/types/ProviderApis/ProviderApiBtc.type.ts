import type { EMessageTypesBtc } from '../message';

export enum EBtcDappNetworkTypeEnum {
  MAINNET,
  TESTNET,
}

export type IBtcDappNetworkName = 'livenet' | 'testnet';

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
];

export type ISwitchNetworkParams = { network: IBtcDappNetworkName };

export type ISignMessageParams = {
  message: string;
  type: EMessageTypesBtc;
};
