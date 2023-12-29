import type { IEncodedTx } from '@onekeyhq/core/src/types';

export enum EGasType {
  Standard = 'Standard',
  Custom = 'Custom',
}

export type IGasEIP1559 = {
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice?: string;
};

export type IGasLegacy = {
  gasPrice: string;
  gasLimit: string;
};

export type IFeeUTXO = {
  feeRate?: string;
  feeValue?: string;
};

export type ICustomGasLegacy = {
  gasPrice: string;
  gasLimit: string;
};

export type ICustomGasEIP1559 = {
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
};

export type ICustomFeeUTXO = {
  feeRate: string;
};

export type ICustomGas = {
  gas: ICustomGasLegacy;
  gasEIP1559: ICustomGasEIP1559;
  feeUTXO: ICustomFeeUTXO;
  gasLimit: string;
};

export type IEstimateGasParams = {
  networkId: string;
  encodedTx: IEncodedTx;
};

export type IFeeInfoUnit = {
  common?: {
    baseFeeValue?: string;
    limit?: string;
    limitForDisplay?: string;
    limitUsed?: string;
    feeDecimals: number;
    feeSymbol: string;
    nativeDecimals: number;
    nativeSymbol: string;
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
  gasUTXO?: IFeeUTXO[];
  limit: string;
  limitForDisplay: string;
  nativeTokenPrice: {
    price: number;
    price24h: number;
  };
  prediction?: IGasEIP1559Prediction[];
};
