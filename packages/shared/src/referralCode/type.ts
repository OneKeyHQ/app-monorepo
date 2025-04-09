export interface IInviteSummary {
  faqs: Array<{
    q: string;
    a: string;
  }>;
  inviteUrl: string;
  inviteCode: string;
  withdrawAddresses: string[];
  enabledNetworks: string[];
  totalRewards: string;
  rebateConfig: {
    rebate: number;
    discount: number;
    threshold: number;
  };
  Earn: Record<string, any>;
  HardwareSales: {
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
  };
  rebateLevel: string;
  banners: any[];
}

interface IHardwareSalesRecordItem {
  _id: string;
  itemUniqueId: string;
  side: string;
  subject: string;
  userId: string;
  amount: string;
  createdAt: string;
  effectiveTime: string | null;
  orderTotalAmount: string;
  payReceipt: string | null;
  payTime: string | null;
  receivceAddress: string | null;
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
