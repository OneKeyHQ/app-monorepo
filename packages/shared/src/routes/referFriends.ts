import type {
  IBtcRewardHistoryItem,
  IEarnWalletHistoryItem,
  IEarnWalletHistoryNetwork,
  IHardwareRecordItem,
} from '../referralCode/type';

export type IReferralPageTab = 'invite' | 'benefits';

export interface IInviteRewardRouteParams {
  showRewardDistributionHistory?: boolean;
  tab?: IReferralPageTab;
}

export interface IBtcRewardCodeInfoParam {
  codeId: string;
  batchName: string;
  rewardUsd: number;
}

export enum EModalReferFriendsRoutes {
  ReferAFriend = 'ReferAFriend',
  InvitedByFriend = 'InvitedByFriend',
  YourReferred = 'YourReferred',
  InviteCodes = 'InviteCodes',
  YourReferredWalletAddresses = 'YourReferredWalletAddresses',
  HardwareSalesReward = 'HardwareSalesReward',
  HardwareSalesOrderDetail = 'HardwareSalesOrderDetail',
  InviteReward = 'InviteReward',
  EditAddress = 'EditAddress',
  EarnReward = 'EarnReward',
  RewardDistributionHistory = 'RewardDistributionHistory',
  ReferralLevel = 'ReferralLevel',
  RedemptionHistory = 'RedemptionHistory',
  PerpsReward = 'PerpsReward',
  SwapReward = 'SwapReward',
  BtcRewardRecover = 'BtcRewardRecover',
  BtcRewardVerifyVoucher = 'BtcRewardVerifyVoucher',
  BtcRewardSelectAddress = 'BtcRewardSelectAddress',
  BtcRewardConfirm = 'BtcRewardConfirm',
  BtcRewardSuccess = 'BtcRewardSuccess',
  BtcRewardDetail = 'BtcRewardDetail',
}

// Tabs of the Referrals page (InviteCodes route): the codes, then the
// wallets and hardware orders they brought in.
export type IReferralsPageTab = 'codes' | 'wallets' | 'orders';

export type IModalReferFriendsParamList = {
  [EModalReferFriendsRoutes.ReferAFriend]: {
    utmSource?: string;
    code?: string;
  };
  [EModalReferFriendsRoutes.InvitedByFriend]: {
    code: string;
    page?: string;
  };
  [EModalReferFriendsRoutes.YourReferred]: undefined;
  [EModalReferFriendsRoutes.InviteCodes]: {
    // New codes build their link from this template.
    inviteUrl: string;
    tab?: IReferralsPageTab;
  };
  [EModalReferFriendsRoutes.YourReferredWalletAddresses]: {
    networks: IEarnWalletHistoryNetwork[];
    items: IEarnWalletHistoryItem[];
  };
  [EModalReferFriendsRoutes.HardwareSalesReward]:
    | {
        showOrderDetail?: boolean;
        orderId?: string;
      }
    | undefined;
  [EModalReferFriendsRoutes.HardwareSalesOrderDetail]: {
    data: IHardwareRecordItem;
  };
  [EModalReferFriendsRoutes.InviteReward]: IInviteRewardRouteParams | undefined;
  [EModalReferFriendsRoutes.EditAddress]: {
    enabledNetworks: string[];
    accountId: string;
    address?: string;
    hideAddressBook?: boolean;
    enableAllowListValidation?: boolean;
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
  [EModalReferFriendsRoutes.RedemptionHistory]: undefined;
  [EModalReferFriendsRoutes.PerpsReward]: undefined;
  [EModalReferFriendsRoutes.SwapReward]: undefined;
  [EModalReferFriendsRoutes.BtcRewardRecover]: undefined;
  [EModalReferFriendsRoutes.BtcRewardVerifyVoucher]: {
    codeInfo: IBtcRewardCodeInfoParam;
  };
  [EModalReferFriendsRoutes.BtcRewardSelectAddress]: {
    codeInfo: IBtcRewardCodeInfoParam;
    voucherCode: string;
    quotaRemaining?: number;
  };
  [EModalReferFriendsRoutes.BtcRewardConfirm]: {
    codeInfo: IBtcRewardCodeInfoParam;
    voucherCode: string;
    walletAddress: string;
  };
  [EModalReferFriendsRoutes.BtcRewardSuccess]: {
    rewardUsd: number;
    walletAddress: string;
    expectedPayoutAt: string;
  };
  [EModalReferFriendsRoutes.BtcRewardDetail]: {
    item: IBtcRewardHistoryItem;
  };
};
