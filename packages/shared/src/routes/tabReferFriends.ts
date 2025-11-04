import type {
  IEarnWalletHistoryItem,
  IEarnWalletHistoryNetwork,
} from '../referralCode/type';

export enum ETabReferFriendsRoutes {
  TabReferAFriend = 'TabReferAFriend',
  TabInviteReward = 'TabInviteReward',
  TabYourReferred = 'TabYourReferred',
  TabYourReferredWalletAddresses = 'TabYourReferredWalletAddresses',
  TabHardwareSalesReward = 'TabHardwareSalesReward',
  TabEditAddress = 'TabEditAddress',
  TabEarnReward = 'TabEarnReward',
  TabRewardDistributionHistory = 'TabRewardDistributionHistory',
  TabReferralLevel = 'TabReferralLevel',
}

export type ITabReferFriendsParamList = {
  TabReferAFriend: {
    utmSource?: string;
    code?: string;
  };
  TabInviteReward: undefined;
  TabYourReferred: undefined;
  TabYourReferredWalletAddresses: {
    networks: IEarnWalletHistoryNetwork[];
    items: IEarnWalletHistoryItem[];
  };
  TabHardwareSalesReward: undefined;
  TabEditAddress: {
    enabledNetworks: string[];
    accountId: string;
    address?: string;
    onAddressAdded: ({
      address,
      networkId,
    }: {
      address: string;
      networkId: string;
    }) => void;
  };
  TabEarnReward: {
    title: string;
  };
  TabRewardDistributionHistory: undefined;
  TabReferralLevel: undefined;
};
