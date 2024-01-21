import type { EMessageTypesBtc } from '../message';

export enum ENetworkTypeEnum {
  MAINNET,
  TESTNET,
}

export type INetworkType = 'livenet' | 'testnet';

export const NETWORK_TYPES = [
  {
    value: ENetworkTypeEnum.MAINNET,
    label: 'LIVENET',
    name: 'livenet',
    validNames: [0, 'livenet', 'mainnet'],
  },
  {
    value: ENetworkTypeEnum.TESTNET,
    label: 'TESTNET',
    name: 'testnet',
    validNames: ['testnet'],
  },
];

export type ISwitchNetworkParams = { network: INetworkType };

export type ISignMessageParams = {
  message: string;
  type: EMessageTypesBtc;
};
