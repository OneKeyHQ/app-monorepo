export enum ETabReferFriendsRoutes {
  TabReferAFriend = 'TabReferAFriend',
  TabInviteReward = 'TabInviteReward',
  TabYourReferred = 'TabYourReferred',
  TabHardwareSalesReward = 'TabHardwareSalesReward',
  TabEarnReward = 'TabEarnReward',
  TabPerpsReward = 'TabPerpsReward',
  TabRewardDistributionHistory = 'TabRewardDistributionHistory',
  TabReferralLevel = 'TabReferralLevel',
}

export type ITabReferFriendsParamList = {
  TabReferAFriend: {
    utmSource?: string;
    code?: string;
  };
  TabInviteReward:
    | {
        showRewardDistributionHistory?: boolean;
      }
    | undefined;
  TabYourReferred: undefined;
  TabHardwareSalesReward:
    | {
        showOrderDetail?: boolean;
        orderId?: string;
      }
    | undefined;
  TabEarnReward: {
    title: string;
  };
  TabPerpsReward: undefined;
  TabRewardDistributionHistory: undefined;
  TabReferralLevel: undefined;
};
