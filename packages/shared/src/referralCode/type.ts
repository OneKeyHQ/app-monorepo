interface IReward {
  title: string;
  description: string;
  monthlySalesFiatValue: string;
  available?: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    usdValue: string;
    fiatValue: string;
  }[];
  pending?: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
    usdValue: string;
  }[];
}

export interface IInviteSummary {
  faqs: Array<{
    q: string;
    a: string;
  }>;
  inviteUrl: string;
  inviteCode: string;
  withdrawAddresses: {
    networkId: string;
    address: string;
  }[];
  enabledNetworks: string[];
  totalRewards: string;
  levelPercent: string;
  nextRebateLevel: string;
  Onchain: IReward;
  rebateConfig: {
    level: number;
    rebate: number;
    discount: number;
    threshold: number;
    emoji: string;
    labelKey: string;
    label: string;
  };
  rebateLevels: {
    level: number;
    rebate: number;
    discount: number;
    thresholdFiatValue: string;
    emoji: string;
    labelKey: string;
    label: string;
  }[];
  HardwareSales: IReward & {
    nextStage: { isEnd: boolean; amount: string; label: string };
  };
  banners: any[];
  cumulativeRewards: {
    distributed: string;
    undistributed: string;
    nextDistribution: string;
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
  };
}

export interface IEarnWalletHistoryItem {
  networkId: string;
  address: string;
  createdAt: string;
}

export interface IEarnWalletHistoryNetwork {
  networkId: string;
  name: string;
  logoURI: string;
}

export interface IEarnWalletHistory {
  items: {
    items: IEarnWalletHistoryItem[];
    total: number;
  }[];
  networks: IEarnWalletHistoryNetwork[];
  total: number;
}

interface IHardwareSalesRecordItem {
  _id: string;
  itemUniqueId: string;
  side: 'in' | 'out';
  subject: string;
  userId: string;
  createdAt: string;
  effectiveTime: string | null;
  orderTotalAmount: string;
  payReceipt: string | null;
  payTime: string | null;
  orderName: string | null;
  source: string | null;
  receivceAddress: string | null;
  heading: string;
  title: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  updatedAt: string;
  fiatValue: string;
  status: string;
}

export interface IEarnRewardItem {
  amount: string;
  networkId: string;
  token: {
    networkId: string;
    address: string;
    name: string;
    logoURI: string;
    symbol: string;
  };
  vaultName: string;
  vaultAddress: string;
  provider: string;
  fiatValue: string;
}

export interface IEarnRewardResponse {
  fiatValue: string;
  items: {
    accountAddress: string;
    fiatValue: string;
    items: IEarnRewardItem[];
  }[];
  total: number;
}

export interface IEarnPositionItem {
  key: string;
  networkId: string;
  accountAddress: string;
  deposited: string;
}

export interface IEarnProtocol {
  networkId: string;
  symbol: string;
  provider: string;
  vault: string;
}

export interface IEarnPositionsResponse {
  list: IEarnPositionItem[];
  protocols: Record<string, IEarnProtocol>;
}
export interface IHardwareSalesRecord {
  available: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
  };
  pending: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
  };
  items: IHardwareSalesRecordItem[];
}

export interface IInvitePaidItem {
  _id: string;
  networkId: string;
  address: string;
  token: {
    networkId: string;
    address: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  version: number;
  rebateAmount: string;
  tx: string;
  updatedAt: string;
  createdAt: string;
  paidAmount: string;
}

export interface IInvitePaidHistory {
  total: number;
  items: IInvitePaidItem[];
}

export interface IInviteHistory {
  total: number;
  items: IHardwareSalesRecordItem[];
}

export interface IInvitePostConfig {
  referralReward: {
    amount: number;
    unit: string;
  };
  commissionRate: {
    amount: number;
    unit: string;
  };
  friendDiscount: {
    amount: number;
    unit: string;
  };
  locales: {
    Earn: {
      title: string;
      subtitle: string;
      for_you: {
        title: string;
        subtitle: string;
      };
      for_your_friend: {
        title: string;
        subtitle: string;
      };
    };
  };
}
