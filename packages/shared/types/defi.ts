export type IFetchAccountDeFiPositionsParams = {
  accountId: string;
  networkId: string;
  accountAddress?: string;
  isAllNetworks?: boolean;
  allNetworksAccountId?: string;
  allNetworksNetworkId?: string;
  saveToLocal?: boolean;
};

export enum EDeFiAssetType {
  ASSET = 'asset',
  DEBT = 'debt',
  REWARD = 'reward',
}

export type IDeFiAssetMeta = {
  decimals: number;
  logoUrl?: string;
  isVerified: boolean;
};

export type IDeFiAsset = {
  symbol: string;
  address: string;
  amount: string;
  value: number;
  price: number;
  category: string;
  meta: IDeFiAssetMeta;
};

export type IMetrics = {
  healthFactor: number | null;
};

export type IDeFiSource = {
  provider: string;
  fetchedAt: string;
  ttl: number;
  cached: boolean;
};

export type IDeFiPosition = {
  networkId: string;
  owner: string;
  protocol: string;
  protocolName: string;
  chain: string;
  category: string;
  assets: IDeFiAsset[];
  debts: IDeFiAsset[];
  rewards: IDeFiAsset[];
  metrics: IMetrics;
  source: IDeFiSource;
};

export type IProtocolSummary = {
  protocol: string;
  protocolName: string;
  totalValue: number;
  totalDebt: number;
  netWorth: number;
  networkIds: string[];
  positionCount: number;
  positionIndices: { index: number; networkId: string }[];
  protocolLogo: string;
  protocolUrl: string;
};

export type IFetchAccountDeFiPositionsResp = {
  success: boolean;
  data: {
    positions: Record<string, IDeFiPosition[]>; // <networkId, positions>
    totals: {
      totalValue: number;
      totalDebt: number;
      netWorth: number;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocolSummaries: IProtocolSummary[];
  };
  meta: {
    provider: string;
    networkIds: string[];
    canonicalChains: string[];
    requestedNetworkIds: string[];
    requestedCanonicalChains: string[];
    fetchedAt: string;
    staleness: number;
    freshnessSec: number;
    cached: boolean;
    degraded: boolean;
    warnings: string[];
  };
};

export type IDeFiProtocol = {
  networkId: string;
  owner: string;
  protocol: string; // as protocolId
  categories: string[];
  positions: {
    category: string;
    all: (IDeFiAsset & { type: EDeFiAssetType })[];
    assets: (IDeFiAsset & { type: EDeFiAssetType })[];
    debts: (IDeFiAsset & { type: EDeFiAssetType })[];
    rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
    value: string;
  }[];
};
