interface IReward {
  title: string;
  description: string;
  monthlySales: string;
  available?: {
    token: {
      networkId: string;
      address: string;
      logoURI: string;
      name: string;
      symbol: string;
    };
    amount: string;
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
  Earn: IReward;
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
    threshold: number;
    emoji: string;
    labelKey: string;
    label: string;
  }[];
  HardwareSales: IReward;
  banners: any[];
}

interface IHardwareSalesRecordItem {
  _id: string;
  itemUniqueId: string;
  side: 'in' | 'out';
  subject: string;
  userId: string;
  amount: string;
  createdAt: string;
  effectiveTime: string | null;
  orderTotalAmount: string;
  payReceipt: string | null;
  payTime: string | null;
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
  _id: string;
  itemUniqueId: string;
  amount: string;
  effectiveTime: string;
  info: Array<{
    networkId: string;
    accountAddress: string;
    provider: string;
    vaultAddress: string;
    vaultName: string;
    type: string;
  }>;
  orderTotalAmount: string;
  payReceipt: string | null;
  payTime: string | null;
  side: string;
  subject: string;
  title: string;
  token: {
    networkId: string;
    address: string;
    name: string;
    logoURI: string;
    symbol: string;
  };
  userId: string;
  accountAddress: string;
  vaultName: string;
  vaultAddress: string;
  fiatValue: string;
  status: string;
  heading: string;
}

export interface IEarnRewardResponse {
  fiatValue: string;
  items: IEarnRewardItem[];
  total: number;
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
}
