import type { ITabSubNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabReferFriendsRoutes,
  type ITabReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';

const ReferAFriend = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/ReferAFriend'),
);

const InviteReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/InviteReward'),
);

const YourReferred = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/YourReferred'),
);

const HardwareSalesReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/HardwareSalesReward'),
);

const OneKeyId = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/OneKeyId'),
);

const EditAddress = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/EditAddress'),
);

const EarnReward = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/EarnReward'),
);

const YourReferredWalletAddresses = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/YourReferredWalletAddresses'),
);

const RewardDistributionHistory = LazyLoadPage(
  () => import('../../../views/ReferFriends/pages/RewardDistributionHistory'),
);

export const referFriendsRouters: ITabSubNavigatorConfig<
  ETabReferFriendsRoutes,
  ITabReferFriendsParamList
>[] = [
  {
    name: ETabReferFriendsRoutes.TabReferAFriend,
    rewrite: '/',
    component: ReferAFriend,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabInviteReward,
    rewrite: '/invite-reward',
    component: InviteReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabYourReferred,
    component: YourReferred,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabYourReferredWalletAddresses,
    component: YourReferredWalletAddresses,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabHardwareSalesReward,
    component: HardwareSalesReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabOneKeyId,
    rewrite: '/onekey-id',
    component: OneKeyId,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabEditAddress,
    component: EditAddress,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabEarnReward,
    component: EarnReward,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabReferFriendsRoutes.TabRewardDistributionHistory,
    component: RewardDistributionHistory,
    headerShown: !platformEnv.isNative,
  },
];
