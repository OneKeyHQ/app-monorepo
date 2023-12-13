import type { IEncodedTx } from '@onekeyhq/core/src/types';

export type IEIP1559Fee = {
  confidence: 0;
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  value: string;
};

export type IEstimateGasParams = {
  networkId: string;
  encodedTx: IEncodedTx;
};

export type IFeeInfoUnit = {
  isEIP1559?: boolean;
  baseFeeValue?: string;
  price?: string; // in GWEI
  price1559?: IEIP1559Fee;
  limit?: string;
  limitForDisplay?: string;
  limitUsed?: string;
  isBtcForkChain?: boolean;
  btcFee?: number;
  feeRate?: string;
  feeDecimals: 0;
  feeSymbol: string;
  nativeDecimals: 0;
  nativeSymbol: string;
};

export type IEstimateGasResp = {
  isEIP1559: true;
  feeDecimals: 0;
  feeSymbol: string;
  nativeDecimals: 0;
  nativeSymbol: string;
  fees: IEIP1559Fee[] | string[];
  baseFeeValue?: string;
  limit: string;
  limitForDisplay: string;
};
