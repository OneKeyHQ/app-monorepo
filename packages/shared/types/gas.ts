import type { IEncodedTx } from '@onekeyhq/core/src/types';

export enum EGasType {
  Standard = 'Standard',
  Custom = 'Custom',
}

export type IGasEIP1559 = {
  confidence: 0;
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice: string;
};

export type IGasLegacy = {
  gasPrice: string;
  gasLimit: string;
};

export type IGasUTXO = {
  feeRate?: string;
  feeValue?: string;
};

export type ICustomGasLegacy = {
  gasPrice: string;
};

export type ICustomGasEIP1559 = {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
};

export type ICustomGasUTXO = {
  feeRate: string;
};

export type ICustomGas = ICustomGasLegacy | ICustomGasEIP1559 | ICustomGasUTXO;

export type IEstimateGasParams = {
  networkId: string;
  encodedTx: IEncodedTx;
};

export type IFeeInfoUnit = {
  isEIP1559?: boolean;
  isBtcForkChain?: boolean;
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
  gasUTXO?: IGasUTXO;
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
