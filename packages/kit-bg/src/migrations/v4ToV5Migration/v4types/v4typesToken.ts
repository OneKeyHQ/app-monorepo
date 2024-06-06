export type IV4Token = {
  id: string;
  name: string;

  isNative?: boolean;
  networkId: string;
  tokenIdOnNetwork: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  address?: string;
  impl?: string;
  chainId?: string;
  source?: string;
  coingeckoId?: string;
  swftId?: string;
  marketCap?: number;
  addToIndex?: boolean;
  autoDetected?: boolean;
  sendAddress?: string;
  onramperId?: string;
  moonpayId?: string;

  riskLevel?: EV4TokenRiskLevel;
};

export enum EV4TokenRiskLevel {
  UNKNOWN = 0,
  VERIFIED = 1,
  WARN,
  DANGER,
}
