import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

const ReferFriends = LazyLoadPage(() => import('../pages/ReferAFriend'));
const InvitedByFriend = LazyLoadPage(() => import('../pages/InvitedByFriend'));
const YourReferred = LazyLoadPage(() => import('../pages/YourReferred'));
const HardwareSalesReward = LazyLoadPage(
  () => import('../pages/HardwareSalesReward'),
);
const HardwareSalesOrderDetail = LazyLoadPage(
  () => import('../pages/HardwareSalesReward/HardwareSalesOrderDetail'),
);
const InviteReward = LazyLoadPage(() => import('../pages/InviteReward'));
const EditAddress = LazyLoadPage(() => import('../pages/EditAddress'));
const EarnReward = LazyLoadPage(() => import('../pages/EarnReward'));
const YourReferredWalletAddresses = LazyLoadPage(
  () => import('../pages/YourReferredWalletAddresses'),
);
const RewardDistributionHistory = LazyLoadPage(
  () => import('../pages/RewardDistributionHistory'),
);
const ReferralLevel = LazyLoadPage(() => import('../pages/ReferralLevel'));
const RedemptionHistory = LazyLoadPage(
  () => import('../../Redemption/pages/RedemptionHistory'),
);
const PerpsReward = LazyLoadPage(() => import('../pages/PerpsReward'));

const BtcRewardRecover = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/Recover'),
);
const BtcRewardVerifyVoucher = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/VerifyVoucher'),
);
const BtcRewardSelectAddress = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/SelectAddress'),
);
const BtcRewardConfirm = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/ConfirmRedeem'),
);
const BtcRewardSuccess = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/RedeemSuccess'),
);
const BtcRewardDetail = LazyLoadPage(
  () => import('../../Redemption/pages/BtcReward/BtcRewardDetail'),
);

export const ReferFriendsRouter: IModalFlowNavigatorConfig<
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList
>[] = [
  {
    name: EModalReferFriendsRoutes.ReferAFriend,
    component: ReferFriends,
  },
  {
    name: EModalReferFriendsRoutes.InvitedByFriend,
    component: InvitedByFriend,
  },
  {
    name: EModalReferFriendsRoutes.YourReferred,
    component: YourReferred,
  },
  {
    name: EModalReferFriendsRoutes.YourReferredWalletAddresses,
    component: YourReferredWalletAddresses,
  },
  {
    name: EModalReferFriendsRoutes.HardwareSalesReward,
    component: HardwareSalesReward,
  },
  {
    name: EModalReferFriendsRoutes.HardwareSalesOrderDetail,
    component: HardwareSalesOrderDetail,
  },
  {
    name: EModalReferFriendsRoutes.InviteReward,
    component: InviteReward,
  },
  {
    name: EModalReferFriendsRoutes.EditAddress,
    component: EditAddress,
  },
  {
    name: EModalReferFriendsRoutes.EarnReward,
    component: EarnReward,
  },
  {
    name: EModalReferFriendsRoutes.RewardDistributionHistory,
    component: RewardDistributionHistory,
  },
  {
    name: EModalReferFriendsRoutes.ReferralLevel,
    component: ReferralLevel,
  },
  {
    name: EModalReferFriendsRoutes.RedemptionHistory,
    component: RedemptionHistory,
  },
  {
    name: EModalReferFriendsRoutes.PerpsReward,
    component: PerpsReward,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardRecover,
    component: BtcRewardRecover,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardVerifyVoucher,
    component: BtcRewardVerifyVoucher,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardSelectAddress,
    component: BtcRewardSelectAddress,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardConfirm,
    component: BtcRewardConfirm,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardSuccess,
    component: BtcRewardSuccess,
  },
  {
    name: EModalReferFriendsRoutes.BtcRewardDetail,
    component: BtcRewardDetail,
  },
];
