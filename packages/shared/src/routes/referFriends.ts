import type {
  IEarnWalletHistoryItem,
  IEarnWalletHistoryNetwork,
} from '../referralCode/type';

export enum EModalReferFriendsRoutes {
  ReferAFriend = 'ReferAFriend',
  YourReferred = 'YourReferred',
  YourReferredWalletAddresses = 'YourReferredWalletAddresses',
  HardwareSalesReward = 'HardwareSalesReward',
  InviteReward = 'InviteReward',
  EditAddress = 'EditAddress',
  EarnReward = 'EarnReward',
  RewardDistributionHistory = 'RewardDistributionHistory',
  ReferralLevel = 'ReferralLevel',
}

export type IModalReferFriendsParamList = {
  [EModalReferFriendsRoutes.ReferAFriend]: {
    utmSource?: string;
    code?: string;
  };
  [EModalReferFriendsRoutes.YourReferred]: undefined;
  [EModalReferFriendsRoutes.YourReferredWalletAddresses]: {
    networks: IEarnWalletHistoryNetwork[];
    items: IEarnWalletHistoryItem[];
  };
  [EModalReferFriendsRoutes.HardwareSalesReward]: undefined;
  [EModalReferFriendsRoutes.InviteReward]: undefined;
  [EModalReferFriendsRoutes.EditAddress]: {
    enabledNetworks: string[];
    accountId: string;
    address?: string;
    hideAddressBook?: boolean;
    onAddressAdded: ({
      address,
      networkId,
    }: {
      address: string;
      networkId: string;
    }) => void;
  };
  [EModalReferFriendsRoutes.EarnReward]: {
    title: string;
  };
  [EModalReferFriendsRoutes.RewardDistributionHistory]: undefined;
  [EModalReferFriendsRoutes.ReferralLevel]: undefined;
};
