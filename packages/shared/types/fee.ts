import type { IEncodedTx } from '@onekeyhq/core/src/types';

export enum ESendFeeStatus {
  Loading = 'Loading',
  Idle = 'Idle',
  Success = 'Success',
  Error = 'Error',
}

export enum EFeeType {
  Standard = 'Standard',
  Custom = 'Custom',
}

export type IGasEIP1559 = {
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  gasLimitForDisplay: string;
  gasPrice?: string;
};

export type IGasLegacy = {
  gasPrice: string;
  gasLimit: string;
  gasLimitForDisplay?: string;
};

export type IFeeUTXO = {
  feeRate?: string;
  feeValue?: string;
};

export type IEstimateGasParams = {
  networkId: string;
  encodedTx?: IEncodedTx;
};

export type IFeeInfoUnit = {
  common: {
    baseFeeValue?: string;
    feeDecimals: number;
    feeSymbol: string;
    nativeDecimals: number;
    nativeSymbol: string;
    nativeTokenPrice: number;
  };
  gas?: IGasLegacy;
  gasEIP1559?: IGasEIP1559;
  feeUTXO?: IFeeUTXO;
};

export type IGasEIP1559Prediction = IGasEIP1559 & { confidence: number };

export type IEstimateGasResp = {
  isEIP1559: true;
  feeDecimals: number;
  feeSymbol: string;
  nativeDecimals: number;
  nativeSymbol: string;
  baseFeeValue?: string;
  gas?: IGasLegacy[];
  gasEIP1559?: IGasEIP1559[];
  feeUTXO?: IFeeUTXO[];
  limit: string;
  limitForDisplay: string;
  nativeTokenPrice: {
    price: number;
    price24h: number;
  };
  prediction?: IGasEIP1559Prediction[];
};
