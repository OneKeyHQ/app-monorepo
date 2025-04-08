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
