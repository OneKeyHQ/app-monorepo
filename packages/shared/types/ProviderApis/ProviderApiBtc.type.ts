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
  memo?: string;
  memos?: string[];
};

export type ISignMessageParams = {
  message: string;
  type: EMessageTypesBtc;
};

export interface IToSignInput {
  index: number;
  address?: string;
  publicKey?: string;
  sighashTypes?: number[];
  disableTweakSigner?: boolean;
  useTweakedSigner?: boolean;
}

export interface ISignPsbtOptions {
  autoFinalized?: boolean;
  toSignInputs?: IToSignInput[];
  isBtcWalletProvider?: boolean;
}

export interface ISignPsbtParams {
  psbtHex: string;
  options?: ISignPsbtOptions;
}

export type ISignPsbtsParams = {
  psbtHexs: string[];
  options: ISignPsbtOptions;
};

export type IPushPsbtParams = {
  psbtHex: string;
};

/**
 * @experimental Params for `deriveContextHash`. Output is per-public-key:
 * the IKM is the connected leaf's BIP-32 private key (HD) or the raw
 * imported private key (imported). Different connected addresses produce
 * different outputs. See
 * `core/src/chains/btc/sdkBtc/deriveContextHashFromCredentials.ts` for the
 * full contract; `deriveContextHash.ts` for algorithm and validation.
 */
export type IDeriveContextHashParams = {
  appName: string;
  context: string;
};
