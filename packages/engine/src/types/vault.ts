import { EIP1559Fee } from './network';

import type { Engine } from '../index';
import type { SignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
};
export type IVaultOptions = IVaultFactoryOptions & {
  engine: Engine;
};

export type IBroadcastedTx = SignedTx;

export type ISignCredentialOptions = {
  password?: string;
};

export type INftTransferInfo = any;
export type ISwapInfo = any;
export type ITransferInfo = {
  from: string;
  to: string;
  amount: string;
  token?: string;
};

export type IEncodedTxAny = any;
export type IDecodedTxAny = any;

// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IFeeInfoUnit = {
  eip1559?: boolean;
  price?: string | EIP1559Fee;
  limit?: string;
};

// TODO rename to IFeeInfoMeta
export type IFeeInfo = {
  // TODO merge (limit, prices, EIP1559Fee) to single field
  limit?: string;
  prices: Array<string | EIP1559Fee>;
  symbol?: string;
  decimals?: number;
  nativeSymbol?: string;
  nativeDecimals?: number;
  // TODO rename to feeInTx
  tx?: IFeeInfoUnit;
  currency?: string;
  eip1559?: boolean;
};

export type IFeeInfoSelectedType = 'preset' | 'custom';
export type IFeeInfoSelected = {
  type: IFeeInfoSelectedType;
  preset: string; // '0' | '1' | '2';
  custom?: IFeeInfoUnit;
};

export type IFeeInfoPayload = {
  selected: IFeeInfoSelected;
  info: IFeeInfo;
  current: {
    total: string; // total fee in Gwei
    totalNative: string; // total fee in ETH
    value: IFeeInfoUnit;
  };
};
