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

export type IV4FeeInfoPrice = string | IV4EIP1559Fee; // in GWEI

export type IV4FeeInfo = {
  limit?: string; // calculated gasLimit of encodedTx
  limitForDisplay?: string;
  prices: Array<IV4FeeInfoPrice>; // preset gasPrices: normal, fast, rapid
  defaultPresetIndex: string; // '0' | '1' | '2';
  waitingSeconds?: Array<number>; // waiting time for different prices
  disableEditFee?: boolean; // disable fee edit

  feeSymbol?: string; // feeSymbol: GWEI
  feeDecimals?: number; // feeDecimals: 9
  nativeSymbol?: string; // ETH
  nativeDecimals?: number; // 18

  // TODO rename to feeInTx
  tx?: IV4FeeInfoUnit | null;
  eip1559?: boolean;
  customDisabled?: boolean;
  baseFeeValue?: string; // A base fee: e.g. L1 fee for Layer 2 networks
  extraInfo?: {
    tokensChangedTo?: { [key: string]: string | undefined };
    networkCongestion?: number;
    estimatedTransactionCount?: number;
    originalPrices?: Array<IV4EIP1559Fee | string> | null;
  } | null;
  isBtcForkChain?: boolean;
  feeList?: number[];
  // for sol prioritization fees
  isSolChain?: boolean;
  computeUnitPrice?: string;
};
