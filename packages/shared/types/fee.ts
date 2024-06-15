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
  confidence?: number;
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

export type IFeeTron = {
  requiredBandwidth: number;
  requiredEnergy: number;
  originalFee: number;
};

export type IFeeSol = {
  computeUnitPrice: string;
};

export type IFeeFil = {
  gasFeeCap: string;
  gasPremium: string;
  gasLimit: string;
};

export type IEstimateGasParams = {
  networkId: string;
  accountAddress: string;
  encodedTx?: IEncodedTx;
};

export type IFeeInfoUnit = {
  common: {
    baseFee?: string;
    feeDecimals: number;
    feeSymbol: string;
    nativeDecimals: number;
    nativeSymbol: string;
    nativeTokenPrice?: number;
  };
  gas?: IGasLegacy;
  gasEIP1559?: IGasEIP1559;
  feeUTXO?: IFeeUTXO;
  feeTron?: IFeeTron;
  gasFil?: IFeeFil;
  feeSol?: IFeeSol;
};

export type IEstimateFeeParamsSol = {
  computeUnitLimit: string;
  baseFee: string; // lamports
  computeUnitPriceDecimals: number;
};

export type IEstimateFeeParams = {
  estimateFeeParamsSol?: IEstimateFeeParamsSol;
};

export type ISendSelectedFeeInfo = {
  feeInfo: IFeeInfoUnit;
  total: string;
  totalNative: string;
  totalFiat: string;
  totalNativeForDisplay: string;
  totalFiatForDisplay: string;
};

export type IEstimateGasResp = {
  isEIP1559: true;
  feeDecimals: number;
  feeSymbol: string;
  nativeDecimals: number;
  nativeSymbol: string;
  baseFee?: string;
  computeUnitPrice?: string;
  gas?: IGasLegacy[];
  gasEIP1559?: IGasEIP1559[];
  feeUTXO?: IFeeUTXO[];
  feeTron?: IFeeTron[];
  gasFil?: IFeeFil[];
  nativeTokenPrice?: {
    price: number;
    price24h: number;
  };
};

export type IFeeSelectorItem = {
  label: string;
  icon: string;
  value: number;
  feeInfo: IFeeInfoUnit;
  type: EFeeType;
};
