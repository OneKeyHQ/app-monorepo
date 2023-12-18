import type { IEncodedTx } from '@onekeyhq/core/src/types';

export type IGasEIP1559 = {
  confidence: 0;
  baseFeePerGas: string; // chainValue not GWEI
  maxFeePerGas: string; // chainValue not GWEI
  maxPriorityFeePerGas: string; // chainValue not GWEI
  gasPrice: string;
};

export type IGasLegacy = {
  gasPrice: string; // chainValue not GWEI
};

export type IEstimateGasParams = {
  networkId: string;
  encodedTx: IEncodedTx;
};

export type IGasBTC = {
  feeRate?: string;
  btcFee?: string;
};

export type IFeeInfoUnit = {
  isEIP1559?: boolean;
  isBtcForkChain?: boolean;
  common: {
    baseFeeValue?: string;
    limit?: string;
    limitForDisplay?: string;
    limitUsed?: string;
    feeDecimals: 0;
    feeSymbol: string;
    nativeDecimals: 0;
    nativeSymbol: string;
  };
  gas?: IGasLegacy;
  gasEIP1559?: IGasEIP1559;
  gasBTC?: IGasBTC;
};

export type IEstimateGasResp = {
  isEIP1559: true;
  feeDecimals: 0;
  feeSymbol: string;
  nativeDecimals: 0;
  nativeSymbol: string;
  fees: IGasEIP1559[] | string[];
  baseFeeValue?: string;
  limit: string;
  limitForDisplay: string;
};
