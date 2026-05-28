export enum EKytRiskLevel {
  Checking = 'checking',
  None = 'none',
  Low = 'low',
  Moderate = 'moderate',
  High = 'high',
  Severe = 'severe',
  Failed = 'failed',
}

export type IKytRiskFactor = {
  category: string;
  entity?: string;
  exposureType?: string;
  hops?: number;
  amountUsd?: string;
  percent?: string;
};

export type IKytRiskDetail = {
  level: EKytRiskLevel;
  checkedAt: string;
  asset: {
    symbol: string;
    tokenImageUri?: string;
    networkName: string;
  };
  transferAmount: string;
  factors: IKytRiskFactor[];
  reportUrl?: string;
};

export type IKytAssetResult = {
  symbol: string;
  tokenName: string;
  tokenImageUri?: string;
  level: EKytRiskLevel;
};

export type IKytCheckResult = {
  level: EKytRiskLevel;
  assetsChecked?: number;
  assets?: IKytAssetResult[];
};

export type IKytSupportedAsset = {
  networkId: string;
  networkName: string;
  tokenAddress: string;
  tokenLogoURI: string;
  tokenName: string;
  tokenSymbol: string;
};
