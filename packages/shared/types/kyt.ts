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
  amountUsd?: number;
  percent?: number;
};

export type IKytRiskDetail = {
  level: EKytRiskLevel;
  checkedAt: string;
  asset: {
    symbol: string;
    tokenName?: string;
    tokenImageUri?: string;
    networkName: string;
  };
  transferAmount: string;
  factors: IKytRiskFactor[];
  reportUrl?: string;
};

export type IKytSupportedAsset = {
  networkId: string;
  networkName: string;
  tokenAddress: string;
  tokenLogoURI: string;
  tokenName: string;
  tokenSymbol: string;
};

export type IKytHistoryAsset = {
  networkId: string;
  tokenAddress: string;
  tokenSymbol: string;
  providerCoin?: string;
};

export type IKytHistoryListItem = {
  networkId: string;
  txid: string;
  accountAddress: string;
  tokenAddress: string;
  status: string;
  level: EKytRiskLevel;
  checkedAt: number;
  asset: IKytHistoryAsset;
  transfer: {
    txid: string;
    accountAddress: string;
  };
  reasons: IKytRiskFactor[];
  reportUrl?: string;
};

// KYT block attached to a history tx by the server (per-tx, covers all transfers).
export type IKytHistoryResult = {
  txid: string;
  highestLevel: EKytRiskLevel;
  list: IKytHistoryListItem[];
};
