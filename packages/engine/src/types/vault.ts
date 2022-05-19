import { EVMDecodedItem } from '../vaults/impl/evm/decoder/decoder';

import { EIP1559Fee } from './network';

import type { Engine } from '../index';
import type { SignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
  walletId?: string;
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
  max?: boolean;
};

export type IApproveInfo = {
  from: string; // token owner
  token: string; // token address
  amount: string; // amount
  spender: string; // spender to authorize
};

export type IEncodedTxAny = any;
export type IDecodedTxAny = any;
export type IDecodedTx = EVMDecodedItem | null;

export enum IEncodedTxUpdateType {
  transfer = 'transfer',
  tokenApprove = 'tokenApprove',
}

export type IEncodedTxUpdatePayloadTokenApprove = {
  amount: string;
};
export type IEncodedTxUpdatePayloadTransfer = {
  amount: string;
};

export type IEncodedTxUpdateOptions = {
  type?: IEncodedTxUpdateType;
};

// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IFeeInfoUnit = {
  eip1559?: boolean;
  price?: string | EIP1559Fee;
  limit?: string;
};

// TODO rename to IFeeInfoMeta
export type IFeeInfo = {
  editable?: boolean;
  // TODO merge (limit, prices, EIP1559Fee) to single field
  limit?: string; // calculated gasLimit of encodedTx
  prices: Array<string | EIP1559Fee>; // preset gasPrices: normal, fast, rapid
  symbol?: string; // feeSymbol: GWEI
  decimals?: number; // feeDecimals: 9
  nativeSymbol?: string; // ETH
  nativeDecimals?: number; // 18
  // TODO rename to feeInTx
  tx?: IFeeInfoUnit | null;
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

export type IPrepareWatchingAccountsParams = {
  target: string;
  name: string;
};

export type IPrepareImportedAccountsParams = {
  privateKey: Buffer;
  name: string;
};

export type IPrepareSoftwareAccountsParams = {
  password: string;
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
};

export type IPrepareHardwareAccountsParams = {
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
};

export type IPrepareAccountsParams =
  | IPrepareWatchingAccountsParams
  | IPrepareImportedAccountsParams
  | IPrepareSoftwareAccountsParams
  | IPrepareHardwareAccountsParams;
