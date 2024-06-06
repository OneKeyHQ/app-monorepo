export type IV4EIP1559Fee = {
  baseFee: string;

  maxPriorityFeePerGas: string; // in GWEI
  maxPriorityFeePerGasValue?: string;

  maxFeePerGas: string; // in GWEI
  maxFeePerGasValue?: string;

  gasPrice?: string; // in GWEI
  gasPriceValue?: string;

  confidence?: number;
  price?: string;
};
// TODO rename to IFeeInfoValue, IFeeInfoData, IFeeInfoDetail
export type IV4FeeInfoUnit = {
  eip1559?: boolean;
  priceValue?: string;
  price?: string; // in GWEI
  price1559?: IV4EIP1559Fee;
  limit?: string;
  limitForDisplay?: string;
  limitUsed?: string;
  similarToPreset?: string;
  waitingSeconds?: number;
  isBtcForkChain?: boolean;
  btcFee?: number;
  feeRate?: string;
  // sol prioritization fees
  computeUnitPrice?: string;
  isSolChain?: boolean;
};
