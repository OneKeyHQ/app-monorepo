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

export const ReferFriendsRouter: IModalFlowNavigatorConfig<
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList
>[] = [
  {
    name: EModalReferFriendsRoutes.ReferAFriend,
    rewrite: '/r/invite',
    exact: true,
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
];
